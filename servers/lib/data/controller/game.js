
var path      = require('path');
var _         = require('lodash');
var when      = require('when');
var lConst    = require('../../lms/lms.const.js');
var Util      = require('../../core/util.js');

module.exports = {
    saveGameData: saveGameData,
    getGameData:  getGameData,
    updateDevice: updateDevice,
    postTotalTimePlayed: postTotalTimePlayed,
    postGameAchievement: postGameAchievement
};
var exampleIn = {};
var exampleOut = {};


// ----------------------------------------
// game AA, episode 1
exampleIn.saveGameData = {
    id: 'AA-1'
};
function saveGameData(req, res, next)
{
    if( !req.body ) {
        this.requestUtil.errorResponse(res, { status: "error", error: "Game data missing", key: "missing.data"});
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
        req.params.hasOwnProperty("id") ) ) {
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

    this.cbds.saveGameData(userId, gameId, data)
        .then(function(){
            this.requestUtil.jsonResponse(res, { status: "ok" });
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

// game AA, episode 1
exampleIn.getGameData = {
    id: 'AA-1'
};
function getGameData(req, res, next)
{
    if( !req.body ) {
        this.requestUtil.errorResponse(res, { status: "error", error: "Game data missing", key: "missing.data"});
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
        req.params.hasOwnProperty("id") ) ) {
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

    this.cbds.getGameData(userId, gameId)
        .then(function(){
            this.requestUtil.jsonResponse(res, { status: "ok" });
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
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

exampleIn.postTotalTimePlayed = {
    addDiff: 123
};
function postTotalTimePlayed(req, res, next) {
    if( req.session &&
        req.session.passport &&
        req.session.passport.user) {

        var userData = req.session.passport.user;

        // deviveId required
        if( !(req.body &&
            req.body.addDiff &&
            _.isNumber(req.body.addDiff) ) ) {
            this.requestUtil.errorResponse(res, "missing addDiff from data");
            return;
        }

        if( !( req.params &&
            req.params.hasOwnProperty("gameId") ) ) {
            this.requestUtil.errorResponse(res, {error: "missing client/game Id"});
            return
        }
        var gameId = req.params.gameId;
        var timeDiff = parseFloat(req.body.addDiff);

        // TODO: validate gameId

        // update device Id
        //console.log("deviceId:", req.body.deviceId);
        this.cbds.addDiffToTotalTimePlayed(userData.id, gameId, timeDiff)
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
        .then(function(){
            this.requestUtil.jsonResponse(res, { status: "ok" });
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
            _.isNumber(req.body.group) ) ) {
            this.requestUtil.errorResponse(res, "missing group from data");
            return;
        }
        achievement.group = req.body.group;

        // subGroup required
        if( !(req.body &&
            req.body.subGroup &&
            _.isNumber(req.body.subGroup) ) ) {
            this.requestUtil.errorResponse(res, "missing subGroup from data");
            return;
        }
        achievement.subGroup = req.body.subGroup;

        // item required
        if( !(req.body &&
            req.body.item &&
            _.isNumber(req.body.item) ) ) {
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