
var _          = require('lodash');
var when       = require('when');
var handlebars = require('handlebars');
var path       = require('path');
//
var Util       = require('../../core/util.js');
var dConst     = require('../dash.const.js');

module.exports = {
    getUserGameAchievements:    getUserGameAchievements,
    getGameDetails:             getGameDetails,
    getGameReports:             getGameReports,
    getGameMissions:            getGameMissions,
    saveAssessmentResults:      saveAssessmentResults,
    getDeveloperGameSubmissionTarget: getDeveloperGameSubmissionTarget,
    getGameInfoFromSubmissionTarget: getGameInfoFromSubmissionTarget,
    approveDeveloperGame:       approveDeveloperGame,
    rejectDeveloperGame:        rejectDeveloperGame,
    requestInfoDeveloperGame:   requestInfoDeveloperGame,
    saveGameConfigJson:         saveGameConfigJson,
    getGameConfigJson:          getGameConfigJson
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


function getDeveloperGameSubmissionTarget(req, res) {
    var userId = req.user.id;
    if(req.user.role !== "admin"){
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"},401);
        return;
    }

    if ( !(this.options.gameDevelopers &&
        this.options.gameDevelopers.submissionAPI &&
        this.options.gameDevelopers.submissionAPI.destination))
    {
        console.errorExt("DashService", "getDeveloperGameSubmissionTarget Error - destination not configured");
        this.requestUtil.errorResponse(res, {key:"dash.general"},500);
        return;
    }

    this.requestUtil.jsonResponse(res, {url: this.options.gameDevelopers.submissionAPI.destination});
}

function getGameInfoFromSubmissionTarget(req, res) {
    var userId = req.user.id;
    if(req.user.role !== "admin"){
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"},401);
        return;
    }

    if ( !(this.options.gameDevelopers &&
        this.options.gameDevelopers.submissionAPI &&
        this.options.gameDevelopers.submissionAPI.destination))
    {
        console.errorExt("DashService", "getGameInfoFromSubmissionTarget Error - destination not configured");
        this.requestUtil.errorResponse(res, {key:"dash.general"},500);
        return;
    }

    var gameId = req.params.gameId.toUpperCase();
    var url = this.options.gameDevelopers.submissionAPI.destination
        + "/api/v2/dash/developer/info/game/"+gameId;

    this.requestUtil.request(url)
        .then(function(data) {
            this.requestUtil.jsonResponse(res, data);
        }.bind(this))
        .catch(function(err) {
            this.requestUtil.errorResponse(res, {key:"dash.general"},500);
        }.bind(this));
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
        console.errorExt("DashService", "approveDeveloperGame Error - destination not configured");
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
            // console.log("Dash: approveDeveloperGame getGameInformation - ", {gameId: gameId, gameData: gameData, url: url});
            return this.requestUtil.request(url, gameData);
        }.bind(this))
        .then(function(results) {
            if (!results || !results.update || results.update !== "complete") {
                return results; // error
            }
            // Calling updateGameInformation is assumed redundant if isSelf is true.
            if (isSelf) {
                return gameData;
            }
            // console.log("Dash: approveDeveloperGame updateGameInformation - ", {gameId: gameId, gameData: gameData });
            return dashService.telmStore.updateGameInformation(gameId, gameData);
        }.bind(this))
        .then(function(results) {
            if (results && results.basic !== undefined) {
                // console.log("Dash: approveDeveloperGame setDeveloperGameStatus - ", {gameId: gameId, userId: userId });
                return dashService.telmStore.setDeveloperGameStatus(gameId, 0, userId, dConst.gameApproval.status.approved);
            }
            return results; // pass along error
        }.bind(this))
        .then(function(results) {
            if (results && results.status !== undefined) {
                // console.log("Dash: approveDeveloperGame sendDeveloperGameApprovedEmail - ", {gameId: gameId});
                sendDeveloperGameApprovedEmail.call(this, gameId, req.protocol, req.headers.host);
              
                // console.log("Dash: approveDeveloperGame Result - ", {update: "complate"});
                this.requestUtil.jsonResponse(res, {status: "ok"});
            } else {
                console.errorExt("DashService", "approveDeveloperGame Error - ", result);
                this.requestUtil.errorResponse(res, {key:"dash.general"},500);
            }
        }.bind(this))
        .catch(function(err) {
            console.errorExt("DashService", "approveDeveloperGame Error - ", err);
            this.requestUtil.errorResponse(res, {key:"dash.general"},500);
        }.bind(this));
}

