
var _         = require('lodash');
var when      = require('when');


module.exports = {
    getCsvParseSchema:    getCsvParseSchema,
    updateCsvParseSchema: updateCsvParseSchema
};

function getCsvParseSchema(req, res, next){
    try {
        // check input
        if( !( req.params &&
            req.params.hasOwnProperty("gameId") ) ) {
            this.requestUtil.errorResponse(res, {error: "missing game id"});
            return;
        }
        var gameId = req.params.gameId;
        // gameIds are not case sensitive
        gameId = gameId.toUpperCase();

        this.store.getCsvDataByGameId(gameId)
            .then(function(data){
                this.requestUtil.textResponse(res, data);
            }.bind(this))

            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this));

    } catch(err) {
        console.trace("Research: Get Csv Parse Schema Error -", err);
        this.stats.increment("error", "GetCsvParseSchema.Catch");
        this.requestUtil.errorResponse(res, {error: err});
    }
}

function updateCsvParseSchema(req, res, next){
    try {
        // check input
        if( !( req.params &&
            req.params.hasOwnProperty("gameId") ) ) {
            this.requestUtil.errorResponse(res, {error: "missing game id"});
            return;
        }
        var gameId = req.params.gameId;
        // gameIds are not case sensitive
        gameId = gameId.toUpperCase();

        if( !( req.body &&
            req.body.hasOwnProperty("data") ) ) {
            this.requestUtil.errorResponse(res, {error: "missing data"});
            return;
        }
        var data = req.body.data;

        this.store.setCsvDataByGameId(gameId, data)
            .then(function(){
                this.requestUtil.jsonResponse(res, {});
            }.bind(this))

            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this));

    } catch(err) {
        console.trace("Research: Get Csv Parse Schema Error -", err);
        this.stats.increment("error", "GetCsvParseSchema.Catch");
        this.requestUtil.errorResponse(res, {error: err});
    }
}
