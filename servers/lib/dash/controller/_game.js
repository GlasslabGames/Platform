
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

        this.requestUtil.jsonResponse(res, this.getGameAssessmentInfo(gameId));
    } catch(err) {
        console.trace("Reports: Get Assessment Definitions Error -", err);
        this.stats.increment("error", "GetAssessmentDefinitions.Catch");
    }
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

        // userId, assessmentId, data
        if( !req.body ) {
            this.requestUtil.errorResponse(res, {error: "missing body"});
            return;
        }
        var data = req.body;

        // merge in current assessment
        this.telmStore.getAssessmentResults(userId, gameId, assessmentId)
            .then(function(aeResults){

                var out = _.cloneDeep(aeResults);
                out.gameId = gameId;
                out.userId = userId;
                out.assessmentId = assessmentId;

                // merge results if they exist
                if( !out.results &&
                    !_.isObject(out.results) ) {
                    out.results = {};
                }

                // remove old data
                if( _.isArray(out.results.watchout) ||
                    _.isArray(out.results.shoutout) ) {
                    delete out.results.watchout;
                    delete out.results.shoutout;
                }
                // merge results
                out.results = _.merge( out.results, data.results );

                //console.log("out:", out);
                return this.telmStore.saveAssessmentResults(userId, gameId, assessmentId, out);
            }.bind(this) )


            .then(function(){
                this.requestUtil.jsonResponse(res, {});
            }.bind(this) )
            // error
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this) );

    } catch(err) {
        console.trace("Reports: Save Assessment Results Error -", err);
        this.stats.increment("error", "SaveAssessmentResults.Catch");
    }
}
