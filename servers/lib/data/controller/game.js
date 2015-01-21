
var path      = require('path');
var _         = require('lodash');
var when      = require('when');
var ini       = require('ini');
//
var lConst    = require('../../lms/lms.const.js');
var Util      = require('../../core/util.js');

module.exports = {
    saveGameData: saveGameData,
    getGameData:  getGameData,
    deleteGameData: deleteGameData,
    updateDevice: updateDevice,
    getGamePlayInfo: getGamePlayInfo,
    postTotalTimePlayed: postTotalTimePlayed,
    postGameAchievement: postGameAchievement,
    releases: releases,
    createMultiplayerMatch: createMultiplayerMatch
};
var exampleIn = {};
var exampleOut = {};


// ----------------------------------------
// game AA, episode 1
exampleIn.saveGameData = {
    id: 'AA-1'
};
/*
 {
 "a": 456,
 "b": 4.31,
 "c": "test"
 }
 */
function saveGameData(req, res, next)
{
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
        return
    }
    var gameId = req.params.gameId;

    // TODO: check if gameId in DB

    var data = req.body;
    this.cbds.saveUserGameData(userId, gameId, data)
        .then(function(){
            this.requestUtil.jsonResponse(res, { status: "ok" });
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

// http://localhost:8001/api/v2/data/game/AA-1
// game AA, episode 1
exampleIn.getGameData = {
    id: 'AA-1'
};
function getGameData(req, res, next)
{
    // route requireAuth ensures "session.passport.user" exists
    var userId = req.session.passport.user.id;

    if( !( req.params &&
        req.params.hasOwnProperty("gameId") ) ) {
        this.requestUtil.errorResponse(res, { error: "missing game Id", key: "missing.gameId"});
        return
    }
    var gameId = req.params.gameId;

    // TODO: check if gameId in DB


    this.cbds.getUserGameData(userId, gameId)
        .then(function(data){
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


// http://localhost:8001/api/v2/data/game/AA-1
// game AA, episode 1
exampleIn.getGameData = {
    id: 'AA-1'
};
function deleteGameData(req, res, next)
{
    // route requireAuth ensures "session.passport.user" exists
    var userId = req.session.passport.user.id;

    if( !( req.params &&
        req.params.hasOwnProperty("gameId") ) ) {
        this.requestUtil.errorResponse(res, { error: "missing game Id", key: "missing.gameId"});
        return
    }
    var gameId = req.params.gameId;

    // TODO: check if gameId in DB


    this.cbds.removeUserGameData(userId, gameId)
        .then(function(){
            this.requestUtil.jsonResponse(res, { status: "ok" });
        }.bind(this))
        .then(null, function(err) {
            // missing
            if(err.code == 13) {
                // this is ok
                this.requestUtil.errorResponse(res, { status: "ok" });
            } else {
                this.requestUtil.errorResponse(res, err);
            }
        }.bind(this));
}


// ----------------------------------------
exampleIn.updateDevice = {
    deviceId: "ASD-QWER-ASD",
    gameId: "AA-1"
};
function updateDevice(req, res, next) {
    if( req.session &&
        req.session.passport &&
        req.session.passport.user) {

        var userData = req.session.passport.user;

        // deviveId required
        if( !(req.body &&
              req.body.deviceId &&
              req.body.deviceId.length) ) {
            this.requestUtil.errorResponse(res, "missing deviceId");
            return;
        }

        if( !(req.body &&
            req.body.gameId &&
            req.body.gameId.length) ) {
            this.requestUtil.errorResponse(res, "missing gameId");
            return;
        }

        // update device Id
        //console.log("deviceId:", req.body.deviceId);
        this.cbds.updateUserDeviceId(userData.id, req.body.gameId, req.body.deviceId)
            .then(function(){
                this.requestUtil.jsonResponse(res, { status: "ok" } );
            }.bind(this))

            // catch all errors
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this));

    } else {
        this.requestUtil.errorResponse(res, "not logged in");
    }
}

// TODO: look at security around totalTimePlayed setting
exampleIn.postTotalTimePlayed = {
    addTimeDiff: 123,
    setTime: 123456
};
function postTotalTimePlayed(req, res, next) {
    if( req.session &&
        req.session.passport &&
        req.session.passport.user) {

        var userData = req.session.passport.user;
        var timeDiff = null;
        var totalTimePlayed = null;

        if( (req.body &&
            req.body.addDiff &&
            _.isNumber(req.body.addDiff) ) ) {
            timeDiff = parseFloat(req.body.addDiff);
        }

        if( req.body &&
            req.body.hasOwnProperty('setTime') &&
            _.isNumber(req.body.setTime))
        {
            totalTimePlayed = parseFloat(req.body.setTime);
        }

        // addDiff required
        if( !timeDiff && !totalTimePlayed ) {
            this.requestUtil.errorResponse(res, "missing addDiff or totalTimePlayed from data");
            return;
        }

        if( !( req.params &&
               req.params.hasOwnProperty("gameId") )
          ) {
            this.requestUtil.errorResponse(res, {error: "missing client/game Id"});
            return
        }
        var gameId = req.params.gameId;

        // TODO: validate gameId


        // update device Id
        //console.log("deviceId:", req.body.deviceId);
        this.cbds.addDiffToTotalTimePlayed(userData.id, gameId, timeDiff, totalTimePlayed)
            .then(function(){
                this.requestUtil.jsonResponse(res, { status: "ok" } );
            }.bind(this))

            // catch all errors
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this));

    } else {
        this.requestUtil.errorResponse(res, "not logged in");
    }
}

function getGamePlayInfo(req, res, next)
{
    if( !req.body ) {
        this.requestUtil.errorResponse(res, { status: "error", error: "User Preference data missing", key: "missing.data"});
        return;
    }

    var userId;
    if(req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.session.passport.user.id) {
        userId = req.session.passport.user.id;
    } else {
        this.requestUtil.errorResponse(res, { status: "error", error: "not logged in", key: "invalid.access"});
        return;
    }

    if( !( req.params &&
        req.params.hasOwnProperty("gameId") ) ) {
        this.requestUtil.errorResponse(res, {error: "missing client/game Id"});
        return
    }
    var gameId = req.params.gameId;

    var data = req.body;
    try{
        data = JSON.parse(data);
    } catch(err){
        // this is ok, data doesn't have to be json
    }

    this.cbds.getGamePlayInfo(userId, gameId)
        .then(function(data){
            this.requestUtil.jsonResponse(res, data);
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}


exampleIn.postGameAchievement = {
    group:    "CCSS.ELA-Literacy.WHST.6-8.1",
    subGroup: "b",
    item:     "Core Cadet"
};
function postGameAchievement(req, res, next) {
    if( req.session &&
        req.session.passport &&
        req.session.passport.user) {

        var userData = req.session.passport.user;
        var achievement = {};

        // group required
        if( !(req.body &&
            req.body.group &&
            _.isString(req.body.group) ) ) {
            this.requestUtil.errorResponse(res, "missing group from data");
            return;
        }
        achievement.group = req.body.group;

        // subGroup required
        if( !(req.body &&
            req.body.subGroup &&
            _.isString(req.body.subGroup) ) ) {
            this.requestUtil.errorResponse(res, "missing subGroup from data");
            return;
        }
        achievement.subGroup = req.body.subGroup;

        // item required
        if( !(req.body &&
            req.body.item &&
            _.isString(req.body.item) ) ) {
            this.requestUtil.errorResponse(res, "missing item from data");
            return;
        }
        achievement.item = req.body.item;


        if( !( req.params &&
            req.params.hasOwnProperty("gameId") ) ) {
            this.requestUtil.errorResponse(res, {error: "missing client/game Id"});
            return
        }
        var gameId = req.params.gameId;
        // TODO: validate gameId

        // update device Id
        //console.log("deviceId:", req.body.deviceId);
        this.cbds.postGameAchievement(userData.id, gameId, achievement)
            .then(function(){
                this.requestUtil.jsonResponse(res, { status: "ok" } );
            }.bind(this))

            // catch all errors
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this));

    } else {
        this.requestUtil.errorResponse(res, "not logged in");
    }
}

// http://127.0.0.1:8001/api/v2/data/game/SC/releases.ini
function releases(req, res, next, serviceManager) {
    if( !( req.params &&
        req.params.hasOwnProperty("gameId") ) ) {
        this.requestUtil.errorResponse(res, {error: "missing client/game Id"});
        return
    }
    var gameId = req.params.gameId;

    var dash = serviceManager.get("dash").service;
    // TODO: replace this with DB lookup, return promise
    dash.isValidGameId(gameId)
        .then(function(state) {
            if (!state) {
                return when.reject({error: "invalid gameId"});
            }
            var outType = '.ini';
            if (req.params && req.params.hasOwnProperty("type")) {
                outType = req.params.type;
            }
            var dash = serviceManager.get("dash").service;
            return dash.getGameReleases(gameId);

        }.bind(this) )
        .then(function(releaseInfo){
            if(outType === '.ini') {
                var out = ";aiu;\r\n\r\n";

                out += ini.stringify(releaseInfo);
                this.requestUtil.textResponse(res, out, 200);
            } else {
                this.requestUtil.jsonResponse(res, releaseInfo );
            }
        }.bind(this) )
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this) );
}

