var _         = require('lodash');
var when      = require('when');
//
var Util      = require('../../core/util.js');
var dConst    = require('../dash.const.js');
var fs = require('fs');

module.exports = {
    getActiveGamesBasicInfo:         getActiveGamesBasicInfo,
    getGamesBasicInfo:               getGamesBasicInfo,
    getPlanLicenseGamesBasicInfo:    getPlanLicenseGamesBasicInfo,
    getAvailableGamesObj:            getAvailableGamesObj,
    getGamesBasicInfoByPlan:         getGamesBasicInfoByPlan,
    getActiveGamesDetails:           getActiveGamesDetails,
    getMyGames:                      getMyGames,
    reloadGameFiles:                 reloadGameFiles,
    migrateInfoFiles:                migrateInfoFiles,
    getDeveloperProfile:             getDeveloperProfile,
    getDeveloperGameIds:             getDeveloperGameIds,
    getDeveloperGamesInfo:           getDeveloperGamesInfo,
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
                    // logic moved to _infoFormat method
                    //for(var i = 0; i < gameIds.length; i++) {
                    //    var gameId = gameIds[i];
                    //
                    //    var info = _.cloneDeep(promiseList[i]);
                    //
                    //    // TODO: move license check to it's own function
                    //    info.license.valid = false;
                    //    if(info.license.type == "free") {
                    //        info.license.valid = true;
                    //    }
                    //    else if(info.license.type == "loginType") {
                    //        info.license.loginType = info.license.loginType.split(',');
                    //        if( _.contains(info.license.loginType, loginType) ) {
                    //            info.license.valid = true;
                    //        }
                    //    } else {
                    //        // check license
                    //        info.license.valid = licenseGameIds.hasOwnProperty(gameId);
                    //    }
                    //
                    //    // no maintenance message and if invalid lic, replace with invalid lic message
                    //    if(!info.maintenance && !info.license.valid) {
                    //        info.maintenance = { message: info.license.message.invalid };
                    //    }
                    //
                    //    outGames.push( info );
                    //}
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
            console.error("Get License Games Basic Info Error -",err);
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
            var  licConst = require("../../lic/lic.const.js");
            if(licenseId){
                var license = results[0];
                var plan = licConst.plan[license["package_type"]];
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
            console.error("Get Available Game Map Error -",err);
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
            console.error("Get Games Basic Info By Plan Error -",err);
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
            var lConst = require('../../lic/lic.const.js');
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
                console.error("Get Plan Games Basic Info Error -",err);
                reject(err);
            });
    }.bind(this));
}

