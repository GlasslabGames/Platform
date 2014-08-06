
var path      = require('path');
var _         = require('lodash');
var when      = require('when');

module.exports = {
    endQSession:     endQSession,
    cleanupQSession: cleanupQSession
};
var exampleIn = {};
var exampleOut = {};

exampleIn.endQSession = {
    id: 1
};
function endQSession(req, res, next)
{
    if( !( req.body &&
           req.body.id )
      ) {
        var err = { status: "error", error: "Game session Q ID", key: "missing.data"};
        console.error("endQSession Error:", err);
        this.requestUtil.errorResponse(res, err);
        return;
    }
    var id = req.body.id;

    this.cbds.endQSession(id)
        .then(function(){
            this.requestUtil.jsonResponse(res, { status: "ok" });
        }.bind(this))
        .then(null, function(err){
            console.error("endQSession Error:", err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

exampleIn.cleanupQSession = {
    id: 1
};
function cleanupQSession(req, res, next)
{
    if( !( req.body &&
        req.body.id )
        ) {
        var err = { status: "error", error: "Game session Q ID", key: "missing.data"};
        console.error("cleanupQSession Error:", err);
        this.requestUtil.errorResponse(res, err);
        return;
    }
    var id = req.body.id;

    this.cbds.cleanupQSession(id)
        .then(function(){
            this.requestUtil.jsonResponse(res, { status: "ok" });
        }.bind(this))
        .then(null, function(err){
            console.error("cleanupQSession Error:", err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}
