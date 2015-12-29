/**
 * Monitor DataStore Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  when   - https://github.com/cujojs/when
 *
 */
// Third-party libs
var _         = require('lodash');
var when      = require('when');
var guard     = require('when/guard');
var couchbase = require('couchbase');
// load at runtime
var Util;

module.exports = MonitorDS_Couchbase;

function MonitorDS_Couchbase(options){
    // Glasslab libs
    Util   = require('../core/util.js');

    this.options = _.merge(
        {
            host:     "localhost:8091",
            bucket:   "default",
            password: "",
            gameSessionExpire: 1*1*60 //24*60*60 // in seconds
        },
        options
    );
}

MonitorDS_Couchbase.prototype.connect = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var options = {
        host:     this.options.host,
        bucket:   this.options.bucket,
        password: this.options.password,
        connectionTimeout: this.options.timeout || 60000,
        operationTimeout:  this.options.timeout || 60000
    };
    this.client = new couchbase.Connection(options, function(err) {
        console.errorExt("MonitorStore Couchbase", err);

        if(err) throw err;
    }.bind(this));

    this.client.on('error', function (err) {
        console.errorExt("MonitorStore Couchbase", err);
        reject(err);
    }.bind(this));

    this.client.on('connect', function () {
        //console.log("CouchBase MonitorStore: Options -", options);
        resolve();
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};
