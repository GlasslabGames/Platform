
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
                this.requestUtil.errorResponse(res, {key:"report.gameId.invalid", error: "invalid gameId"});
            } else {
                this.requestUtil.jsonResponse(res, this.getGameAssessmentInfo(gameId));
            }
        }.bind(this) )
        .catch(function(err){
            console.trace("Reports: Get Assessment Error -", err);
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
                this.requestUtil.errorResponse(res, {key: "report.gameId.invalid", error: "invalid gameId"});
            } else {

                if (!req.params.userId) {
                    this.requestUtil.errorResponse(res, {error: "missing userId"});
                    return;
                }
                var userId = req.params.userId;

                if (!req.params.assessmentId) {
                    this.requestUtil.errorResponse(res, {error: "missing assessmentId"});
                    return;
                }
                var assessmentId = req.params.assessmentId;

                // userId, assessmentId, data
                if (!req.body) {
                    this.requestUtil.errorResponse(res, {error: "missing body"});
                    return;
                }
                var data = req.body;

                // merge in current assessment
                this._saveAssessmentResults(userId, gameId, assessmentId, data)
                    .then(function () {
                        this.requestUtil.jsonResponse(res, {});
                    }.bind(this))
                    // error
                    .then(null, function (err) {
                        this.requestUtil.errorResponse(res, err);
                    }.bind(this));

            }
        }.bind(this) )
        .catch(function(err){
            console.trace("Reports: Save Assessment Error -", err);
            this.stats.increment("error", "SaveAssessment.Catch");
        });
}
