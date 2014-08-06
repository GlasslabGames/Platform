
var _         = require('lodash');
var when      = require('when');
var lConst    = require('../../lms/lms.const.js');
//

module.exports = {
    saveCompetencyResults: saveCompetencyResults
};

var exampleIn = {}, exampleOut = {};

// register a license to the signed in user
/*
 POST
 http://localhost:8001/int/v1/dash/reports/competency/results
 */
exampleIn.saveCompetencyResults = {

};
function saveCompetencyResults(req, res, next) {
    if( req.body) {

    } else {
        this.requestUtil.errorResponse(res, {error:"missing competency results", key:"competencyResults.missing"}, 404);
    }
}
