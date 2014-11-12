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

function DataService(options, serviceManager){
    try{
        var Telemetry, WebStore, Errors;

        // Glasslab libs
        aConst     = require('../auth/auth.js').Const;
        // TODO: rename WebStore to DashStore
        WebStore   = require('../dash/dash.js').Datastore.MySQL;
        Util       = require('../core/util.js');
        Telemetry  = require('./data.js');
        Errors     = require('../errors.js');
        tConst     = Telemetry.Const;

        this.options = _.merge(
            {
                DataService: { port: 8081 }
            },
            options
        );

        this.requestUtil = new Util.Request(this.options, Errors);
        this.webstore    = new WebStore(this.options.webapp.datastore.mysql);
        this.myds        = new Telemetry.Datastore.MySQL(this.options.telemetry.datastore.mysql);
        this.cbds        = new Telemetry.Datastore.Couchbase(this.options.telemetry.datastore.couchbase, serviceManager);
        this.stats       = new Util.Stats(this.options, "Data");

        this._serviceManager = serviceManager;

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
            return this.cbds.connect(this.myds);
        }.bind(this))
        .then(function(){
                console.log("DataService: Couchbase DS Connected");
                this.stats.increment("info", "Couchbase.Connect");
            }.bind(this),
            function(err){
                console.trace("DataService: Couchbase DS Error -", err);
                this.stats.increment("error", "Couchbase.Connect");
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
DataService.prototype._validateSendBatch = function(res, data, gameSessionId){
    var promise;

    // get session
    // eventList needs to be an array
    if(!gameSessionId) {
        if( _.isArray(data) && data.length > 0) {
            gameSessionId = data[0].gameSessionId;
        }
        else if( _.isObject(data) && data.hasOwnProperty('gameSessionId')) {
            gameSessionId = data.gameSessionId;
        }
    }

    if(gameSessionId) {
        // validate session and get data
        promise = this.cbds.validateSession(gameSessionId)
            .then(function(sdata){
                return this._saveBatchV2(gameSessionId, sdata.userId, sdata.gameLevel, data);
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
    // default SC
    var gameId = 'SC';

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
        var sessionData = {};
        for(var i = 0; i < eventList.length; i++)
        {
            var data = eventList[i];

            if( !_.isObject(data) ){
                errList.push(new Error("event is not an object"));
                continue; // skip to next item in list
            }

            // userId: String or Integer (Optional)
            // add userId to all events
            if(userId) {
                data.userId = userId;
            }

            // deviceId: String (Optional)
            if( !data.hasOwnProperty("deviceId") ) {
                // no deviceId is ok
            } else {
                if( !_.isString(data.deviceId) ) {
                    errList.push(new Error("deviceId invalid type"));
                    delete data.deviceId;
                }
                else if(data.deviceId.length == 0) {
                    errList.push(new Error("deviceId can not be empty"));
                    delete data.deviceId;
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
            }

            // clientVersion NOT required
            if( !data.hasOwnProperty("clientVersion") ) {
                // no clientVersion is ok
            } else {
                if( !_.isString(data.clientVersion) ) {
                    errList.push(new Error("clientVersion invalid type"));
                    delete data.clientVersion;
                }
                else if(data.clientVersion.length == 0) {
                    errList.push(new Error("clientVersion can not be empty"));
                    delete data.clientVersion;
                }
                // TODO: add validate of clientVersion using DB
                // else if( this._eventValidateClientVersion(data.gameId, data.clientVersion) ){...}
            }

            // gameLevel NOT required
            if( !data.hasOwnProperty("gameLevel") ) {
                // no gameType is ok
            } else {
                if( !_.isString(data.gameLevel) ) {
                    errList.push(new Error("gameLevel invalid type"));
                    delete data.gameLevel;
                }
                else if(data.gameLevel.length == 0) {
                    errList.push(new Error("gameLevel can not be empty"));
                    delete data.gameLevel;
                }
                // TODO: ??? add validation of gameLevel using DB ???
                // else if( this._eventValidateGameLevel(data.gameId, data.gameLevel) ){...}
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
                    //data.eventName = this._convertEventName(data.eventName, data.gameId);
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
                    }
                    catch(err) {
                        errList.push(err);
                        continue; // skip to next item in list
                    }
                }
            }

            // add gameSessionId
            data.gameSessionId = gameSessionId;

            // add server TimeStamp
            data.serverTimeStamp = Util.GetTimeStamp();

            // set gameId for all events
            if(data.gameId) {
                gameId = data.gameId;
            }

            if(gameId == "SC") {
                if(data.eventName == "GL_Scenario_Score") {

                    var completed = false;
                    if( data.eventData.stars &&
                        parseInt(data.eventData.stars) > 0 ) {
                        completed = true;
                    }
                    sessionData = _.merge(sessionData, {
                        score: data.eventData,
                        summary: {
                            completed: completed
                        }
                    });
                }
                else if(data.eventName == "GL_Scenario_Summary") {
                    sessionData = _.merge(sessionData, { summary: data.eventData });
                }
            }

            // added saved data to list
            //console.log("data:", data);
            processedEvents.push(data);
        }

        var p = null;
        if(_.keys(sessionData).length > 0) {
            p = this.cbds.updateGameSessionV2(gameSessionId, sessionData);
            console.log("gameSessionId:", gameSessionId, ", sessionData:", sessionData);
        } else {
            p = Util.PromiseContinue();
        }

        var dash = this._serviceManager.get("dash").service;
        // TODO: replace this with DB lookup, return promise
        dash.isValidGameId(gameId)
            .then(function(state){
                if(!state){
                    errList.push(new Error("invalid gameId"));
                    this.stats.increment("error", "invalid.gameId");
                    reject(errList);
                } else{
                    // update session or skip to saving events
                    p.then(function() {
                            // adds the promise to the list
                            return this.cbds.saveEvents(gameId, processedEvents);
                        }.bind(this))
                        .then(
                            function(){
                                if(errList.length > 0){
                                    // some errors occurred
                                    this.stats.increment("error", "SaveBatch2");
                                    reject(errList);
                                } else {
                                    this.stats.increment("info", "SaveBatch2.Done");

                                    this.addActivity(userId, gameId, gameSessionId)
                                        .then(null, function(err){
                                            console.error("DataService: addActivity Error -", err);
                                        }.bind(this));

                                    resolve();
                                }
                            }.bind(this),
                            function(err){
                                this.stats.increment("error", "SaveBatch2");
                                errList.push(err);
                                reject(errList);
                            }.bind(this)
                        );
                }
            }.bind(this) );

    } else {
        console.error("DataService: Error - invalid data type");
        this.stats.increment("error", "SaveBatch2.Invalid.DataType");
        reject(new Error("invalid data type"));
        return;
    }

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

DataService.prototype.addActivity = function(userId, gameId, gameSessionId) {
    // TODO: move this to core service routing
    var protocal = this.options.assessment.protocal || 'http:';
    var host = this.options.assessment.host || 'localhost';
    var port = this.options.assessment.port || 8003;
    var url = protocal + "//" + host + ":" + port + "/int/v1/aeng/activity";

    return this.requestUtil.request(url,
        {
            userId:  userId,
            gameId:  gameId,
            gameSessionId: gameSessionId
        })
        .then(null, function(err){
            if(err.code == 'ECONNREFUSED') {
                console.error("Can not connect to Assessment Server, check if the server is running");
            }
            return err;
        }.bind(this));
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
};

// throw errors
DataService.prototype._validateEventData = function(eventName, eventData) {
    // TODO: ya.... this should be done at some point, but whom has time?
};

DataService.prototype.getCompletedMissions = function(userId, gameId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    this.cbds.getRawGameSessionsInfoByUserId(gameId, userId)
        .then(function(sessions){

            var completedMissions = [];
            for(var i = 0; i < sessions.length; i++) {
                if( sessions[i].hasOwnProperty("summary") &&
                    sessions[i].summary.completed) {
                    completedMissions.push(sessions[i]);
                }
            }

            //console.log("getGameSessionsInfoByUserId completeMissions:", completeMissions);
            resolve(completedMissions);
        }.bind(this))
        .then(null, function(err){
            reject(err);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};
