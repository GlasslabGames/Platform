/**
 * Telemetry Collector Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  when       - https://github.com/cujojs/when
 *  express    - https://github.com/visionmedia/express
 *  multiparty - https://github.com/superjoe30/node-multiparty
 *  redis      - https://github.com/mranney/node_redis
 *
 */

var http       = require('http');
// Third-party libs
var _          = require('lodash');
var when       = require('when');
var parallel   = require('when/parallel');
var express    = require('express');
var multiparty = require('multiparty');
var redis      = require('redis');
// load at runtime
var RequestUtil, aConst, tConst, rConst;
var myDS, cbDS;

module.exports = Collector;

function Collector(options){
    try{
        // Glasslab libs
        RequestUtil = require('./util.js').Request;
        aConst      = require('./auth.js').Const;
        tConst      = require('./telemetry.js').Const;
        rConst      = require('./routes.js').Const;
        myDS        = require('./telemetry.js').Datastore.MySQL;
        //cbDS        = require('./telemetry.js').Datastore.Couchbase;
        WebStore    = require('./webapp.js').Datastore.MySQL;

        this.options = _.merge(
            {
                queue:     { port: null, host: null, db:0 },
                collector: { port: 8081 }
            },
            options
        );

        this.requestUtil = new RequestUtil(this.options);
        this.webstore    = new WebStore(this.options.webapp.datastore.mysql);
        this.myds        = new myDS(this.options.telemetry.datastore.mysql);
        //this.cbds        = new cbDS(this.options.telemetry.datastore.couchbase);

        this.app   = express();
        this.queue = redis.createClient(this.options.queue.port, this.options.queue.host, this.options.queue);
        if(this.options.queue.db) {
            this.queue.select(this.options.queue.db);
        }

        this.app.set('port', this.options.collector.port);
        this.app.use(express.logger());
        this.app.use(express.urlencoded());
        this.app.use(express.json());
        // If you want to use app.delete and app.put instead of using app.post
        // this.app.use(express.methodOverride());
        this.app.use(express.errorHandler({showStack: true, dumpExceptions: true}));

        this.setupRoutes();

        // start server
        http.createServer(this.app).listen(this.app.get('port'), function(){
            console.log('Collector: Server listening on port ' + this.app.get('port'));
        }.bind(this));

    } catch(err){
        console.trace("Collector: Error -", err);
    }
}

// ---------------------------------------
// HTTP Server request functions
Collector.prototype.setupRoutes = function() {
    this.app.post(rConst.api.startsession,       this.startSession.bind(this));
    this.app.post(rConst.api.sendtelemetrybatch, this.sendBatchTelemetry.bind(this));
    this.app.post(rConst.api.endsession,         this.endSession.bind(this));
}

Collector.prototype.startSession = function(req, outRes){
    try {
        var headers = { cookie: "" };
        var url = "http://localhost:" +this.options.validate.port + tConst.validate.api.session;

        if(req.params.type == tConst.type.game) {
            url += "/"+req.body.userSessionId;
            delete req.body.userSessionId;
        } else {
            headers.cookie = req.headers.cookie;
        }

        //console.log("req:", req);
        //console.log("headers:", headers);
        //console.log("getSession url:", url);
        // validate session
        this.requestUtil.getRequest(url, headers, req, function(err, res, data){
            if(err) {
                console.log("Collector startSession Error:", err);
                return;
            }

            //console.log("statusCode:", res.statusCode, ", headers:",  res.headers);
            //console.log("data:", data);
            try {
                data = JSON.parse(data);
            } catch(err) {
                console.log("Collector startSession JSON parse Error:", err);
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
                var isVersionValid = this.validateGameVersion(gameType, req.body.gameVersion);
            }

            // clean up old game session
            this.myds.cleanUpOldGameSessions(userId, gameType)
                // start session
                .then(function () {
                    return this.myds.startGameSession(userId, courseId, gameType);
                }.bind(this))
                // start queue session
                .then(function (gameSessionId) {
                    // save for later
                    gSessionId = gameSessionId;
                    this.qStartSession(gameSessionId, userId)
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
                        gameSession:       gSessionId,
                        eventsMaxSize:     configs.eventsMaxSize,
                        eventsMinSize:     configs.eventsMinSize,
                        eventsPeriodSes:   configs.eventsPeriodSecs,
                        eventsDetailLevel: configs.eventsDetailLevel
                    };

                    //console.log("configs:", configs);
                    this.requestUtil.jsonResponse(outRes, outData);
                }.bind(this) )
                // catch all errors
                .then(null,  function(err) {
                    console.error("Collector end Session Error:", err);
                    outRes.status(500).send( ' Error:'+err);
                }.bind(this) );

        }.bind(this) );

    } catch(err) {
        console.trace("Collector: Start Session Error -", err);
    }
};

Collector.prototype.sendBatchTelemetry = function(req, outRes){
    try {
        if(req.params.type == tConst.type.game) {
            var form = new multiparty.Form();
            form.parse(req, function(err, fields) {
                if(err){
                    console.error("Collector: Error -", err);
                    outRes.status(500).send('Error:'+err);
                    return;
                }

                if(fields){
                    if(fields.events)        fields.events        = fields.events[0];
                    if(fields.gameSessionId) fields.gameSessionId = fields.gameSessionId[0];
                    if(fields.gameVersion)   fields.gameVersion   = fields.gameVersion[0];

                    //console.log("fields:", fields);
                    this.qSendBatch(fields.gameSessionId, fields);
                }

                outRes.send();
            }.bind(this));
        } else {
            //console.log("send telemetry batch body:", req.body);
            // Queue Data
            this.qSendBatch(req.body.gameSessionId, req.body);

            outRes.send();
        }
    } catch(err) {
        console.trace("Collector: Send Telemetry Batch Error -", err);
    }
};

