
var _         = require('lodash');
var when      = require('when');
//
var Util      = require('../../core/util.js');

module.exports = {
    getAllGameAchievements:  getAllGameAchievements,
    getUserGameAchievements: getUserGameAchievements,
    getGameDetails:      getGameDetails,
    getGameReports:      getGameReports,
    getGameMissions:     getGameMissions
};

var exampleIn = {};

// http://localhost:8001/api/v2/dash/game/AA-1/achievements/all
exampleIn.getAllGameAchievements = {
    gameId: 'AA-1'
};
function getAllGameAchievements(req, res){
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
        if( game.achievements ) {
            this.requestUtil.jsonResponse(res, game.achievements);
        } else {
            this.requestUtil.jsonResponse(res, {});
        }

    } catch(err) {
        console.trace("Reports: Get Achievements Error -", err);
        this.stats.increment("error", "GetAchievements.Catch");
    }
}

// http://localhost:8001/api/v2/dash/game/AA-1/achievements/user
exampleIn.getUserGameAchievements = {
    gameId: 'AA-1'
};
function getUserGameAchievements(req, res){
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
        var userData = req.session.passport.user;

        this.telmStore.getGamePlayInfo(userData.id, gameId)
            .then(function(info){
                // if achievement exist then return them otherwise sent empty object
                this.requestUtil.jsonResponse(res, this.getListOfAchievements(gameId, info.achievement) );
            }.bind(this))
            // catch all
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this))


    } catch(err) {
        console.trace("Reports: Get Achievements Error -", err);
        this.stats.increment("error", "GetAchievements.Catch");
    }
}


// game AA, episode 1
exampleIn.getGameInfo = {
    gameId: 'AA-1'
};
function getGameDetails(req, res){
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
            game.info.hasOwnProperty('details') ) {
            this.requestUtil.jsonResponse(res, game.info.details);
        } else {
            this.requestUtil.jsonResponse(res, {});
        }

    } catch(err) {
        console.trace("Reports: Get Game Info Error -", err);
        this.stats.increment("error", "GetGameInfo.Catch");
    }
}


// game AA, episode 1
exampleIn.getGameReports = {
    gameId: 'AA-1'
};
function getGameReports(req, res){
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
        if( game.hasOwnProperty('info') &&
            game.info.hasOwnProperty('reports') ) {
            this.requestUtil.jsonResponse(res, game.info.reports);
        } else {
            this.requestUtil.jsonResponse(res, []);
        }

    } catch(err) {
        console.trace("Reports: Get Game Reports Error -", err);
        this.stats.increment("error", "GetGameReports.Catch");
    }
}

/*
 GET
 http://localhost:8001/api/v2/dash/course/8/game/SC/missions
*/
exampleIn.getGameMissions = {
    gameId: 'SC',
    courseId: 1
};
function getGameMissions(req, res){
    try {
        // check input
        if( !( req.params &&
            req.params.hasOwnProperty("gameId") ) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"}, 404);
            return;
        }
        var gameId = req.params.gameId;
        // gameIds are not case sensitive
        gameId = gameId.toUpperCase();

        // check gameId exists
        if( !this.games.hasOwnProperty(gameId) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"}, 404);
            return;
        }

        if( !( req.params &&
            req.params.hasOwnProperty("courseId") ) ) {
            this.requestUtil.errorResponse(res, {error: "invalid course id"}, 404);
            return;
        }
        var courseId = req.params.courseId;

        var userData = req.session.passport.user;

        var game = this.games[gameId];
        if( game.info &&
            game.info.hasOwnProperty('missionGroups') ) {

            var missionGroups = _.cloneDeep(game.info.missionGroups);
            var missionProgressLock = true;

            this.dashStore.getGameSettingsFromCourseId(courseId)
                .then(function(gameSettings){

                    // get missionProgressLock for game and user
                    if( gameSettings.hasOwnProperty(gameId) &&
                        gameSettings[gameId].hasOwnProperty('missionProgressLock') ) {
                        missionProgressLock = gameSettings[gameId].missionProgressLock;
                    }

                    return this.dashStore.getCompletedMissions(userData.id, courseId, gameId);
                }.bind(this))
                .then(function(completedMissions){

                    for(var i = 0; i < missionGroups.length; i++) {
                        if (missionProgressLock) {
                            // ensure first mission is unlocked
                            if (i == 0) {
                                missionGroups[i].locked = false;
                            }
                        } else {
                            // if not locked all mission groups unlocked
                            missionGroups[i].locked = false;
                        }

                        var missions = missionGroups[i].missions;
                        var numCompletedSubMissions = 0;
                        var lastCompletedDate = null;
                        for (var j = 0; j < missions.length; j++) {
                            if (missionProgressLock) {
                                // if mission unlocked, make sure first submission is unlocked
                                if (j == 0 && !missionGroups[i + 1].locked) {
                                    missions[j].locked = false;
                                }
                            } else {
                                // if not locked all missions unlocked
                                missions[j].locked = false;
                            }

                            if( completedMissions.hasOwnProperty(missions[j].id) ) {
                                missions[j].completed = true;
                                missions[j].completedDate = completedMissions[ missions[j].id ];
                            }

                            // count number of completed missions
                            if (missions[j].completed) {
                                numCompletedSubMissions++;

                                // if progress, unlock next submission
                                if (missionProgressLock &&
                                    missions[j + 1]) {
                                    missions[j + 1].locked = false;
                                }
                            }

                            // keep track of last complted date
                            if (missions[j].completedDate > lastCompletedDate) {
                                lastCompletedDate = missions[j].completedDate;
                            }
                        }

                        if (numCompletedSubMissions == missions.length) {
                            missionGroups[i].completed = true;
                            missionGroups[i].completedDate = lastCompletedDate;

                            // if progress, unlock next mission
                            if (missionProgressLock &&
                                missionGroups[i + 1]) {
                                missionGroups[i + 1].locked = false;
                            }
                        }
                    }

                    this.requestUtil.jsonResponse(res, missionGroups);
                }.bind(this))

                // catch all errors
                .then(null, function(err){
                    console.error("getGameMissions Error:", err);
                    this.requestUtil.errorResponse(res, "Get Missions Error");
                }.bind(this));
        } else {
            this.requestUtil.jsonResponse(res, []);
        }

    } catch(err) {
        console.trace("Reports: Get Game Missions Error -", err);
        this.stats.increment("error", "GetGameInfo.Catch");
        this.requestUtil.errorResponse(res, "Server Error");
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
