
/**
 * Telemetry Dispatcher Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *
 */
// Third-party libs
var _         = require('lodash');
// load at runtime
var MySQL;

function TelemDS_Couchbase(options){
    // Glasslab libs


    this.options = _.merge(
        {
            datastore: {}
        },
        options
    );

    this.ds = new MySQL(this.options);
    // Connect to data store
    this.ds.testConnection();
}

TelemDS_Couchbase.prototype.saveEvents = function(jdata, done){

    for(var i in jdata.events){

    }

    done(null);
};

TelemDS_Couchbase.prototype.getEvents = function(gameSessionId, done){

    done(null);
}


module.exports = TelemDS_Couchbase;
