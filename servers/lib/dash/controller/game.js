
var _         = require('lodash');
var when      = require('when');
//
var Util      = require('../../core/util.js');

module.exports = {
    getAchievements: getAchievements
};

function getAchievements(req, res){
    try {

        if( req.params &&
            req.params.hasOwnProperty("id") &&
            this.gameInfo.hasOwnProperty(req.params.id) ) {

            if(this.gameInfo[req.params.id].hasOwnProperty('$Achievements')) {

                var info = this.gameInfo[req.params.id]['$Achievements'];

                this.requestUtil.jsonResponse(res, info);
            } else {
                this.requestUtil.jsonResponse(res, { total: 0 });
            }
        } else {
            this.requestUtil.errorResponse(res, {error: "invalid game id"});
        }

    } catch(err) {
        console.trace("Reports: Get Achievements Error -", err);
        this.stats.increment("error", "GetAchievements.Catch");
    }
}
