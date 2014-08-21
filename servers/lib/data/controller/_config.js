
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

    var gameId = req.params.gameId.toUpperCase();
    var config = req.body;
    var gameIds = serviceManager.get("dash").service.getListOfGameIds();

    // check if gameId exists in list of gameIds
    if (_.contains(gameIds, gameId)) {
        this.cbds.updateConfigs(gameId, config)
            .then(function(){
                this.requestUtil.jsonResponse(res, { status: "ok" });
            }.bind(this))
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this));
    } else {
        this.requestUtil.errorResponse(res, {key: "data.gameId.invalid", statusCode: 401});
    }

}




