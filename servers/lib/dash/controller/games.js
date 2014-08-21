
var _         = require('lodash');
var when      = require('when');
//
var Util      = require('../../core/util.js');

module.exports = {
    getGamesBasicInfo: getGamesBasicInfo,
    getMyGames:        getMyGames
};

var exampleIn = {};

// no input
function getGamesBasicInfo(req, res){
    try {
        var userData = req.session.passport.user;

        this.dashStore.getLicensedGameIdsFromUserId(userData.id)
            .then(function(licenseGameIds){
                var outGames = [];

                // TODO: replace with promise
                var games = this.getListOfGameIds();
                for(var i = 0; i < games.length; i++) {
                    var gameId = games[i];

                    var info = _.cloneDeep(this.getGameBasicInfo(gameId));
                    if(info.license.type == "free") {
                        info.license.valid = true;
                    } else {
                        // check license
                        info.license.valid = licenseGameIds.hasOwnProperty(gameId);
                    }
                    outGames.push( info );
                }

                this.requestUtil.jsonResponse(res, outGames);
            }.bind(this))

            // catch all errors
            .then(null, function(err) {
                this.requestUtil.errorResponse(res, err);
            }.bind(this));

    } catch(err) {
        console.trace("Reports: Get Game Basic Info Error -", err);
        this.stats.increment("error", "GetGameBasicInfo.Catch");
    }
}

function getMyGames(req, res, next) {
    try {
        var userData = req.session.passport.user;

        this.dashStore.getDistinctGames(userData.id)
            .then(function(gameIdList) {

                for(var i = 0; i < gameIdList.length; i++) {
                    var gameId = gameIdList[i];

                    // TODO: replace with promise
                    gameIdList[i] = this.getGameBasicInfo(gameId);
                }

                this.requestUtil.jsonResponse(res, gameIdList);
            }.bind(this))

            // catch all errors
            .then(null, function(err) {
                this.requestUtil.errorResponse(res, err);
            }.bind(this));

    } catch(err) {
        console.trace("Reports: Get MyGames Error -", err);
        this.stats.increment("error", "GetMyGames.Catch");
    }
}