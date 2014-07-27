
var path      = require('path');
var _         = require('lodash');
var when      = require('when');

module.exports = {
    getGameSessionEvents: getGameSessionEvents
};
var exampleIn = {};
var exampleOut = {};


// game AA, episode 1
exampleIn.getGameSessionEvents = {
    gameSessionId: "ABCD-1234-EFGH"
};
function getGameSessionEvents(req, res, next)
{
    if( !(req.params &&
          req.params.gameSessionId)
        ) {
        this.requestUtil.errorResponse(res, { status: "error", error: "Game data missing", key: "missing.data"});
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
