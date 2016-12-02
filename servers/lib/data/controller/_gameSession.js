
var path      = require('path');
var _         = require('lodash');
var when      = require('when');

module.exports = {
    getGameSessionEvents: getGameSessionEvents,
    getGameSessionsInfo: getGameSessionsInfo,
    getLatestGameSessions: getLatestGameSessions
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
    userId = parseInt(userId);

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

exampleIn.getLatestGameSessions = {
    gameId: 'AA-1',
    data: {}
};
function getLatestGameSessions(req, res) {
    try {

        // check input
        if( !( req.params &&
            req.params.hasOwnProperty("gameId") ) ) {
            this.requestUtil.errorResponse(res, {key:"report.gameId.missing", error: "missing gameId"});
            return;
        }
        var gameId = req.params.gameId;
        // gameIds are not case sensitive
        gameId = gameId.toUpperCase();

        // if (!this.isValidGameId(gameId)) {
        //     this.requestUtil.errorResponse(res, {key:"report.gameId.invalid", error: "invalid gameId"});
        //     return;
        // }

        this.cbds.getLatestGameSessions(gameId).then(
            function(results) {
                this.requestUtil.jsonResponse(res, results);
            }.bind(this),

            function(err) {
                this.requestUtil.errorResponse(res,err);
            }.bind(this)
        );
    } catch(err) {
        console.trace("Reports: getLatestGameSessions Error -", err);
        this.stats.increment("error", "GetLatestGameSessions.Catch");
    }
}
