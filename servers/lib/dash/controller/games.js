var _         = require('lodash');
var when      = require('when');
var fn        = require('when/function');
//
var Util      = require('../../core/util.js');
var dConst    = require('../dash.const.js');
var fs = require('fs');
var multiparty = require('multiparty');
var mmm = require('mmmagic'),
    Magic = mmm.Magic;
var crypto = require('crypto');

module.exports = {
    getActiveGamesBasicInfo:         getActiveGamesBasicInfo,
    getGamesBasicInfo:               getGamesBasicInfo,
    getPlanLicenseGamesBasicInfo:    getPlanLicenseGamesBasicInfo,
    getAvailableGamesObj:            getAvailableGamesObj,
    getGamesBasicInfoByPlan:         getGamesBasicInfoByPlan,
    getActiveGamesDetails:           getActiveGamesDetails,
    getMyGames:                      getMyGames,
    reloadGameFiles:                 reloadGameFiles,
    getBadgeJSON:                    getBadgeJSON,
    generateBadgeCode:               generateBadgeCode,
    badgeCodeAwarded:                badgeCodeAwarded,
    reprocessSince:                  reprocessSince,
    reprocessGame:                   reprocessGame,
    deleteAssessments:               deleteAssessments,
    queueStatus:                     queueStatus,
    migrateInfoFiles:                migrateInfoFiles,
    migrateSingleGameInfoFiles:      migrateSingleGameInfoFiles,
    replaceGameInfo:                 replaceGameInfo,
    uploadGameFile:                  uploadGameFile,
    getDeveloperProfile:             getDeveloperProfile,
    getDeveloperGameIds:             getDeveloperGameIds,
    getDeveloperGamesInfo:           getDeveloperGamesInfo,
    getDeveloperGamesInfoSchema:     getDeveloperGamesInfoSchema,
    getDeveloperGameInfo:            getDeveloperGameInfo,
    createNewGame:                   createNewGame,
    submitGameForApproval:           submitGameForApproval,
    getAllDeveloperGamesAwaitingApproval: getAllDeveloperGamesAwaitingApproval,
    getAllDeveloperGamesRejected:    getAllDeveloperGamesRejected,
    getAllDeveloperGameAccessRequestsAwaitingApproval: getAllDeveloperGameAccessRequestsAwaitingApproval,
    getAllDeveloperGameAccessRequestsDenied: getAllDeveloperGameAccessRequestsDenied,
    getApprovedGamesOrgInfo:         getApprovedGamesOrgInfo,
    updateDeveloperGameInfo:         updateDeveloperGameInfo
};

var exampleIn = {};
var exampleOut = {};

// no input
function getActiveGamesBasicInfo(req, res){
    try {
        var loginType = "guest";
        var promise = null;
        //var outGames = [];
        var gameIds;
        var licenseGameIds;
        if( req.session &&
            req.session.passport &&
            req.session.passport.user ) {
            var userData = req.session.passport.user;
            loginType = userData.loginType;

            promise = this.dashStore.getLicensedGameIdsFromUserId(userData.id);
        } else {
            promise = Util.PromiseContinue();
        }

        promise.then(function(ids){
            // ensure licenseGameIds is object
            licenseGameIds = ids;
            if(!licenseGameIds) { licenseGameIds = {}; }

            // TODO: replace with promise
            this.getListOfVisibleGameIds()
                .then(function(ids){
                    gameIds = ids;
                    var promiseList = [];
                    gameIds.forEach(function (gameId) {
                        promiseList.push(this.getGameBasicInfo(gameId));
                    }.bind(this) );
                    return when.all(promiseList);
                }.bind(this) )
                .then(function(gamesInfo){
                    var outGames = _infoFormat(gamesInfo, loginType, gameIds, licenseGameIds);
                    this.requestUtil.jsonResponse(res, outGames);

                }.bind(this) );
        }.bind(this) )

        // catch all errors
        .then(null, function(err) {
            this.requestUtil.errorResponse(res, err);
        }.bind(this) );

    } catch(err) {
        console.trace("Reports: Get Game Basic Info Error -", err);
        this.stats.increment("error", "GetGameBasicInfo.Catch");
    }
}

