/**
 * LMS Service Module
 *
 */

var http       = require('http');
// Third-party libs
var _          = require('lodash');
var when       = require('when');
// load at runtime
var Util, lConst;

module.exports = LMSService;

function LMSService(options){
    try{
        var WebStore, LMSStore;

        this.options = _.merge(
            {
            },
            options
        );

        // Glasslab libs
        LMSStore   = require('./lms.js').Datastore.MySQL;
        WebStore   = require('../dash/dash.js').Datastore.MySQL;
        Util       = require('../core/util.js');
        lConst     = require('./lms.js').Const;

        this.requestUtil = new Util.Request(this.options);
        this.webstore    = new WebStore(this.options.webapp.datastore.mysql);
        this.myds        = new LMSStore(this.options.lms.datastore.mysql);
        this.stats       = new Util.Stats(this.options, "LMS");

    } catch(err){
        console.trace("LMSService: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

LMSService.prototype.start = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    this.myds.connect()
        .then(function(){
                console.log("LMSService: MySQL DS Connected");
                this.stats.increment("info", "MySQL.Connect");
            }.bind(this),
            function(err){
                console.trace("LMSService: MySQL Error -", err);
                this.stats.increment("error", "MySQL.Connect");
            }.bind(this))

        .then(function(){
            return this.webstore.connect();
        }.bind(this))
        .then(function(){
            console.log("WebApp: MySQL DS Connected");
            this.stats.increment("info", "MySQL.Connect");
        }.bind(this),
            function(err){
                console.trace("WebApp: MySQL Error -", err);
                this.stats.increment("error", "MySQL.Connect");
            }.bind(this))

        .then(resolve, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


LMSService.prototype._generateCode = function() {

    var code = "";
    for( var i = 0; i < lConst.code.length; i++) {
        code += lConst.code.charSet.charAt(Math.floor(Math.random() * lConst.code.charSet.length));
    }

    return code;
};