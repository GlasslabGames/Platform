
var when   = require('when');
var Util   = require('../../core/util.js');
var lConst = require('../../lms/lms.const.js');

module.exports = {
    getUserEvents: getUserEvents
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

        this.cbds.getSessionsByUserId(gameId, userId)
            .then(function(sessionList) {

                if(!sessionList || (sessionList.length == 0)) {
                    this.requestUtil.jsonResponse(res, []);
                    return;
                }

                when.reduce(sessionList, function(currentResult, sessionId, index) {

                        if(sessionId.length > 0) {
                            return this.cbds.getEvents(sessionId)
                                .then( function (results) {
                                    //if(results.length > 0) console.log("getRawEvents length:", results.length);
                                    return currentResult.concat(results);
                                }.bind(this));
                        } else {
                            return currentResult;
                        }
                    }.bind(this), [])

                    // done
                    .then(function(result){
                        // output in pretty format
                        this.requestUtil.jsonResponse(res, JSON.stringify(result));
                    }.bind(this))

                    // error
                    .then(null, function(err){
                        console.error("err:", err);
                    }.bind(this))


            }.bind(this));

    } catch(err) {
        console.trace("Collector: Get User Data Error -", err);
        this.stats.increment("error", "GetUserData.Catch");
        this.requestUtil.errorResponse(res, {error: err});
    }
}
