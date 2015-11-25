
var _          = require('lodash');
var when       = require('when');
var handlebars = require('handlebars');
//
var Util       = require('../../core/util.js');
var dConst    = require('../dash.const.js');

module.exports = {
    getUserGameAchievements:    getUserGameAchievements,
    getGameDetails:             getGameDetails,
    getGameReports:             getGameReports,
    getGameMissions:            getGameMissions,
    saveAssessmentResults:      saveAssessmentResults,
    approveDeveloperGame:       approveDeveloperGame,
    rejectDeveloperGame:        rejectDeveloperGame,
    requestInfoDeveloperGame:   requestInfoDeveloperGame
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
                    }.bind(this) )
                    // catch all
                    .then(null, function(err){
                        this.requestUtil.errorResponse(res, err);
                    }.bind(this) );
            }
        }.bind(this) )
        .then(null,function(err){
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
                this.requestUtil.errorResponse(res, {key:"report.gameId.invalid"});
                return;
            }
            return this.getGameDetails(gameId);
        }.bind(this) )
        .then(function(gameDetails){
            this.requestUtil.jsonResponse(res, gameDetails);
        }.bind(this) )
        .then(null,function(err){
            console.trace("Reports: Get Game Info Error -", err);
            this.requestUtil.errorResponse(res, err);
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
        this.requestUtil.errorResponse(res, {key:"report.gameId.missing"});
        return;
    }

    var gameId = req.params.gameId;
    // gameIds are not case sensitive
    gameId = gameId.toUpperCase();

    // check gameId exists
    this.isValidGameId(gameId)
        .then(function(state){
            if(!state){
                return when.reject({key: "report.gameId.invalid"});
            } else {
                return this.getGameReports(gameId);
            }
        }.bind(this))
        .then(function(gameReports){
            this.requestUtil.jsonResponse(res, gameReports);
        }.bind(this))
        .then(null,function(err){
            this.requestUtil.errorResponse(res, err);
            console.trace("Reports: Get Game Reports Error -", err);
            this.stats.increment("error", "GetGameReports.Catch");
        }.bind(this));
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
                when.reject({key: "report.gameId.invalid"});
            } else {
                var userData = req.session.passport.user;
                return this.getGameMissions(gameId);
            }
        }.bind(this) )
        .then(function(missions){
            var gameMissions = _.cloneDeep(missions);
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
                                    sdkUrl:           this.options.sdk.simcity + "://" + req.headers.host, //this.requestUtil.getFullHostUrl(req),
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
        }.bind(this) )
        .then(null,function(err) {
            console.trace("Reports: Get Game Missions Error -", err);
            this.stats.increment("error", "GetGameInfo.Catch");
            if(err.key == "report.gameId.invalid"){
                this.requestUtil.errorResponse(res, err);
            } else {
                this.requestUtil.errorResponse(res, "Server Error");
            }
        }.bind(this) );
}

function saveAssessmentResults(req, res){
    if( !(req.params &&
        req.params.hasOwnProperty("assessmentId"))){
        this.requestUtil.errorResponse(res, {key: "assessment.id.missing", error: "missing assessment id"});
        return;
    }
    // route requireAuth ensures "session.passport.user" exists
    var gameId = req.body.gameId;
    //gameIds are not case sensitive
    gameId = gameId.toUpperCase();

    this.isValidGameId(gameId)
        .then(function(state) {

            if (!state) {
                return when.reject({key: "report.gameId.invalid"});
            }

            if (!req.params.userId) {
                return when.reject({key: "report.userId.missing"});
            }
            var userId = req.params.userId;

            if (!req.params.assessmentId) {
                return when.reject({key: "report.assessmentId.missing"});
            }
            var assessmentId = req.params.assessmentId;

            // userId, assessmentId, data
            if (!req.body) {
                return when.reject({key: "report.body.missing"});
            }
            var data = req.body;

            // merge in current assessment
            return this._saveAssessmentResults(userId, gameId, assessmentId, data);
        }.bind(this) )
        .then(function () {
            this.requestUtil.jsonResponse(res, {});
        }.bind(this) )
        // error
        .then(null,function(err){
            console.trace("Reports: Save Assessment Error -", err);
            this.requestUtil.errorResponse(res, err);
            this.stats.increment("error", "SaveAssessment.Catch");
        }.bind(this) );
}


