
var _          = require('lodash');
var when       = require('when');
var handlebars = require('handlebars');
//
var Util       = require('../../core/util.js');

module.exports = {
    getUserGameAchievements: getUserGameAchievements,
    getGameDetails:         getGameDetails,
    getGameReports:         getGameReports,
    getGameMissions:        getGameMissions,
    saveAssessmentResults:  saveAssessmentResults
};

var exampleIn = {};


// http://localhost:8001/api/v2/dash/game/AA-1/achievements/user
exampleIn.getUserGameAchievements = {
    gameId: 'AA-1'
};
function getUserGameAchievements(req, res){
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
        this.isValidGameId(gameId)
            .then(function(state){
                if(!state){
                    this.requestUtil.errorResponse(res, {key:"report.gameId.invalid", error: "invalid gameId"});
                } else {
                    this.telmStore.getGamePlayInfo(userData.id, gameId)
                        .then(function(info){
                            // if achievement exist then return them otherwise sent empty object
                            this.requestUtil.jsonResponse(res, this.getListOfAchievements(gameId, info.achievement) );
                        }.bind(this))
                        // catch all
                        .then(null, function(err){
                            this.requestUtil.errorResponse(res, err);
                        }.bind(this));
                }
            }.bind(this) )
            .catch(function(err){
                console.trace("Reports: Get Achievements Error -", err);
                this.stats.increment("error", "GetAchievements.Catch");
            }.bind(this) );
}


// game AA, episode 1
exampleIn.getGameInfo = {
    gameId: 'AA-1'
};
function getGameDetails(req, res){
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
    this.isValidGameId(gameId)
        .then(function(state){
            if(!state){
                this.requestUtil.errorResponse(res, {key:"report.gameId.invalid", error: "invalid gameId"});
            } else {
                this.requestUtil.jsonResponse(res, this.getGameDetails(gameId));
            }
        }.bind(this) )
        .catch(function(err){
            console.trace("Reports: Get Game Info Error -", err);
            this.stats.increment("error", "GetGameInfo.Catch");
        }.bind(this) );
}


// game AA, episode 1
exampleIn.getGameReports = {
    gameId: 'AA-1'
};
function getGameReports(req, res){
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
    this.isValidGameId(gameId)
        .then(function(state){
            if(!state){
                this.requestUtil.errorResponse(res, {key:"report.gameId.invalid", error: "invalid gameId"});
            } else {
                this.requestUtil.jsonResponse(res, this.getGameReports(gameId));
            }
        }.bind(this) )
        .catch(function(err){
            console.trace("Reports: Get Game Reports Error -", err);
            this.stats.increment("error", "GetGameReports.Catch");
        }.bind(this) );
}


/*
 GET
 http://localhost:8001/api/v2/dash/game/SC/missions
 */
exampleIn.getGameMissions = {
    gameId: 'SC'
};
function getGameMissions(req, res){
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
    this.isValidGameId(gameId)
        .then(function(state){
            if(!state){
                this.requestUtil.errorResponse(res, {key:"report.gameId.invalid", error: "invalid gameId"});
            } else {
                var userData = req.session.passport.user;

                var gameMissions = _.cloneDeep(this.getGameMissions(gameId));
                if( gameMissions ) {
                    var missionGroups = _.cloneDeep(gameMissions.groups);
                    var linkSchema    = gameMissions.linkSchema;
                    var missionProgressLock = false;
                    for(var i = 0; i < missionGroups.length; i++) {
                        var missions = missionGroups[i].missions;
                        var lastCompletedDate = null;
                        for (var j = 0; j < missions.length; j++) {
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
                                        sdkUrl:           this.requestUtil.getFullHostUrl(req),
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
                    }

                    this.requestUtil.jsonResponse(res, {
                        title: gameMissions.title,
                        groups: missionGroups
                    });
                } else {
                    this.requestUtil.jsonResponse(res, {});
                }
            }
        }.bind(this) )
        .catch(function(err) {
            console.trace("Reports: Get Game Missions Error -", err);
            this.stats.increment("error", "GetGameInfo.Catch");
            this.requestUtil.errorResponse(res, "Server Error");
        }.bind(this) );
}

function saveAssessmentResults(req, res){
    if( !(req.params &&
        req.params.hasOwnProperty("assessmentId"))){
        this.requestUtil.errorResponse(res, {key: "assessment.id.missing", error: "missing assessment id"});
        return;
    }

    // route requireAuth ensures "session.passport.user" exists
    var userId = req.session.passport.user.id;
    var gameId = req.body.gameId;
    gameId = gameId.toUpperCase();
    var assessmentId = req.params.assessmentId;
    assessmentId = AssessmentId.toUpperCase();
    var data = req.body;

    this._saveAssessmentResults(userId, gameId, assessmentId, data)
        .then(function(){
            this.requestUtil.jsonResponse(res, {});
        }.bind(this) )
        // error
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this) )
        .catch(function(err){
            console.trace("Reports: Save Assessment Error -", err);
            this.stats.increment("error", "SaveAssessment.Catch");
        });
};
