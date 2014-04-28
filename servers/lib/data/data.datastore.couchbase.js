
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
var moment    = require('moment');
// load at runtime
var tConst, Util;

module.exports = TelemDS_Couchbase;

function TelemDS_Couchbase(options){
    // Glasslab libs
    Util   = require('../core/util.js');
    tConst = require('./data.const.js');

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
        // if design doc changes, auto update design doc
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
    // TODO: move this to it's own module

var temp = function (doc, meta)
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
};

var gdv_getEventsByGameSessionId = function (doc, meta)
{
    var values = meta.id.split(':');
    if( (values[0] == 'gd') &&
        (values[1] == 'e') &&
        (meta.type == 'json') &&
        doc.hasOwnProperty('gameSessionId') )
    {
        emit( doc['gameSessionId'] );
    }
};

var gdv_getEventsByServerTimeStamp = function (doc, meta)
{
    var values = meta.id.split(':');
    if( (values[0] == 'gd') &&
        (values[1] == 'e') &&
        (meta.type == 'json') &&
        doc.hasOwnProperty('serverTimeStamp') )
    {
        var td = new Date(doc.serverTimeStamp * 1000);
        emit( dateToArray( td ) );
    }
};

var gdv_getStartedSessionsByDeviceId = function (doc, meta)
{
    var values = meta.id.split(':');
    if( (values[0] == 'gd') &&
        (values[1] == 'gs') &&
        (meta.type == 'json') &&
        doc.hasOwnProperty('deviceId') &&
        doc.hasOwnProperty('state') &&
        doc['state'] == 'started' )
    {
        emit( doc['deviceId'] );
    }
};

var gdv_getAllStartedSessions = function (doc, meta)
{
    var values = meta.id.split(':');
    if( (values[0] == 'gd') &&
        (values[1] == 'gs') &&
        (meta.type == 'json') &&
        doc.hasOwnProperty('serverStartTimeStamp') &&
        doc['state'] == 'started' )
    {
        var td = new Date(doc.serverStartTimeStamp * 1000);
        emit( dateToArray( td ) );
    }
};