function getPlanLicenseGamesBasicInfo(req, res){
    if(!(req && req.user && req.user.id)){
        this.requestUtil.errorResponse(res, {key: "dash.permission.denied"});
        return;
    }
    var licenseId = req.user.licenseId;
    var loginType = req.user.loginType;
    var promise;
    if(licenseId){
        var licService = this.serviceManager.get("lic").service;
        promise = licService.myds.getLicenseById(licenseId);
    } else{
        promise = Util.PromiseContinue();
    }
    promise
        .then(function(output) {
            var type;
            // check if part of active license
            if(licenseId && output[0].active > 0){
                var license = output[0];
                type = license["package_type"];
            } else{
                type = "basic";
            }
            return _getPlanGamesBasicInfo.call(this, type);
        }.bind(this))
        .then(function(output){
            var gamesInfo = output[0];
            var availableGames = output[1];
            var outGames = _infoFormat(gamesInfo, loginType, availableGames, availableGames);
            this.requestUtil.jsonResponse(res, outGames);
        }.bind(this))
        .then(null, function(err){
            console.errorExt("DashService", "Get License Games Basic Info Error -",err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function getAvailableGamesObj(req, res){
    if(!(req && req.user && req.user.id)){
        this.requestUtil.errorResponse(res, {key: "dash.permission.denied"});
        return;
    }
    var licenseId = req.user.licenseId;
    var promise;
    if(licenseId){
        var licService = this.serviceManager.get("lic").service;
        promise = licService.myds.getLicenseById(licenseId);
    } else{
        var dashService = this.serviceManager.get("dash").service;
        promise = dashService.getListOfAllFreeGameIds();
    }
    promise
        .then(function(results){
            var availableGames = {};
            var lConst = this.serviceManager.get("lic").lib.Const;
            if(licenseId){
                var license = results[0];
                var plan = lConst.plan[license["package_type"]];
                var browserGames = plan.browserGames;
                browserGames.forEach(function(gameId){
                    availableGames[gameId] = true;
                });
                var ipadGames = plan.iPadGames;
                ipadGames.forEach(function(gameId){
                    availableGames[gameId] = true;
                });
                var downloadableGames = plan.downloadableGames;
                downloadableGames.forEach(function(gameId){
                    availableGames[gameId] = true;
                });
            } else{
                var freeGames = results;
                freeGames.forEach(function(gameId){
                    availableGames[gameId] = true;
                });
            }
            this.requestUtil.jsonResponse(res, availableGames);
        }.bind(this))
        .then(null, function(err){
            console.errorExt("DashService", "Get Available Game Map Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"});
        }.bind(this));
}

function getGamesBasicInfoByPlan(req, res){
    var planId = req.params.planId;
    var loginType = "guest";
    if(req.user && req.user.loginType){
        loginType = req.user.loginType;
    }
    _getPlanGamesBasicInfo.call(this, planId)
        .then(function(output){
            var gamesInfo = output[0];
            var availableGames = output[1];
            var outGames = _infoFormat(gamesInfo, loginType, availableGames, availableGames);
            this.requestUtil.jsonResponse(res, outGames);
        }.bind(this))
        .then(null, function(err){
            console.errorExt("DashService", "Get Games Basic Info By Plan Error -",err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function _getPlanGamesBasicInfo(type){
    return when.promise(function(resolve, reject){
        var promise;
        var availableGames;
        if(type === 'basic'){
            promise = this.getListOfAllFreeGameIds();
        }
        else{
            var lConst = this.serviceManager.get("lic").lib.Const;
            var plan = lConst.plan[type];
            var browserGames = plan.browserGames;
            var iPadGames = plan.iPadGames;
            var downloadableGames = plan.downloadableGames;
            var gameIds = browserGames.concat(iPadGames, downloadableGames);
            promise = Util.PromiseContinue(gameIds);
        }
        promise
            .then(function(gameIds){
                availableGames = gameIds;
                var promiseList = [];
                gameIds.forEach(function(gameId){
                    promiseList.push(this.getGameBasicInfo(gameId));
                }.bind(this));
                return when.all(promiseList);
            }.bind(this))
            .then(function(gamesInfo){
                resolve([gamesInfo, availableGames]);
            })
            .then(null, function(err){
                console.errorExt("DashService", "Get Plan Games Basic Info Error -",err);
                reject(err);
            });
    }.bind(this));
}

function getGamesBasicInfo(req, res){
    try {
        var loginType = "guest";
        var promise = null;
        var gameIds;
        var licenseGameIds;
        if( req.session &&
            req.session.passport &&
            req.session.passport.user ) {
            var userData = req.session.passport.user;
            loginType = userData.loginType;
            // old licensing system
            promise = this.dashStore.getLicensedGameIdsFromUserId(userData.id);
        } else {
            promise = Util.PromiseContinue();
        }

        promise.then(function(ids){
            // ensure licenseGameIds is object
            licenseGameIds = ids;
            if(!licenseGameIds) { licenseGameIds = {}; }

            return this.getListOfAllGameIds();
        }.bind(this) )
        .then(function(ids){
            gameIds = ids;
            var promiseList = [];
            gameIds.forEach(function (gameId) {
                promiseList.push(this.getGameBasicInfo(gameId));
            }.bind(this) );
            return when.all(promiseList);
        }.bind(this) )
        .then(function(gamesInfo){
            var outGames = _infoFormat(gamesInfo, loginType, gameIds, licenseGameIds);
            this.requestUtil.jsonResponse(res, outGames);
        }.bind(this) )

        // catch all errors
        .then(null, function(err) {
            this.requestUtil.errorResponse(res, err);
        }.bind(this) );

    } catch(err) {
        console.trace("Reports: Get Game Basic Info Error -", err);
        this.stats.increment("error", "GetGameBasicInfo.Catch");
    }
}

function getApprovedGamesOrgInfo(req, res){
    try {
        var gameIds;
        var gamesInfo;
        
        this.getListOfVisibleGameIds()
        .then(function(ids){
            gameIds = ids;
            var promiseList = [];
            gameIds.forEach(function (gameId) {
                promiseList.push(this.getGameBasicInfo(gameId));
            }.bind(this) );
            return when.all(promiseList);
        }.bind(this) )
        .then(function(_gamesInfo){
            gamesInfo = _gamesInfo;
            return this.telmStore.getAllDeveloperProfiles();
        }.bind(this) )
        .then(function(profiles){
            var owner = { };
            var keys = Object.keys(profiles);
            for (var j=0;j<keys.length;j++) {
                var key = keys[j];
                var userId = key.split(':')[2];
                var profile = profiles[key];
                var pkeys = Object.keys(profile);
                for (var k=0;k<pkeys.length;k++) {
                    var pkey = pkeys[k];
                    if (profile[pkey].verifyCodeStatus == "verified") {
                        owner[pkey] = userId;
                    }
                }
            }
          
            var promiseList = [];
            for (var i=0;i<gamesInfo.length;i++) {
                var gameInfo = gamesInfo[i];
                if (owner.hasOwnProperty(gameInfo.gameId)) {
                    promiseList.push(this.telmStore.getDeveloperOrganization(owner[gameInfo.gameId]));
                } else {
                    promiseList.push({ organization: "-- Legacy game --" });
                }
            }
            return when.all(promiseList);
        }.bind(this) )
        .then(function(results){
            for (var i=0;i<results.length;i++) {
                var gameInfo = gamesInfo[i];
                gameInfo["organization"] = results[i];
            }

            var outGames = _infoFormat(gamesInfo, "loginType", gameIds, {});
            this.requestUtil.jsonResponse(res, outGames);
        }.bind(this) )

        // catch all errors
        .then(null, function(err) {
            this.requestUtil.errorResponse(res, err);
        }.bind(this) );

    } catch(err) {
        console.trace("Reports: Get Game Basic Info Error -", err);
        this.stats.increment("error", "GetGameBasicInfo.Catch");
    }
}

function getActiveGamesDetails(req, res){
    try {
        var loginType = "guest";
        var promise = null;
        //var outGames = [];
        var gameIds;
        var licenseGameIds;
        if( req.session &&
            req.session.passport &&
            req.session.passport.user ) {
            var userData = req.session.passport.user;
            loginType = userData.loginType;

            promise = this.dashStore.getLicensedGameIdsFromUserId(userData.id);
        } else {
            promise = Util.PromiseContinue();
        }

        promise.then(function(ids) {
            // ensure licenseGameIds is object
            licenseGameIds = ids;
            if(!licenseGameIds) { licenseGameIds = {}; }

            // TODO: replace with promise
            return this.getListOfVisibleGameIds()

        }.bind(this) )
        .then(function(games){
            var promiseList = [];
            gameIds = games;
            gameIds.forEach(function(gameId){
                promiseList.push(this.getGameDetails(gameId));
            }.bind(this) );
            return when.all(promiseList);
        }.bind(this) )
        .then(function(gamesDetails){
            var outGames = _infoFormat(gamesDetails, loginType, gameIds, licenseGameIds);
            this.requestUtil.jsonResponse(res, outGames);
        }.bind(this) )

        // catch all errors
        .then(null, function(err) {
            this.requestUtil.errorResponse(res, err);
        }.bind(this) );

    } catch(err) {
        console.trace("Reports: Get Game Basic Info Error -", err);
        this.stats.increment("error", "GetGameBasicInfo.Catch");
    }
}

function _infoFormat(gamesInfo, loginType, allGameIds, approvedGameIds){
    var outGames = [];
    gamesInfo.forEach(function(gameInfo, index){
        var gameId = allGameIds[index];
        var info = _.cloneDeep(gameInfo);

        info.license.valid = false;
        if(info.license.type == "free") {
            info.license.valid = true;
        }
        else if(info.license.type == "loginType") {
            info.license.loginType = info.license.loginType.split(',');
            if( _.contains(info.license.loginType, loginType) ) {
                info.license.valid = true;
            }
        } else {
            // check license
            info.license.valid = approvedGameIds.hasOwnProperty(gameId);
        }

        // no maintenance message and if invalid lic, replace with invalid lic message
        if(!info.maintenance && !info.license.valid) {
            info.maintenance = { message: info.license.message.invalid };
        }
        outGames.push( info );
    });
    return outGames;
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
            small: "/assets/thumb-game-SC.png",
            large: "/assets/thumb-game-SC.png"
        },
        developer: {
            id: "GL",
            name: "GlassLab, Inc.",
            logo: {
                small: "/assets/glasslab-logo.png",
                large: "/assets/glasslab-logo-2x.png"
            }
        }
    },
    {
        gameId: "AA-1",
        enabled: true,
        shortName: "Mars Generation One",
        longName: "Mars Generation One - Argubot Academy EDU",
        description: "Put your powers of persuasion to the ultimate test, on a whole new planet! Argubot Academy EDU is an adventure game for iOS tablets. Designed for students in grades 6-8, the game develops persuasion and reasoning skills for STEM &amp; 21st century careers.",
        settings: { },
        license: {
            type: "free",
            valid: true
        },
        thumbnail: {
            small: "/assets/thumb-game-AA-1.png",
            large: "/assets/thumb-game-AA-1.png"
        },
        developer: {
            id: "GL",
            name: "GlassLab, Inc.",
            logo: {
                small: "/assets/glasslab-logo.png",
                large: "/assets/glasslab-logo-2x.png"
            }
        }
    }
];
function getMyGames(req, res) {
    try {
        var userData = req.session.passport.user;

        // 1) get list of all classes for this user
        this.lmsStore.getCourseIdsFromInstructorId(userData.id)
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

                return when.all(gamesList);
            }.bind(this) )
            .then(function(gamesList){
                this.requestUtil.jsonResponse(res, gamesList);
            }.bind(this) )

            // catch all errors
            .then(null, function(err) {
                this.requestUtil.errorResponse(res, err);
            }.bind(this) );

    } catch(err) {
        console.trace("Reports: Get MyGames Error -", err);
        this.stats.increment("error", "GetMyGames.Catch");
    }
}

function migrateSingleGameInfoFiles(req, res) {
    if( !(req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length) ) {
        // if has no code
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
        return;
    }

    // code saved as a constant
    if( req.params.code !== dConst.code ) {
        // If the code is not valid
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
        return;
    }

    var gameName = req.params.gameName;

    this._migrateSingleGame(gameName, true)
        .then(function(){
            return this._loadGameFiles();
        }.bind(this))
        .then(function(){
            res.end('{"migration": "complete"}');
        })
        .then(null, function(err){
            console.trace("Dash: Migrate Info Error -", err);
            var error = {
                migration: "failed",
                error: err
            };
            res.end(JSON.stringify(error));
            this.stats.increment("error", "MigrateInfo.Catch");
        }.bind(this));
}




var _internalAssessmentRequest = function(route, data) {
    var protocal = this.options.assessment.protocal || 'http:';
    var host = this.options.assessment.host || 'localhost';
    var port = this.options.assessment.port || 8003;
    var url = protocal + "//" + host + ":" + port + route;
    return this.requestUtil.request(url, data);
};

function reprocessGame(req, res){
    if( !(req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length) ) {
        // if has no code
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
        return;
    }

    // code saved as a constant
    if( req.params.code !== dConst.code ) {
        // If the code is not valid
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
        return;
    }

    if (!(req.params.gameId && _.isString(req.params.gameId) && req.params.gameId.length)) {
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
    }
    var gameId = req.params.gameId.toUpperCase();


    var jobData = {
        "jobType": "reprocess",
        "gameId": gameId
    };

    if (req.query.courseId && _.isString(req.query.courseId) && req.query.courseId.length) {
        jobData['courseId'] = req.query.courseId;
    }
    if (req.query.assessmentId && _.isString(req.query.assessmentId) && req.query.assessmentId.length) {
        jobData['assessmentId'] = req.query.assessmentId;
    }
    if (req.query.onlyMissing && _.isString(req.query.onlyMissing) && req.query.onlyMissing.length) {
        jobData['onlyMissing'] = req.query.onlyMissing.toLowerCase() == "true";
    }

    // send request to assessment
    _internalAssessmentRequest.bind(this)("/int/v1/aeng/queue", jobData).then(
        function(r) {
            res.end('{"reprocess": "started"}');
        }
    );
}

function deleteAssessments(req, res){
    if( !(req.params.code &&
            _.isString(req.params.code) &&
            req.params.code.length) ) {
        // if has no code
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
        return;
    }

    // code saved as a constant
    if( req.params.code !== dConst.code ) {
        // If the code is not valid
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
        return;
    }

    if (!(req.params.gameId && _.isString(req.params.gameId) && req.params.gameId.length)) {
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
    }
    var gameId = req.params.gameId.toUpperCase();

    if (!(req.params.assessmentId && _.isString(req.params.assessmentId) && req.params.assessmentId.length)) {
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
    }
    var assessmentId = req.params.assessmentId;

    this.telmStore.deleteAllAssessmentResults(gameId, assessmentId)
        .then(function(results) {
            this.requestUtil.jsonResponse(res, "success");
        }.bind(this))
        .catch(function(err) {
            console.errorExt("DashService", "getAllAssessmentResults Error", err);
            this.requestUtil.errorResponse(res, {key: "dash.general"}, 500);
        }.bind(this));
}

function reprocessSince(req, res) {
    if( !(req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length) ) {
        // if has no code
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
        return;
    }

    // code saved as a constant
    if( req.params.code !== dConst.code ) {
        // If the code is not valid
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
        return;
    }

    var jobData = {
        "jobType": "reprocess",
    };

    if (!req.query.since || isNaN(parseInt(req.query.since))) {
        // need a since
        this.requestUtil.errorResponse(res, {key:"dash.since.invalid"}, 401);
        return;
    }
    jobData['since'] = parseInt(req.query.since);

    if (req.query.gameId) {
        // optional gameId
        var gameId = req.query.gameId.toUpperCase();
        jobData['gameId'] = gameId;
    }

    // send request to assessment
    _internalAssessmentRequest.bind(this)("/int/v1/aeng/queue", jobData).then(
        function(r) {
            res.end('{"reprocess": "started"}');
        }
    );
}

function queueStatus(req, res){

    if( !(req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length) ) {
        // if has no code
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
        return;
    }

    // code saved as a constant
    if( req.params.code !== dConst.code ) {
        // If the code is not valid
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
        return;
    }

    // send request to assessment
    _internalAssessmentRequest.bind(this)("/int/v1/aeng/processStatus").then(
        function(r) {
            res.end(JSON.stringify(r));
        }
    );
}

function migrateInfoFiles(req, res){
    if( !(req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length) ) {
        // if has no code
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
        return;
    }

    // code saved as a constant
    if( req.params.code !== dConst.code ) {
        // If the code is not valid
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
        return;
    }
    this._migrateGameFiles(true)
        .then(function(){
            return this._loadGameFiles();
        }.bind(this))
        .then(function(){
            res.end('{"migration": "complete"}');
        })
        .then(null, function(err){
            console.trace("Dash: Migrate Info Error -", err);
            var error = {
                migration: "failed",
                error: err
            };
            res.end(JSON.stringify(error));
            this.stats.increment("error", "MigrateInfo.Catch");
        }.bind(this));
}

function reloadGameFiles(req, res){
    if( !(req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length) ) {
        // if has no code
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
        return;
    }

    // code saved as a constant
    if( req.params.code !== dConst.code ) {
        // If the code is not valid
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
        return;
    }
    this._loadGameFiles()
        .then(function(){
            res.end('{"status": "complete"}');
        })
        .then(null, function(err){
            console.trace("Dash: Reload Game Files Error -", err);
            var error = {
                status: 'failed',
                error: err
            };
            res.end(JSON.stringify(error));
            this.stats.increment("error", "ReloadGameFiles.Catch");
        }.bind(this));
}

function getDeveloperProfile(req, res){
    var userId = req.user.id;
    if ( (req.user.role !== "developer") && (req.user.role !== "admin") ) {
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"},401);
        return;
    }
    getDeveloperGameIds.call(this,userId)
        .then(function(output){
            res.end(JSON.stringify(output));
        })
        .then(null, function(err){
            console.trace("Dash: Get Developer Profile Error -", err);
            this.requestUtil.errorResponse(res, err);
            this.stats.increment("error", "GetDeveloperProfile.Catch");
        }.bind(this));
}

function getDeveloperGameIds(userId, hidden){
    return when.promise(function(resolve, reject){
        this.telmStore.getDeveloperProfile(userId)
            .then(function(values){
                var gameIds = {};
                if(hidden){
                    resolve(values);
                    return;
                }
                _(values).forEach(function(value, key){
                    if(value.verifyCodeStatus === "verified") {
                        gameIds[key] = {};
                    }
                });
                resolve(gameIds);
            }.bind(this))
            .then(null, function(err){
                reject(err);
            }.bind(this));
    }.bind(this));
}

function createNewGame(req, res){
    var userId = req.user.id;
    var gameId = req.params.gameId.toUpperCase();
    if ( (req.user.role !== "developer") && (req.user.role !== "admin") ) {
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"},401);
        return;
    }
    var authService = this.serviceManager.get("auth").service;
    this.telmStore.getGameInformation(gameId, true)
        .then(function (found) {
            if (found === "no object") {
                return this.telmStore.getDeveloperProfile(userId)
                    .then(function(profile){
                        profile[gameId] = {verifyCodeStatus: "verified"};
                        return authService.authDataStore.setDeveloperProfile(userId, profile);
                    }.bind(this))
                    .then(function() {
                        var gameData = _.cloneDeep(this._newGameTemplate);
                        gameData.basic.gameId = gameData.basic.shortName = gameData.basic.longName = gameId;
                        gameData.basic.enabled = true;
                        gameData.basic.visible = false;
                        return this.telmStore.createGameInformation(gameId, gameData);
                    }.bind(this))
                    .catch(function(err) {
                        console.errorExt("DashService", "createNewGame Error Updating Profile", err);
                        this.requestUtil.errorResponse(res, {key: "dash.general"}, 500);
                    }.bind(this))
                    .done(function() {
                        this.requestUtil.jsonResponse(res, {status: "ok"});
                    }.bind(this))
                    ;
            } else {
                //this.requestUtil.errorResponse(res, {key: "dash.createGame.alreadyExists"}, 500);
                this.requestUtil.errorResponse(res, {key:"user.invalid.gameId", error: "This is an invalid game Id."}, 401);
            }
        }.bind(this))
        .catch(function (err) {
            console.errorExt("DashService", "createNewGame Error", err);
            this.requestUtil.errorResponse(res, {key: "dash.general"}, 500);
        }.bind(this));
}

function submitGameForApproval(req, res){
    var userId = req.user.id;
    if(req.user.role !== "developer"){
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"},401);
        return;
    }

    var gameId = req.params.gameId.toUpperCase();
    getDeveloperGameIds.call(this,userId)
        .then(function(developerGames) {
            if(!!developerGames[gameId]) {
                return this.telmStore.setDeveloperGameStatus(gameId, userId, userId, dConst.gameApproval.status.submitted);
            } else {
                return when.reject(userId + " not a developer for "+gameId);
            }
        }.bind(this))
        .then(function() {
            this.requestUtil.jsonResponse(res, {status: "ok"});
        }.bind(this))
        .catch(function(err) {
            console.errorExt("DashService", "submitGameForApproval Error", err);
            var errKey = (typeof err === 'string' ? errKey = err : "dash.general");
            this.requestUtil.errorResponse(res, {key: errKey}, 500);
        }.bind(this));
}

function getAllDeveloperGamesAwaitingApproval(req, res){
    var userId = req.user.id;
    if(req.user.role !== "admin"){
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"},401);
        return;
    }

    this.telmStore.getAllDeveloperGamesAwaitingApproval()
        .then(function(results) {
            if (_.isObject(results)) {
                var promiseList = [];
                for (var did in results) {
                    var game = results[did];
                    if (game.status == dConst.gameApproval.status.submitted) {
                        promiseList.push([did, game]);
                        promiseList.push(this.telmStore.getDeveloperOrganization(game.userId));
                        promiseList.push(this.telmStore._getGameInformation(game.gameId, false, false));
                    }
                }
                return when.all(promiseList);
            }
            return [];
        }.bind(this))
        .then(function(results) {
            var games = [];
            for (var i=0;i<results.length;) {
                var did = results[i][0];
                var game = results[i++][1];
                game.organization = results[i++];
                game.basic = results[i++].basic;
                games.push(game);
            }
            this.requestUtil.jsonResponse(res, games);
        }.bind(this))
        .catch(function(err) {
            console.errorExt("DashService", "getAllDeveloperGamesAwaitingApproval Error", err);
            this.requestUtil.errorResponse(res, {key: "dash.general"}, 500);
        }.bind(this));
}

function getAllDeveloperGamesRejected(req, res){
    var userId = req.user.id;
    if(req.user.role !== "admin"){
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"},401);
        return;
    }

    this.telmStore.getAllDeveloperGamesRejected()
        .then(function(results) {
            if (_.isObject(results)) {
                var promiseList = [];
                for (var did in results) {
                    var game = results[did];
                    if (game.status == dConst.gameApproval.status.rejected ||
                        game.status == dConst.gameApproval.status.pulled) {
              
                        promiseList.push([did, game]);
                        promiseList.push(this.telmStore.getDeveloperOrganization(game.userId));
                        promiseList.push(this.telmStore._getGameInformation(game.gameId, false, false));
                    }
                }
                return when.all(promiseList);
            }
            return [];
        }.bind(this))
        .then(function(results) {
            var games = [];
            for (var i=0;i<results.length;) {
                var did = results[i][0];
                var game = results[i++][1];
                game.organization = results[i++];
                game.basic = results[i++].basic;
                games.push(game);
            }
            this.requestUtil.jsonResponse(res, games);
        }.bind(this))
        .catch(function(err) {
            console.errorExt("DashService", "getAllDeveloperGamesRejected Error", err);
            this.requestUtil.errorResponse(res, {key: "dash.general"}, 500);
        }.bind(this));
}

function getDeveloperGamesInfo(req, res){
    var userId = req.user.id;
    if ( (req.user.role !== "developer") && (req.user.role !== "admin") ) {
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"},401);
        return;
    }
    getDeveloperGameIds.call(this,userId)
        .then(function(gameIds) {
            gameIds = Object.keys(gameIds);
            var basicGameInfo = {};
            when.map(gameIds, function (gameId) {
                return this.telmStore.getGameInformation(gameId)
                    .then(function(gameInfo) {
                        if (gameInfo && gameInfo.basic) {
                            basicGameInfo[gameId] = gameInfo.basic;
                        }
                    }, function(err) {
                        // ignore
                    });
            }.bind(this))
                .catch(function (err) {
                    console.errorExt("DashService", "Get Developer Profile Error basicGameInfo", err);
                    this.requestUtil.errorResponse(res, err);
                }.bind(this))
                .done(function (result) {
                    this.requestUtil.jsonResponse(res, basicGameInfo);
                }.bind(this));
        }.bind(this))
        .then(null, function(err){
            console.trace("Dash: Get Developer Profile Error -", err);
            this.requestUtil.errorResponse(res, err);
            this.stats.increment("error", "GetDeveloperGamesInfo.Catch");
        }.bind(this));
}

function getAllDeveloperGameAccessRequestsAwaitingApproval(req, res){
    var userId = req.user.id;
    if(req.user.role !== "admin"){
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"},401);
        return;
    }

    this.telmStore.getAllDeveloperGameAccessRequestsAwaitingApproval()
        .then(function(results) {
            if (_.isObject(results)) {
                var promiseList = [];
                for (var userId in results) {
                    for (var gameId in results[userId]) {
                        promiseList.push([userId, gameId, results[userId][gameId]]);
                        promiseList.push(this.dashStore.getUserInfoById(userId));
                        promiseList.push(this.telmStore.getDeveloperOrganization(userId));
                        promiseList.push(this.telmStore._getGameInformation(gameId, false, false));
                    }
                }
                return when.all(promiseList);
            }
            return [];
        }.bind(this))
        .then(function(results) {
            var accessRequestInfos = [];
            for (var i=0; i<results.length; i+=4) {
                var requestInfo = {
                    userId: results[i][0],
                    gameId: results[i][1],
                    verifyCode: results[i][2]
                };
                requestInfo.devEmail = results[i+1].email;
                requestInfo.organization = results[i+2];
                requestInfo.basic = results[i+3].basic;
                accessRequestInfos.push(requestInfo);
            }
            this.requestUtil.jsonResponse(res, accessRequestInfos);
        }.bind(this))
        .catch(function(err) {
            console.errorExt("DashService", "getAllDeveloperGameAccessRequestsAwaitingApproval Error", err);
            this.requestUtil.errorResponse(res, {key: "dash.general"}, 500);
        }.bind(this));
}

function getAllDeveloperGameAccessRequestsDenied(req, res){
    var userId = req.user.id;
    if(req.user.role !== "admin"){
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"},401);
        return;
    }

    this.telmStore.getAllDeveloperGameAccessRequestsDenied()
        .then(function(results) {
            if (_.isObject(results)) {
                var promiseList = [];
                for (var userId in results) {
                    for (var gameId in results[userId]) {
                        promiseList.push([userId, gameId, results[userId][gameId]]);
                        promiseList.push(this.dashStore.getUserInfoById(userId));
                        promiseList.push(this.telmStore.getDeveloperOrganization(userId));
                        promiseList.push(this.telmStore._getGameInformation(gameId, false, false));
                    }
                }
                return when.all(promiseList);
            }
            return [];
        }.bind(this))
        .then(function(results) {
            var accessRequestInfos = [];
            for (var i=0; i<results.length; i+=4) {
                var requestInfo = {
                    userId: results[i][0],
                    gameId: results[i][1],
                    verifyCode: results[i][2]
                };
                requestInfo.devEmail = results[i+1].email;
                requestInfo.organization = results[i+2];
                requestInfo.basic = results[i+3].basic;
                accessRequestInfos.push(requestInfo);
            }
            this.requestUtil.jsonResponse(res, accessRequestInfos);
        }.bind(this))
        .catch(function(err) {
            console.errorExt("DashService", "getAllDeveloperGameAccessRequestsDenied Error", err);
            this.requestUtil.errorResponse(res, {key: "dash.general"}, 500);
        }.bind(this));
}

function getDeveloperGamesInfoSchema(req, res){
    this.requestUtil.jsonResponse(res, this._schema);
}

function getDeveloperGameInfo(req, res) {
    var gameId = req.params.gameId;
    this.telmStore.getGameInformation(gameId)
        .then(function(gameInfo) {
            this.requestUtil.jsonResponse(res, gameInfo);
        }.bind(this))
        .catch(function(err) {
            this.requestUtil.errorResponse(res, {key:"dash.access.invalid"});

        }.bind(this));
}

function updateDeveloperGameInfo(req, res){
    var userId = req.user.id;
    var gameId = req.params.gameId;

    when(req.user.role)
        .then(function(role) {
            if (role === "admin") {
                return when.resolve(role);
            } else if (role === "developer") {
                return getDeveloperGameIds.call(this, userId)
                    .then(function(gameIds){
                        if(gameIds[gameId]){
                            return when.resolve(role);
                        }
                        return when.reject({key:"dash.gameId.access.denied"});
                    }.bind(this));
            } else {
                return when.reject({key:"dash.permission.denied"});
            }
        }.bind(this))

        .then(function(permissionCheckResult) {
            return fn.call(JSON.parse, req.body.jsonStr)
                .catch(function(err) {
                    return when.reject({key:"dash.general", reason: err.toString()});
                });
        }.bind(this))

        .then(function(jsonParseResult) {
            if (gameId && gameId === jsonParseResult.basic.gameId) {
                return when.resolve(jsonParseResult);
            }
            return when.reject({key:"dash.gameId.invalid"});
        }.bind(this))

        .then(function(jsonParseResult) {
            return this.validateGameInfo(jsonParseResult)
                .catch(function (errors) {
                    return when.reject({key:"dash.gameInfo.invalid", errors: errors});
                });
        }.bind(this))

        .then(function(validationResult){
            //uncommented out for testing
            //_writeToInfoJSONFiles(gameId, JSON.stringify(validationResult, null, 4));
            if (req.body.overwrite) {
                return this.telmStore.createGameInformation(gameId, validationResult);
            }
            return this.telmStore.updateGameInformation(gameId, validationResult);
        }.bind(this))

        .then(function(status){
            this.requestUtil.jsonResponse(res, {update: "complete"});
        }.bind(this))

        .catch(function(err){
            console.error("Dash: Update Developer Game Info Error -", err);
            this.requestUtil.errorResponse(res, err, 401);
            this.stats.increment("error", "UpdateDeveloperGameInfo.Catch");
        }.bind(this))

        .done(function(status){
            ////
        }.bind(this));
}

function replaceGameInfo(req, res) {
    if( !(req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length &&
        req.params.code === dConst.code) ) {
        // if has no code
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"}, 401);
        return;
    }

    var gameId = req.params.gameId.toUpperCase();
    var data = req.body;
    if (!this.validateGameInfo(data)) {
        this.requestUtil.errorResponse(res, {key:"dash.data.invalid"},500);
        return;
    }

    this.telmStore.createGameInformation(gameId, data)
        .then(function() {
            this.requestUtil.jsonResponse(res, {update: "complete"});
        }.bind(this))
        .catch(function(err){
            console.trace("Dash: replaceGameInfo Error -", err);
            this.requestUtil.errorResponse(res, err, 401);
        }.bind(this));
}

function _writeToInfoJSONFiles(gameId, data){
    return when.promise(function(resolve, reject){
        fs.writeFile(__dirname + "/../games/" + gameId.toLowerCase() + "/info.json", data, function(err){
            if(err){
                reject(err);
                return;
            }
            resolve();
        });
    });
}

function uploadGameFile(req, res) {
    if ( (req.user.role !== "developer") && (req.user.role !== "admin") ) {
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"},401);
        return;
    }

    var gameId = req.params.gameId;

    var form = new multiparty.Form();
    form.parse(req, function(err, fields, files) {
        if(err) {
            console.errorExt("DashService", "uploadGameFile formParse Error -", err);
            this.requestUtil.errorResponse(res, {key:"dash.general"},500);
        }

        _.forEach(files, function(file, key) {
            if(_.isArray(file) && file[0]) {
                file = file[0];
            } else {
                this.requestUtil.errorResponse(res, {key:"dash.info.missing"},500);
            }

            var data = fs.readFileSync(file.path);

            var magic = new Magic(mmm.MAGIC_MIME_TYPE);
            magic.detect(data, function(err, mimeType) {
                if(err) {
                    this.requestUtil.errorResponse(res, {key:"dash.info.missing"},500);
                    throw err;
                }
                var filePath;

                if (mimeType.indexOf("image/") === 0) {
                    var checksum = crypto.createHash("md5").update(data).digest("hex");
                    filePath = gameId + "/images/" + checksum + '.' +(file.originalFilename.split(".").pop());
                } else if (mimeType === 'application/pdf') {
                    filePath = gameId + "/docs/" + file.originalFilename;
                } else {
                    this.requestUtil.errorResponse(res, {key:"dash.type.invalid"},500);
                    return;
                }

                var extraParams = {
                    ACL: "public-read",
                    ContentType: mimeType
                };

                this.serviceManager.awss3.createS3Object( filePath, data, extraParams, "playfully-cms" )
                    .then(function(){

                        this.requestUtil.jsonResponse(res, {
                            path: "https://s3-us-west-2.amazonaws.com/playfully-cms/" + filePath
                        });
                    }.bind(this))
                    .catch(function(err){
                        console.errorExt("DashService", "uploadGameFile putS3Object Error -", err);
                        this.requestUtil.errorResponse(res, {key:"dash.general"},500);
                    }.bind(this));

            }.bind(this));
        }.bind(this));
    }.bind(this));
}

function getBadgeJSON(req, res){
    if (!req.params.badgeId) {
        console.log("no badgeId");
        this.requestUtil.errorResponse(res, {key:"dash.badgeId.missing", error: "missing badgeId"});
        return;
    }

    var url = "https://api-prod.lrng.org/api/v1/badge/remote-badges?badgeIds=[" + req.params.badgeId + "]";

    this.requestUtil.getRequest( url, { "token": "b0a20a70-61a8-11e5-9d70-feff819cdc9" },
        function( err, result, data ) {
            if ( data ) {
                this.requestUtil.jsonResponse(res, data);
            } else if ( err ) {
                this.requestUtil.errorResponse(res, err, 400);
            }
        }.bind(this) );
}

function generateBadgeCode( req, res ) {
    var userId = parseInt( req.params.userId );
    if ( ! userId ) {
        this.requestUtil.errorResponse(res, {key:"dash.userId.missing", error: "missing userId"});
        return;
    }

    var badgeId = parseInt( req.params.badgeId );
    if ( ! badgeId ) {
        this.requestUtil.errorResponse(res, {key:"dash.badgeId.missing", error: "missing badgeId"});
        return;
    }

    // Check if user already has badge
    // If not, get earned-code
    // add to user's badge list
	var newBadge = { id: parseInt( badgeId ), redeemed: false, code: "" };
    this.webstore.getUserBadgeListById( userId )
        .then(function(results) {
            if ( ! results ) {
                results = [];
            }
            return results;
        }.bind(this))
        .then(function( badgeList ) {
            // Ignore if already exists
            badgeList.forEach( function( badge ) {
                if ( badgeId == badge.id ) {
                	// Do not get an earned-code, just ignore
                	console.log( "---> generateBadgeCode: Earned badge already existed for user/badge: ", userId, badgeId );
                    this.stats.increment("info", "Route.Update.User.Done");
                    this.requestUtil.jsonResponse(res, data);
                    return;
                }
            });

			badgeList.push( newBadge );

            return badgeList;
        }.bind(this))
        .then( function( badgeList ) {
		    var url = "https://api-prod.lrng.org/api/v1/badge/" + badgeId + "/earned-code/generate";

		    this.requestUtil.postRequest( url, { "token": "b0a20a70-61a8-11e5-9d70-feff819cdc9" }, null,
		        function( err, result, data ) {
		            if ( data ) {
		                // data {"status":"ok","data":{"code":"35664e6779763b3e784e7d426f5a3e3f4d402632"}}
		                var dataJSON = JSON.parse( data );

                        badgeList.forEach( function( badge ) {
                            if ( badgeId == badge.id ) {
				                badge.code = dataJSON.data.code;
                            }
                        });

                        return this.serviceManager.get("auth").service.getAuthStore().updateUserBadgeList( userId, badgeList );
		            } else {
		            	if ( ! err ) {
		            		err = "failed to retrieve earned code";
		            	}

		                this.requestUtil.errorResponse(res, err, 400);
		                return;
		            }
		        }.bind(this))
                .then(function( data ) {
                    this.stats.increment("info", "Route.Update.User.Done");
                    this.requestUtil.jsonResponse(res, data);
                }.bind(this))
                .then(null, function(err){
                    this.stats.increment("error", "Route.Update.User");
                    console.errorExt("DashService", "updateUserBadgeList error:", err);
                    this.requestUtil.errorResponse(res, {key:"user.update.general"}, 400);
                }.bind(this));
        }.bind(this));
}

function badgeCodeAwarded(req, res) {
    var badgeId = parseInt( req.params.badgeId );
    if ( ! badgeId ) {
        this.requestUtil.errorResponse(res, {key:"dash.badgeId.missing", error: "missing badgeId"});
        return;
    }

    var code = req.params.code;
    if (!code) {
        this.requestUtil.errorResponse(res, {key:"dash.code.missing", error: "missing code"});
        return;
    }

    var url = "https://api-prod.lrng.org/api/v1/badge/" + badgeId + "/earned-code/" + code + "/redeemed";

    this.requestUtil.getRequest( url, { "token": "b0a20a70-61a8-11e5-9d70-feff819cdc9" },
        function( err, result, data ) {
            if ( data ) {
                this.requestUtil.jsonResponse(res, data);
            } else if ( err ) {
                this.requestUtil.errorResponse(res, err, 400);
            }
        }.bind(this));
}
