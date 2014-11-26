
var Util = require('../../core/util.js');
var _    = require('lodash');

module.exports = {
    updateGameConfigs: updateGameConfigs
};

function updateGameConfigs(req, res, next, serviceManager)
{
    if (Object.keys(req.body).length < 1) {
        this.requestUtil.errorResponse(res, {key: "data.gameConfig.missing", statsCode: 400});
        return;
    }

    // gameIds are not case sensitive
    var gameId = req.params.gameId.toUpperCase();
    var config = req.body;
    var dash = serviceManager.get("dash");

    // check if gameId exists
    dash.isValidGameId(gameId)
        .then(function(state){
            if(!state){
                return reject({key: "data.gameId.invalid", statusCode: 401});
            }

            return this.cbds.updateCongs(gameId, config);
        }.bind(this) )
        .then(function(){
            this.requestUtil.jsonResponse(res, { status: "ok" });
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this) );
}
