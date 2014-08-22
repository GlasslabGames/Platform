
var Util = require('../../core/util.js');
var _    = require('lodash');

module.exports = {
    index: index,
    connect: connect
};

function index(req, res, next)
{
    // default simcity
    var gameId = 'SC';
    if( req.params &&
        req.params.hasOwnProperty("gameId") ) {
        gameId = req.params.gameId;
    }

    this.cbds.getConfigs(gameId)
        .then(function(config){
            this.requestUtil.jsonResponse(res, config);
        }.bind(this))
        .then(null, function(err){
            if(err.code == 13) {
                this.myds.getConfigs()
                    .then(function(config) {
                        this.requestUtil.jsonResponse(res, config);
                    }.bind(this));
            } else {
                console.error("Data Service: Get Config Error -", err);
                this.requestUtil.errorResponse(res, {key: "data.config.error", statusCode: 500});
            }
        }.bind(this));
}

function connect(req, res, next)
{
    var host = req.headers.host;
    res.send("http://"+host);
}
