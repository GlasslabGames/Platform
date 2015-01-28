var _      = require('lodash');
var when   = require('when');
var Util;
var lConst;

module.exports = Lic_Couchbase;

function Lic_Couchbase(options){
    // Glasslab libs
    Util   = require('../core/util.js');
    lConst = require('./lic.const.js');

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

Lic_Couchbase.prototype.connect = function(myds){
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
            console.error("[Lic] CouchBase LicDataStore: Error -", err);

            if(err) throw err;
        }.bind(this));

        this.client.on('error', function (err) {
            console.error("[Lic] CouchBase LicDataStore: Error -", err);
            reject(err);
        }.bind(this));

        this.client.on('connect', function () {
            // if design doc changes, auto update design doc
            this.setupDocsAndViews()
                .then(function(){
                    if(myds) {
                        return this.migrateDataAuto(myds);
                    }
                }.bind(this))
                .then( resolve, reject );
        }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};