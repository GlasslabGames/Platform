
var _          = require('lodash');
var when       = require('when');
var handlebars = require('handlebars');
//
var Util       = require('../../core/util.js');

module.exports = {
    getUserGameAchievements: getUserGameAchievements,
    getGameDetails:      getGameDetails,
    getGameReports:      getGameReports,
    getGameMissions:     getGameMissions
};

var exampleIn = {};


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

        // gameIds are not case sensitive
        var gameId = req.params.gameId.toUpperCase();
        var userData = req.session.passport.user;

        // check gameId exists
        if( !this.isValidGameId(gameId) ) {
            this.requestUtil.errorResponse(res, {key:"report.gameId.invalid", error: "invalid gameId"});
            return;
        }

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
        if( !this.isValidGameId(gameId) ) {
            this.requestUtil.errorResponse(res, {key:"report.gameId.invalid", error: "invalid gameId"});
            return;
        }

        this.requestUtil.jsonResponse(res, this.getGameDetails(gameId));
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
            this.requestUtil.errorResponse(res, {key:"report.gameId.missing", error: "missing gameId"});
            return;
        }

        var gameId = req.params.gameId;
        // gameIds are not case sensitive
        gameId = gameId.toUpperCase();

        // check gameId exists
        if( !this.isValidGameId(gameId) ) {
            this.requestUtil.errorResponse(res, {key:"report.gameId.invalid", error: "invalid gameId"});
            return;
        }

        this.requestUtil.jsonResponse(res, this.getGameReports(gameId));
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
        if( !this.isValidGameId(gameId) ) {
            this.requestUtil.errorResponse(res, {key:"report.gameId.invalid", error: "invalid gameId"});
            return;
        }

        if( !( req.params &&
            req.params.hasOwnProperty("courseId") ) ) {
            this.requestUtil.errorResponse(res, {error: "invalid course id"}, 404);
            return;
        }
        var courseId = req.params.courseId;

        var userData = req.session.passport.user;

        var missions = _.cloneDeep(this.getGameMissions(gameId));
        if( missions ) {

            var missionGroups = _.cloneDeep(missions.groups);
            var linkSchema    = missions.linkSchema;

            var missionProgressLock = false;

            this.dashStore.getGameSettingsFromCourseId(courseId)
                .then(function(gameSettings){

                    // get missionProgressLock for game and user
                    if( gameSettings.hasOwnProperty(gameId) &&
                        gameSettings[gameId].hasOwnProperty('missionProgressLock') ) {
                        missionProgressLock = gameSettings[gameId].missionProgressLock;

                        // TODO: remove this after adding challenges to simcity
                        missionProgressLock = false;
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
                                // if missionGroups unlocked, make sure first submission is unlocked
                                if ( j == 0 &&
                                     missionGroups[i] &&
                                     !missionGroups[i].locked) {
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

                            // update links
                            for (var k = 0; k < missions[j].links.length; k++) {

                                // if has $linkSchemaId replace link with $linkSchemaId
                                if(missions[j].links[k].hasOwnProperty("$linkSchemaId")) {
                                    missions[j].links[k].link = linkSchema[ missions[j].links[k]["$linkSchemaId"] ];

                                    // replace keys
                                    var data = {
                                        gameId:           gameId,
                                        webSessionId:     req.cookies["connect.sid"],
                                        missionId:        missions[j].id,
                                        courseId:         courseId,
                                        configSessionUrl: req.headers.host,
                                        configDataUrl:    req.headers.host
                                    };

                                    // encodeURIComponent all data inputs
                                    for(var d in data) {
                                        data[d] = encodeURIComponent(data[d]);
                                    }

                                    var template = handlebars.compile( missions[j].links[k].link );
                                    missions[j].links[k].link = template(data);

                                    // remove $linkSchemaId
                                    delete missions[j].links[k]["$linkSchemaId"];
                                }
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
