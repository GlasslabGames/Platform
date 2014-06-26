
var _         = require('lodash');
var when      = require('when');
//
var Util      = require('../../core/util.js');

module.exports = {
    getGameAchievements: getGameAchievements,
    getGameInfo: getGameInfo
};

var exampleIn = {};

// game AA, episode 1
exampleIn.getGameAchievements = {
    id: 'AA-1'
};
function getGameAchievements(req, res){
    try {

        // check input
        if( !( req.params &&
               req.params.hasOwnProperty("gameId") ) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return
        }

        var gameId = req.params.gameId;
        // gameIds are not case sensitive
        gameId = gameId.toLowerCase();

        // check gameId exists
        if( !this.games.hasOwnProperty(gameId) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return
        }

        var game = this.games[gameId];
        if(game.hasOwnProperty('achievements')) {
            this.requestUtil.jsonResponse(res, game['achievements']);
        } else {
            this.requestUtil.jsonResponse(res, {});
        }

    } catch(err) {
        console.trace("Reports: Get Achievements Error -", err);
        this.stats.increment("error", "GetAchievements.Catch");
    }
}

// game AA, episode 1
exampleIn.getGameInfo = {
    id: 'AA-1'
}
function getGameInfo(req, res){
    try {

        // check input
        if( !( req.params &&
            req.params.hasOwnProperty("gameId") ) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return
        }

        var gameId = req.params.gameId;
        // gameIds are not case sensitive
        gameId = gameId.toLowerCase();

        // check gameId exists
        if( !this.games.hasOwnProperty(gameId) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return
        }

        var game = this.games[gameId];
        if(game.hasOwnProperty('info')) {
            this.requestUtil.jsonResponse(res, game['info']);
        } else {
            this.requestUtil.jsonResponse(res, {});
        }

    } catch(err) {
        console.trace("Reports: Get Game Info Error -", err);
        this.stats.increment("error", "GetGameInfo.Catch");
    }
}

// recursivly removes all
function removeSpecialMembers(data){
    for(var key in data) {
        if(key.charAt(0) == '$') {
            delete data[key];
        } else if(_.isObject( data[key] )) {
            removeSpecialMembers(data[key]);
        }
    }
}