function rejectDeveloperGame(req, res) {
    if(req.user.role !== "admin"){
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"},401);
        return;
    }

    if ( !(this.options.gameDevelopers &&
        this.options.gameDevelopers.submissionAPI &&
        this.options.gameDevelopers.submissionAPI.destination))
    {
        console.errorExt("DashService", "rejectDeveloperGame Error - destination not configured");
        this.requestUtil.errorResponse(res, {key:"dash.general"},500);
        return;
    }

    var userId = req.user.id;
    var reason = req.body.reason;
    var gameId = req.params.gameId.toUpperCase();
    var url = this.options.gameDevelopers.submissionAPI.destination
        + "/api/v2/dash/replace/"+gameId+"/" + dConst.code;
    var isSelf = !!this.options.gameDevelopers.submissionAPI.isSelf;
    var action = dConst.gameApproval.status.pulled;
    var dashService = this.serviceManager.get("dash").service;
    var gameData;
    
    this.telmStore.getDeveloperGameStatus(gameId, true)
        .then(function(data) {
            if (typeof data !== 'string') {
                if (data.status == dConst.gameApproval.status.submitted) {
                    action = dConst.gameApproval.status.rejected;
                }
            }
            return this.telmStore.getGameInformation(gameId);
        }.bind(this))
        .then(function(data) {
            gameData = data;
            gameData.basic.visible = false;
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
                return dashService.telmStore.setDeveloperGameStatus(gameId, 0, userId, action);
            }
            return results; // pass along error
        }.bind(this))
        .then(function(results) {
            if (results && results.status !== undefined) {
                sendDeveloperGameRejectedEmail.call(this, gameId, action, reason, req.protocol, req.headers.host);

                console.log("Dash: approveDeveloperGame Result - ", {update: "complate"});
                this.requestUtil.jsonResponse(res, {status: "ok"});
            } else {
                console.errorExt("DashService", "rejectDeveloperGame Error - ", result);
                this.requestUtil.errorResponse(res, {key:"dash.general"},500);
            }
        }.bind(this))
        .catch(function(err) {
            console.errorExt("DashService", "rejectDeveloperGame Error - ", err);
            this.requestUtil.errorResponse(res, {key:"dash.general"},500);
        }.bind(this));
}

// maybe this should be in user.js
function requestInfoDeveloperGame(req, res) {
    if(req.user.role !== "admin"){
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"},401);
        return;
    }

    var reason = req.body.reason;
    var gameId = req.params.gameId.toUpperCase();

    sendDeveloperGameRequestInfoEmail.call(this, gameId, reason, req.protocol, req.headers.host)
    .then(function(results) {
        console.log("Dash: requestInfoDeveloperGame Result - email sent");
        this.requestUtil.jsonResponse(res, {status: "ok"});
    }.bind(this))
    .catch(function(err) {
        console.errorExt("DashService", "requestInfoDeveloperGame Error - ", err);
        this.requestUtil.errorResponse(res, {key:"dash.general"},500);
    }.bind(this));
}

function sendDeveloperGameApprovedEmail(gameId, protocol, host) {
    var dashService = this.serviceManager.get("dash").service;
    var authService = this.serviceManager.get("auth").service;
    
    return dashService.telmStore.getDeveloperGameStatus(gameId, false)
    .then(function(activity) {
        return authService.getAuthStore().findUser('id', activity.userId)
    }.bind(this))
    .then(function(userData) {
        var emailData = {
            subject: "GlassLab Games - Game approved for distribution",
            to: userData.email,
            user: userData,
            gameId: gameId,
            host: protocol + "://" + host
        };
        var email = new Util.Email(
            this.options.auth.email,
            path.join(__dirname, "../email-templates"),
            this.stats);
        return email.send('submitted-game-approved', emailData);
    }.bind(this))
    .then(function(){
        // all ok
    }.bind(this))
    // error
    .then(null, function(err){
        console.errorExt("DashService", 'failed to send email -',  err);
    }.bind(this))
}

