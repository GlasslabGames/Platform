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

module.exports = LicService;

function LicService(options){
    try{
        var LicStore, Errors;

        this.options = _.merge(
            {
            },
            options
        );

        // Glasslab libs
        LicStore   = require('./lic.js').Datastore.MySQL;
        Util       = require('../core/util.js');
        lConst     = require('./lic.js').Const;
        Errors     = require('../errors.js');

        this.requestUtil = new Util.Request(this.options, Errors);
        this.myds        = new LicStore(this.options.lms.datastore.mysql);
        this.stats       = new Util.Stats(this.options, "LMS");

    } catch(err){
        console.trace("LicService: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

LicService.prototype.start = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // test connection to LMS MySQL
    this.myds.connect()
        .then(function(){
                console.log("LicService: MySQL DS Connected");
                this.stats.increment("info", "MySQL.Connect");
            }.bind(this),
            function(err){
                console.trace("LicService: MySQL Error -", err);
                this.stats.increment("error", "MySQL.Connect");
            }.bind(this))

        .then(resolve, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};
