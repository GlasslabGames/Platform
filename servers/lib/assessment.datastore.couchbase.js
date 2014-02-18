
/**
 * Telemetry Couchbase Datastore Module
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
var aeConst;

module.exports = AE_DS_Couchbase;

function AE_DS_Couchbase(options){
    // Glasslab libs
    aeConst = require('./assessment.const.js');

    this.options = _.merge(
        {
            host:     "localhost:8091",
            bucket:   "glasslab_assessment",
            password: "glasslab"
        },
        options
    );
}

AE_DS_Couchbase.prototype.connect = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    this.client = new couchbase.Connection({
        host:     this.options.host,
        bucket:   this.options.bucket,
        password: this.options.password
    }, function(err) {
        console.error("CouchBase Distiller DS: Error -", err);

        if(err) throw err;
    }.bind(this));

    this.client.on('error', function (err) {
        console.error("CouchBase Distiller DS: Error -", err);
        reject(err);
    }.bind(this));

    this.client.on('connect', function () {
        console.log("CouchBase connected!");
        resolve();
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

AE_DS_Couchbase.prototype.saveDistilledData = function(gameSessionId, data){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        // example - ae:dist:data:ABC-123-EFG
        var key = aeConst.keys.assessment+":"+aeConst.keys.distiller+":"+aeConst.keys.distillerData+":"+gameSessionId;
        this.client.add(key, data, function(err) {
            if(err){
                console.error("CouchBase Distiller DS: Set Distiller Data Error -", err);
                reject(err);
                return;
            }
            resolve();
        }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

