
var when = require('when');
var _    = require('lodash');

var Util = require('../../core/util.js');

module.exports = {
    index: index,
    connect: connect
};

// http://127.0.0.1:8001/api/v2/data/config/SC
//
function index(req, res, next, serviceManager)
{
    gameId = "SC";
    if( req.params &&
        req.params.hasOwnProperty("gameId") ) {
        gameId = req.params.gameId;
    }

    var dash = serviceManager.get("dash").service;
    // TODO: replace this with DB lookup, return promise
    dash.isValidGameId(gameId)
        .then(function(state){
            if(!state){
                this.requestUtil.errorResponse(res, {error: "invalid gameId"});
            } else{
                var defaultConfig = {
                    "eventsMaxSize": 100,
                    "eventsMinSize": 5,
                    "eventsPeriodSecs": 30,
                    "eventsDetailLevel": 10
                };
                var configP = [];

                configP.push(
                    this.cbds.getConfigs("default")
                        .then(null, function(err){
                            if(err.code == 13) {
                                return this.cbds.updateConfigs("default", defaultConfig);
                            }
                            else { return when.reject(err); }
                        }.bind(this))
                );
                configP.push(
                    this.cbds.getConfigs(gameId)
                        .then(null, function(err){
                            if(err.code == 13) {
                                return this.cbds.updateConfigs(gameId, defaultConfig);
                            }
                            else { return when.reject(err); }
                        }.bind(this))
                );

                var p = when.reduce(configP, function(pconfig, config){
                    return _.merge(pconfig, config);
                }.bind(this), defaultConfig);

                p.then(function(config){
                    this.requestUtil.jsonResponse(res, config);
                }.bind(this))
                    .then(null, function(err){
                        console.error("Data Service: Get Config Error -", err);
                        this.requestUtil.errorResponse(res, {key: "data.config.error", statusCode: 500});
                    }.bind(this));
            }
        }.bind(this) );
}

// http://127.0.0.1:8001/sdk/connect
function connect(req, res, next)
{
    // host
    var host = req.headers.host;
    if( this.options.sdk &&
        this.options.sdk.connect ) {
        if( this.options.sdk.connect != "$host" ) {
            host = this.options.sdk.connect;
        }
    }
    // protocol
    var protocol = "http://";
    if( this.options.env !== "dev" ) {
        protocol = "http://";
    }
    //send
    res.send( protocol + host );
}
