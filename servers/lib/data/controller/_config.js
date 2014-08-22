
var Util = require('../../core/util.js');
var _    = require('lodash');

module.exports = {
    updateGameConfigs: updateGameConfigs
};

function updateGameConfigs(req, res, next, serviceManager)
{
    // TODO: check input
    var data = req.body;
    // TODO: check if gameId exists in req.params otherwise this will error
    var gameId = req.params.gameId.toUpperCase();
    var gameIds = serviceManager.get("dash").service.getListOfGameIds();

    // check if gameId exists in list of gameIds
    if (_.contains(gameIds, gameId)) {
        this.cbds.updateConfigs(gameId, data)
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




