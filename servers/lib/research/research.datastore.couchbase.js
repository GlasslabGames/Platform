
/**
 * Research DataStore Module
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
var Util;

module.exports = ResearchDS_Couchbase;

function ResearchDS_Couchbase(options){
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

ResearchDS_Couchbase.prototype.connect = function(){
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
        console.error("CouchBase ResearchStore: Error -", err);

        if(err) throw err;
    }.bind(this));

    this.client.on('error', function (err) {
        console.error("CouchBase ResearchStore: Error -", err);
        reject(err);
    }.bind(this));

    this.client.on('connect', function () {
        resolve();
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


ResearchDS_Couchbase.prototype.getEventsByDate = function(startDateArray, endDateArray, limit){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    startDateArray[1]++; // month starts at 0, so need to add one
    startDateArray[6] = null;
    startDateArray.pop();

    endDateArray[1]++;   // month starts at 0, so need to add one
    endDateArray[6]   = "\u0fff";

    var options = {
        stale: false,
        startkey: startDateArray,
        endkey:   endDateArray
    };

    if(limit) {
        options.limit = limit;
    }

    console.log("CouchBase ResearchStore: getEventsByDate - startDateArray:", startDateArray, ", endDateArray:", endDateArray);
    this.client.view("telemetry", "getEventsByServerTimeStamp").query(
        options,
        function(err, results){
           if(err){
                console.error("CouchBase ResearchStore: Get Events View Error -", err);
                reject(err);
                return;
            }

            if(results.length == 0) {
                resolve([]);
                return;
            }

            var keys = [];
            for (var i = 0; i < results.length; ++i) {
                keys.push(results[i].id);
            }

            //console.log("CouchBase ResearchStore: keys", keys);
            console.log("CouchBase ResearchStore: getEventsByDate events:", keys.length);
            this.client.getMulti(keys, {},
                function(err, results){
                    if(err){
                        console.error("CouchBase ResearchStore: Multi Get Events Error -", err);
                        if(results) {
                            console.error("CouchBase ResearchStore: Multi Get Events Error - results:", results);
                        }
                        reject(err);
                        return;
                    }

                    var events = [];
                    for(var i in results) {
                        events.push( results[i].value );
                    }

                    //console.log("getRawEvents events:", events);
                    resolve(events);
                }.bind(this));

        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};
