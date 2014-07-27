/**
 * Auth Couchbase Datastore Module
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

var exampleIn = {};

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
        console.error("[Data] CouchBase TelemetryStore: Error -", err);

        if(err) throw err;
    }.bind(this));

    this.client.on('error', function (err) {
        console.error("[Data] CouchBase TelemetryStore: Error -", err);
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


// ------------------------------------
// TODO: remove
var gdv_getEventsByServerTimeStamp = function (doc, meta)
{
    var values = meta.id.split(':');
    if( (values[0] == 'gd') &&
        (values[1] == 'e') &&
        (meta.type == 'json') &&
        doc.hasOwnProperty('serverTimeStamp')
      )
    {
        emit( dateToArray( new Date(doc.serverTimeStamp * 1000) ) );
    }
};


// Research
var gdv_getEventsByGameId_ServerTimeStamp = function (doc, meta)
{
    var values = meta.id.split(':');
    if( (values[0] == 'gd') &&
        (values[1] == 'e') &&
        (meta.type == 'json') &&
        doc.hasOwnProperty('gameId')
      )
    {
        var a = dateToArray( new Date(doc.serverTimeStamp * 1000) );
        a.unshift( doc.gameId.toUpperCase() );
        emit( a );
    }
};

// Assessment
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


var gdv_getCompletedSessionsByUserId = function (doc, meta)
{
    var values = meta.id.split(':');
    if( (values[0] == 'gd') &&
        (values[1] == 'gs') &&
        (meta.type == 'json') &&
        doc.hasOwnProperty('state') &&
        doc.hasOwnProperty('userId') &&
        (doc['state'] == 'ended') &&
        doc.hasOwnProperty('gameId') &&
        doc.hasOwnProperty('gameSessionId')
      )
    {
        emit( [
            doc.gameId.toUpperCase(),
            doc.userId
        ], doc.gameSessionId );
    }
};

// For new session check, cleanup
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

// For cleanup
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

// TODO: Remove when all achievement
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
// TODO: Remove when all achievement
// gd:d:AA-1:25
var gdv_getLastDeviceIdByGameId = function (doc, meta)
{
    var values = meta.id.split(':');
    if( (values[0] == 'gd') &&
        (values[1] == 'd') &&
        (values.length > 3) &&
        (meta.type == 'json') &&
        doc.hasOwnProperty('lastDevice') )
    {
        emit( values[2], doc['lastDevice'] );
    }
};
// ------------------------------------

    this.telemDDoc = {
        views: {
            getEventsByGameSessionId : {
                map: gdv_getEventsByGameSessionId
            },
            getEventsByServerTimeStamp : {
                map: gdv_getEventsByServerTimeStamp
            },
            getEventsByGameId_ServerTimeStamp : {
                map: gdv_getEventsByGameId_ServerTimeStamp
            },
            getStartedSessionsByDeviceId : {
                map: gdv_getStartedSessionsByDeviceId
            },
            getAllStartedSessions : {
                map: gdv_getAllStartedSessions
            },
            getCompletedSessionsByUserId: {
                map: gdv_getCompletedSessionsByUserId
            },
            getAllAchievementsByDeviceId: {
                map: gdv_getAllAchievementsByDeviceId
            },
            getLastDeviceIdByGameId: {
                map: gdv_getLastDeviceIdByGameId
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

TelemDS_Couchbase.prototype.migrateData = function(parent) {
// add promise wrapper
return when.promise(function (resolve, reject) {
// ------------------------------------------------

    var currentVersion = 0.6;
    this.getDataSchemaInfo()
        .then(function (info) {

            if (info.version < currentVersion) {
                return this._migrateEventAchievements();
                //this._migrateEventsFromMysql(parent.stats, parent.myds, parent.options.telemetry.migrateCount);
            }
            else
            {
                console.log("CouchBase TelemetryStore: DB Schema Up to date!");
                // nothing to do
                resolve();
                return;
            }
        }.bind(this))

        .then(function () {
            // all done
            console.log("CouchBase TelemetryStore: All Done Migrating");
            this.updateDataSchemaVersion(currentVersion);
        }.bind(this))

        // all done
        .then(resolve, reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


TelemDS_Couchbase.prototype._migrateEventsFromMysql = function(stats, myds, migrateCount) {
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



TelemDS_Couchbase.prototype._migrateEventAchievements = function() {
// add promise wrapper
return when.promise(function (resolve, reject) {
// ------------------------------------------------

    console.log("CouchBase TelemetryStore: Migrating Achievement Events...");
    this.getLastDeviceIdByGameId("AA-1")
        // LastDeviceId
        .then(function(deviceIds) {
            // if no deviceIds skip to next
            if(!deviceIds) return;

            // Get achievements events
            return this.getAchievements(deviceIds);
        }.bind(this))

        // User LastDeviceId
        .then(function(events) {
            // if no deviceIds skip to next
            if(!events) return;

            var promistReduce = when.reduce(events, function(currentResult, event, index){
                // save achievements to player info
                //console.log(index+":", event);
                return this.postGameAchievement(event.userId, event.gameId, event.eventData);
            }.bind(this), 0);

            promistReduce.then(resolve, reject);

        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


TelemDS_Couchbase.prototype.getLastDeviceIdByGameId = function(gameId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    this.client.view("telemetry", "getLastDeviceIdByGameId").query({
            key: gameId,
            stale: false
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

            var out = _.pluck(results, 'value');
            //console.log("getLastDeviceIdByGameId out:", out);
            resolve(out);

        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.getAchievements = function(deviceIds){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    this.client.view("telemetry", "getAllAchievementsByDeviceId").query({
            keys: deviceIds,
            stale: false
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


TelemDS_Couchbase.prototype.updateDataSchemaVersion = function(version){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = tConst.game.dataKey+"::"+tConst.game.dsInfoKey;
    // get data
    this.client.get(key,
        function(err, data){
            var info = {
                version: 0.5
            };
            // "NO - No such key"
            if(err){
                if(err.code != 13){
                    console.error("CouchBase TelemetryStore: Update DataSchema Version Error -", err);
                    reject(err);
                    return;
                }
            } else {
                info = data.value;
            }

            info.version = version;

            // replace with updated
            this.client.set(key, info,
                function(err, data){
                    if(err){
                        console.error("CouchBase TelemetryStore: Update DataSchema Version Error -", err);
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

TelemDS_Couchbase.prototype.getDataSchemaInfo = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = tConst.game.dataKey+"::"+tConst.game.dsInfoKey;
    // get data
    this.client.get(key, function(err, data){
        var info = {
            version: 0
        };
        // "NO - No such key"
        if(err){
            if(err.code != 13){
                console.error("CouchBase TelemetryStore: Get DataSchema Info Error -", err);
                reject(err);
                return;
            }
        } else {
            info = data.value;
        }

        resolve(info);
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
            key: gameSessionId,
            stale: false
        },
        function(err, results){
            if(err){
                console.error("CouchBase TelemetryStore: Get Events View Error -", err);
                reject(err);
                return;
            }
            var eventsData = {
                userId: 0,
                gameSessionId: '',
                events: []
            };

            if(results.length == 0) {
                resolve(eventsData);
                return;
            }

            var keys = [];
            for (var i = 0; i < results.length; ++i) {
                keys.push(results[i].id);
            }

            var eventsData = {
                userId: 0,
                gameSessionId: gameSessionId,
                events: []
            };

            if(keys.length == 0) {
                resolve(eventsData);
                return;
            }

            //console.log("CouchBase TelemetryStore: getEvents keys length", keys.length);
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
                        "gameId": "SC",
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
                    var event, revent;
                    for(var i in results) {
                        revent = results[i].value;
                        event = {
                            timestamp: revent.clientTimeStamp,
                            name:      revent.eventName,

                            gameSessionEventOrder: revent.gameSessionEventOrder,
                            clientTimeStamp: revent.clientTimeStamp,
                            serverTimeStamp: revent.serverTimeStamp,
                            eventName: revent.eventName,
                            eventData: revent.eventData,
                            totalTimePlayed: revent.totalTimePlayed
                        };

                        // pull root info (data that should all be the same for all events of a session event)
                        if(revent.userId) {
                            eventsData.userId = revent.userId;
                        }
                        if( revent.gameType ) {
                            eventsData.gameType = revent.gameType;
                        }
                        if( revent.gameVersion) {
                            eventsData.gameVersion = revent.gameVersion;
                        }
                        if( revent.clientVersion ) {
                            eventsData.clientVersion = revent.clientVersion;
                        }
                        if( revent.deviceId ) {
                            eventsData.deviceId = revent.deviceId;
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
            key: gameSessionId,
            stale: false
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
        gameId:    'SC',
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
            reject(new Error("session "+gameSessionId+" "+gameSessionData.state ));
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


TelemDS_Couchbase.prototype.getSessionsByUserId = function(gameId, userId){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        gameId = gameId.toUpperCase();
        // tConst.game.session.started

        this.client.view("telemetry", 'getCompletedSessionsByUserId').query(
            {
                key: [gameId, userId]
            },
            function(err, results) {
                if(err){
                    console.error("CouchBase TelemetryStore: Get Sessions By UserId Error -", err);
                    reject(err);
                    return;
                }

                var gameSessionIds = _.pluck(results, 'value');
                resolve(gameSessionIds);
            }.bind(this)
        );

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
};

TelemDS_Couchbase.prototype.cleanUpOldGameSessionsV2 = function(deviceId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // use view to find started session for a deviceId
    // tConst.game.session.started
    this.client.view("telemetry", 'getStartedSessionsByDeviceId').query(
        {
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

                        console.log("CouchBase TelemetryStore: Cleaning up game sessions :", val.gameSessionId);
                    }

                    this.client.setMulti(datalist, {},
                        function(err){
                            if(err){
                                console.error("CouchBase TelemetryStore: Multi Get Events Error -", err);
                                reject(err);
                                return;
                            }

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



TelemDS_Couchbase.prototype.startGameSessionV2 = function(userId, deviceId, gameId, courseId, gameLevel, clientTimeStamp) {
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
        gameId:               gameId,
        deviceId:             deviceId,
        gameSessionId:        gameSessionId,
        state:                tConst.game.session.started,
        attempt:              1, // TODO: inc this from last session
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
                    console.error("CouchBase TelemetryStore: End Game Session V2 Error -", err);
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
                if(err.code == 13) {
                    console.warn("CouchBase TelemetryStore: End Q - Session Id Missing -", gameSessionId);
                    resolve();
                } else {
                    console.error("CouchBase TelemetryStore: End Q Session Error -", err);
                    reject(err);
                }
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
                console.error("CouchBase TelemetryStore: Cleanup Q Session Error -", err);
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
};

TelemDS_Couchbase.prototype.saveGameData = function(userId, gameId, data){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = tConst.game.dataKey+":"+tConst.game.saveKey+":"+gameId+":"+userId;

    // set game data
    this.client.set(key, data,
        function(err, data){
            if(err){
                console.error("CouchBase TelemetryStore: Save Game Data Error -", err);
                reject(err);
                return;
            }

            resolve(data);
        }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.getGameData = function(userId, gameId){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        var key = tConst.game.dataKey+":"+tConst.game.saveKey+":"+gameId+":"+userId;

        // get game data
        this.client.get(key,
            function(err, data){
                if(err){
                    console.error("CouchBase TelemetryStore: Get Game Data Error -", err);
                    reject(err);
                    return;
                }
                resolve(data);
            }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};



TelemDS_Couchbase.prototype.saveUserPref = function(userId, gameId, data){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        var key = tConst.game.dataKey+":"+tConst.game.prefKey+":"+gameId+":"+userId;

        // set user game pref
        this.client.set(key, data,
            function(err, data){
                if(err){
                    console.error("CouchBase TelemetryStore: Save User Pref Data Error -", err);
                    reject(err);
                    return;
                }

                resolve(data);
            }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.updateUserDeviceId = function(userId, gameId, deviceId) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var key = tConst.game.dataKey+":"+tConst.game.deviceKey+":"+gameId+":"+userId;
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
                    console.error("CouchBase DataStore: Error -", err);
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
                        console.error("CouchBase DataStore: Error -", err);
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


TelemDS_Couchbase.prototype.getMultiUserLastDeviceId = function(userIds, gameId) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var keys = [];
        for(var i = 0; i < userIds.length; i++) {
            var key = tConst.game.dataKey+":"+tConst.game.deviceKey+":"+gameId+":"+userIds[i];
            keys.push(key);
        }

        this.client.getMulti(keys, {}, function(err, data) {
            // it's ok if one fails, need to check them all for errors
            if( err &&
                !err.code == 4101) {
                console.error("CouchBase DataStore: Error -", err);
                reject(err);
                return;
            }

            var deviceUserIdMap = {};
            var failed;
            _.forEach(data, function(device, key) {

                // check if errors
                if(device.error) {
                    // it's ok if no device in list for a user
                    // otherwise fail
                    if(device.error.code != 13) {
                        console.error("CouchBase DataStore: Error -", device.error);
                        failed = device.error;
                        return;
                    }
                }

                // split to get user id
                var parts = key.split(':');
                if( device &&
                    device.value &&
                    device.value.lastDevice ) {
                    deviceUserIdMap[ device.value.lastDevice ] = parts[3];
                }
            });

            if(!failed) {
                if( Object.keys(deviceUserIdMap).length > 0 ) {
                    resolve(deviceUserIdMap);
                } else {
                    resolve();
                }
            } else {
                reject(failed);
            }
        }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.getMultiUserSavedGames = function(userIds, gameId) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var keys = [];
        for(var i = 0; i < userIds.length; i++) {
            var key = tConst.game.dataKey+":"+tConst.game.saveKey+":"+gameId+":"+userIds[i];
            keys.push(key);
        }

        this.client.getMulti(keys, {}, function(err, data){
            // it's ok if one fails, need to check them all for errors
            if( err &&
                !err.code == 4101) {
                console.error("CouchBase DataStore: getMultiUserSavedGames Error -", err);
                reject(err);
                return;
            }

            var userIdGameDataMap = {};
            // re-set all users map values
            for(var i = 0; i < userIds.length; i++) {
                userIdGameDataMap[ userIds[i] ] = {};
            }

            var failed = null;
            _.forEach(data, function(gamedata, key) {

                // check if errors
                if(gamedata.error) {
                    // it's ok if no device in list for a user
                    // otherwise fail
                    if(gamedata.error.code != 13) {
                        console.error("CouchBase DataStore: getMultiUserSavedGames Error -", gamedata.error);
                        failed = gamedata.error;
                        return;
                    }
                }

                // split to get user id
                var parts = key.split(':');
                if( gamedata &&
                    gamedata.value ) {
                    userIdGameDataMap[ parts[3] ] = gamedata.value;
                }
            });

            if(!failed) {
                if( Object.keys(userIdGameDataMap).length > 0 ) {
                    resolve(userIdGameDataMap);
                } else {
                    resolve();
                }
            } else {
                reject(failed);
            }
        }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};



TelemDS_Couchbase.prototype.getUserSavedGame = function(userId, gameId) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        var key = tConst.game.dataKey+":"+tConst.game.saveKey+":"+gameId+":"+userId;

        this.client.get(key, function(err, data){
            // NOT "No such key"
            if( err &&
                err.code != 13) {
                console.error("CouchBase DataStore: Error -", err);
                reject(err);
                return;
            }

            resolve(data.value);
        }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.getGamePlayInfo = function(userId, gameId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    // gameId is not case sensitive
    gameId = gameId.toUpperCase();

    var key = tConst.game.dataKey+":"+tConst.game.playInfoKey+":"+gameId+":"+userId;

    // get user game pref
    this.client.get(key,
        function(err, data){
            var playInfo = playInfo = {
                totalTimePlayed: 0,
                achievement: { "groups": {} }
            };
            if(err){
                // NOT "No such key"
                if(err.code != 13) {
                    console.error("CouchBase TelemetryStore: Get User Pref Data Error -", err);
                    reject(err);
                    return;
                }
            } else {
                playInfo = _.merge(playInfo, data.value);
            }

            resolve(playInfo);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.getMultiGamePlayInfo = function(userIds, gameId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var keys = [];
    for(var i = 0; i < userIds.length; i++) {
        var key = tConst.game.dataKey+":"+tConst.game.playInfoKey+":"+gameId+":"+userIds[i];
        keys.push(key);
    }

    // get user game pref
    this.client.getMulti(keys, {},
        function(err, data){
            // it's ok if one fails, need to check them all for errors
            if( err &&
                !err.code == 4101) {
                console.error("CouchBase DataStore: getMultiGamePlayInfo Error -", err);
                reject(err);
                return;
            }

            var userIdGameDataMap = {};
            // re-set all users map values
            for(var i = 0; i < userIds.length; i++) {
                userIdGameDataMap[ userIds[i] ] = {};
            }

            var failed = null;
            _.forEach(data, function(gamedata, key) {

                // check if errors
                if(gamedata.error) {
                    // it's ok if no device in list for a user
                    // otherwise fail
                    if(gamedata.error.code != 13) {
                        console.error("CouchBase DataStore: getMultiGamePlayInfo Error -", gamedata.error);
                        failed = gamedata.error;
                        return;
                    }
                }

                // split to get user id
                var parts = key.split(':');
                if( gamedata &&
                    gamedata.value ) {
                    userIdGameDataMap[ parts[3] ] = gamedata.value;
                }
            });

            if(!failed) {
                if( Object.keys(userIdGameDataMap).length > 0 ) {
                    resolve(userIdGameDataMap);
                } else {
                    resolve();
                }
            } else {
                reject(failed);
            }
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.addDiffToTotalTimePlayed = function(userId, gameId, timeDiff, totalTimePlayed) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        // gameId is not case sensitive
        gameId = gameId.toUpperCase();

        var key = tConst.game.dataKey+":"+tConst.game.playInfoKey+":"+gameId+":"+userId;
        this.client.get(key, function(err, data){
            var playInfo = {
                totalTimePlayed: 0,
                achievement: { "groups": {} }
            };
            if(err) {
                // "NO - No such key"
                if(err.code != 13) {
                    console.error("CouchBase DataStore: addTotalTimePlayed Error -", err);
                    reject(err);
                    return;
                }
            } else {
                playInfo = _.merge(playInfo, data.value);
            }

            if(totalTimePlayed) {
                // set totalTimePlayed
                playInfo.totalTimePlayed = totalTimePlayed;
            }
            if(timeDiff) {
                // add time to totalTimePlayed
                playInfo.totalTimePlayed += timeDiff;
            }

            // update data
            this.client.set(key, playInfo,
                function(err, data) {
                    if(err) {
                        console.error("CouchBase DataStore: addTotalTimePlayed Error -", err);
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

exampleIn.postGameAchievement = {};
exampleIn.postGameAchievement.achievement = {
    group:    "CCSS.ELA-Literacy.WHST.6-8.1",
    subGroup: "b",
    item:     "Core Cadet"
};
TelemDS_Couchbase.prototype.postGameAchievement = function(userId, gameId, achievement) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // gameId is not case sensitive
    gameId = gameId.toUpperCase();

    var key = tConst.game.dataKey+":"+tConst.game.playInfoKey+":"+gameId+":"+userId;
    this.client.get(key, function(err, data){
        var playInfo = {
                totalTimePlayed: 0,
                achievement: { "groups": {} }
        };
        if(err) {
            // "NO - No such key"
            if(err.code != 13) {
                console.error("CouchBase DataStore: postGameAchievement Error -", err);
                reject(err);
                return;
            }
        } else {
            playInfo = _.merge(playInfo, data.value);
        }

        // create object tree
        if(!playInfo.achievement.groups.hasOwnProperty( achievement.group )) {
            playInfo.achievement.groups [achievement.group] = { "subGroups": {} };
        }
        if(!playInfo.achievement.groups[achievement.group].subGroups.hasOwnProperty( achievement.subGroup )) {
            playInfo.achievement.groups[achievement.group].subGroups[achievement.subGroup] = { "items": {} };
        }
        if(!playInfo.achievement.groups[achievement.group].subGroups[achievement.subGroup].items.hasOwnProperty( achievement.item )) {
            playInfo.achievement.groups[achievement.group].subGroups[achievement.subGroup].items[achievement.item] = { "won": false };
        }

        // update info
        playInfo.achievement.groups[achievement.group].subGroups[achievement.subGroup].items[achievement.item].won = true;

        // update data
        this.client.set(key, playInfo,
            function(err, data) {
                if(err) {
                    console.error("CouchBase DataStore: postGameAchievement Error -", err);
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


TelemDS_Couchbase.prototype.getEventCount = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = tConst.game.dataKey+"::"+tConst.game.countKey;

    // get user game pref
    this.client.get(key,
        function(err, data){
            var count = 0;
            if(err){
                // NOT "No such key"
                if(err.code != 13) {
                    console.error("CouchBase TelemetryStore: Get Event Count Data Error -", err);
                    reject(err);
                    return;
                }
            } else {
                count = data.value;
            }

            resolve(count);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


TelemDS_Couchbase.prototype.saveAssessmentResults = function(gameId, userId, assessmentId, data){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = tConst.aeng.key+":"+tConst.aeng.resultsKey+":"+gameId+":"+assessmentId+":"+userId;

    // get user game pref
    this.client.set(key, data,
        function(err, data) {
            if(err) {
                console.error("CouchBase TelemetryStore: Save Assessment Results Error -", err);
                reject(err);
                return;
            }

            resolve(data);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};
