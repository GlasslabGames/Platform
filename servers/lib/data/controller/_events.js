
var when   = require('when');
var guard  = require('when/guard');
var Util   = require('../../core/util.js');
var lConst = require('../../lms/lms.const.js');

module.exports = {
    getUserEvents:     getUserEvents,
    setAllUsersActive: setAllUsersActive,
    runDataMigration:  runDataMigration
};

/*
 /int/v1/data/game/:gameId/user/:userId/events
 */
function getUserEvents(req, res, next){
    try {
        if( !(req.params &&
              req.params.userId) ) {
            this.requestUtil.errorResponse(res, {error: "missing userId"}, 401);
        }
        var userId = parseInt(req.params.userId);

        if( !(req.params &&
              req.params.gameId) ) {
            this.requestUtil.errorResponse(res, {error: "missing gameId"}, 401);
        }
        var gameId = req.params.gameId;

        this.cbds.getGameSessionIdsByUserId(gameId, userId)
            .then(function(sessionList) {
                if(!sessionList || (sessionList.length == 0)) {
                    this.requestUtil.jsonResponse(res, []);
                    return;
                }

                //console.log("sessionList:", sessionList);
                // guard, async so it runs each one at a time, to prevent spaming the server for events
                var guardedAsyncOperation = guard(guard.n(1),
                    function(currentResult, gameSessionId, index) {
                        if(gameSessionId.length > 0) {
                            return this.cbds.getEvents(gameSessionId)
                                .then( function (results) {
                                    if(results.events.length) {
                                        //console.log("getRawEvents length:", results.length);
                                        return currentResult.concat(results);
                                    }
                                    return currentResult;
                                }.bind(this));
                        } else {
                            return currentResult;
                        }
                }.bind(this));

                when.reduce(sessionList, guardedAsyncOperation, [])
                    // done
                    .then(function(result){
                        // output in pretty format
                        this.requestUtil.jsonResponse(res, JSON.stringify(result));
                    }.bind(this))

                    // error
                    .then(null, function(err){
                        console.error("err:", err);
                    }.bind(this));

            }.bind(this));

    } catch(err) {
        console.trace("Collector: Get User Data Error -", err);
        this.stats.increment("error", "GetUserData.Catch");
        this.requestUtil.errorResponse(res, {error: err});
    }
}

/*
 http://localhost:8002/int/v1/data/user/all/active
 */
function setAllUsersActive(req, res, next) {

    // get user sessions from Couch and MySQL
    this.cbds.getAllGameSessions(this.myds)

        // send as activity
        .then(function(gameSessions) {
            // shortcut if no session list
            if(!gameSessions) return;

            var guardedAsyncOperation = guard(guard.n(1), function(info, i) {
                if( info.userId &&
                    info.gameId &&
                    info.gameSessionId ) {
                    return addActivity.call(this, info.userId, info.gameId, info.gameSessionId);
                } else {
                    console.error("setAllUsersActive Info:", info);
                }
            }.bind(this));
            return when.map(gameSessions, guardedAsyncOperation);
        }.bind(this))

        // all done
        .then(function(){
            this.requestUtil.jsonResponse(res, {status:"complete"});
        }.bind(this))

        // catch all error
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this));

}

function addActivity(userId, gameId, gameSessionId) {
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


/*
 http://localhost:8002/admin/data/runMigration
 */
function runDataMigration(req, res, next) {
    // Migrate Old DB Events
    console.log("CouchBase TelemetryStore: Starting Data Migration...");
    this.cbds.migrateData(this.myds)
        .then(function(){
            console.log("CouchBase TelemetryStore: Completed Data Migration");
            this.requestUtil.jsonResponse(res, {status:"complete"});
        }.bind(this))

        // catch all error
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}