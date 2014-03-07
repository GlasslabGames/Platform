
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
var uuid      = require('node-uuid');
var couchbase = require('couchbase');
// load at runtime
var tConst, Util;

function TelemDS_Couchbase(options){
    // Glasslab libs
    tConst = require('./telemetry.const.js');
    Util   = require('./util.js');

    this.options = _.merge(
        {
            host:     "localhost:8091",
            bucket:   "default",
            password: "",
            gameSessionExpire: 1*60*60
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

    this.client.getDesignDoc("telemetry", function(err){
        if(err) {
            // missing need to create the doc and views
            if( err.reason == "missing" ||
                err.reason == "deleted") {

                // TODO: move this to it's own module
                // TODO: add variable search and replace after convert to string
/*
{
    var values = meta.id.split(':');
    if( (values[0] == 'gd') &&
    (values[1] == 'e') &&
    (meta.type == "json") )
    {
        for(var i in doc.tags) {
            epoc = parseInt(doc.timestamp);
            td = new Date(epoc * 1000);
            key  = [i.toLowerCase(), doc.tags[i]];
            key  = key.concat( dateToArray( td ) );
            emit(key);
        }
    }
}
*/
var gdv_getEventsByGameSessionId = function (doc, meta)
{
    var values = meta.id.split(':');
    if( (values[0] == 'gd') &&
        (values[1] == 'e') &&
        (meta.type == "json") &&
        doc.hasOwnProperty('gameSessionId') )
    {
        key  = doc['gameSessionId'];
        emit(key);
    }
};

                var telemDDoc = {
                    views: {
                        getEventsByGameSessionId : {
                            map: gdv_getEventsByGameSessionId
                        }
                    }
                };

                // convert function to string
                telemDDoc.views.getEventsByGameSessionId.map = telemDDoc.views.getEventsByGameSessionId.map.toString();
                //console.log("telemDDoc:", telemDDoc);

                this.client.setDesignDoc("telemetry", telemDDoc, function(err){
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


TelemDS_Couchbase.prototype.migrateEventsFromMysql = function(stats, myds, migrateCount) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var sessionToGameLevelMap = [];
    myds.getArchiveEventsLastId()
        .then(function(lastId) {
            if(lastId) {
                return this._setEventCounter(lastId)
                    // _setEventCounter done
                    .then(function() {
                        return myds.getGameSessionWithGameSection();
                    }.bind(this))

                    // getGameSessionWithGameSection done
                    .then(function(map){
                        sessionToGameLevelMap = map;
                        // migrate 5k at a time, as to no overload the DB
                        return myds.getArchiveEvents(migrateCount);
                    }.bind(this))

                    // getArchiveEvents done
                    .then(function(data){
                        //console.log("events:", data.events);
                        if( data &&
                            data.events &&
                            _.isArray(data.events) &&
                            data.events.length > 0 ) {

                            // run all migrate sessions in sequence
                            return this._migrateOldDB_SaveEvents(stats, myds, data.events, data.ids, sessionToGameLevelMap )
                                // _migrateOldDB_SaveEvents done
                                .then(function(ids) {
                                    if( ids &&
                                        _.isArray(ids) ) {

                                        stats.increment('info', 'Couchbase.MigrateOldDBEvents.Done');
                                        console.log("Assessment: Migrate", ids.length, "events, last id:", ids[ids.length - 1]);

                                        // start process again, loop until no more events left
                                        process.nextTick( function(){
                                            this.migrateEventsFromMysql(stats, myds, migrateCount);
                                        }.bind(this) );
                                    }
                                }.bind(this));
                        } else {
                            console.log("Assessment: no events to migrate");
                            resolve();
                        }
                    }.bind(this));
            } else {
                console.log("Assessment: no events to migrate");
                resolve();
            }

        }.bind(this))

        // catch all errors
        .catch(function(err){
            console.error("Assessment: Error getting game sessions, err:", err);
            stats.increment('error', 'MySQL.MigrateEventsFromMysql');

            reject(new Error("Assessment: Error migrate events from Mysql, err:", err));
        }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype._migrateOldDB_SaveEvents = function(stats, myds, data, ids, sessionToGameLevelMap) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        if(data){
            stats.gauge('info',     'MigrateEvents', data.length);
            stats.increment('info', 'Events', data.length);
            //console.log("Assessment: Events per session:", data.length);

            //
            this._setEventsWithIds(data, sessionToGameLevelMap)
                // saveEvents, ok
                .then(function() {
                    stats.increment('info', 'Couchbase.SaveEvents.Done');

                    return myds.disableArchiveEvents(ids);
                }.bind(this),
                    // saveEvents error
                    function(err) {
                        console.error("Assessment: Couchbase Error: could not save events, err:", err);
                        stats.increment('error', 'MigrateEvents.Couchbase.SaveEvents');
                    }.bind(this))

                // disableArchiveEvents, ok
                .then(function() {
                    //console.log("Events migrated, events count:", data.length);
                    stats.increment('info', 'MigrateEvents.MySQL.RemoveEvents.Done');

                    resolve(ids);
                }.bind(this),
                    // disableArchiveEvents, error
                    function() {
                        console.error("Assessment: MySQL Error: could not remove events");
                        stats.increment('error', 'MigrateEvents.MySQL.RemoveEvents');

                        reject(new Error("Assessment: MySQL Error: could not remove events"));
                    }.bind(this));
        } else {
            console.log("Assessment: no Events to migrate");
            resolve(ids);
        }
// ------------------------------------------------
    }.bind(this));
// end promise wrapper
}


TelemDS_Couchbase.prototype._setEventCounter = function(lastId){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var key = tConst.game.dataKey+"::"+tConst.game.countKey;
    this.client.incr(key, {
            initial: lastId,
            offset: 0
        },
        function(err, data){
            if(err){
                console.error("CouchBase TelemetryStore: Incr Event Count Error -", err);
                reject(err);
                return;
            }

            resolve(data);
        }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};


TelemDS_Couchbase.prototype._setEventsWithIds = function(events, map){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var kv = {}, key, v;
    for(var i = 0; i < events.length; i++){
        key = tConst.game.dataKey+":"+tConst.game.eventKey+":"+events[i].id;

        // remove id
        delete events[i].id;
        v = _.cloneDeep(events[i]);
        if( map.hasOwnProperty(v.gameSessionId) ) {
            v.gameLevel = map[v.gameSessionId];
        }
        kv[key] = { value: v };
    }
    //console.log("kv:", kv);

    // see setMulti for keyValue format
    // https://github.com/couchbase/couchnode/blob/master/lib/connection.js
    this.client.setMulti(kv, {}, function(err){
        if(err) {
            console.error("CouchBase TelemetryStore: Set Event Error -", err);
            reject(err);
            return;
        }

        resolve();
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
                initial: events.length,
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
                for(var i = 0; i < events.length; i++){
                    key = tConst.game.dataKey+":"+tConst.game.eventKey+":"+kIndex;
                    kv[key] = { value: _.cloneDeep(events[i]) };

                    kIndex++;
                }
                //console.log("kv:", kv);

                // see setMulti for keyValue format
                // https://github.com/couchbase/couchnode/blob/master/lib/connection.js
                this.client.addMulti(kv, {}, function(err){
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

    this.client.view("telemetry", "getEventsByGameSessionId").query({
            stale: false,
            key: gameSessionId
        },
        function(err, results){
            if(err){
                console.error("CouchBase TelemetryStore: Get Events View Error -", err);
                reject(err);
                return;
            }

            var keys = [];
            for (var i = 0; i < results.length; ++i) {
                keys.push(results[i].id);
            }

            //console.log("CouchBase TelemetryStore: keys", keys);
            this.client.getMulti(keys, {},
                function(err, results){
                    if(err){
                        console.error("CouchBase TelemetryStore: Multi Get Events Error -", err);
                        reject(err);
                        return;
                    }

                    /*
                    {
                        "userId": 12,
                        "deviceId": "123",
                        "clientTimeStamp": 1392775453,
                        "serverTimeStamp": 1392776453,
                        "clientId": "SC",
                        "clientVersion": "1.2.4156",
                        "gameLevel": "Mission2.SubMission1",
                        "gameSessionId": "34c8e488-c6b8-49f2-8f06-97f19bf07060",
                        "eventName": "CustomEvent",
                        "eventData": {
                            "float key": 1.23,
                            "int key": 1,
                            "string key": "asd"
                        }
                    }
                    */
                    var eventsData = {
                        userId: 0,
                        gameSessionId: '',
                        events: []
                    };
                    var event, revent;
                    for(var i in results) {
                        revent = results[i].value;
                        event = {
                            timestamp: revent.clientTimeStamp,
                            name:      revent.eventName,
                            eventData: revent.eventData
                        };

                        if(revent.userId) {
                            eventsData.userId = revent.userId;
                        }
                        if( revent.gameSessionId) {
                            eventsData.gameSessionId = revent.gameSessionId;
                        }
                        if( revent.gameVersion) {
                            eventsData.gameVersion = revent.clientVersion;
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



TelemDS_Couchbase.prototype.startGameSession = function(userId, courseId, gameLevel, gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    if(!gameSessionId) {
        gameSessionId = uuid.v1();
    }

    var key = tConst.game.dataKey+":"+tConst.game.gameSessionKey+":"+gameSessionId;

    this.client.add(key, {
            startDate: Util.GetTimeStamp(),
            endDate:   0,
            userId:    userId,
            gameLevel: gameLevel,
            courseId:  courseId,
            gameSessionId: gameSessionId,
            state: tConst.game.session.started
        }, {
            expiry: this.options.gameSessionExpire
        }, function(err, data){
            if(err){
                console.error("CouchBase TelemetryStore: Start Game Session Error -", err);
                reject(err);
                return;
            }

            resolve(data);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.cleanupSession = function(gameSessionId){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var key = tConst.game.dataKey+":"+tConst.game.gameSessionKey+":"+gameSessionId;
        // remove meta info
        this.client.remove(key, function(err){
            if(err){
                console.error("CouchBase TelemetryStore: Cleanup Session Error -", err);
                reject(err);
                return;
            }

            resolve();
        }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
}


TelemDS_Couchbase.prototype.validateSession = function(gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var key = tConst.game.dataKey+":"+tConst.game.gameSessionKey+":"+gameSessionId;
    this.client.get(key, function(err, data){
        if(err){
            console.error("CouchBase TelemetryStore: Validate Sessionn Error -", err);
            reject(err);
            return;
        }

        var gameSessionData = data.value;
        if(gameSessionData.state == tConst.game.session.started) {
            resolve(gameSessionData);
        } else {
            reject(new Error("session "+gameSessionData.state ));
        }

    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


TelemDS_Couchbase.prototype.endGameSession = function(gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var key = tConst.game.dataKey+":"+tConst.game.gameSessionKey+":"+gameSessionId;
    // get data
    this.client.get(key,
        function(err, data){
            if(err){
                console.error("CouchBase TelemetryStore: End Game Session Error -", err);
                reject(err);
                return;
            }

            var gameSessionData = data.value;
            gameSessionData.endDate = Util.GetTimeStamp();
            gameSessionData.state = tConst.game.session.ended;

            // replace with updated
            this.client.replace(key, gameSessionData,
                function(err, data){
                    if(err){
                        console.error("CouchBase TelemetryStore: Start Game Session Error -", err);
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

module.exports = TelemDS_Couchbase;
