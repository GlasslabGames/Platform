
/**
 * Telemetry Dispatcher Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *
 */
// Third-party libs
var _         = require('lodash');
var couchbase = require('couchbase');
// load at runtime

function TelemDS_Couchbase(options){
    this.options = _.merge(
        {
            host:     "localhost:8091",
            bucket:   "default",
            password: ""
        },
        options
    );

    this.client = new couchbase.Connection({
        host:     this.options.host,
        bucket:   this.options.bucket,
        password: this.options.password
    }, function(err) {
        console.error("CouchBase SessionStore: Error -", err);

        if(err) throw err;
    }.bind(this));

    this.client.on('error', function (err) {
        console.error("CouchBase SessionStore: Error -", err);
    }.bind(this));

    this.client.on('connect', function () {
        console.log("CouchBase connected!");
    }.bind(this));
}

TelemDS_Couchbase.prototype.saveEvents = function(data){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = "gameSession:"+jdata.gameSessionId+":events";

    this.client.set(key, data, {
            //expiry: ttl // in seconds
        },
        function(err, result){
            if(err){
                console.error("CouchBase SessionStore: Set Error -", err);
                reject(err);
                return;
            }
            resolve();
        }
    );
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.endGameSession = function(gameSessionId, done){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // TODO

    resolve();
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.getEvents = function(gameSessionId, done){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = "gameSession:"+gameSessionId+":events";

    this.client.get(key, function(err, result){
            if(err){
                console.error("CouchBase SessionStore: Get Error -", err);
                reject(err);
                return;
            }
            resolve(result);
        }
    );
// ------------------------------------------------
}.bind(this));
// end promise wrapper
}

module.exports = TelemDS_Couchbase;