var gdv_getAllAchievementsByDeviceId = function (doc, meta)
{
    var values = meta.id.split(':');
    if( (values[0] == 'gd') &&
        (values[1] == 'e') &&
        (meta.type == 'json') &&
        doc.hasOwnProperty('deviceId') &&
        doc.hasOwnProperty('eventName') &&
        doc['eventName'] == '$Achievement' )
    {
        emit( doc['deviceId'] );
    }
};

    this.telemDDoc = {
        views: {
            getEventsByGameSessionId : {
                map: gdv_getEventsByGameSessionId
            },
            getEventsByServerTimeStamp : {
                map: gdv_getEventsByServerTimeStamp
            },
            getStartedSessionsByDeviceId : {
                map: gdv_getStartedSessionsByDeviceId
            },
            getAllStartedSessions : {
                map: gdv_getAllStartedSessions
            },
            getAllAchievementsByDeviceId: {
                map: gdv_getAllAchievementsByDeviceId
            }
        }
    };

    // convert function to string
    for(var i in this.telemDDoc.views) {
        if( this.telemDDoc.views[i].hasOwnProperty('map') ) {
            this.telemDDoc.views[i].map = this.telemDDoc.views[i].map.toString();
        }
    }
    //console.log("telemDDoc:", telemDDoc);

    // TODO: add variable search and replace after convert to string

    this.client.getDesignDoc("telemetry", function(err, data){
        if(err) {
            // missing need to create the doc and views
            if( err.reason == "missing" ||
                err.reason == "deleted") {

                this._setDocsAndViews()
                    .then( resolve, reject );
                return;
            } else {
                console.error("err", err);
                reject(err);
                return;
            }
        }

        if(JSON.stringify(data) != JSON.stringify(this.telemDDoc)) {
            this._setDocsAndViews()
                .then( resolve, reject );
            return;
        } else {
            resolve();
        }

}.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype._setDocsAndViews = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    console.log("Updating telemetry Design Document...");
    this.client.setDesignDoc("telemetry", this.telemDDoc, function(err){
        if(err) {
            console.error("err", err);
            reject(err);
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
                                        console.log("TelemetryStore: Migrate", ids.length, "events, last id:", ids[ids.length - 1]);

                                        // start process again, loop until no more events left
                                        process.nextTick( function(){
                                            this.migrateEventsFromMysql(stats, myds, migrateCount);
                                        }.bind(this) );
                                    }
                                }.bind(this));
                        } else {
                            console.log("TelemetryStore: no events to migrate");
                            resolve();
                        }
                    }.bind(this));
            } else {
                console.log("TelemetryStore: no events to migrate");
                resolve();
            }

        }.bind(this))

        // catch all errors
        .catch(function(err){
            console.error("TelemetryStore: Error getting game sessions, err:", err);
            stats.increment('error', 'MySQL.MigrateEventsFromMysql');

            reject(new Error("TelemetryStore: Error migrate events from Mysql, err:", err));
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

            if(results.length == 0) {
                resolve({});
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



TelemDS_Couchbase.prototype.getRawEvents = function(gameSessionId){
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

                if(results.length == 0) {
                    resolve([]);
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



TelemDS_Couchbase.prototype.startGameSession = function(userId, courseId, gameLevel, gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    if(!gameSessionId) {
        gameSessionId = Util.CreateUUID();
    }

    var key = tConst.game.dataKey+":"+tConst.game.gameSessionKey+":"+gameSessionId;

    var gameSessionData = {
        serverStartTimeStamp: Util.GetTimeStamp(),
            clientStartTimeStamp: Util.GetTimeStamp(),
        serverEndTimeStamp:   0,
        clientEndTimeStamp:   0,
        userId:    userId,
        deviceId:  userId, // old version deviceId and userId are the same
        gameLevel: gameLevel,
        courseId:  courseId,
        gameSessionId: gameSessionId,
        state:  tConst.game.session.started,
        qstate: '' // TODO: remove with assessment Q
    };
    console.log("start gameSessionData:", gameSessionData);

    this.client.add(key, gameSessionData,
        //{ expiry: this.options.gameSessionExpire },
        function(err, data){
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


TelemDS_Couchbase.prototype.validateSession = function(gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var key = tConst.game.dataKey+":"+tConst.game.gameSessionKey+":"+gameSessionId;
    this.client.get(key, function(err, data){
        if(err){
            console.error("CouchBase TelemetryStore: Validate Session Error -", err);
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

            var gameSessionData     = data.value;
            gameSessionData.serverEndTimeStamp = Util.GetTimeStamp();
            gameSessionData.clientEndTimeStamp = Util.GetTimeStamp();
            gameSessionData.state   = tConst.game.session.ended;
            gameSessionData.qstate  = tConst.game.session.started; // TODO: remove with assessment Q
            console.log("end gameSessionData:", gameSessionData);

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

TelemDS_Couchbase.prototype.getAllOldGameSessions = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var expireDate = moment.utc().subtract('second', this.options.gameSessionExpire).toArray();
    expireDate[1]++; // month starts at 0, so need to add one
    expireDate[6] = "\u0fff";

    // tConst.game.session.started
    this.client.view("telemetry", 'getAllStartedSessions').query(
        {
            stale: false,
            startkey: [null],
            endkey: expireDate
        },
        function(err, results) {
            this._cleanUpGameSessions(err, results)
                .then(resolve, reject)
        }.bind(this)
    );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}

TelemDS_Couchbase.prototype.cleanUpOldGameSessionsV2 = function(deviceId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // use view to find started session for a deviceId
    // tConst.game.session.started
    this.client.view("telemetry", 'getStartedSessionsByDeviceId').query(
        {
            stale: false,
            key: deviceId
        },
        function(err, results) {
            this._cleanUpGameSessions(err, results)
                .then(resolve, reject)
        }.bind(this)
    );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}


TelemDS_Couchbase.prototype._cleanUpGameSessions = function(err, results){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        if(err) {
            console.error("CouchBase TelemetryStore: Get Events View Error -", err);
            reject(err);
            return;
        }

        if(results.length > 0) {
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

                    var datalist = {};
                    for (var i = 0; i < keys.length; ++i) {
                        var val = results[ keys[i] ].value;
                        val.serverEndTimeStamp = Util.GetTimeStamp();
                        val.state = tConst.game.session.cleanup;
                        datalist[ keys[i] ] = {
                            value: _.clone(val)
                        };
                    }

                    this.client.setMulti(datalist, {},
                        function(err){
                            if(err){
                                console.error("CouchBase TelemetryStore: Multi Get Events Error -", err);
                                reject(err);
                                return;
                            }

                            console.log("CouchBase TelemetryStore: Cleaned up", keys.length, "game sessions");
                            resolve();
                        }.bind(this)
                    );
                }.bind(this)
            );
        } else {
            // nothing to do
            resolve();
        }

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
}



TelemDS_Couchbase.prototype.startGameSessionV2 = function(deviceId, userId, courseId, gameLevel, clientTimeStamp) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var gameSessionId = Util.CreateUUID();
    //console.log("gameSessionId:", gameSessionId);

    var key = tConst.game.dataKey+":"+tConst.game.gameSessionKey+":"+gameSessionId;

    var data = {
        serverStartTimeStamp: Util.GetTimeStamp(),
        clientStartTimeStamp: clientTimeStamp,
        serverEndTimeStamp:   0,
        clientEndTimeStamp:   0,
        deviceId:             deviceId,
        gameSessionId:        gameSessionId,
        state:                tConst.game.session.started,
        qstate:               '' // TODO: remove with assessment Q
    };
    // optional
    if(userId) {
        data.userId = userId;
    }
    if(courseId) {
        data.courseId = courseId;
    }
    if(gameLevel) {
        data.gameLevel = gameLevel;
    }

    this.client.add(key, data, function(err) {
        if(err){
            console.error("CouchBase TelemetryStore: Start Game Session Error -", err);
            reject(err);
            return;
        }

        resolve(gameSessionId);
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.endGameSessionV2 = function(gameSessionId, clientTimeStamp){
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
                gameSessionData.serverEndTimeStamp = Util.GetTimeStamp();
                gameSessionData.clientEndTimeStamp = clientTimeStamp;
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

// TODO: remove with assessment Q
TelemDS_Couchbase.prototype.endQSession = function(gameSessionId){
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

            var gameSessionData     = data.value;
            gameSessionData.qstate  = tConst.game.session.ended;

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
}

TelemDS_Couchbase.prototype.cleanupQSession = function(gameSessionId){
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

            var gameSessionData    = data.value;
            gameSessionData.qstate = tConst.game.session.cleanup;

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
}



TelemDS_Couchbase.prototype.getAchievements = function(deviceIds){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        this.client.view("telemetry", "getAllAchievementsByDeviceId").query({
                stale: false,
                keys: deviceIds
            },
            function(err, results){
                if(err){
                    console.error("CouchBase TelemetryStore: Get Achievements View Error -", err);
                    reject(err);
                    return;
                }

                if(results.length == 0) {
                    resolve({});
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
                            console.error("CouchBase TelemetryStore: Multi Get Achievements Error -", err);
                            reject(err);
                            return;
                        }

                        var out = _.pluck(results, 'value');
                        //console.log("getAchievements out:", out);
                        resolve(out);
                    }.bind(this));

            }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};


TelemDS_Couchbase.prototype.saveGameData = function(userId, data){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = tConst.game.dataKey+":"+tConst.game.saveKey+":"+userId;

    // set game data
    this.client.set(key, data,
        function(err, data){
            if(err){
                console.error("CouchBase TelemetryStore: Save Game Error -", err);
                reject(err);
                return;
            }

            resolve(data);
        }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};