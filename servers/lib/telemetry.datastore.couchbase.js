
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
var tConst;

function TelemDS_Couchbase(options){
    // Glasslab libs
    tConst = require('./telemetry.const.js');

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

TelemDS_Couchbase.prototype.saveEvents = function(jdata){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = tConst.game.sessionKey+":"+jdata.gameSessionId+":"+tConst.game.eventsKey;

    //console.log("saveEvents jdata:", jdata);
    this.client.set(key, jdata,
        function(err){
            if(err){
                console.error("CouchBase SessionStore: Set Events Error -", err);
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


TelemDS_Couchbase.prototype.getEvents = function(gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = tConst.game.sessionKey+":"+gameSessionId+":"+tConst.game.eventsKey;

    console.log("getEvents key:", key);
    this.client.get(key,
        function(err, result){
            if(err){
                console.error("CouchBase SessionStore: Get Events Error -", err);
                reject(err);
                return;
            }

            //console.log("getEvents data:", result.value);
            resolve(result.value);
        }
    );
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


/*
TelemDS_Couchbase.prototype.startGameSession = function(userId, courseId, activityId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // TODO
    resolve();

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.cleanUpOldGameSessions = function(userId, activityId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // TODO
    resolve();

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.endGameSession = function(gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // TODO
    resolve();

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};
*/

module.exports = TelemDS_Couchbase;
