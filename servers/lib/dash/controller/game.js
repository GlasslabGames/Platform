
var _         = require('lodash');
var when      = require('when');
//
var Util      = require('../../core/util.js');

module.exports = {
    getGameAchievements: getGameAchievements,
    getGameDetails:      getGameDetails,
    getGameReports:      getGameReports,
    getGameMissions:     getGameMissions
};

var exampleIn = {};

// game AA, episode 1
exampleIn.getGameAchievements = {
    gameId: 'AA-1'
};
function getGameAchievements(req, res){
    try {

        // check input
        if( !( req.params &&
               req.params.hasOwnProperty("gameId") ) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return;
        }

        var gameId = req.params.gameId;
        // gameIds are not case sensitive
        gameId = gameId.toLowerCase();

        // check gameId exists
        if( !this.games.hasOwnProperty(gameId) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return;
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
        gameId = gameId.toLowerCase();

        // check gameId exists
        if( !this.games.hasOwnProperty(gameId) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return;
        }

        var game = this.games[gameId];
        if( game.hasOwnProperty('info') &&
            game['info'].hasOwnProperty('details')
          ) {
            this.requestUtil.jsonResponse(res, game['info'].details);
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
        gameId = gameId.toLowerCase();

        // check gameId exists
        if( !this.games.hasOwnProperty(gameId) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return;
        }

        var game = this.games[gameId];
        if( game.hasOwnProperty('info') &&
            game['info'].hasOwnProperty('reports')
            ) {
            this.requestUtil.jsonResponse(res, game['info'].reports);
        } else {
            this.requestUtil.jsonResponse(res, []);
        }

    } catch(err) {
        console.trace("Reports: Get Game Reports Error -", err);
        this.stats.increment("error", "GetGameReports.Catch");
    }
}


// game AA, episode 1
exampleIn.getGameMissions = {
    gameId: 'AA-1',
    courseId: 1
};
function getGameMissions(req, res){
    try {
        // check input
        if( !( req.params &&
            req.params.hasOwnProperty("gameId") ) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return;
        }

        var gameId = req.params.gameId;
        // gameIds are not case sensitive
        gameId = gameId.toLowerCase();

        // check gameId exists
        if( !this.games.hasOwnProperty(gameId) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return;
        }

        var game = this.games[gameId];
        if( game.hasOwnProperty('info') &&
            game['info'].hasOwnProperty('missions')
            ) {
            var missions = _.cloneDeep(game['info'].missions);
            var missionProgressLock = true;

            // TODO: get missionProgressLock for game and user
            // TODO: get list of all completed missions

            for(var i = 0; i < missions.length; i++) {
                if(missionProgressLock) {
                    // ensure first mission is unlocked
                    if(i == 0) {
                        missions[i].locked = false;
                    }
                }

                var submissions = missions[i].submissions;
                var numCompletedSubMissions = 0;
                var lastCompletedDate = null;
                for(var j = 0; j < submissions.length; j++) {
                    if(missionProgressLock) {
                        // if mission unlocked, make sure first submission is unlocked
                        if( j == 0 &&
                            !missions[i+1].locked ) {
                            submissions[j].locked = false;
                        }
                    }

                    // TODO: check if mission is completed in DB
                    //  completed
                    //  completedDate

                    // count number of completed missions
                    if(submissions[j].completed) {
                        numCompletedSubMissions++;

                        // if progress, unlock next submission
                        if( missionProgressLock &&
                            submissions[j+1]) {
                            submissions[j+1].locked = false;
                        }
                    }

                    // keep track of last complted date
                    if(submissions[j].completedDate > lastCompletedDate) {
                        lastCompletedDate = submissions[j].completedDate;
                    }
                }

                if(numCompletedSubMissions == submissions.length) {
                    missions[i].completed = true;
                    missions[i].completedDate = lastCompletedDate;

                    // if progress, unlock next mission
                    if( missionProgressLock &&
                        missions[i+1]) {
                        missions[i+1].locked = false;
                    }
                }
            }

            this.requestUtil.jsonResponse(res, missions);
        } else {
            this.requestUtil.jsonResponse(res, []);
        }

    } catch(err) {
        console.trace("Reports: Get Game Missions Error -", err);
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