function sendDeveloperGameRejectedEmail(gameId, action, reason, protocol, host) {
    var dashService = this.serviceManager.get("dash").service;
    var authService = this.serviceManager.get("auth").service;
    
    return dashService.telmStore.getDeveloperGameStatus(gameId)
    .then(function(activity) {
        return authService.getAuthStore().findUser('id', activity.userId)
    }.bind(this))
    .then(function(userData) {
        var emailData = {
            subject: action === dConst.gameApproval.status.pulled ? "GlassLab Games - Game pulled from distribution" : "GlassLab Games - Submitted game rejected",
            to: userData.email,
            user: userData,
            gameId: gameId,
            reason: reason,
            host: protocol + "://" + host
        };
        var email = new Util.Email(
            this.options.auth.email,
            path.join(__dirname, "../email-templates"),
            this.stats);
        return email.send(action === dConst.gameApproval.status.pulled ? 'developer-game-pulled' : 'developer-game-rejected', emailData);
    }.bind(this))
    .then(function(){
        // all ok
    }.bind(this))
    // error
    .then(null, function(err){
        console.errorExt("DashService", "failed to send email -",  err);
    }.bind(this))
}

function sendDeveloperGameRequestInfoEmail(gameId, reason, protocol, host) {
    var dashService = this.serviceManager.get("dash").service;
    var authService = this.serviceManager.get("auth").service;
    
    return dashService.telmStore.getDeveloperGameStatus(gameId)
    .then(function(activity) {
        return authService.getAuthStore().findUser('id', activity.userId)
    }.bind(this))
    .then(function(userData) {
        var emailData = {
            subject: "GlassLab Games - Information requested",
            to: userData.email,
            user: userData,
            gameId: gameId,
            reason: reason,
            host: protocol + "://" + host
        };
        var email = new Util.Email(
            this.options.auth.email,
            path.join(__dirname, "../email-templates"),
            this.stats);
        return email.send('developer-request-info', emailData);
    }.bind(this))
    .then(function(){
        // all ok
    }.bind(this))
    // error
    .then(null, function(err){
        console.errorExt("DashService", 'failed to send email -',  err);
    }.bind(this))
}

function saveGameConfigJson(req, res) {
    // route requireAuth ensures "session.passport.user" exists
    var userId = req.session.passport.user.id;

    if( !req.body ||
        ( _.isObject(req.body) &&
            !Object.keys(req.body).length ) ) {
        this.requestUtil.errorResponse(res, {key: "missing.data", statusCode: 401});
        return;
    }

    if( !( req.params &&
            req.params.hasOwnProperty("gameId") ) ) {
        this.requestUtil.errorResponse(res, { error: "missing game Id", key: "missing.gameId", statusCode: 401});
        return;
    }
    var gameId = req.params.gameId;
    var data = req.body;

    // TODO: check if gameId in DB

    this.telmStore.getDeveloperProfile(userId)
        .then(function(values){
            var hasAccess = false;
            _(values).forEach(function(value, key){
                if(value.verifyCodeStatus === "verified" && key === gameId) {
                    hasAccess = true;
                }
            });

            if (hasAccess) {
                this.telmStore.saveGameConfigJson(gameId, data)
                    .then(function(){
                        this.requestUtil.jsonResponse(res, { status: "ok" });
                    }.bind(this))
                    .then(null, function(err){
                        this.requestUtil.errorResponse(res, err);
                    }.bind(this));
            } else {
                this.requestUtil.errorResponse(res, { error: "user does not have developer access", statusCode: 401});
            }
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function getGameConfigJson(req, res) {
    if( !( req.params &&
            req.params.hasOwnProperty("gameId") ) ) {
        this.requestUtil.errorResponse(res, { error: "missing game Id", key: "missing.gameId"});
        return;
    }
    var gameId = req.params.gameId;

    // TODO: check if gameId in DB

    this.telmStore.getGameConfigJson(gameId)
        .then(function(data){
            this.requestUtil.noCache(res);
            this.requestUtil.jsonResponse(res, data);
        }.bind(this))
        .then(null, function(err) {
            // missing
            if(err.code == 13) {
                this.requestUtil.errorResponse(res, { error: "no game data", key: "no.data", statusCode: 404});
            } else {
                this.requestUtil.errorResponse(res, err);
            }
        }.bind(this));
}

