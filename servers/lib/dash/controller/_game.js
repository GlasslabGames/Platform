
var _         = require('lodash');
var when      = require('when');
//
var Util      = require('../../core/util.js');

module.exports = {
    getAssessmentDefinitions:  getAssessmentDefinitions
};

var exampleIn = {};

// game AA, episode 1
exampleIn.getAssessmentDefinitions = {
    gameId: 'AA-1'
};
function getAssessmentDefinitions(req, res){
    try {

        // check input
        if( !( req.params &&
               req.params.hasOwnProperty("gameId") ) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return;
        }
        var gameId = req.params.gameId;
        // gameIds are not case sensitive
        gameId = gameId.toUpperCase();

        // check gameId exists
        if( !this.games.hasOwnProperty(gameId) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return;
        }

        var game = this.games[gameId];
        if( game.info &&
            game.info.hasOwnProperty('assessment')) {
            this.requestUtil.jsonResponse(res, game.info['assessment']);
        } else {
            this.requestUtil.jsonResponse(res, []);
        }

    } catch(err) {
        console.trace("Reports: Get Assessment Error -", err);
        this.stats.increment("error", "GetAchievements.Catch");
    }
}
