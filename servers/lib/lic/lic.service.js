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

function LicService(options, serviceManager){
    try{
        var LicStore, Errors;

        this.options = _.merge(
            {
            },
            options
        );

        // Glasslab libs
        LicStore     = require('./lic.js').Datastore.MySQL;
        LicDataStore = require('./lic.js').Datastore.Couchbase;
        Util         = require('../core/util.js');
        lConst       = require('./lic.js').Const;
        Errors       = require('../errors.js');

        this.requestUtil = new Util.Request(this.options, Errors);
        this.myds        = new LicStore(this.options.lic.datastore.mysql);
        this.cbds        = new LicDataStore(this.options.lic.datastore.couchbase);
        this.stats       = new Util.Stats(this.options, "LMS");
        this.serviceManager = serviceManager;

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
        .then(function(){
            return this.cbds.connect();
        }.bind(this))
            .then(function(){
                console.log("LicService: Couchbase DS Connected");
                this.stats.increment("info", "Couchbase.Connect");
            }.bind(this),
            function(err){
                console.trace("LicService: Couchbase Error -", err);
                this.stats.increment("error", "Couchbase.Connect");
            }.bind(this))
        .then(resolve, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};
