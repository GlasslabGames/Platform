
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


AuthDS_Couchbase.prototype.updateUserDeviceId = function(userId, deviceId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var key = aConst.datastore.keys.user+":"+aConst.datastore.keys.device+":"+userId;
    this.client.get(key, function(err, data){
        var userDeviceInfo;
        if(err) {
            // "No such key"
            if(err.code == 13)
            {
                userDeviceInfo = {
                    lastDevice: "",
                    devices: {}
                };
            } else {
                console.error("CouchBase AuthStore: Error -", err);
                reject(err);
                return;
            }
        } else {
            userDeviceInfo = data.value;
        }

        // if not seen this device before, add inner object
        if( !userDeviceInfo.devices.hasOwnProperty(deviceId) ){
            userDeviceInfo.devices[deviceId] = {
                lastSeenTimestamp: 0
            }
        }

        // update info
        userDeviceInfo.lastDevice = deviceId;
        userDeviceInfo.devices[deviceId].lastSeenTimestamp = Util.GetTimeStamp();

        // update data
        this.client.set(key, userDeviceInfo,
            function(err, data) {
                if(err) {
                    console.error("CouchBase AuthStore: Error -", err);
                    reject(err);
                    return;
                }

                resolve(data);
            }.bind(this));

    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};
