
var _      = require('lodash');
var when   = require('when');
//
var Util   = require('../../core/util.js');
var tConst = require('../data.const.js');

module.exports = {
    startSessionV2: startSessionV2,
    endSessionV2:   endSessionV2,

    startSessionV1: startSessionV1,
    endSessionV1:   endSessionV1
};

var exampleInput = {};
exampleInput.startSessionV2 = {
    gameId:    "AA-1",
    deviceId:  "123-ASD",
    gameLevel: "Level1",
    courseId:  12,
    timestamp: 123456789
};
function startSessionV2(req, outRes){
    try {
        this.stats.increment("info", "Route.StartSessionV2");

        if(!req.body.deviceId) {
            this.stats.increment("error", "StartSession.DeviceId.Missing");
            this.requestUtil.errorResponse(outRes, "DeviceId Missing", 404);
            return;
        }

        // optional gameId
        // TODO: in future make required
        var gameId = '';
        if(req.body.gameId) {
            gameId = req.body.gameId;
        }

        //console.log("req:", req);
        //console.log("getSession url:", url);
        // account for anon users
        var userData = {
            id: null,
            collectTelemetry: true
        }
        if( req.session &&
            req.session.passport &&
            req.session.passport.user) {
            userData = req.session.passport.user;
        }

        //console.log("req.params:", req.params, ", req.body:", req.body);
        // required
        var deviceId         = req.body.deviceId;
        var clientTimeStamp  = Util.GetTimeStamp();
        try {
            if(req.body.timestamp) {
                var t =  parseInt(req.body.timestamp);
                if(!_.isNaN(t)) {
                    clientTimeStamp = t;
                } else {
                    //console.log("startSessionV2 invalid input data:", req.body)
                    this.requestUtil.errorResponse(outRes, "invalid timestamp format", 400);
                    return;
                }
            }
        } catch(err) {
            // this is ok
        }

        // Optional
        var courseId = undefined;
        try {
            if(req.body.courseId) {
                var t = parseInt(req.body.courseId);
                if(!_.isNaN(t)) {
                    courseId = t;
                }
            }
        } catch(err) {
            // this is ok
        }
        var gameLevel        = req.body.gameLevel;
        var gameSessionId       = undefined;

        // clean up old game session
        this.cbds.cleanUpOldGameSessionsV2(deviceId)

            // start queue session
            .then(function () {
                return this.cbds.startGameSessionV2(userData.id, deviceId, gameId, courseId, gameLevel, clientTimeStamp);
            }.bind(this))

            // get config settings
            .then(function (gSessionId) {
                gameSessionId = gSessionId;
                return this.myds.getConfigs();
            }.bind(this))

            // all ok, done
            .then(function (configs) {
                // override details if user collectTelemetry is set
                if (userData.collectTelemetry) {
                    configs.eventsDetailLevel = 10;
                }

                var outData = {
                    gameSessionId:     gameSessionId,
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
                console.error("Start Session Error:", err);
                this.stats.increment("error", "StartSession.General");
                this.requestUtil.errorResponse(outRes, err, 500);
            }.bind(this) );


    } catch(err) {
        console.trace("Start Session Error -", err);
        this.stats.increment("error", "StartSession.Catch");
    }
};


exampleInput.endSessionV2 = {
    gameSessionId:  "ASD-123-QWER",
    timestamp:      123456789
};
function endSessionV2(req, outRes){
    try {
        // TODO: validate all inputs
        //console.log("req.params:", req.params, ", req.body:", req.body);

        this.stats.increment("info", "Route.EndSession");
        var gameSessionId;
        var userId;
        var gameId;

        //console.log("endSession jdata:", jdata);
        // forward to webapp server
        if(req.body.gameSessionId) {
            gameSessionId = req.body.gameSessionId;

            // required
            var clientTimeStamp = Util.GetTimeStamp();
            try {
                if(req.body.timestamp) {
                    var t =  parseInt(req.body.timestamp);
                    if(!_.isNaN(t)) {
                        clientTimeStamp = t;
                    } else {
                        //console.log("startSessionV2 invalid input data:", req.body)
                        this.requestUtil.errorResponse(outRes, "invalid timestamp format", 400);
                        return;
                    }
                }
            } catch(err) {
                // this is ok
            }

            // validate session
            this.cbds.validateSession(gameSessionId)

                // all done in parallel
                .then(function (gSessionData) {
                    userId = gSessionData.userId;
                    gameId = gSessionData.gameId;
                    // when all done
                    // add end session in Datastore
                    return this.cbds.endGameSessionV2(gameSessionId, clientTimeStamp)
                        // push job on queue
                        .then( function() {
                            //console.log("PushJob gameSessionId:", gameSessionId);
                            return pushJob.call(this, userId, gameId, gameSessionId);
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
                    console.error("End Session Error:", err);
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
        console.trace("End Session Error -", err);
        this.stats.increment("error", "Route.EndSession.Catch");
        this.requestUtil.errorResponse(outRes, "End Session Error", 500);
    }
};
// ---------------------------------------

// ---------------------------------------
// API V1
// ---------------------------------------
function startSessionV1(req, outRes){
    try {
        // TODO: validate all inputs
        this.stats.increment("info", "Route.StartSession");

        var userData = req.session.passport.user;

        //console.log("req:", req);
        //console.log("getSession url:", url);
        // validate session

        //console.log("req.params:", req.params, ", req.body:", req.body);
        var gameLevel        = req.body.gameType;
        var courseId         = parseInt(req.body.courseId);
        var gameSessionId    = null;
        var isVersionValid   = false;

        // only if game
        if(req.params.type == tConst.type.game) {
            // validate game version if version is passed exists
            isVersionValid = this._validateGameVersion(req.body.gameVersion);
        }

        // clean up old game session
        this.myds.cleanUpOldGameSessions(userData.id, gameLevel)

            // start session in MySQL (GL_SESSION)
            .then(function () {
                return this.myds.startGameSession(userData.id, courseId, gameLevel);
            }.bind(this))

            // start queue session
            .then(function (gSessionId) {
                // save for later
                gameSessionId = gSessionId;
                return this.cbds.startGameSession(userData.id, courseId, gameLevel, gameSessionId);
            }.bind(this))

            // start activity session
            .then(function () {
                return this.webstore.createActivityResults(gameSessionId, userData.id, courseId, gameLevel);
            }.bind(this))

            // get config settings
            .then(function () {
                return this.myds.getConfigs();
            }.bind(this))

            // all ok, done
            .then(function (configs) {
                // override details if user collectTelemetry is set
                if (userData.collectTelemetry) {
                    configs.eventsDetailLevel = 10;
                }

                var outData = {
                    versionValid:      isVersionValid,
                    gameSessionId:     gameSessionId,
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
                console.error("End Session Error:", err);
                this.stats.increment("error", "StartSession.General");
                this.requestUtil.errorResponse(outRes, err, 500);
            }.bind(this) );


    } catch(err) {
        console.trace("Start Session Error -", err);
        this.stats.increment("error", "StartSession.Catch");
    }
};


function endSessionV1(req, outRes){
    try {
        // TODO: validate all inputs
        //console.log("req.params:", req.params, ", req.body:", req.body);

        // V1 is always simcity(SC) gameId
        var gameId = "SC";
        this.stats.increment("info", "Route.EndSession");

        var done = function(jdata) {
            //console.log("endSession jdata:", jdata);
            // forward to webapp server
            if(jdata.gameSessionId) {
                var userId;

                // validate session
                this.cbds.validateSession(jdata.gameSessionId)

                    // save events
                    .then(function(sdata) {
                        userId = sdata.userId;
                        return this._saveBatchV1(jdata.gameSessionId, userId, sdata.gameLevel, jdata)
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
                                //console.log("EndSession gameSessionId:", jdata.gameSessionId, ", score:", score);
                                return this.cbds.endGameSession(jdata.gameSessionId);
                            }.bind(this) )
                            // push job on queue
                            .then( function() {
                                //console.log("PushJob gameSessionId:", jdata.gameSessionId, ", score:", score);
                                return pushJob.call(this, userId, gameId, jdata.gameSessionId);
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
                        console.error("End Session Error:", err);
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
        console.trace("End Session Error -", err);
        this.stats.increment("error", "Route.EndSession.Catch");
        this.requestUtil.errorResponse(outRes, "End Session Error", 500);
    }
};
// ---------------------------------------

function pushJob(userId, gameId, gameSessionId) {
    // TODO: move this to core service routing
    var protocal = this.options.assessment.protocal || 'http:';
    var host = this.options.assessment.host || 'localhost';
    var port = this.options.assessment.port || 8003;
    var url = protocal + "//" + host + ":" + port + "/int/v1/aeng/queue";

    return this.requestUtil.request(url, {
        jobType: "sessionEnd",
        userId:  userId,
        gameId:  gameId,
        gameSessionId: gameSessionId
    });
}