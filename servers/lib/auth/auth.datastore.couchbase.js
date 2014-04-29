
/**
 * Telemetry Dispatcher Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  when   - https://github.com/cujojs/when
 *
 */
// Third-party libs
var _         = require('lodash');
var when      = require('when');
var couchbase = require('couchbase');
// load at runtime
var Util, aConst;

module.exports = AuthDS_Couchbase;

function AuthDS_Couchbase(options){
    // Glasslab libs
    Util   = require('../core/util.js')
    aConst = require('./auth.const.js');

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

AuthDS_Couchbase.prototype.connect = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    this.client = new couchbase.Connection({
        host:     this.options.host,
        bucket:   this.options.bucket,
        password: this.options.password,
        connectionTimeout: this.options.timeout || 5000,
        operationTimeout:  this.options.timeout || 5000
    }, function(err) {
        console.error("CouchBase AuthStore: Error -", err);

        if(err) throw err;
    }.bind(this));

    this.client.on('error', function (err) {
        console.error("CouchBase AuthStore: Error -", err);
        reject(err);
    }.bind(this));

    this.client.on('connect', function () {
        resolve();
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

