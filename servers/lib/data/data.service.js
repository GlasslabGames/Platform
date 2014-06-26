/**
 * Telemetry DataService Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  when       - https://github.com/cujojs/when
 *  express    - https://github.com/visionmedia/express
 *  multiparty - https://github.com/superjoe30/node-multiparty
 *
 */

var http       = require('http');
var when       = require('when');
// Third-party libs
var _          = require('lodash');
// load at runtime
var aConst, tConst, Util;

module.exports = DataService;

function DataService(options){
    try{
        var Assessment, Telemetry, WebStore;

        // Glasslab libs
        Assessment = require('../aeng/assessment.js');
        aConst     = require('../auth/auth.js').Const;
        WebStore   = require('../dash/dash.js').Datastore.MySQL;
        Util       = require('../core/util.js');
        Telemetry  = require('./data.js');
        tConst     = Telemetry.Const;

        this.options = _.merge(
            {
                DataService: { port: 8081 }
            },
            options
        );

        this.requestUtil = new Util.Request(this.options);
        this.webstore    = new WebStore(this.options.webapp.datastore.mysql);
        this.myds        = new Telemetry.Datastore.MySQL(this.options.telemetry.datastore.mysql);
        this.cbds        = new Telemetry.Datastore.Couchbase(this.options.telemetry.datastore.couchbase);
        this.queue       = new Assessment.Queue.Redis(this.options.assessment.queue);
        this.stats       = new Util.Stats(this.options, "Data");

    } catch(err) {
        console.trace("DataService: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

DataService.prototype.start = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    // test connection to MySQL
    this.myds.connect()
        .then(function(){
                console.log("DataService: MySQL DS Connected");
                this.stats.increment("info", "MySQL.Connect");
            }.bind(this),
            function(err){
                console.trace("DataService: MySQL Error -", err);
                this.stats.increment("error", "MySQL.Connect");
            }.bind(this))

        // test connection to Couchbase
        .then(function(){
            return this.cbds.connect();
        }.bind(this))
        .then(function(){
                console.log("DataService: Couchbase DS Connected");
                this.stats.increment("info", "Couchbase.Connect");
            }.bind(this),
            function(err){
                console.trace("DataService: Couchbase DS Error -", err);
                this.stats.increment("error", "Couchbase.Connect");
            }.bind(this))

        // Migrate Old DB Events Done
        .then(function(){
            return this.cbds.migrateEventsFromMysql(this.stats, this.myds, this.options.telemetry.migrateCount);
        }.bind(this))
        .then(function() {
            console.log("DataService: Migrate Old DB Events Done!");
        }.bind(this))

        .then(resolve, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


DataService.prototype._validateGameVersion = function(gameVersion){
    // Grab indices of specific delimeters
    var gameMajorDelimeter     = gameVersion.indexOf( "_" );
    var majorMinorDelimeter    = gameVersion.indexOf( "." );
    var minorRevisionDelimeter = gameVersion.lastIndexOf( "." );

    // If any of these indices are invalid, the version is invalid
    if( gameMajorDelimeter < 0 ||
        majorMinorDelimeter < 0 ||
        minorRevisionDelimeter < 0 ) {
        console.warn( "Game version format was invalid:", gameVersion );
        this.stats.increment("warn", "ValidateGameVersion.Invalid.GameVersion");
        return false;
    }

    // Parse the gameVersion string and grab game, major, minor, and revision
    var game           = gameVersion.substring( 0, gameMajorDelimeter );
    var major          = parseInt(gameVersion.substring( gameMajorDelimeter + 1, majorMinorDelimeter ) );
    var minor          = parseInt(gameVersion.substring( majorMinorDelimeter + 1, minorRevisionDelimeter ) );
    var revisionString = gameVersion.substring( minorRevisionDelimeter + 1 );

    // Check the revision for an appended character (used internally to indicate server)
    // /^[a-z]/i == check if between a to z when lowercase
    if( /^[a-z]/i.test(revisionString.charAt(revisionString.length - 1)) ) {
        //console.info( "Found character in revision:", revisionString );
        revisionString = revisionString.substring( 0, revisionStringlength - 1 );
    }
    revision = parseInt(revisionString);

    console.log( "Game version:", gameVersion,
        ", game:", game,
        ", major:", major,
        ", minor:", minor,
        ", revision:", revision);

    var validGameVersions = tConst.game.versions;
    // Check existence of the game key
    if( !validGameVersions.hasOwnProperty(game) ) {
        console.warn( "Game type " + game + " did not exist as a valid version." );
        this.stats.increment("warn", "ValidateGameVersion.Invalid.GameType");
        return false;
    }

    // Check against the expected major, minor, and revision
    var versionInfo = validGameVersions[game];
    if( major < versionInfo.major ||
        minor < versionInfo.minor ||
        revision < versionInfo.revision ) {
        console.warn( "Game version is invalid and needs to be updated:", gameVersion );
        this.stats.increment("warn", "ValidateGameVersion.Invalid.GameVersion");
        return false;
    }

    // The version is valid, allow play
    return true;
};

// ---------------------------------------
DataService.prototype._validateSendBatch = function(version, res, data, gameSessionId){
    var promise;

    // get session for version 2
    if(version != 1) {
        // eventList needs to be an array
        if(!gameSessionId) {
            if( _.isArray(data) && data.length > 0) {
                gameSessionId = data[0].gameSessionId;
            }
            else if( _.isObject(data) && data.hasOwnProperty('gameSessionId')) {
                gameSessionId = data.gameSessionId;
            }
        }
    }

    if(gameSessionId) {
        // validate session and get data
        promise = this.cbds.validateSession(gameSessionId)
            .then(function(sdata){
                if(version == 1) {
                    return this._saveBatchV1(gameSessionId, sdata.userId, sdata.gameLevel, data);
                } else {
                    return this._saveBatchV2(gameSessionId, sdata.userId, sdata.gameLevel, data);
                }
            }.bind(this));
    } else {
        this.stats.increment("error", "ValidateSendBatch.NoGameSessionId");
        this.requestUtil.errorResponse(res, "GameSessionId missing", 500);
        return;
    }

    if(promise) {
        promise
            // all ok
            .then(function(){
                res.send();
            }.bind(this))

            // catch all errors
            .then(null, function(err){
                console.error("DataService: Error -", err);
                this.stats.increment("error", "ValidateSendBatch");
                this.requestUtil.errorResponse(res, err, 500);
            }.bind(this));
    }
};

var exampleInput = {};
exampleInput.saveBatchV1 = {
    "userId": 12,
    "deviceId": "123",
    "clientTimeStamp": 1392775453,
    "gameId": "SC",
    "clientVersion": "1.2.4156",
    "gameLevel": "Mission2.SubMission1",
    "gameSessionId": "34c8e488-c6b8-49f2-8f06-97f19bf07060",
    "eventName": "CustomEvent",
    "eventData": {
        "float key": 1.23,
        "int key": 1,
        "string key": "asd"
    }
};
DataService.prototype._saveBatchV1 = function(gameSessionId, userId, gameLevel, eventList) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var score = 0;

    //console.log("saveBatch data: ", data);

    // data needs to be an object
    if(_.isObject(eventList)) {
        if(eventList.stars) {
            score = eventList.stars;
        }

        if(eventList.events) {

            // parse events
            if( _.isString(eventList.events) ) {
                try {
                    eventList.events = JSON.parse(eventList.events);
                } catch(err) {
                    console.error("DataService: Error -", err, ", JSON events:", eventList.events);
                    this.stats.increment("error", "SaveBatch.JSONParse");
                    reject(err);
                    return;
                }
            }

            // object but not array, it should be an array
            if(  _.isObject(eventList.events) &&
                !_.isArray(eventList.events) ) {
                eventList.events = [eventList.events];
            }

            // still not array, we have a problem
            if(!_.isArray(eventList.events))
            {
                reject(new Error("invalid event type"));
                return;
            }

            if(!eventList.events.length) {
                resolve(score);
                return;
            }

            //console.log("DataService: data", data);
            //console.log("DataService: gameVersion", data.gameVersion);

            // find score if it exists
            var event;
            var events = [];
            for(var i = 0; i < eventList.events.length; i++) {
                event = {
                    gameId: "",
                    clientVersion: "",
                    serverTimeStamp: 0,
                    clientTimeStamp: 0,
                    eventName: ""
                };

                // get name
                if(eventList.events[i].name) {
                    event.eventName = eventList.events[i].name;
                } else {
                    // skip to next event
                    continue;
                }

                // get timestamp if provided
                if(eventList.events[i].timestamp) {
                    // if string, convert timestamp to int
                    if( _.isString(eventList.events[i].timestamp) ) {
                        event.clientTimeStamp = parseInt(eventList.events[i].timestamp);
                    }
                    if( _.isNumber(eventList.events[i].timestamp) ) {
                        event.clientTimeStamp = eventList.events[i].timestamp;
                    }
                } else {
                    event.clientTimeStamp = Util.GetTimeStamp();
                }

                var gameParts = eventList.gameVersion.split("_");
                var clientVersion;
                var gameId;
                if(gameParts.length > 2) {
                    clientVersion = gameParts.pop();
                    gameId        = gameParts.join("_");
                } else if(gameParts.length == 2) {
                    clientVersion = gameParts[1];
                    gameId        = gameParts[0];
                } else if(gameParts.length == 1) {
                    clientVersion = gameParts[0];
                    gameId        = gameParts[0];
                }
                event.gameId = gameId
                event.clientVersion = clientVersion;

                // add data
                if(eventList.events[i].eventData) {
                    event.eventData = eventList.events[i].eventData;
                }

                if(userId) {
                    event.userId = userId;
                }

                // get score
                if( eventList.events[i].name &&
                    eventList.events[i].name == tConst.game.scoreKey) {
                    if( eventList.events[i].eventData &&
                        eventList.events[i].eventData.stars) {
                        score = eventList.events[i].eventData.stars;
                    }
                }

                event.gameSessionId = gameSessionId;
                event.serverTimeStamp = Util.GetTimeStamp();

                // adds the promise to the list
                //console.log("event:", event);
                events.push(event);
            }

            this.cbds.saveEvents(events)
                .then(
                    function(){
                        this.stats.increment("info", "SaveBatch.Done");
                        resolve(score);
                    }.bind(this),
                    function(err){
                        reject(err);
                    }.bind(this)
                );

        } else {
            // no events
            this.stats.increment("info", "SaveBatch.Done");
            resolve(score);
            return;
        }
    } else {
        console.error("DataService: Error - invalid data type");
        this.stats.increment("error", "SaveBatch.Invalid.DataType");
        reject(new Error("invalid data type"));
        return;
    }

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}

/*
 example inputs:
 [
     {
         "userId": 12,
         "deviceId": "123",
         "clientTimeStamp": 1392775453,
         "gameId": "SC-1",
         "clientVersion": "1.2.4156",
         "gameLevel": "397255e0-fee0-11e2-ab09-1f14110c1a8d",
         "gameSessionId": "34c8e488-c6b8-49f2-8f06-97f19bf07060",
         "eventName": "$ScenarioScore",
         "eventData": {
             "float key": 1.23,
             "int key": 1,
             "string key": "asd"
         }
     },
     {
         "clientTimeStamp": 1392775453,
         "gameId": "SC-1",
         "clientVersion": "1.2.4156",
         "gameLevel": "Mission2.SubMission1",
         "gameSessionId": "34c8e488-c6b8-49f2-8f06-97f19bf07060",
         "eventName": "CustomEvent",
         "eventData": {
             "float key": 1.23,
             "int key": 1,
             "string key": "asd"
         }
     }
 ]
 */
/*
 Required properties
 clientTimeStamp, gameId, eventName

 Input Types accepted
 gameSessionId: String
 eventList : (Array or Object)
     userId: String or Integer (Optional)
     deviceId: String          (Optional)
     clientTimeStamp: Integer  (Required)
     gameId: String          (Required)
     clientVersion: String     (Optional)
     gameLevel: String         (Optional)
     eventName: String         (Required)
     eventData: Object         (Optional)
 */
DataService.prototype._saveBatchV2 = function(gameSessionId, userId, gameLevel, eventList) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        // verify all required values are set

        // eventList is object but not array
        if(  _.isObject(eventList) &&
            !_.isArray(eventList)) {
            // convert to array
            eventList = [eventList];
        }

        // eventList needs to be an array
        if(_.isArray(eventList)) {
            // empty list, just return
            if(!eventList.length) {
                resolve();
                return;
            }

            var processedEvents = [];
            var errList = [];
            for(var i = 0; i < eventList.length; i++)
            {
                var data = eventList[i];
                var pData = {};

                if( !_.isObject(data) ){
                    errList.push(new Error("event is not an object"));
                    continue; // skip to next item in list
                }

                // userId: String or Integer (Optional)
                // add userId to all events
                if(userId) {
                    pData.userId = userId;
                }

                // deviceId: String (Optional)
                if( !data.hasOwnProperty("deviceId") ) {
                    // no deviceId is ok
                } else {
                    if( !_.isString(data.deviceId) ) {
                        errList.push(new Error("deviceId invalid type"));
                    }
                    else if(data.deviceId.length == 0) {
                        errList.push(new Error("deviceId can not be empty"));
                    }
                    else {
                        // save
                        pData.deviceId = data.deviceId;
                    }
                }

                // clientTimeStamp: Integer (Required)
                if( !data.hasOwnProperty("clientTimeStamp") ) {
                    errList.push(new Error("clientTimeStamp missing"));
                    continue; // skip to next item in list
                } else {
                    if( !_.isNumber(data.clientTimeStamp) ) {
                        errList.push(new Error("clientTimeStamp invalid type"));
                        continue; // skip to next item in list
                    }

                    // save
                    pData.clientTimeStamp = data.clientTimeStamp;
                }

                // gameId required
                if( !data.hasOwnProperty("gameId") ) {
                    errList.push(new Error("gameId missing"));
                    continue; // skip to next item in list
                } else {
                    if( !_.isString(data.gameId) ) {
                        errList.push(new Error("gameId invalid type"));
                        continue; // skip to next item in list
                    }
                    else if(data.gameId.length == 0) {
                        errList.push(new Error("gameId can not be empty"));
                        continue; // skip to next item in list
                    }
                    // TODO: add validate of gameId using DB
                    // else if( this._eventValidateGameId(data.gameId) ){...}
                    else {
                        // save
                        pData.gameId = data.gameId;
                    }
                }

                // clientVersion NOT required
                if( !data.hasOwnProperty("clientVersion") ) {
                    // no clientVersion is ok
                } else {
                    if( !_.isString(data.clientVersion) ) {
                        errList.push(new Error("clientVersion invalid type"));
                    }
                    else if(data.clientVersion.length == 0) {
                        errList.push(new Error("clientVersion can not be empty"));
                    }
                    // TODO: add validate of clientVersion using DB
                    // else if( this._eventValidateClientVersion(data.gameId, data.clientVersion) ){...}
                    else {
                        // save
                        pData.clientVersion = data.clientVersion;
                    }
                }

                // gameLevel NOT required
                if( !data.hasOwnProperty("gameLevel") ) {
                    // no gameType is ok
                } else {
                    if( !_.isString(data.gameLevel) ) {
                        errList.push(new Error("gameLevel invalid type"));
                    }
                    else if(data.gameLevel.length == 0) {
                        errList.push(new Error("gameLevel can not be empty"));
                    }
                    // TODO: ??? add validation of gameLevel using DB ???
                    // else if( this._eventValidateGameLevel(data.gameId, data.gameLevel) ){...}
                    else {
                        // save
                        pData.gameType = data.gameType;
                    }
                }

                // eventName required
                if( !data.hasOwnProperty("eventName") ) {
                    errList.push(new Error("eventName missing"));
                    continue; // skip to next item in list
                } else {
                    if( !_.isString(data.eventName) ) {
                        errList.push(new Error("eventName invalid type"));
                        continue; // skip to next item in list
                    }
                    else if(data.eventName.length == 0) {
                        errList.push(new Error("name can not be empty"));
                        continue; // skip to next item in list
                    }
                    // try parse/analyze name
                    try {
                        // convert + save
                        // TODO: use convertEventName
                        //pData.eventName = this._convertEventName(data.eventName, data.gameId);
                        pData.eventName = data.eventName;
                    }
                    catch(err) {
                        errList.push(err);
                        continue; // skip to next item in list
                    }
                }

                // eventData NOT required
                if( !data.hasOwnProperty("eventData") ) {
                    // no eventData is ok
                } else {
                    if( !_.isObject(data.eventData) ) {
                        errList.push(new Error("invalid eventData type, should be an object"));
                        eventErr = true;
                    } else {
                        try {
                            // TODO: validate eventData based on eventName
                            this._validateEventData(data.eventName, data.eventData);
                            // save
                            pData.eventData = data.eventData;
                        }
                        catch(err) {
                            errList.push(err);
                            continue; // skip to next item in list
                        }
                    }
                }

                // add gameSessionId
                pData.gameSessionId = gameSessionId;

                // add server TimeStamp
                pData.serverTimeStamp = Util.GetTimeStamp();

                // added saved data to list
                //console.log("pData:", pData);
                processedEvents.push(pData);
            }

            // adds the promise to the list
            this.cbds.saveEvents(processedEvents)
                .then(
                    function(){
                        if(errList.length > 0){
                            // some errors occurred
                            this.stats.increment("error", "SaveBatch2");
                            reject(errList);
                        } else {
                            this.stats.increment("info", "SaveBatch2.Done");
                            resolve();
                        }
                    }.bind(this),
                    function(err){
                        this.stats.increment("error", "SaveBatch2");
                        errList.push(err);
                        reject(errList);
                    }.bind(this)
                );
        } else {
            console.error("DataService: Error - invalid data type");
            this.stats.increment("error", "SaveBatch2.Invalid.DataType");
            reject(new Error("invalid data type"));
            return;
        }

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
}

// throw errors
DataService.prototype._convertEventName = function(rawName, gameId) {
    if(rawName.charAt(0) == '$'){
        var tName = rawName.slice(1);

        var glEventsPrefix = "GL";
        var map = {
            "SessionStart" : "Session_Start",
            "ScenarioScore": "Scenario_Score"
        };

        if(map.hasOwnProperty(tName)){
            return glEventsPrefix+"_"+map[tName];
        } else {
            throw new Error("invalid event name");
        }
    }
    // custom name, add gameId
    else {
        return gameId + "_" + rawName;
    }
}

// throw errors
DataService.prototype._validateEventData = function(eventName, eventData) {

}