function approveDeveloperGame(req, res) {
    var userId = req.user.id;
    if(req.user.role !== "admin"){
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"},401);
        return;
    }

    if ( !(this.options.gameDevelopers &&
        this.options.gameDevelopers.submissionAPI &&
        this.options.gameDevelopers.submissionAPI.destination))
    {
        console.error("Dash: approveDeveloperGame Error - destination not configured");
        this.requestUtil.errorResponse(res, {key:"dash.general"},500);
        return;
    }

    var gameId = req.params.gameId.toUpperCase();
    var url = this.options.gameDevelopers.submissionAPI.destination
        + "/api/v2/dash/replace/"+gameId+"/" + dConst.code;
    var isSelf = !!this.options.gameDevelopers.submissionAPI.isSelf;
    
    var dashService = this.serviceManager.get("dash").service;
    var gameData;
    
    this.telmStore.getGameInformation(gameId)
        .then(function(data) {
            gameData = data;
            gameData.basic.visible = true;
            return this.requestUtil.request(url, gameData);
        }.bind(this))
        .then(function(results) {
            if (!results || !results.update || results.update !== "complete") {
                return results; // error
            }
            // This is redundant if submissionAPI.destination is this server.
            if (isSelf) {
                return gameData;
            }
            return dashService.telmStore.updateGameInformation(gameId, gameData);
        }.bind(this))
        .then(function(results) {
            if (results && results.basic !== undefined) {
                return dashService.telmStore.setDeveloperGameApproved(gameId, userId);
            }
            return results; // pass along error
        }.bind(this))
        .then(function(results) {
            if (results && results.status !== undefined) {
                console.log("Dash: approveDeveloperGame Result - ", {update: "complate"});
                this.requestUtil.jsonResponse(res, {status: "ok"});
            } else {
                console.error("Dash: approveDeveloperGame Error - ", result);
                this.requestUtil.errorResponse(res, {key:"dash.general"},500);
            }
        }.bind(this))
        .catch(function(err) {
            console.error("Dash: approveDeveloperGame Error - ", err);
            this.requestUtil.errorResponse(res, {key:"dash.general"},500);
        }.bind(this));
}


function rejectDeveloperGame(req, res) {
/*
    var userId = req.user.id;
    if(req.user.role !== "admin"){
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"},401);
        return;
    }

    if ( !(this.options.gameDevelopers &&
        this.options.gameDevelopers.submissionAPI &&
        this.options.gameDevelopers.submissionAPI.destination))
    {
        console.error("Dash: rejectDeveloperGame Error - destination not configured");
        this.requestUtil.errorResponse(res, {key:"dash.general"},500);
        return;
    }

    var gameId = req.params.gameId.toUpperCase();
    var url = this.options.gameDevelopers.submissionAPI.destination
        + "/api/v2/dash/replace/"+gameId+"/" + dConst.code;

    this.telmStore.getGameInformation(gameId)
        .then(function(data) {
            return this.requestUtil.request(url, data);
        }.bind(this))
        .then(function(results) {
            console.log("Dash: rejectDeveloperGame Result - ", results)
            this.requestUtil.jsonResponse(res, {status: "ok"});
        }.bind(this))
        .catch(function(err) {
            console.error("Dash: rejectDeveloperGame Error - ", err);
            this.requestUtil.errorResponse(res, {key:"dash.general"},500);
        }.bind(this));
*/
}

// maybe this should be in user.js
function requestInfoDeveloperGame(req, res) {
}


