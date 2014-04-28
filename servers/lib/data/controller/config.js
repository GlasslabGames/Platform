
var Util = require('../../core/util.js');

module.exports = {
    index: index
};

function index(req, res, next)
{
    if( req.params &&
        req.params.hasOwnProperty("id") ) {
        // config for game
    }

    this.myds.getConfigs()
        .then(function(data){
            this.requestUtil.jsonResponse(res, data);
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}
