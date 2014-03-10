
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
var tConst;

function TelemDS_Couchbase(options){
    // Glasslab libs
    tConst = require('./telemetry.const.js');

    this.options = _.merge(
        {
            host:     "localhost:8091",
            bucket:   "glasslab_data",
            password: "glasslab",
            timeout:  5000
        },
        options
    );
}

TelemDS_Couchbase.prototype.connect = function(){
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
        console.error("CouchBase TelemetryStore: Error -", err);

        if(err) throw err;
    }.bind(this));

    this.client.on('error', function (err) {
        console.error("CouchBase TelemetryStore: Error -", err);
        reject(err);
    }.bind(this));

    this.client.on('connect', function () {
        //console.log("CouchBase connected!");
        console.log("CouchBase TelemetryStore connected!");
        this.setupDocsAndViews()
            .then( resolve, reject );
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.setupDocsAndViews = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    this.client.getDesignDoc("telemetry", function(err, result){
        if(err) {
            // missing need to create the doc and views
            if( err.reason == "missing" ||
                err.reason == "deleted") {

                // TODO: move this to it's own module
                // TODO: add variable search and replace after convert to string
                var telemDDoc = {
                    views: {
                        gameData : {
                            map: function (doc, meta) {
                                values = meta.id.split(':');
                                if( (values[0] == 'gd') &&
                                    (values[1] == 'e') &&
                                    (meta.type == "json") )
                                {
                                    for(var i in doc.tags){
                                        epoc = parseInt(doc.timestamp);
                                        td = new Date(epoc * 1000);
                                        key  = [i.toLowerCase(), doc.tags[i]];
                                        key  = key.concat( dateToArray( td ) );
                                        emit(key);
                                    }
                                }
                            }
                        }
                    }
                };

                // convert function to string
                telemDDoc.views.gameData.map = telemDDoc.views.gameData.map.toString();
                //console.log("telemDDoc:", telemDDoc);

                this.client.setDesignDoc("telemetry", telemDDoc, function(err, result){
                    if(err) {
                        console.error("err", err);
                        reject(err);
                        return;
                    }

                    resolve();
                }.bind(this));

            } else {
                console.error("err", err);
                reject(err);
            }

            return;
        }

        resolve();
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.saveEvent = function(event){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var key = tConst.game.dataKey+"::"+tConst.game.countKey;
    this.client.incr(key, {initial: 0},
        function(err, data){
            if(err){
                console.error("CouchBase TelemetryStore: Incr Event Count Error -", err);
                reject(err);
                return;
            }

            var key = tConst.game.dataKey+":"+tConst.game.eventKey+":"+data.value;
            this.client.add(key, event, function(err, data){
                if(err){
                    console.error("CouchBase TelemetryStore: Set Event Error -", err);
                    reject(err);
                    return;
                }

                resolve();
            }.bind(this));

    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.saveEvents = function(events){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var key = tConst.game.dataKey+"::"+tConst.game.countKey;
        this.client.incr(key, {
                initial: 0,
                offset: events.length
            },
            function(err, data){
                if(err){
                    console.error("CouchBase TelemetryStore: Incr Event Count Error -", err);
                    reject(err);
                    return;
                }

                var kv = {}, key;
                var kIndex = data.value - events.length + 1;
                for(var i in events){
                    key = tConst.game.dataKey+":"+tConst.game.eventKey+":"+kIndex;
                    kv[key] = { value: _.cloneDeep(events[i]) };

                    kIndex++;
                }

                // see setMulti for keyValue format
                // https://github.com/couchbase/couchnode/blob/master/lib/connection.js
                this.client.addMulti(kv, {}, function(err, data){
                    if(err){
                        console.error("CouchBase TelemetryStore: Set Event Error -", err);
                        reject(err);
                        return;
                    }

                    resolve();
                }.bind(this));

            }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};


TelemDS_Couchbase.prototype.getEvents = function(gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    this.client.view("telemetry", "gameData").query({
            stale: false,
            startkey: ["gameSessionId".toLowerCase(), gameSessionId, null],
            endkey:   ["gameSessionId".toLowerCase(), gameSessionId, "\u0fff"]
        },
        function(err, results){
            if(err){
                console.error("CouchBase TelemetryStore: Get Events Error -", err);
                reject(err);
                return;
            }

            var keys = [];
            for (var i = 0; i < results.length; ++i) {
                keys.push(results[i].id);
            }

            this.client.getMulti(keys, {},
                function(err, results){
                    if(err){
                        console.error("CouchBase TelemetryStore: Get Events Error -", err);
                        reject(err);
                        return;
                    }

                    var eventsData = {
                        userId: 0,
                        gameSessionId: '',
                        events: []
                    };
                    var event, revent;
                    for(var i in results) {
                        revent = results[i].value;
                        event = {
                            name:      revent.name,
                            timestamp: revent.timestamp,
                            eventData: revent.data
                        };

                        if( revent.tags &&
                            revent.tags.userId) {
                            eventsData.userId = revent.tags.userId;
                        }
                        if( revent.tags &&
                            revent.tags.gameSessionId) {
                            eventsData.gameSessionId = revent.tags.gameSessionId;
                        }
                        if( revent.tags &&
                            revent.tags.gameVersion) {
                            eventsData.gameVersion = revent.tags.gameVersion;
                        }

                        eventsData.events.push(event);
                    }

                    //console.log("getEvents eventsData:", eventsData);
                    resolve(eventsData);
            }.bind(this));

        }.bind(this));

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
