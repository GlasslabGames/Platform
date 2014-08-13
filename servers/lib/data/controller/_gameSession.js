
var path      = require('path');
var _         = require('lodash');
var when      = require('when');

module.exports = {
    getGameSessionEvents: getGameSessionEvents,
    getGameSessionsInfo:  getGameSessionsInfo
};
var exampleIn = {};
var exampleOut = {};


exampleIn.getGameSessionEvents = {
    gameSessionId: "ABCD-1234-EFGH"
};
function getGameSessionEvents(req, res, next)
{
    if( !(req.params &&
          req.params.gameSessionId)
        ) {
        this.requestUtil.errorResponse(res, { status: "error", error: "gameSessionId missing", key: "missing.gameSessionId"});
        return;
    }
    var gameSessionId = req.params.gameSessionId;

    this.cbds.getEvents(gameSessionId)
        .then(function(events){
            this.requestUtil.jsonResponse(res, events);
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

exampleIn.getGameSessionsInfo = {
    gameId: "AA-1",
    userId: 25
};
function getGameSessionsInfo(req, res, next)
{
    if( !(req.params &&
        req.params.userId)
        ) {
        this.requestUtil.errorResponse(res, { status: "error", error: "userId missing", key: "missing.userId"});
        return;
    }
    var userId = req.params.userId;

    if( !(req.params &&
        req.params.gameId)
        ) {
        this.requestUtil.errorResponse(res, { status: "error", error: "gameId missing", key: "missing.gameId"});
        return;
    }
    var gameId = req.params.gameId;

    this.cbds.getGameSessionsInfoByUserId(gameId, userId)
        .then(function(info){
            this.requestUtil.jsonResponse(res, info);
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}
