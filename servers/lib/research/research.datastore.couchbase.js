
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
var guard     = require('when/guard');
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
    var options = {
        host:     this.options.host,
        bucket:   this.options.bucket,
        password: this.options.password,
        connectionTimeout: this.options.timeout || 60000,
        operationTimeout:  this.options.timeout || 60000
    };
    this.client = new couchbase.Connection(options, function(err) {
        console.error("CouchBase ResearchStore: Error -", err);

        if(err) throw err;
    }.bind(this));

    this.client.on('error', function (err) {
        console.error("CouchBase ResearchStore: Error -", err);
        reject(err);
    }.bind(this));

    this.client.on('connect', function () {
        //console.log("CouchBase ResearchStore: Options -", options);
        resolve();
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


// http://stackoverflow.com/questions/19178782/how-to-reshape-an-array-with-lodash
// In:  array = [1, 2, 3, 4, 5, 6, ,7, 8], n = 3
// Out: [[1, 2, 3], [4, 5, 6], [7, 8]]
function reshape(array, n){
    return _.compact(array.map(function(el, i){
        if (i % n === 0) {
            return array.slice(i, i + n);
        }
    }));
}


ResearchDS_Couchbase.prototype.getEventsByGameIdDate = function(gameId, startDateArray, endDateArray, limit){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var startkey, endkey;

    // year, month, day, hour, min, sec, micro, gameId, userId
    startkey = _.cloneDeep(startDateArray);
    startkey[1]++; // month starts at 0, so need to add one
    startkey.unshift( gameId );

    // if endDateArray exists then use this data for array
    endkey = _.cloneDeep(endDateArray || ["\u0fff", "\u0fff", "\u0fff", "\u0fff", "\u0fff", "\u0fff"]);
    // if endDateArray exists then adjust month and set micro sec to all
    if(endDateArray) {
        endkey[1]++;   // month starts at 0, so need to add one
    }
    // use gameId if exist, otherwise wildcard
    endkey.unshift( gameId );

    var options = {
        startkey: startkey,
        endkey: endkey,
        inclusive_end: true
    };

    if(limit) {
        options.limit = parseInt(limit);
    }

    console.log("CouchBase ResearchStore: getEventsByDate - options:", options);
    this.client.view("telemetry", "getEventsByGameId_ServerTimeStamp").query(
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
                keys.push( results[i].id );
            }

            var taskList = reshape(keys, this.options.multiGetChunkSize);
            console.log("CouchBase ResearchStore: getEventsByKeys Number of Chunks:", taskList.length);

            var guardedAsyncOperation, taskResults;
            // Allow only 1 inflight execution of guarded
            guardedAsyncOperation = guard(guard.n(1), this._getEventsByKeys.bind(this));
            taskResults = when.map(taskList, guardedAsyncOperation);
            taskResults.then(
                function(events){
                    events = _.flatten(events);
                    console.log("CouchBase ResearchStore: getEventsByKeys total events:", events.length);
                    return events;
                }.bind(this),
                //errors
                function(err){
                    reject(err);
                }.bind(this)
            )
            .done(function(events){
                resolve(events);
            }.bind(this));


        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


ResearchDS_Couchbase.prototype.getUserDataBySessions = function(gameSessionIdList){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var taskList = reshape(gameSessionIdList, this.options.multiGetChunkSize);
    console.log("getUserDataBySessions totalEvents:", taskList.length);

    var guardedAsyncOperation, taskResults;
    // Allow only 1 inflight execution of guarded
    guardedAsyncOperation = guard(guard.n(1), this._getSessions.bind(this));
    taskResults = when.map(taskList, guardedAsyncOperation);
    taskResults.then(
        function(list){
            var finalList = {};
            for(var i = 0; i < list.length; i++) {
                finalList = _.merge(finalList, list[i]);
            }

            console.log("CouchBase ResearchStore: getUserDataBySessions total events:", list.length);
            return finalList;
        }.bind(this),
        //errors
        function(err){
            reject(err);
        }.bind(this)
    )
    .done(function(events){
        resolve(events);
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


ResearchDS_Couchbase.prototype._getSessions = function(gameSessionIdList){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // add key prepender for loop up
    var keys = [];
    for(var i = 0; i < gameSessionIdList.length; i++) {
        keys[i] = "gd:gs:"+gameSessionIdList[i];
    }

    this.client.getMulti(keys, {},
        function(err, results){
            if (err) {
                if(err.code == 4101) {

                    for (var i in results) {
                        if( results[i].error &&
                            (results[i].error.code == 13) )
                        {
                            results[i].value = {};
                        }
                    }

                } else {
                    console.error("CouchBase ResearchStore: Multi Get Sessions Error -", err);
                    if (results) {
                        console.error("CouchBase ResearchStore: Multi Get Sessions Error - results:", results);
                    }
                    reject(err);
                    return;
                }
            }

            var data = {};
            for (var i in results) {
                var item = results[i].value;
                if(item.gameSessionId) {
                    data[item.gameSessionId] = item;
                }
            }

            resolve(data);
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

ResearchDS_Couchbase.prototype._getEventsByKeys = function(keys) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    console.log("CouchBase ResearchStore: getEventsByKeys events:", keys.length);
    this.client.getMulti(keys, {},
        function (err, results) {
            if (err) {
                console.error("CouchBase ResearchStore: Multi Get Events Error -", err);
                if (results) {
                    console.error("CouchBase ResearchStore: Multi Get Events Error - results:", results);
                }
                reject(err);
                return;
            }

            var events = [];
            for (var i in results) {
                events.push(results[i].value);
            }

            //console.log("getRawEvents events.length:", events.length);
            resolve(events);
        }.bind(this));
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

ResearchDS_Couchbase.prototype.setCsvDataByGameId = function(gameId, data) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var key = "g:"+gameId+":parse-csv";
        this.client.set(key, data, {format:'utf8'},
            function (err, results) {
                if (err) {
                    reject(err);
                    return;
                }

                resolve();
            }.bind(this));
// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

ResearchDS_Couchbase.prototype.getCsvDataByGameId = function(gameId) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var key = "g:"+gameId+":parse-csv";
        this.client.get(key, {format:'utf8'},
            function (err, results) {
                if (err) {
                    if(err.code == 13) {
                        resolve();
                        return;
                    }
                    reject(err);
                    return;
                }

                resolve(results.value);
            }.bind(this));
// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};