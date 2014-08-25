
var _         = require('lodash');
var when      = require('when');
//
var Util      = require('../../core/util.js');

module.exports = {
    getGamesBasicInfo: getGamesBasicInfo,
    getMyGames:        getMyGames
};

var exampleIn = {};
var exampleOut = {};

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


// http://localhost:8001/api/v2/dash/myGames
// returns list of games a user has added to there classes
// 1) get list of all classes for this user
// 2) for each class get list of games
// 3) use full list of games to build set of distinct
exampleOut.getMyGames = [
    {
        gameId: "SC",
        enabled: true,
        maintenance: {
            message: "Coming Soon!"
        },
        shortName: "SimCityEdu",
        longName: "SimCityEDU: Pollution Challenge!",
        description: "SimCityEDU: Pollution Challenge!",
        settings: {
            missionProgressLock: false
        },
        license: {
            type: "tier",
            valid: false
        },
        thumbnail: {
            small: "assets/thumb-game-SC.png",
            large: "assets/thumb-game-SC.png"
        },
        developer: {
            id: "GL",
            name: "GlassLab, Inc.",
            logo: {
                small: "assets/glasslab-logo.png",
                large: "assets/glasslab-logo-2x.png"
            }
        }
    },
    {
        gameId: "AA-1",
        enabled: true,
        shortName: "Mars Generation One",
        longName: "Mars Generation One - Argubot Academy",
        description: "Put your powers of persuasion to the ultimate test, on a whole new planet! Argubot Academy is an adventure game for iOS tablets. Designed for students in grades 6-8, the game develops persuasion and reasoning skills for STEM &amp; 21st century careers.",
        settings: { },
        license: {
            type: "free",
            valid: true
        },
        thumbnail: {
            small: "assets/thumb-game-AA-1.png",
            large: "assets/thumb-game-AA-1.png"
        },
        developer: {
            id: "GL",
            name: "GlassLab, Inc.",
            logo: {
                small: "assets/glasslab-logo.png",
                large: "assets/glasslab-logo-2x.png"
            }
        }
    }
];
function getMyGames(req, res) {
    try {
        var userData = req.session.passport.user;

        // 1) get list of all classes for this user
        this.lmsStore.getCourseIdsFromUserId(userData.id)
            .then(function(courseIds) {
                // 3) use full list of games to build set of distinct
                return this.telmStore.multiGetDistinctGamesForCourses( courseIds );
            }.bind(this))
            // distinct games
            .then(function(games) {
                var gamesList = [];
                for(var gameId in games) {

                    // TODO: replace with promise
                    gamesList.push( this.getGameBasicInfo(gameId) );
                }

                this.requestUtil.jsonResponse(res, gamesList);
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