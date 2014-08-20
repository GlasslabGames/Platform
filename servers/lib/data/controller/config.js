
var Util = require('../../core/util.js');
var _    = require('lodash');

module.exports = {
    index: index
};

function index(req, res, next)
{
    if( req.params &&
        req.params.hasOwnProperty("gameId") ) {
        // TODO: config for game
    }

    var gameId = req.params.gameId;

    this.cbds.getConfigs(gameId)
        .then(function(data){
            this.requestUtil.jsonResponse(res, data);
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, {key: "data.gameId.missing", statusCode: 401});
        }.bind(this));
}




