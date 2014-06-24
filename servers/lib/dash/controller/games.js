
var _         = require('lodash');
var when      = require('when');
//
var Util      = require('../../core/util.js');

module.exports = {
    getGamesMinInfo: getGamesMinInfo,
    getGamesAllInfo: getGamesAllInfo
};

var exampleIn = {};

// no input
function getGamesMinInfo(req, res){
    try {
        var games = [];
        for(var game in this.games) {
            if(this.games[game].hasOwnProperty("info")) {
                var info = _.cloneDeep(this.games[game]["info"]);

                for(var key in info) {
                    // if found then remove from object
                    if(key.indexOf("long") === 0) {
                        delete info[key];
                    }
                }

                games.push( info );
            }
        }

        this.requestUtil.jsonResponse(res, games);

    } catch(err) {
        console.trace("Reports: Get Achievements Error -", err);
        this.stats.increment("error", "GetAchievements.Catch");
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