// no input
function getGamesBasicInfo(req, res){
    try {
        var loginType = "guest";
        var promise = null;
        var gameIds;
        var licenseGameIds;
        //var outGames = [];
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
                this.getListOfAllGameIds()
                    .then(function(ids){
                        gameIds = ids;
                        var promiseList = [];
                        gameIds.forEach(function (gameId) {
                            promiseList.push(this.getGameBasicInfo(gameId));
                        }.bind(this) );
                        return when.all(promiseList);
                    }.bind(this) )
                    .then(function(gamesInfo){
                        // logic moved to _infoFormat method
                        //for(var i = 0; i < gameIds.length; i++) {
                        //    var gameId = gameIds[i];
                        //
                        //    var info = _.cloneDeep(promiseList[i]);
                        //
                        //    // TODO: move license check to it's own function
                        //    info.license.valid = false;
                        //    if(info.license.type == "free") {
                        //        info.license.valid = true;
                        //    }
                        //    else if(info.license.type == "loginType") {
                        //        info.license.loginType = info.license.loginType.split(',');
                        //        if( _.contains(info.license.loginType, loginType) ) {
                        //            info.license.valid = true;
                        //        }
                        //    } else {
                        //        // check license
                        //        info.license.valid = licenseGameIds.hasOwnProperty(gameId);
                        //    }
                        //
                        //    // no maintenance message and if invalid lic, replace with invalid lic message
                        //    if(!info.maintenance && !info.license.valid) {
                        //        info.maintenance = { message: info.license.message.invalid };
                        //    }
                        //
                        //    outGames.push( info );
                        //}

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
            // logic moved to _infoFormat method
            // promiseList, once resolved, contains details from various games
            //promiseList.forEach(function(gameDetails){
                //    var info = _.cloneDeep(gameDetails);
                //
                //    // TODO: move license check to it's own function
                //    info.license.valid = false;
                //    if(info.license.type == "free") {
                //        info.license.valid = true;
                //    }
                //    else if(info.license.type == "loginType") {
                //        info.license.loginType = info.license.loginType.split(',');
                //        if( _.contains(info.license.loginType, loginType) ) {
                //            info.license.valid = true;
                //        }
                //    } else {
                //        // check license
                //        info.license.valid = licenseGameIds.hasOwnProperty(gameId);
                //    }
                //
                //    // no maintenance message and if invalid lic, replace with invalid lic message
                //    if(!info.maintenance && !info.license.valid) {
                //        info.maintenance = { message: info.license.message.invalid };
                //    }
                //    outGames.push( info );
                //}.bind(this) );
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

        // TODO: move license check to it's own function
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
        longName: "Mars Generation One - Argubot Academy EDU",
        description: "Put your powers of persuasion to the ultimate test, on a whole new planet! Argubot Academy EDU is an adventure game for iOS tablets. Designed for students in grades 6-8, the game develops persuasion and reasoning skills for STEM &amp; 21st century careers.",
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
    if(req.user.role !== "developer"){
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

function getDeveloperGamesInfo(req, res){
    var userId = req.user.id;
    if(req.user.role !== "developer"){
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"},401);
        return;
    }
    getDeveloperGameIds.call(this,userId)
        .then(function(gameIds){
            var basic;
            var basicGameInfo = {};
            _(gameIds).forEach(function(value, gameId){
                basic = this._games[gameId].info.basic;
                basicGameInfo[gameId] = basic;
            }.bind(this));
            var output = JSON.stringify(basicGameInfo);
            res.end(output);
        }.bind(this))
        .then(null, function(err){
            console.trace("Dash: Get Developer Profile Error -", err);
            this.requestUtil.errorResponse(res, err);
            this.stats.increment("error", "GetDeveloperGamesInfo.Catch");
        }.bind(this));
}

function updateDeveloperGameInfo(req, res){
    var userId = req.user.id;
    var gameId = req.params.gameId;
    if(req.user.role !== "developer"){
        this.requestUtil.errorResponse(res, {key:"dash.access.invalid"},401);
        return;
    }
    var data = req.body.data;

    if(!data.basic){
        this.requestUtil.errorResponse(res, {key:"dash.info.missing"},401);
        return;
    }
    var infoData;
    getDeveloperGameIds.call(this,userId)
        .then(function(gameIds){
            if(gameIds[gameId]){
                return this.telmStore.getGameInformation(gameId, true);
            }
            return "no access"
        }.bind(this))
        .then(function(results){
            if(typeof results === "string"){
                return results;
            }
            var basic = results.basic;
            var details = results.details;
            if(!(basic && details)){
                return "malformed object";
            }
            _(basic).forEach(function(value, property){
                basic[property] = data[property];
            });
            _(details).forEach(function(value, property){
                details[property] = data[property];
            });
            results.basic = basic;
            results.details = details;
            infoData = results;
            return _writeToInfoJSONFiles(gameId, JSON.stringify(infoData, null, 4));
        })
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return this.telmStore.updateGameInformation(gameId, infoData);
        }.bind(this))
        .then(function(status){
            if(status !== "no object" && status !== "no access" && status !== "malformed object"){
                this.buildGameForGamesObject(infoData, gameId);
                res.end('{"update":"complete"}');
            } else if(status === "malformed object"){
                this.requestUtil.errorResponse(res, {key:"dash.info.malformed"});
            } else{
                this.requestUtil.errorResponse(res, {key:"dash.access.invalid"});
            }
        }.bind(this))
        .then(null, function(err){
            var error = {
                update: "failed",
                error: err
            };
            error = JSON.stringify(error);
            console.trace("Dash: Update Developer Game Info Error -", err);
            this.requestUtil.errorResponse(res, error, 401);
            this.stats.increment("error", "UpdateDeveloperGameInfo.Catch");
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
