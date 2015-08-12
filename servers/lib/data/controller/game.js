
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
    getGameDataForUser:  getGameDataForUser,
    updateDevice: updateDevice,
    getGamePlayInfo: getGamePlayInfo,
    postTotalTimePlayed: postTotalTimePlayed,
    postGameAchievement: postGameAchievement,
    releases: releases,
    createMatch: createMatch,
    getMatch: getMatch,
    updateMatches: updateMatches,
    pollMatches: pollMatches,
    completeMatch: completeMatch,
    deleteGameSaves: deleteGameSaves
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

// http://localhost:8001/api/v2/data/game/AA-1/user/27
function getGameDataForUser(req, res, next)
{
    if( !( req.params &&
        req.params.hasOwnProperty("gameId") ) ) {
        this.requestUtil.errorResponse(res, { error: "missing game Id", key: "missing.gameId"});
        return;
    }
    var gameId = req.params.gameId;

    if( !( req.params &&
        req.params.hasOwnProperty("userId") ) ) {
        this.requestUtil.errorResponse(res, { error: "missing user Id", key: "data.userId.missing"});
        return;
    }
    var userId = req.params.userId;


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
    var outType;
    // TODO: replace this with DB lookup, return promise
    dash.isValidGameId(gameId)
        .then(function(state) {
            if (!state) {
                return when.reject({error: "invalid gameId"});
            }
            outType = '.ini';
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

function createMatch(req, res){
    if(!(req.params && req.params.gameId)) {
        this.requestUtil.errorResponse(res, {key: "data.gameId.missing"});
        return;
    }

    var userId;
    if( req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.session.passport.user.id ) {
        userId = req.session.passport.user.id;
    } else {
        this.requestUtil.errorResponse(res, { status: "error", error: "not logged in", key: "invalid.access"});
        return;
    }

    var gameId = req.params.gameId;
    var userIds = req.body.invitedUsers;
    if(!Array.isArray(userIds)){
        userIds = [userIds];
    }
    var firstUserId = userId;
    userIds.push(firstUserId);

    this.myds.getUsersByIds(userIds)
        .then(function(results){
            if(results.length < userIds.length){
                return "invalid userId";
            }
            return this.cbds.getGameInformation(gameId, true);
        }.bind(this))
        .then(function(result){
            if(typeof result === "string"){
                return result;
            } else {
                var canCreateMatches = result.basic.settings.canCreateMatches;
                if (!canCreateMatches) {
                    return "cannot create matches";
                }
            }
            var players = {};
            var player;
            userIds.forEach(function(userId){
                player = {};
                player.playerStatus = "active";
                players[userId] = player;
            });
            var data = {
                players: players,
                status: "active",
                history: [],
                meta: {
                    playerTurn: firstUserId
                }
            };
            return this.cbds.createMatch(gameId, data);
        }.bind(this))
        .then(function(match){
            if(match === "invalid userId"){
                this.requestUtil.errorResponse(res, {key: "data.user.invalid"});
                return;
            }
            if(match === "no object"){
                this.requestUtil.errorResponse(res, {key: "data.gameId.invalid"});
                return;
            }
            if(match === "cannot create matches"){
                this.requestUtil.errorResponse(res, {key: "data.gameId.match"});
                return;
            }
            this.requestUtil.jsonResponse(res, match);
        }.bind(this))
        .then(null, function(err){
            console.error(err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function getMatch(req, res) {
    if(!(req.params && req.params.gameId)) {
        this.requestUtil.errorResponse(res, {key: "data.gameId.missing"});
        return;
    }
    if(!(req.user && req.user.id)) {
        this.requestUtil.errorResponse(res, {key: "data.userId.missing"});
        return;
    }
    if(!req.params.matchId) {
        this.requestUtil.errorResponse(res, {key: "data.matchId.missing"});
        return
    }

    var gameId = req.params.gameId;
    var userId = req.user.id;
    var matchId = req.params.matchId;

    this.cbds.getMatch(gameId, matchId)
        .then(function(match) {
            this.requestUtil.jsonResponse(res, match);
        }.bind(this))
        .then(null, function(err) {
            console.error("Get Match Error -",err);
            this.requestUtil.errorResponse(res, { key: "data.gameId.general"});
        }.bind(this));
}

function updateMatches(req, res){
    if(!(req.params && req.params.gameId)) {
        this.requestUtil.errorResponse(res, {key: "data.gameId.missing"});
        return;
    }
    var gameId = req.params.gameId;

    if(!(req.body && typeof req.body === "object" && Object.keys(req.body).length > 0)){
        this.requestUtil.errorResponse(res, {key: "data.turnData.missing"});
        return;
    }
    var matchUpdates = req.body;
    if(!Array.isArray(matchUpdates)){
        matchUpdates = [matchUpdates];
    }

    var userId;
    if( req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.session.passport.user.id ) {
        userId = req.session.passport.user.id;
    } else {
        this.requestUtil.errorResponse(res, { status: "error", error: "not logged in", key: "invalid.access"});
        return;
    }

    var matchStatus;
    var matchesToUpdate;
    this.cbds.getGameInformation(gameId, true)
        .then(function(info){
            if(info === "no object") {
                return info;
            } else if(!info.basic.settings.canCreateMatches){
                return "cannot create matches";
            }
            matchesToUpdate = {};
            var matchId;
            var matchIds = [];
            matchStatus = {};
            _(matchUpdates).forEach(function(item){
                matchId = item.matchId;
                matchStatus[matchId] = "not a valid matchId";
                if(!matchesToUpdate[matchId]){
                    matchesToUpdate[matchId] = {};
                    matchesToUpdate[matchId].turns = [];
                    item.turnData.playerId = userId;
                    matchIds.push(matchId);
                }
                matchesToUpdate[matchId].nextPlayer = item.nextPlayer;
                matchesToUpdate[matchId].turns.push(item.turnData);
            }.bind(this));
            return this.cbds.multiGetMatches(gameId, matchIds);
        }.bind(this))
        .then(function(matches){
            if(typeof matches === "string"){
                return matches;
            }
            var data;
            var match;
            var player;
            matchStatus;
            _(matches).forEach(function(item, key){
                delete item.cas;
                delete item.flags;

                if(typeof item === "string"){
                    delete matches[key];
                    return;
                }
                match = item.value;
                //finish this
                var player = match.data.players[userId];
                // check if player is in match
                if(player){
                    // check if match is active for player
                    if(player.playerStatus === "active"){
                        // check if it is the player's turn
                        if(match.data.meta.playerTurn === userId ) {
                            data = match.data;
                            data.history = data.history.concat(matchesToUpdate[match.id].turns);
                            data.meta.playerTurn = matchesToUpdate[match.id].nextPlayer;
                            matchStatus[match.id] = "updated";
                        } else{
                            matchStatus[match.id] = "not your turn";
                        }
                    } else{
                        matchStatus[match.id] = "match complete";
                    }
                } else{
                    matchStatus[match.id] = "not your match";
                }
            });
            return this.cbds.multiSetMatches(matches);
        }.bind(this))
        .then(function(result){
            if(result === "no object"){
                this.requestUtil.errorResponse(res, {key: "data.gameId.invalid"});
                return;
            }
            if(result === "cannot create matches"){
                this.requestUtil.errorResponse(res, {key: "data.gameId.match"});
                return;
            }
            this.requestUtil.jsonResponse(res, { status: "ok", data: matchStatus });
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function pollMatches(req, res){
    if(!(req.params && req.params.gameId)) {
        this.requestUtil.errorResponse(res, {key: "data.gameId.missing"});
        return;
    }
    if(!(req.user && req.user.id)){
        this.requestUtil.errorResponse(res, {key: "data.userId.missing"});
        return;
    }
    if(!(req.query && req.query.status)){
        this.requestUtil.errorResponse(res, {key: "data.match.status.missing"});
        return
    }

    var gameId = req.params.gameId;
    var userId = req.user.id;
    var status = req.query.status;

    this.cbds.getGameInformation(gameId, true)
        .then(function(info){
            if(info === "no object") {
                return info;
            } else if(!info.basic.settings.canCreateMatches){
                return "cannot create matches";
            }
            return this.cbds.getAllGameMatchesByUserId(gameId, userId, status);
        }.bind(this))
        .then(function(matches){
            if(matches === "no object"){
                this.requestUtil.errorResponse(res, {key: "data.gameId.invalid"});
                return;
            }
            if(matches === "cannot create matches"){
                this.requestUtil.errorResponse(res, {key: "data.gameId.match"});
                return;
            }
            var activeMatches = {};
            var player;
            _(matches).forEach(function(match, matchId){
                player = match.data.players[userId];
                if( (status === "all") ||
                    (status === "active" && player.playerStatus === "active") ||
                    (status === "complete" && player.playerStatus === "complete") ){
                    activeMatches[matchId] = match.data;
                }
            });
            this.requestUtil.jsonResponse(res, activeMatches);
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function completeMatch(req, res){
    if(!(req.params && req.params.gameId)) {
        this.requestUtil.errorResponse(res, {key: "data.gameId.missing"});
        return;
    }
    if(!(req.body && req.body.matchId)){
        this.requestUtil.errorResponse(res, {key: "data.matchId.missing"});
        return;
    }
    if(!(req.user && req.user.id)){
        this.requestUtil.errorResponse(res, {key: "data.userId.missing"});
        return;
    }
    var gameId = req.params.gameId;
    var matchId = req.body.matchId;
    var userId = req.user.id;

    this.cbds.getMatch(gameId, matchId)
        .then(function(match){
            var players = match.data.players;
            var found = false;
            var complete = true;
            _(players).forEach(function(player, playerId){
                if(userId === parseInt(playerId)){
                    found = true;
                    player.playerStatus = "complete";
                } else if(player.playerStatus === "active"){
                    complete = false;
                }
            });
            if(!found){
                return "not in match";
            }
            if(complete){
                match.data.status = "complete";
            }
            return this.cbds.updateMatch(gameId, matchId, match);
        }.bind(this))
        .then(function(status){
            if(status === "not in match"){
                this.requestUtil.errorResponse(res, { key: "data.match.access"});
                return;
            }
            if(status === "no object"){
                this.requestUtil.errorResponse(res, {key: "data.gameId.invalid"});
                return;
            }
            if(status === "cannot create matches"){
                this.requestUtil.errorResponse(res, {key: "data.gameId.match"});
                return;
            }
            this.requestUtil.jsonResponse(res, { status: "ok" });
        }.bind(this))
        .then(null, function(err){
            console.error("Complet Match Error -",err);
            this.requestUtil.errorResponse(res, { key: "data.gameId.general"});
        }.bind(this));
}

function deleteGameSaves(req, res){
    if(!(req.user.role === "admin" && req.query.gameId)){
        this.requestUtil.errorResponse(res, { key: "data.access.invalid"});
        return;
    }
    var gameId = req.query.gameId;
    this.cbds.deleteGameSavesByGameId(gameId)
        .then(function(){
            this.requestUtil.jsonResponse(res, { status: "ok"});
        }.bind(this))
        .then(null, function(err){
            console.error("Delete Game Saves Error -", err);
            this.requestUtil.errorReponse(res, { key: "data.gameId.general"});
        }.bind(this));
}