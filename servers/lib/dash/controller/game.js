
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
}
function getGameAchievements(req, res){
    try {

        // check input
        if( !( req.params &&
               req.params.hasOwnProperty("id") ) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return
        }

        var gameId = req.params.id;
        var gameIdParts = gameId.split('-');
        gameId = gameIdParts[0];
        gameEpisodeId = gameIdParts[1];

        // check gameId exists
        if( !this.gameInfo.hasOwnProperty(gameId) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return
        }

        var info;
        if( this.gameInfo[gameId].hasOwnProperty('episodes') &&
            this.gameInfo[gameId].episodes.hasOwnProperty(gameEpisodeId) ) {
            info = this.gameInfo[gameId].episodes[gameEpisodeId];
        } else {
            info = this.gameInfo[gameId];
        }

        if(info.hasOwnProperty('$Achievements')) {
            this.requestUtil.jsonResponse(res, info['$Achievements']);
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
            req.params.hasOwnProperty("id") ) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return
        }

        var gameId = req.params.id;
        var gameIdParts = gameId.split('-');
        gameId = gameIdParts[0];
        gameEpisodeId = gameIdParts[1];

        // check gameId exists
        if( !this.gameInfo.hasOwnProperty(gameId) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return
        }

        var info;
        if( this.gameInfo[gameId].hasOwnProperty('episodes') &&
            this.gameInfo[gameId].episodes.hasOwnProperty(gameEpisodeId) ) {
            info = _.cloneDeep( this.gameInfo[gameId].episodes[gameEpisodeId] );
        } else {
            info = _.cloneDeep( this.gameInfo[gameId] );
        }

        // remove all keys that start with '$'
        removeSpecialMembers(info);

        this.requestUtil.jsonResponse(res, info);

    } catch(err) {
        console.trace("Reports: Get Achievements Error -", err);
        this.stats.increment("error", "GetAchievements.Catch");
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