function createMultiplayerMatch(req, res){
    if(!(req.params && req.params.userId && req.params.gameId && req.user && req.user.id)) {
        this.requestUtil.errorResponse(res, {key: "data.gameId.missing"});
    }
    if(!(req.params.userId && req.user && req.user.id)){
        this.requestUtil.errorResponse(res, {key: "data.userId.missing"});
    }
    var gameId = req.params.gameId;
    var userId = req.user.id;
    var invitedUserId = req.params.userId;
    
    this.myds.getUsersByIds([userId, invitedUserId])
        .then(function(results){
            if(results.length !== 2){
                return "invalid userId";
            }
            return this.cbds.getGameInformation(gameId, true);
        }.bind(this))
        .then(function(state){
            if(typeof state === "string"){
                return state;
            }
            var data = {
                players: [userId,invitedUserId],
                status: "pending",
                turns: [],
                meta: {}
            };
            return this.cbds.createMultiplayerMatch(gameId, data);
        }.bind(this))
        .then(function(state){
            if(state === "invalid userId"){
                this.requestUtil.errorResponse(res, {key: "data.user.invalid"});
                return;
            }
            if(state === "no object"){
                this.requestUtil.errorResponse(res, {key: "data.gameId.invalid"});
                return;
            }
            this.requestUtil.jsonResponse(res, { status: "ok" });
        }.bind(this))
        .then(null, function(err){
            console.error(err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}
