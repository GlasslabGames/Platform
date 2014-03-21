
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
    deviceId:  "123-ASD",
    gameLevel: "Level1",
    courseId:  12,
    timestamp: 123456789
}

function startSessionV2(req, outRes){
    try {
        // TODO: validate all inputs
        this.stats.increment("info", "Route.StartSessionV2");

        if(!req.body.deviceId) {
            this.stats.increment("error", "StartSession.DeviceId.Missing");
            this.requestUtil.errorResponse(outRes, "DeviceId Missing", 404);
            return;
        }

        //console.log("req:", req);
        //console.log("getSession url:", url);
        var userData = req.session.passport.user;

        //console.log("req.params:", req.params, ", req.body:", req.body);
        // required
        var deviceId         = req.body.deviceId;
        var clientTimeStamp  = req.body.timestamp || Util.GetTimeStamp();
        // Optional
        var courseId         = parseInt(req.body.courseId);
        var gameLevel        = req.body.gameLevel;
        var gSessionId       = undefined;

        // clean up old game session
        this.cbds.cleanUpOldGameSessionsV2(deviceId)

            // start queue session
            .then(function () {
                return this.cbds.startGameSessionV2(deviceId, userData.id, courseId, gameLevel, clientTimeStamp);
            }.bind(this))

            // get config settings
            .then(function (gameSessionId) {
                gSessionId = gameSessionId;
                return this.webstore.getConfigs();
            }.bind(this))

            // all ok, done
            .then(function (configs) {
                // override details if user collectTelemetry is set
                if (userData.collectTelemetry) {
                    configs.eventsDetailLevel = 10;
                }

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


    } catch(err) {
        console.trace("Collector: Start Session Error -", err);
        this.stats.increment("error", "StartSession.Catch");
    }
};


exampleInput.endSessionV2 = {
    gameSessionId:  "ASD-123-QWER",
    timestamp:      123456789
}
function endSessionV2(req, outRes){
    try {
        // TODO: validate all inputs
        //console.log("req.params:", req.params, ", req.body:", req.body);

        this.stats.increment("info", "Route.EndSession");
        var gSessionId = undefined;

        //console.log("endSession jdata:", jdata);
        // forward to webapp server
        if(req.body.gameSessionId) {
            gSessionId = req.body.gameSessionId;

            var clientTimeStamp  = req.body.timestamp || Util.GetTimeStamp();

            // validate session
            this.cbds.validateSession(gSessionId)

                // all done in parallel
                .then(function () {
                    // when all done
                    // add end session in Datastore
                    return this.cbds.endGameSessionV2(gSessionId, clientTimeStamp)
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
        var gSessionId       = null;
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
            .then(function (gameSessionId) {
                // save for later
                gSessionId = gameSessionId;
                return this.cbds.startGameSession(userData.id, courseId, gameLevel, gameSessionId);
            }.bind(this))

            // start activity session
            .then(function () {
                return this.webstore.createActivityResults(gSessionId, userData.id, courseId, gameLevel);
            }.bind(this))

            // get config settings
            .then(function () {
                return this.webstore.getConfigs();
            }.bind(this))

            // all ok, done
            .then(function (configs) {
                // override details if user collectTelemetry is set
                if (userData.collectTelemetry) {
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


    } catch(err) {
        console.trace("Collector: Start Session Error -", err);
        this.stats.increment("error", "StartSession.Catch");
    }
};


function endSessionV1(req, outRes){
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