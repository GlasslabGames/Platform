/**
 * Telemetry Collector Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  when       - https://github.com/cujojs/when
 *  express    - https://github.com/visionmedia/express
 *  multiparty - https://github.com/superjoe30/node-multiparty
 *
 */

var http       = require('http');
// Third-party libs
var _          = require('lodash');
var when       = require('when');
var parallel   = require('when/parallel');
var express    = require('express');
var multiparty = require('multiparty');
// load at runtime
var aConst, tConst, rConst, Util;

module.exports = Collector;

function Collector(options){
    try{
        var Assessment, Telemetry, WebStore;

        // Glasslab libs
        Telemetry  = require('./telemetry.js');
        Assessment = require('./assessment.js');
        aConst     = require('./auth.js').Const;
        rConst     = require('./routes.js').Const;
        WebStore   = require('./webapp.js').Datastore.MySQL;
        Util       = require('./util.js');
        tConst     = Telemetry.Const;

        this.options = _.merge(
            {
                collector: { port: 8081 }
            },
            options
        );

        this.requestUtil = new Util.Request(this.options);
        this.webstore    = new WebStore(this.options.webapp.datastore.mysql);
        this.myds        = new Telemetry.Datastore.MySQL(this.options.telemetry.datastore.mysql);
        this.cbds        = new Telemetry.Datastore.Couchbase(this.options.telemetry.datastore.couchbase);
        this.queue       = new Assessment.Queue.Redis(this.options.assessment.queue);
        this.stats       = new Util.Stats(this.options, "Telemetry.Collector");

        this.myds.connect()
            .then(function(){
                console.log("Collector: MySQL DS Connected");
                this.stats.increment("info", "MySQL.Connect");
            }.bind(this),
                function(err){
                    console.trace("Collector: MySQL Error -", err);
                    this.stats.increment("error", "MySQL.Connect");
                }.bind(this))
            .then(function(){
                return this.cbds.connect();
            }.bind(this))
            .then(function(){
                console.log("Collector: Couchbase DS Connected");
                this.stats.increment("info", "Couchbase.Connect");
            }.bind(this),
                function(err){
                    console.trace("Collector: Couchbase DS Error -", err);
                    this.stats.increment("error", "Couchbase.Connect");
                }.bind(this));

        this.app = express();
        this.app.set('port', this.options.collector.port);

        this.app.use(Util.GetExpressLogger(this.options, express, this.stats));
        this.app.use(express.urlencoded());
        this.app.use(express.json());
        // If you want to use app.delete and app.put instead of using app.post
        // this.app.use(express.methodOverride());
        this.app.use(express.errorHandler({showStack: true, dumpExceptions: true}));

        this.setupRoutes();

        // start server
        http.createServer(this.app).listen(this.app.get('port'), function(){
            console.log('---------------------------------------------');
            console.log('Collector: Server listening on port ' + this.app.get('port'));
            console.log('---------------------------------------------');
            this.stats.increment("info", "ServerStarted");
        }.bind(this));

    } catch(err){
        console.trace("Collector: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

// ---------------------------------------
// HTTP Server request functions
Collector.prototype.setupRoutes = function() {
    // API v1
    this.app.post(rConst.api.v1.sessionStart,       this.startSessionV1.bind(this));
    this.app.post(rConst.api.v1.sessionEnd,         this.endSessionV1.bind(this));
    this.app.post(rConst.api.v1.sendEvents,         this.sendBatchTelemetryV1.bind(this));

    // API v2
    this.app.post(rConst.api.v2.sessionStart,       this.startSessionV2.bind(this));
    this.app.post(rConst.api.v2.sessionEnd,         this.endSessionV2.bind(this));
    this.app.post(rConst.api.v2.sendEvents,         this.sendBatchTelemetryV2.bind(this));
}

// ---------------------------------------
// API V1
// ---------------------------------------
Collector.prototype.startSessionV1 = function(req, outRes){
    try {
        var headers = { cookie: "" };
        var url = Util.BuildURI(this.options.validate, tConst.validate.api.session);

        // TODO: validate all inputs
        //console.log("headers cookie:", req.headers.cookie);

        if(req.params.type == tConst.type.game) {
            url += "/"+req.body.userSessionId;
            delete req.body.userSessionId;
        } else {
            headers.cookie = req.headers.cookie;
        }

        this.stats.increment("info", "Route.StartSession");

        //console.log("req:", req);
        //console.log("headers:", headers);
        //console.log("getSession url:", url);
        // validate session
        this.requestUtil.getRequest(url, headers, function(err, res, data){
            if(err) {
                console.log("Collector startSession Error:", err);
                this.stats.increment("error", "StartSession.GetRequest");
                return;
            }

            //console.log("statusCode:", res.statusCode, ", headers:",  res.headers);
            //console.log("data:", data);
            try {
                data = JSON.parse(data);
            } catch(err) {
                console.log("Collector startSession JSON parse Error:", err);
                this.stats.increment("error", "StartSession.JSONParse");
                return;
            }

            //console.log("req.params:", req.params, ", req.body:", req.body);
            var gameLevel        = req.body.gameType;
            var userId           = data.userId;
            var courseId         = parseInt(req.body.courseId);
            var collectTelemetry = data.collectTelemetry;
            var gSessionId       = null;
            var isVersionValid   = false;

            // only if game
            if(req.params.type == tConst.type.game) {
                // validate game version if version is passed exists
                isVersionValid = this._validateGameVersion(req.body.gameVersion);
            }

            // clean up old game session
            this.myds.cleanUpOldGameSessions(userId, gameLevel)

                // start session in MySQL (GL_SESSION)
                .then(function () {
                    return this.myds.startGameSession(userId, courseId, gameLevel);
                }.bind(this))

                // start queue session
                .then(function (gameSessionId) {
                    // save for later
                    gSessionId = gameSessionId;
                    return this.cbds.startGameSession(userId, courseId, gameLevel, gameSessionId);
                }.bind(this))

                // start activity session
                .then(function () {
                    return this.webstore.createActivityResults(gSessionId, userId, courseId, gameLevel);
                }.bind(this))

                // get config settings
                .then(function () {
                    return this.webstore.getConfigs();
                }.bind(this))

                // all ok, done
                .then(function (configs) {
                    // override details if user collectTelemetry is set
                    if (collectTelemetry) {
                        configs.eventsDetailLevel = 10;
                    }

                    var outData = {
                        versionValid:      isVersionValid,
                        gameSessionId:     gSessionId,
                        eventsMaxSize:     configs.eventsMaxSize,
                        eventsMinSize:     configs.eventsMinSize,
                        eventsPeriodSecs:  configs.eventsPeriodSecs,
                        eventsDetailLevel: configs.eventsDetailLevel
                    };

                    //console.log("configs:", configs);
                    this.requestUtil.jsonResponse(outRes, outData);
                    this.stats.increment("info", "StartSession.Done");
                }.bind(this) )

                // catch all errors
                .then(null,  function(err) {
                    console.error("Collector end Session Error:", err);
                    this.stats.increment("error", "StartSession.General");
                    this.requestUtil.errorResponse(outRes, err, 500);
                }.bind(this) );

        }.bind(this) );

    } catch(err) {
        console.trace("Collector: Start Session Error -", err);
        this.stats.increment("error", "StartSession.Catch");
    }
};

Collector.prototype.sendBatchTelemetryV1 = function(req, outRes){
    try {
        // TODO: validate all inputs

        this.stats.increment("info", "Route.SendBatchTelemetry");

        if(req.params.type == tConst.type.game) {
            var form = new multiparty.Form();
            form.parse(req, function(err, fields) {
                if(err){
                    console.error("Collector: Error -", err);
                    this.stats.increment("error", "SendBatchTelemetry.General");
                    this.requestUtil.errorResponse(outRes, err, 500);
                    return;
                }

                if(fields){
                    if(fields.events)        fields.events        = fields.events[0];
                    if(fields.gameSessionId) fields.gameSessionId = fields.gameSessionId[0];
                    if(fields.gameVersion)   fields.gameVersion   = fields.gameVersion[0];

                    //console.log("fields:", fields);
                    this._validateSendBatch(1, outRes, fields, fields.gameSessionId);
                } else {
                    outRes.send();
                }
            }.bind(this));
        } else {
            //console.log("send telemetry batch body:", req.body);
            // Queue Data
            this._validateSendBatch(1, outRes, req.body, req.body.gameSessionId);
        }
    } catch(err) {
        console.trace("Collector: Send Telemetry Batch Error -", err);
        this.stats.increment("error", "SendBatchTelemetry.Catch");
    }
};

Collector.prototype.endSessionV1 = function(req, outRes){
    try {
        // TODO: validate all inputs
        //console.log("req.params:", req.params, ", req.body:", req.body);

        this.stats.increment("info", "Route.EndSession");

        var done = function(jdata) {
            //console.log("endSession jdata:", jdata);
            // forward to webapp server
            if(jdata.gameSessionId) {

                // validate session
                this.cbds.validateSession(jdata.gameSessionId)

                    // save events
                    .then(function(sdata) {
                        return this._saveBatchV1(jdata.gameSessionId, sdata.userId, sdata.gameLevel, jdata)
                    }.bind(this))

                    // all done in parallel
                    .then(function (score) {
                        var p = parallel([
                            // create challenge submission if challenge exists
                            function() {
                                this.webstore.createChallengeSubmission(jdata)
                            }.bind(this),
                            // end game session
                            function() {
                                return this.myds.endGameSession(jdata.gameSessionId);
                            }.bind(this),
                            // end activity session
                            function() {
                                return this.webstore.updateActivityResults(jdata.gameSessionId, score, jdata.cancelled);
                            }.bind(this)
                        ])
                            // when all done
                            // add end session in Datastore
                            .then( function() {
                                //console.log("Collector: endSession gameSessionId:", jdata.gameSessionId, ", score:", score);
                                return this.cbds.endGameSession(jdata.gameSessionId);
                            }.bind(this) )
                            // push job on queue
                            .then( function() {
                                //console.log("Collector: pushJob gameSessionId:", jdata.gameSessionId, ", score:", score);
                                return this.queue.pushJob(jdata.gameSessionId);
                            }.bind(this) );

                        return p;
                    }.bind(this))

                    // all done
                    .then( function() {
                        this.requestUtil.jsonResponse(outRes, {});
                        this.stats.increment("info", "Route.EndSession.Done");
                        return;
                    }.bind(this) )

                    // catch all errors
                    .then(null, function(err) {
                        console.error("Collector end Session Error:", err);
                        this.stats.increment("error", "Route.EndSession.CatchAll");
                        this.requestUtil.errorResponse(outRes, err, 500);
                    }.bind(this) );

            } else {
                var err = "gameSessionId missing!";
                console.error("Error:", err);
                this.stats.increment("error", "Route.EndSession.GameSessionIdMissing");
                this.requestUtil.errorResponse(outRes, err, 500);
            }
        }.bind(this);

        if(req.params.type == tConst.type.game) {
            var form = new multiparty.Form();
            form.parse(req, function(err, fields) {
                if(err){
                    console.error("Error:", err);
                    this.stats.increment("error", "Route.EndSession.General");
                    this.requestUtil.errorResponse(outRes, err, 500);
                    return;
                }

                if(fields){
                    if(fields.events)        fields.events        = fields.events[0];
                    if(fields.gameSessionId) fields.gameSessionId = fields.gameSessionId[0];
                    if(fields.gameVersion)   fields.gameVersion   = fields.gameVersion[0];

                    //console.log("fields:", fields);
                    done(fields);
                }
            });
        } else {
            //console.log("end session body:", req.body);
            done(req.body);
        }
    } catch(err) {
        console.trace("Collector: End Session Error -", err);
        this.stats.increment("error", "Route.EndSession.Catch");
        this.requestUtil.errorResponse(outRes, "End Session Error", 500);
    }
};
// ---------------------------------------


// ---------------------------------------
// API V2
// ---------------------------------------
var exampleInput = {};
exampleInput.startSessionV2 = {
    deviceId:  "123-ASD",
    gameLevel: "Level1",
    courseId:  12
}
Collector.prototype.startSessionV2 = function(req, outRes){
    try {
        var headers = { cookie: "" };
        var url = Util.BuildURI(this.options.validate, tConst.validate.api.session);

        // TODO: validate all inputs
        //console.log("headers cookie:", req.headers.cookie);

        headers.cookie = req.headers.cookie;
        this.stats.increment("info", "Route.StartSessionV2");

        if(!req.body.deviceId) {
            this.stats.increment("error", "StartSession.DeviceId.Missing");
            this.requestUtil.errorResponse(outRes, "DeviceId Missing", 404);
            return;
        }

        //console.log("req:", req);
        //console.log("headers:", headers);
        //console.log("getSession url:", url);
        // validate session
        this.requestUtil.getRequest(url, headers, function(err, res, data){
            if(err) {
                console.log("Collector startSession Error:", err);
                this.stats.increment("error", "StartSession.GetRequest");
                return;
            }

            //console.log("statusCode:", res.statusCode, ", headers:",  res.headers);
            //console.log("data:", data);
            try {
                data = JSON.parse(data);
            } catch(err) {
                console.log("Collector startSession JSON parse Error:", err);
                this.stats.increment("error", "StartSession.JSONParse");
                return;
            }

            //console.log("req.params:", req.params, ", req.body:", req.body);
            // required
            var deviceId         = req.body.deviceId;
            // Optional
            var userId           = data.userId;
            var courseId         = parseInt(req.body.courseId);
            var gameLevel        = req.body.gameLevel;
            var gSessionId       = undefined;

            // clean up old game session
            this.cbds.cleanUpOldGameSessionsV2(deviceId)

                // start queue session
                .then(function () {
                    return this.cbds.startGameSessionV2(deviceId, userId, courseId, gameLevel);
                }.bind(this))

                // get config settings
                .then(function (gameSessionId) {
                    gSessionId = gameSessionId;
                    return this.webstore.getConfigs();
                }.bind(this))

                // all ok, done
                .then(function (configs) {
                    var outData = {
                        gameSessionId:     gSessionId,
                        eventsMaxSize:     configs.eventsMaxSize,
                        eventsMinSize:     configs.eventsMinSize,
                        eventsPeriodSecs:  configs.eventsPeriodSecs,
                        eventsDetailLevel: configs.eventsDetailLevel
                    };

                    //console.log("configs:", configs);
                    this.requestUtil.jsonResponse(outRes, outData);
                    this.stats.increment("info", "StartSession.Done");
                }.bind(this) )

                // catch all errors
                .then(null,  function(err) {
                    console.error("Collector Start Session Error:", err);
                    this.stats.increment("error", "StartSession.General");
                    this.requestUtil.errorResponse(outRes, err, 500);
                }.bind(this) );

        }.bind(this) );

    } catch(err) {
        console.trace("Collector: Start Session Error -", err);
        this.stats.increment("error", "StartSession.Catch");
    }
};


Collector.prototype.sendBatchTelemetryV2 = function(req, outRes){
    try {
        // TODO: validate all inputs

        this.stats.increment("info", "Route.SendBatchTelemetry2");

        //console.log("send telemetry batch body:", req.body);
        // Queue Data
        this._validateSendBatch(2, outRes, req.body);
    } catch(err) {
        console.trace("Collector: Send Telemetry Batch Error -", err);
        this.stats.increment("error", "SendBatchTelemetry.Catch");
    }
};

exampleInput.endSessionV2 = {
    gameSessionId:  "ASD-123-QWER"
}
Collector.prototype.endSessionV2 = function(req, outRes){
    try {
        // TODO: validate all inputs
        //console.log("req.params:", req.params, ", req.body:", req.body);

        this.stats.increment("info", "Route.EndSession");
        var gSessionId = undefined;

        //console.log("endSession jdata:", jdata);
        // forward to webapp server
        if(req.body.gameSessionId) {
            gSessionId = req.body.gameSessionId;

            // validate session
            this.cbds.validateSession(gSessionId)

                // all done in parallel
                .then(function () {
                    // when all done
                    // add end session in Datastore
                    return this.cbds.endGameSessionV2(gSessionId)
                        // push job on queue
                        .then( function() {
                            //console.log("Collector: pushJob gameSessionId:", jdata.gameSessionId, ", score:", score);
                            return this.queue.pushJob(gSessionId);
                        }.bind(this) );
                }.bind(this))

                // all done
                .then( function() {
                    this.requestUtil.jsonResponse(outRes, {});
                    this.stats.increment("info", "Route.EndSession.Done");
                    return;
                }.bind(this) )

                // catch all errors
                .then(null, function(err) {
                    console.error("Collector End Session Error:", err);
                    this.stats.increment("error", "Route.EndSession.CatchAll");
                    this.requestUtil.errorResponse(outRes, err, 500);
                }.bind(this) );

        } else {
            var err = "gameSessionId missing!";
            console.error("Error:", err);
            this.stats.increment("error", "Route.EndSession.GameSessionIdMissing");
            this.requestUtil.errorResponse(outRes, err, 500);
        }

    } catch(err) {
        console.trace("Collector: End Session Error -", err);
        this.stats.increment("error", "Route.EndSession.Catch");
        this.requestUtil.errorResponse(outRes, "End Session Error", 500);
    }
};
// ---------------------------------------


Collector.prototype._validateGameVersion = function(gameVersion){
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
Collector.prototype._validateSendBatch = function(version, res, data, gameSessionId){
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
                console.error("Collector: Error -", err);
                this.stats.increment("error", "ValidateSendBatch");
                this.requestUtil.errorResponse(res, err, 500);
            }.bind(this));
    }
};

exampleInput.saveBatchV1 = {
    "userId": 12,
    "deviceId": "123",
    "clientTimeStamp": 1392775453,
    "clientId": "SC",
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
Collector.prototype._saveBatchV1 = function(gameSessionId, userId, gameLevel, eventList) {
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
                        console.error("Collector: Error -", err, ", JSON events:", eventList.events);
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

                //console.log("Collector: data", data);
                //console.log("Collector: gameVersion", data.gameVersion);

                // find score if it exists
                var event;
                var events = [];
                for(var i = 0; i < eventList.events.length; i++) {
                    event = {
                        clientId: "",
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
                    var clientId;
                    if(gameParts.length > 2) {
                        clientVersion = gameParts.pop();
                        clientId      = gameParts.join("_");
                    } else if(gameParts.length == 2) {
                        clientVersion = gameParts[1];
                        clientId      = gameParts[0];
                    } else if(gameParts.length == 1) {
                        clientVersion = gameParts[0];
                        clientId      = gameParts[0];
                    }
                    event.clientId = clientId
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
            console.error("Collector: Error - invalid data type");
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
         "clientId": "SC-1",
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
         "clientId": "SC-1",
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
 clientTimeStamp, clientId, eventName

 Input Types accepted
 gameSessionId: String
 eventList : (Array or Object)
     userId: String or Integer (Optional)
     deviceId: String          (Optional)
     clientTimeStamp: Integer  (Required)
     clientId: String          (Required)
     clientVersion: String     (Optional)
     gameLevel: String         (Optional)
     eventName: String         (Required)
     eventData: Object         (Optional)
 */
Collector.prototype._saveBatchV2 = function(gameSessionId, userId, gameLevel, eventList) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        // verify all required values are set

        // eventList is object but not array
        if( _.isObject(eventList) &&
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
                if( !data.hasOwnProperty("userId") ) {
                    // no userId is ok
                } else {
                    if( !(_.isString(data.userId) || _.isNumber(data.userId)) ) {
                        errList.push(new Error("userId invalid type"));
                    }
                    else if(_.isString(data.userId) && data.userId.length == 0) {
                        errList.push(new Error("userId can not be empty"));
                    }
                    // TODO: add validate of userId using DB
                    // else if( this._eventValidateUserId(data.userId) ){...}
                    else {
                        // save
                        pData.userId = data.userId;
                    }
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

                // clientId required
                if( !data.hasOwnProperty("clientId") ) {
                    errList.push(new Error("clientId missing"));
                    continue; // skip to next item in list
                } else {
                    if( !_.isString(data.clientId) ) {
                        errList.push(new Error("clientId invalid type"));
                        continue; // skip to next item in list
                    }
                    else if(data.clientId.length == 0) {
                        errList.push(new Error("clientId can not be empty"));
                        continue; // skip to next item in list
                    }
                    // TODO: add validate of clientId using DB
                    // else if( this._eventValidateClientId(data.clientId) ){...}
                    else {
                        // save
                        pData.clientId = data.clientId;
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
                    // else if( this._eventValidateClientVersion(data.clientId, data.clientVersion) ){...}
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
                    // else if( this._eventValidateGameLevel(data.clientId, data.gameLevel) ){...}
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
                        pData.eventName = this._convertEventName(data.eventName, data.clientId);
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
            console.error("Collector: Error - invalid data type");
            this.stats.increment("error", "SaveBatch2.Invalid.DataType");
            reject(new Error("invalid data type"));
            return;
        }

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
}

// throw errors
Collector.prototype._convertEventName = function(rawName, clientId) {
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
    // custom name, add clientId
    else {
        return clientId + "_" + rawName;
    }
}

// throw errors
Collector.prototype._validateEventData = function(eventName, eventData) {

}
