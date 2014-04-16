/**
 * Dashboard Service Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  when       - https://github.com/cujojs/when
 *
 */

// Third-party libs
var _          = require('lodash');
var when       = require('when');

// load at runtime
var Util;

module.exports = DashService;

function DashService(options){
    try{
        var AuthStore, TelmStore;

        // Glasslab libs
        Util          = require('../core/util.js');
        AuthStore     = require('../auth/auth.js').Datastore.Couchbase;
        TelmStore     = require('../data/data.js').Datastore.Couchbase;

        this.options = _.merge(
            {
                DashService: { port: 8084 }
            },
            options
        );

        this.requestUtil = new Util.Request(this.options);
        this.stats       = new Util.Stats(this.options, "Dash");

        this.authStore   = new AuthStore(this.options.auth.datastore.couchbase);
        this.telmStore   = new TelmStore(this.options.telemetry.datastore.couchbase);
        this.gameInfo    = require('./dash.js').Games;

    } catch(err){
        console.trace("DashService: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

DashService.prototype.start = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    this.authStore.connect()
        .then(function(){
                console.log("DashService: Auth DS Connected");
                this.stats.increment("info", "AuthDS.Connect");
            }.bind(this),
            function(err){
                console.trace("DashService: Auth DS Error -", err);
                this.stats.increment("error", "AuthDS.Connect");
            }.bind(this))

        .then(function(){
            return this.telmStore.connect();
        }.bind(this))
        .then(function(){
                console.log("DashService: Telemetry DS Connected");
                this.stats.increment("info", "TelemetryDS.Connect");
            }.bind(this),
            function(err){
                console.trace("DashService: Telemetry DS Error -", err);
                this.stats.increment("error", "TelemetryDS.Connect");
            }.bind(this))

        .then(resolve, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};
