
var _         = require('lodash');
var when      = require('when');
var lConst    = require('../../lms/lms.const.js');
var Util      = require('../../core/util.js');

module.exports = {
    saveUserPref: saveUserPref,
    getUserPref:  getUserPref
};
var exampleIn = {};
var exampleOut = {};

// ----------------------------------------
//
exampleIn.saveUserPref = {
    id: 'AA-1'
};
function saveUserPref(req, res, next)
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
        req.params.hasOwnProperty("id") ) ) {
        this.requestUtil.errorResponse(res, {error: "missing client/game Id"});
        return
    }
    var gameId = req.params.id;

    var data = req.body;
    try{
        data = JSON.parse(data);
    } catch(err){
        // this is ok, data doesn't have to be json
    }

    this.cbds.saveUserPref(userId, gameId, data)
        .then(function(){
            this.requestUtil.jsonResponse(res, { status: "ok" });
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

// game AA, episode 1
exampleIn.getUserPref = {
    id: 'AA-1'
};
function getUserPref(req, res, next)
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
        req.params.hasOwnProperty("id") ) ) {
        this.requestUtil.errorResponse(res, {error: "missing client/game Id"});
        return
    }
    var gameId = req.params.id;

    var data = req.body;
    try{
        data = JSON.parse(data);
    } catch(err){
        // this is ok, data doesn't have to be json
    }

    this.cbds.getUserPref(userId, gameId)
        .then(function(){
            this.requestUtil.jsonResponse(res, { status: "ok" });
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}