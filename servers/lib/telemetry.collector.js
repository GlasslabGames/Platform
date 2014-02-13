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
var aConst, tConst, rConst;

module.exports = Collector;

function Collector(options){
    try{
        var Assessment, Telemetry, Util, WebStore;

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
            }.bind(this));

        this.cbds.connect()
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
    this.app.post(rConst.api.v1.startsession,       this.startSession.bind(this));
    this.app.post(rConst.api.v1.sendtelemetrybatch, this.sendBatchTelemetryV1.bind(this));
    this.app.post(rConst.api.v2.sendEvents,         this.sendBatchTelemetryV2.bind(this));
    this.app.post(rConst.api.v1.endsession,         this.endSession.bind(this));
}

Collector.prototype.startSession = function(req, outRes){
    try {
        var headers = { cookie: "" };
        var url = "http://localhost:" +this.options.validate.port + tConst.validate.api.session;

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
            var gameType = req.body.gameType;
            var userId   = data.userId;
            var courseId = parseInt(req.body.courseId);
            var collectTelemetry = data.collectTelemetry;
            var gSessionId = null;
            var isVersionValid = false;

            // only if game
            if(req.params.type == tConst.type.game) {
                // validate game version if version is passed exists
                isVersionValid = this._validateGameVersion(gameType, req.body.gameVersion);
            }

            // clean up old game session
            this.myds.cleanUpOldGameSessions(userId, gameType)

                // start session in MySQL (GL_SESSION)
                .then(function () {
                    return this.myds.startGameSession(userId, courseId, gameType);
                }.bind(this))

                // start queue session
                .then(function (gameSessionId) {
                    // save for later
                    gSessionId = gameSessionId;
                    return this.queue.startSession(gameSessionId, userId);
                }.bind(this))

                // start activity session
                .then(function () {
                    return this.webstore.createActivityResults(gSessionId, userId, courseId, gameType);
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
                    outRes.status(500).send(err);
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
                    outRes.status(500).send('Error:'+err);
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


Collector.prototype.endSession = function(req, outRes){
    try {
        // TODO: validate all inputs
        //console.log("req.params:", req.params, ", req.body:", req.body);

        this.stats.increment("info", "Route.EndSession");

        var done = function(jdata) {
            //console.log("endSession jdata:", jdata);
            // forward to webapp server
            if(jdata.gameSessionId) {

                // validate session
                this.queue.validateSession(jdata.gameSessionId)

                    // save events
                    .then(function(sdata){
                        return this._saveBatchV1(jdata.gameSessionId, sdata.userId, jdata)
                    }.bind(this))

                    // all done in parallel
                    .then(function (score){
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
                        // add end session to Q
                        .then( function() {
                            console.log("Collector: endSession gameSessionId:", jdata.gameSessionId, ", score:", score);

                            return this.queue.endSession(jdata.gameSessionId);
                        }.bind(this) );

                        return p;
                    }.bind(this))

                    // all done
                    .then( function() {
                        outRes.status(200).send('{}');
                        this.stats.increment("info", "Route.EndSession.Done");
                        return;
                    }.bind(this) )

                    // catch all errors
                    .then(null, function(err) {
                        console.error("Collector end Session Error:", err);
                        this.stats.increment("error", "Route.EndSession.CatchAll");
                        outRes.status(500).send('Error:'+err);
                    }.bind(this) );

            } else {
                var err = "gameSessionId missing!";
                console.error("Error:", err);
                this.stats.increment("error", "Route.EndSession.GameSessionIdMissing");
                outRes.status(500).send('Error:'+err);
            }
        }.bind(this);

        if(req.params.type == tConst.type.game) {
            var form = new multiparty.Form();
            form.parse(req, function(err, fields) {
                if(err){
                    console.error("Error:", err);
                    this.stats.increment("error", "Route.EndSession.General");
                    outRes.status(500).send('Error:'+err);
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
    }
};
// ---------------------------------------


Collector.prototype._validateGameVersion = function(gameType, gameVersion){
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
    var revision = 0;

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

    if(gameSessionId) {
        // validate session and get data
        promise = this.queue.validateSession(gameSessionId)
            .then(function(sdata){
                if(version == 1) {
                    return this._saveBatchV1(gameSessionId, data, sdata.userId);
                } else {
                    return this._saveBatchV2(gameSessionId, data);
                }
            }.bind(this));
    } else {
        if(version == 1) {
            promise = this._saveBatchV1(gameSessionId, data);
        } else {
            promise = this._saveBatchV2(gameSessionId, data);
        }
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
                res.status(500).send('Error:'+err);
            }.bind(this));
    }
};

Collector.prototype._saveBatchV1 = function(gameSessionId, data, userId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var score = 0;

    //console.log("saveBatch data: ", data);

    // data needs to be an object
    if(_.isObject(data)) {
        if(data.stars) {
            score = data.stars;
        }

        if(data.events) {

            // parse events
            if( _.isString(data.events) ) {
                try {
                    data.events = JSON.parse(data.events);
                } catch(err) {
                    console.error("Collector: Error -", err, ", JSON events:", data.events);
                    this.stats.increment("error", "SaveBatch.JSONParse");
                    reject(err);
                    return;
                }
            }

            // object but not array, it should be an array
            if(  _.isObject(data.events) &&
                !_.isArray(data.events) ) {
                data.events = [data.events];
            }

            // still not array, we have a problem
            if(!_.isArray(data.events))
            {
                reject(new Error("invalid event type"));
                return;
            }

            if(!data.events.length) {
                resolve(score);
                return;
            }

            //console.log("Collector: data", data);
            //console.log("Collector: gameVersion", data.gameVersion);

            // find score if it exists
            var event;
            var events = [];
            for(var i in data.events) {
                event = {
                    timestamp: 0,
                    name: "",
                    clientId: "",
                    tags: {},
                    data: {}
                };

                // get name
                if(data.events[i].name) {
                    event.name = data.events[i].name;
                } else {
                    // skip to next event
                    continue;
                }

                // get timestamp if provided
                if(data.events[i].timestamp) {
                    // if string, convert timestamp to int
                    if( _.isString(data.events[i].timestamp) ) {
                        event.timestamp = parseInt(data.events[i].timestamp);
                    }
                    if( _.isNumber(data.events[i].timestamp) ) {
                        event.timestamp = data.events[i].timestamp;
                    }
                } else {
                    event.timestamp = Math.round(new Date().getTime()/1000.0);
                }

                var vParts = data.gameVersion.split("_");
                event.clientId      = vParts[0];
                event.clientVersion = vParts[1];

                // add data
                if(data.events[i].eventData) {
                    event.data = data.events[i].eventData;
                }

                event.tags.gameSessionId = data.gameSessionId;
                if(userId) {
                    event.tags.userId    = userId;
                }

                // get score
                if( data.events[i].name &&
                    data.events[i].name == tConst.game.scoreKey) {
                    if( data.events[i].eventData &&
                        data.events[i].eventData.stars) {
                        score = data.events[i].eventData.stars;
                    }
                }

                // adds the promise to the list
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

Collector.prototype._saveBatchV2 = function(gameSessionId, data) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        // TODO: move score to separate API
        //console.log("saveBatch data: ", data);

        // data needs to be an object
        if(_.isObject(data)) {
            if(!data.length) {
                resolve();
                return;
            }

            // adds the promise to the list
            this.cbds.saveEvents(data)
                .then(
                    function(){
                        this.stats.increment("info", "SaveBatch.Done");
                        resolve();
                    }.bind(this),
                    function(err){
                        reject(err);
                    }.bind(this)
                );
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