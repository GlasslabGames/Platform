
var _         = require('lodash');
var when      = require('when');
//
var Util      = require('../../core/util.js');

module.exports = {
    getGamesBasicInfo: getGamesBasicInfo
};

var exampleIn = {};

// no input
function getGamesBasicInfo(req, res){
    try {
        var games = [];
        for(var game in this.games) {
            if( this.games[game].hasOwnProperty("info") &&
                this.games[game]["info"].hasOwnProperty("basic")
                ) {
                var info = _.cloneDeep(this.games[game]["info"].basic);
                games.push( info );
            }
        }

        this.requestUtil.jsonResponse(res, games);

    } catch(err) {
        console.trace("Reports: Get Game Basic Info Error -", err);
        this.stats.increment("error", "GetGameBasicInfo.Catch");
    }
}

// no input
function getGamesAllInfo(req, res){
    try {
        var games = [];
        for(var game in this.games) {
            if(this.games[game].hasOwnProperty("info")) {
                games.push( this.games[game]["info"] );
            }
        }

        this.requestUtil.jsonResponse(res, games);

    } catch(err) {
        console.trace("Reports: Get Achievements Error -", err);
        this.stats.increment("error", "GetAchievements.Catch");
    }
}