Collector.prototype.endSession = function(req, outRes){
    try {
        //console.log("req.params:", req.params, ", req.body:", req.body);

        var done = function(jdata) {
            //console.log("endSession jdata:", jdata);
            // forward to webapp server
            if(jdata.gameSessionId) {

                // validate session
                this.qValidate(jdata.gameSessionId)
                // save events
                .then(function(){
                    return this.qSendBatch(jdata.gameSessionId, jdata)
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

                        return this.qEndSession(jdata.gameSessionId);
                    }.bind(this) );

                    return p;
                }.bind(this))
                // all done
                .then( function() {
                    outRes.status(200).send('{}');
                    return;
                }.bind(this) )
                // catch all errors
                .then(null, function(err) {
                    console.error("Collector end Session Error:", err);
                    outRes.status(500).send('Error:'+err);
                }.bind(this) );

            } else {
                var err = "gameSessionId missing!";
                console.error("Error:", err);
                outRes.status(500).send('Error:'+err);
            }
        }.bind(this);

        if(req.params.type == tConst.type.game) {
            var form = new multiparty.Form();
            form.parse(req, function(err, fields) {
                if(err){
                    console.error("Error:", err);
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
    }
};
// ---------------------------------------


Collector.prototype.validateGameVersion = function(gameType, gameVersion){
    // Grab indices of specific delimeters
    var gameMajorDelimeter     = gameVersion.indexOf( "_" );
    var majorMinorDelimeter    = gameVersion.indexOf( "." );
    var minorRevisionDelimeter = gameVersion.lastIndexOf( "." );

    // If any of these indices are invalid, the version is invalid
    if( gameMajorDelimeter < 0 ||
        majorMinorDelimeter < 0 ||
        minorRevisionDelimeter < 0 ) {
        console.warn( "Game version format was invalid:", gameVersion );
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
        console.warn( "Found character in revision:", revisionString );
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
        return false;
    }

    // Check against the expected major, minor, and revision
    var versionInfo = validGameVersions[game];
    if( major < versionInfo.major ||
        minor < versionInfo.minor ||
        revision < versionInfo.revision ) {
        console.warn( "Game version is invalid and needs to be updated:", gameVersion );
        return false;
    }

    // The version is valid, allow play
    return true;
};

// ---------------------------------------
// Queue function
Collector.prototype.qStartSession = function(gameSessionId, userId) {
// add promise wrapper
return when.promise(function(resolve, reject, notify) {
// ------------------------------------------------
    var batchInKey = tConst.batchKey+":"+gameSessionId+":"+tConst.inKey;

    // create list and add userId
    this.queue.lpush(batchInKey,
        JSON.stringify({
            gameSessionId: gameSessionId,
            userId:        userId
        }),
        function(err){
            if(err) {
                console.error("Collector: qStart Error-", err);
            }
        }
    );
// ------------------------------------------------
}.bind(this));
// end promise wrapper
}

Collector.prototype.qValidate = function(id) {
// add promise wrapper
return when.promise(function(resolve, reject, notify) {
// ------------------------------------------------

    var batchInKey = tConst.batchKey+":"+id+":"+tConst.inKey;

    this.queue.llen(batchInKey, function(err, count){
        if(err) {
            console.error("Collector: Batch Error -", err);
            reject(err);
            return;
        }

        if(count > 1) {
            resolve();
        } else {
            reject(new Error("session never created"));
        }
    });

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}


Collector.prototype.qSendBatch = function(id, data) {
// add promise wrapper
return when.promise(function(resolve, reject, notify) {
// ------------------------------------------------

    var batchInKey = tConst.batchKey+":"+id+":"+tConst.inKey;

    var score = 0;
    if(data.stars) {
        score = data.stars;
    }

    // if object convert data to string
    if(_.isObject(data)) {
        if(data.events) {

            // parse events
            try {
                data.events = JSON.parse(data.events);
            } catch(err) {
                console.error("Collector: Error -", err, ", JSON events:", data.events);
                reject(err);
                return;
            }

            if(!data.events.length) {
                resolve(score);
                return;
            }

            // find score if it exists
            for(var i in data.events) {
                if( data.events[i].name &&
                    data.events[i].name == tConst.game.scoreKey) {
                    if( data.events[i].eventData &&
                        data.events[i].eventData.stars) {
                        score = data.events[i].eventData.stars;
                    }
                }
            }

        } else {
            // no events
            resolve(score);
            return;
        }

        //console.log("Collector: gameVersion", data.gameVersion);
        data = JSON.stringify(data);
    }

    // X prevents from creating a list if does not exist
    this.queue.lpushx(batchInKey, data, function(err){
        if(err) {
            console.error("Collector: Batch Error -", err);
            reject(err);
            return;
        }

        resolve(score);
    });

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}

Collector.prototype.qEndSession = function(id) {
// add promise wrapper
return when.promise(function(resolve, reject, notify) {
// ------------------------------------------------
    var telemetryInKey = tConst.telemetryKey+":"+tConst.inKey;

    this.queue.lpush(telemetryInKey,
        JSON.stringify({
            id: id,
            type: tConst.end
        }),
        function(err){
            if(err) {
                console.error("Collector: End Error -", err);
                reject(err);
                return;
            }
            resolve();
        }
    );
// ------------------------------------------------
}.bind(this));
// end promise wrapper
}
// ---------------------------------------
