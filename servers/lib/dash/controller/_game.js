
var _         = require('lodash');
var when      = require('when');
//
var Util      = require('../../core/util.js');

module.exports = {
    getAssessmentDefinitions:  getAssessmentDefinitions,
    saveAssessmentResults: saveAssessmentResults
};

var exampleIn = {};

// game AA, episode 1
exampleIn.getAssessmentDefinitions = {
    gameId: 'AA-1'
};
function getAssessmentDefinitions(req, res){
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
        if( !this.games.hasOwnProperty(gameId) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return;
        }

        var game = this.games[gameId];
        if( game.info &&
            game.info.hasOwnProperty('assessment')) {
            this.requestUtil.jsonResponse(res, game.info['assessment']);
        } else {
            this.requestUtil.jsonResponse(res, []);
        }

    } catch(err) {
        console.trace("Reports: Get Assessment Error -", err);
        this.stats.increment("error", "GetAchievements.Catch");
    }
}


exampleIn.saveAssessmentResults = {

};
function saveAssessmentResults(req, res){
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
        if( !this.games.hasOwnProperty(gameId) ) {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
            return;
        }

        // userId, assessmentId, data
        if( !req.body ) {
            this.requestUtil.errorResponse(res, {error: "missing body"});
            return;
        }
        var data = req.body;
        data.gameId = gameId;

        if( !req.body.userId ) {
            this.requestUtil.errorResponse(res, {error: "missing userId"});
            return;
        }
        var userId = req.body.userId;

        if( !req.body.assessmentId ) {
            this.requestUtil.errorResponse(res, {error: "missing assessmentId"});
            return;
        }
        var assessmentId = req.body.assessmentId;

        this.telmStore.saveAssessmentResults(gameId, userId, assessmentId, data)
            .then(function(){
                this.requestUtil.jsonResponse(res, {});
            }.bind(this) )
            // error
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this) );

    } catch(err) {
        console.trace("Reports: Get Assessment Error -", err);
        this.stats.increment("error", "GetAchievements.Catch");
    }
}