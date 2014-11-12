
var _         = require('lodash');
var when      = require('when');
//
var Util      = require('../../core/util.js');

module.exports = {
    getAssessmentDefinitions: getAssessmentDefinitions,
    getAssessmentResults:     getAssessmentResults,
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


exampleIn.getAssessmentResults = {
    userId: 47,
    gameId: 'AA-1',
    assessmentId: "competency"
};
function getAssessmentResults(req, res){
    try {
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
        if(!this.isValidGameId(gameId)) {
            this.requestUtil.errorResponse(res, {key:"report.gameId.invalid", error: "invalid gameId"});
            return;
        }

        if( !req.params.userId ) {
            this.requestUtil.errorResponse(res, {error: "missing userId"});
            return;
        }
        var userId = req.params.userId;

        if( !req.params.assessmentId ) {
            this.requestUtil.errorResponse(res, {error: "missing assessmentId"});
            return;
        }
        var assessmentId = req.params.assessmentId;

        // get the assessment results for the user
        this.telmStore.getAssessmentResults(userId, gameId, assessmentId)
            .then(function(aeResults){
                //console.log( "getAssessmentResults: ", aeResults );
                this.requestUtil.jsonResponse(res, aeResults);
            }.bind(this) )
            // error
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this) );

    } catch(err) {
        console.trace("Reports: Get Assessment Results Error -", err);
        this.stats.increment("error", "GetAssessmentResults.Catch");
    }
}


exampleIn.saveAssessmentResults = {
    userId: 47,
    gameId: 'AA-1',
    assessmentId: "competency",
    data: {}
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
        }.bind(this) )
        // error
        .catch(function(err){
            console.trace("Reports: Save Assessment Error -", err);
            this.requestUtil.errorResponse(res, err);
            this.stats.increment("error", "SaveAssessment.Catch");
        }.bind(this) );
}
