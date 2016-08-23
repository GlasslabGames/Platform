
var _      = require('lodash');
var when   = require('when');
//
var Util   = require('../../core/util.js');

module.exports = {
    startSessionV2:   startSessionV2,
    endSessionV2:     endSessionV2,
    startPlaySession: startPlaySession
};

var exampleInput = {};
var exampleOutput = {};

// http://127.0.0.1:8001/api/v2/data/playSession/start
exampleOutput.startPlaySession = {
    playSessionId: '1234-5678-901235'
};
function startPlaySession(req, res){
    var playSession = {
        playSessionId: Util.CreateUUID()
    };
    this.requestUtil.noCache(res);
    this.requestUtil.jsonResponse(res, playSession);
    this.stats.increment("info", "StartPlaySession.Done");
}


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

        if(!req.body.gameId) {
            this.stats.increment("error", "StartSession.GameId.Missing");
            this.requestUtil.errorResponse(outRes, "GameId Missing", 404);
            return;
        }
        var gameId = req.body.gameId;

        //console.log("req:", req);
        //console.log("getSession url:", url);
        // account for anon users
        var userData = {
            id: null,
            collectTelemetry: true
        };
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
        var gameSessionId    = undefined;

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
                console.errorExt("DataService", "Start Session Error -", err);
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
                    console.errorExt("DataService", "End Session Error -", err);
                    this.stats.increment("error", "Route.EndSession.CatchAll");
                    this.requestUtil.errorResponse(outRes, err, 500);
                }.bind(this) );

        } else {
            var err = "gameSessionId missing!";
            console.errorExt("DataService", err);
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

function pushJob(userId, gameId, gameSessionId) {
    // TODO: move this to core service routing
    var protocal = this.options.assessment.protocal || 'http:';
    var host = this.options.assessment.host || 'localhost';
    var port = this.options.assessment.port || 8003;
    var url = protocal + "//" + host + ":" + port + "/int/v1/aeng/queue";

    return this.requestUtil.request(url,
        {
            jobType: "endSession",
            userId:  userId,
            gameId:  gameId,
            gameSessionId: gameSessionId
        })
        .then(null, function(err){
            if(err.code == 'ECONNREFUSED') {
                console.errorExt("DataService", "Can not connect to Assessment Server, check if the server is running");
            }
            return err;
        }.bind(this));
}