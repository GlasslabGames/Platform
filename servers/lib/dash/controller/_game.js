
var _         = require('lodash');
var when      = require('when');
//
var Util      = require('../../core/util.js');

module.exports = {
    getAssessmentDefinitions: getAssessmentDefinitions,
    saveAssessmentResults:    saveAssessmentResults
};

var exampleIn = {};

// game AA, episode 1
exampleIn.getAssessmentDefinitions = {
    gameId: 'AA-1'
};
function getAssessmentDefinitions(req, res){
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
                return when.reject({ key: "report.gameId.invalid" } );
            }
            return this.getGameAssessmentInfo(gameId);
        }.bind(this) )
        .then(function(assessmentInfo){
            this.requestUtil.jsonResponse(res, assessmentInfo);
        }.bind(this) )
        .catch(function(err){
            console.trace("Reports: Get Assessment Error -", err);
            this.requestUtil.errorResponse(res, err);
            this.stats.increment("error", "GetAchievements.Catch");
        }.bind(this) );
}


exampleIn.saveAssessmentResults = {

};
function saveAssessmentResults(req, res){
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
        }.bind(this))
        // error
        .catch(function(err){
            console.trace("Reports: Save Assessment Error -", err);
            this.requestUtil.errorResponse(res, err);
            this.stats.increment("error", "SaveAssessment.Catch");
        });
}
