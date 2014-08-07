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
var guard     = require('when/guard');
var sequence  = require('when/sequence');
var couchbase = require('couchbase');
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
            gameSessionExpire:   1*1*60, //24*60*60 // in seconds
            multiGetChunkSize:   2000,
            multiGetParallelNum: 2
        },
        options
    );

    this.currentDBVersion = 0.7;
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


TelemDS_Couchbase.prototype._multiChunkGet = function(keys, options, callback){
    // create buckets of keys with each one having a max size of ChunckSize
    var taskList = Util.Reshape(keys, this.options.multiGetChunkSize);

    var guardedAsyncOperation = guard(guard.n(this.options.multiGetParallelNum), function (all, ckeys){
        return when.promise(function(resolve, reject) {
            this.client.getMulti(ckeys, options, function(err, results){
                    if(err) {
                        reject(err);
                        return;
                    }

                    // merge two arrays
                    all = _.merge(all, results);
                    resolve(all);
                });
        }.bind(this));
    }.bind(this));

    when.reduce(taskList, guardedAsyncOperation, {})
        .then(function(all){
            callback(null, all);
        }, function(err){
            callback(err);
        })
};


TelemDS_Couchbase.prototype.setupDocsAndViews = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
// TODO: move this to it's own module

// ------------------------------------
// TODO: remove at some point, used by Pipeline server
var gdv_getEventsByServerTimeStamp = function (doc, meta)
{
    var values = meta.id.split(':');
    if( (values[0] == 'gd') &&
        (values[1] == 'e') &&
        (meta.type == 'json') &&
        doc.hasOwnProperty('serverTimeStamp')
      )
    {
        var st = doc.serverTimeStamp;
        // convert to milliseconds from EPOCH
        if(doc.serverTimeStamp < 10000000000) {
            st *= 1000;
        }

        emit( dateToArray( new Date(st) ) );
    }
};
// TODO: remove at some point, Used by Research Server
var gdv_getEventsByGameId_ServerTimeStamp = function (doc, meta)
{
    var values = meta.id.split(':');
    if( (values[0] == 'gd') &&
        (values[1] == 'e') &&
        (meta.type == 'json') &&
        doc.hasOwnProperty('gameId')
      )
    {
        var st = doc.serverTimeStamp;
        // convert to milliseconds from EPOCH
        if(doc.serverTimeStamp < 10000000000) {
            st *= 1000;
        }

        var a = dateToArray( new Date(st) );
        a.unshift( doc.gameId.toUpperCase() );
        emit( a );
    }
};

// Used for Assessment
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

// used to process all sessions, migration
var gdv_getAllGameSessionsByGameId = function (doc, meta)
{
    var values = meta.id.split(':');
    if( (values[0] == 'gd') &&
        (values[1] == 'gs') &&
        (meta.type == 'json') &&
        (doc.hasOwnProperty('gameId') || doc.hasOwnProperty('clientId') ) )
    {
        emit( doc.gameId || doc.clientId );
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
            getAllGameSessionsByGameId : {
                map: gdv_getAllGameSessionsByGameId
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

TelemDS_Couchbase.prototype.migrateData = function(myds) {
// add promise wrapper
return when.promise(function (resolve, reject) {
// ------------------------------------------------

    console.log("CouchBase TelemetryStore: Getting Data Schema Info...");
    this.getDataSchemaInfo()
        .then(function (info) {
            console.log("CouchBase TelemetryStore: Data Schema Info:", info);

            if( info.version != this.currentDBVersion ) {
                info.version = this.currentDBVersion;
            }

            // ensure there is a property migrated
            if(!info.migrated) {
                info.migrated = {
                    achievements: false,
                    addGameId:    false
                };
            }

            // add a list of functions to be called
            var tasks = [];
            if ( !info.migrated.achievements ) {
                tasks.push(
                    function() {
                        console.log("CouchBase TelemetryStore: Migrate Achievement Events...");
                        return this._migrateEventAchievements()
                            .then(function() {
                                console.log("CouchBase TelemetryStore: Migrate Achievement Events: Done!");
                                info.migrated.achievements = true;
                                return this.updateDataSchemaInfo(info);
                            }.bind(this))
                    }.bind(this)
                );
                //this._migrateEventsFromMysql(parent.stats, parent.myds, parent.options.telemetry.migrateCount);
            }
            if ( !info.migrated.addGameId ) {
                tasks.push(
                     function() {
                         console.log("CouchBase TelemetryStore: Migrate Events to Add GameId...");
                         return this._migrateEvents_AddingGameId(myds)
                            .then(function () {
                                 console.log("CouchBase TelemetryStore: Migrate Events to Add GameId: Done!");
                                info.migrated.addGameId = true;
                                return this.updateDataSchemaInfo(info);
                            }.bind(this))
                    }.bind(this)
                );
            }

            if(tasks.length) {
                // create a gaurded Task function
                var guardTask = guard.bind(null, guard.n(1));
                // run each task using guardTask function
                tasks = tasks.map(guardTask);

                // wait until all guardTasks have completed
                return sequence(tasks)
                    .then(function() {
                        console.log("CouchBase TelemetryStore: DB Schema Up to date!");
                        // nothing to do
                        resolve();
                        return;
                    }.bind(this));
            }
        }.bind(this))

        .then(function () {
            // all done
            console.log("CouchBase TelemetryStore: All Done Migrating");
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
    // assume game Id is SC because events where in mysql
    var gameId = 'SC';

    myds.getArchiveEventsLastId()
        .then(function(lastId) {
            if(lastId) {
                return this._setEventCounter(gameId, lastId)
                    // _setEventCounter done
                    .then(function() {
                        return myds.getGameSessionWithGameSection();
                    }.bind(this))

                    // getGameSessionWithGameSection done
                    .then(function(map) {
                        sessionToGameLevelMap = map;
                        // migrate 5k at a time, as to no overload the DB
                        return myds.getArchiveEvents(migrateCount);
                    }.bind(this))

                    // getArchiveEvents done
                    .then(function(data) {
                        //console.log("events:", data.events);
                        if( data &&
                            data.events &&
                            _.isArray(data.events) &&
                            data.events.length > 0 ) {

                            // run all migrate sessions in sequence
                            return this._migrateOldDB_SaveEvents(stats, myds, gameId, data.events, data.ids, sessionToGameLevelMap )
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
    var gameId = 'AA-1';

    this.getLastDeviceIdByGameId(gameId)
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

            console.log("CouchBase TelemetryStore: Migrating Achievement #", events.length, "Events");
            if(events.length) {
                var promistReduce = when.reduce(events, function(currentResult, event, index){
                    // save achievements to player info
                    //console.log(index+":", event);
                    return this.postGameAchievement(event.userId, event.gameId, event.eventData);
                }.bind(this), 0);

                promistReduce.then(resolve, reject);
            }
            else {
                resolve();
            }

        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};



TelemDS_Couchbase.prototype._migrateEvents_AddingGameId = function(myds) {
    // get all sessions
    return this.getAllGameSessions(myds)
        // get all events per session
        .then(function(gameSessions) {
            // if no deviceIds skip to next
            if(!gameSessions) return;

            console.log("CouchBase TelemetryStore: Migrating Adding GameId to", gameSessions.length, "Sessions");
            var guardedAsyncOperation = guard(guard.n(1), function(gameSession){
                // get events
                return this.getRawEvents(gameSession.gameSessionId)
                    .then(function(events) {
                        //console.log("events:", events);
                        // if no deviceIds skip to next
                        if(!(events && events.length)) return;

                        // extract+remove all ids
                        // create list of keys
                        var keys = [];
                        var outEvents = [];
                        var id;
                        var gameId = gameSession.gameId;
                        for(var i = 0; i < events.length; i++) {
                            id = events[i].id;
                            id = id.split(":");

                            // old event types
                            if(id.length == 3) {
                                var ok = true;
                                // if clientId then SimCity
                                if(events[i].clientId) {
                                    // convert old clientIds
                                    if( events[i].clientId == 'SC' ||
                                        events[i].clientId == 'SD_LC' ||
                                        events[i].clientId == 'ELA_LC') {
                                        events[i].gameType = events[i].clientId;
                                        events[i].gameId = "SC";

                                        delete events[i].clientId;
                                    } else {
                                        console.error("Event clientId does not match possible!! Event:", events[i]);
                                        ok = false;
                                    }
                                }

                                if(events[i].gameId) {
                                    gameId = events[i].gameId
                                }

                                if(ok) {
                                    keys.push( events[i].id );
                                    delete events[i].id;
                                    outEvents.push(events[i]);
                                }
                            }
                        }

                        console.log("CouchBase TelemetryStore: Migrating Adding GameId - gameId:", gameId, ", gameSessionId:", gameSession.gameSessionId, "with", outEvents.length, "Events");
                        // only add events if there are events to add
                        if( outEvents.length > 0 ) {
                            // migrate event to add gameId
                            return this.saveEvents(gameId, outEvents)
                                .then(function() {
                                    return this._removeKeys(keys);
                                }.bind(this));
                        }
                    }.bind(this));

            }.bind(this));

            // for each gameSessionId
            return when.map(gameSessions, guardedAsyncOperation)
                // when all done
                .then(function() {
                    // leave this key just in case
                    // var key = tConst.game.dataKey+"::"+tConst.game.countKey;
                    // return this._removeKeys([key]);
                }.bind(this));
        }.bind(this));
};


TelemDS_Couchbase.prototype._removeKeys = function(keys){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    this.client.removeMulti(keys, {},
        function(err, results){
            if(err){
                var errList = [];
                for(var i in results) {
                    if(results[i].error){
                        if(results[i].error.code != 13) {
                            errList.push(results[i].error);
                        }
                    }
                }

                // only if errors
                if(errList.length) {
                    console.error("CouchBase TelemetryStore: Remove Keys Error -", errList);
                    reject(err);
                    return;
                }
            }

            resolve(results);
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
        function(err, results) {
            if(err){
                console.error("CouchBase TelemetryStore: Get Last DeviceId By GameId View Error -", err);
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

    // ensure deviceIds is array
    if(!_.isArray(deviceIds)) {
        deviceIds = [deviceIds];
    }

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
                resolve([]);
                return;
            }

            var keys = _.pluck(results, 'id');
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


TelemDS_Couchbase.prototype.updateDataSchemaInfo = function(info){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = tConst.game.dataKey+"::"+tConst.game.dsInfoKey;
    // get data
    this.client.set(key, info,
        function(err, data){
            // "NO - No such key"
            if(err){
                if(err.code != 13){
                    console.error("CouchBase TelemetryStore: Update DataSchema Version Error -", err);
                    reject(err);
                    return;
                }
            }

            resolve(data);
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
            version: 0,
            migrated: {}
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



TelemDS_Couchbase.prototype._migrateOldDB_SaveEvents = function(stats, myds, gameId, data, ids, sessionToGameLevelMap) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    if(data){
        stats.gauge('info',     'MigrateEvents', data.length);
        stats.increment('info', 'Events', data.length);
        //console.log("Assessment: Events per session:", data.length);

        //
        this._setEventsWithIds(gameId, data, sessionToGameLevelMap)
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


TelemDS_Couchbase.prototype._setEventCounter = function(gameId, lastId){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var key = tConst.game.dataKey+"::"+tConst.game.countKey+"::"+gameId;
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


TelemDS_Couchbase.prototype._setEventsWithIds = function(gameId, events, map){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var kv = {}, key, v;
    for(var i = 0; i < events.length; i++){
        key = tConst.game.dataKey+":"+tConst.game.eventKey+":"+gameId+":"+events[i].id;

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

TelemDS_Couchbase.prototype.saveEvents = function(gameId, events){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    //var key = tConst.game.dataKey+"::"+tConst.game.countKey;
    var key = tConst.game.dataKey+"::"+tConst.game.countKey+"::"+gameId;

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
            for(var i = 0; i < events.length; i++) {

                //key = tConst.game.dataKey+":"+tConst.game.eventKey+":"+kIndex;
                key = tConst.game.dataKey+":"+tConst.game.eventKey+":"+gameId+":"+kIndex;

                // convert to milliseconds from EPOCH
                if(events[i].serverTimeStamp < 10000000000) {
                    events[i].serverTimeStamp *= 1000;
                }
                if(events[i].clientTimeStamp < 10000000000) {
                    events[i].clientTimeStamp *= 1000;
                }
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

            var keys = _.pluck(results, 'id');

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
                        if( revent.gameId ) {
                            eventsData.gameId = revent.gameId;
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

            var keys = _.pluck(results, 'id');
            //console.log("CouchBase TelemetryStore: keys", keys);
            this._multiChunkGet(keys, {},
                function(err, results){
                    if(err){
                        if(err.code == 4101) {
                            var errors = [];
                            for(var r in results) {
                                if(results[r].error) {
                                    errors.push( results[r].error );
                                }
                            }
                            console.error("CouchBase TelemetryStore: Multi Get RawEvents Errors -", errors);
                        } else {
                            console.error("CouchBase TelemetryStore: Multi Get RawEvents Error -", err);
                            reject(err);
                            return;
                        }
                    }

                    var events = [];
                    for(var id in results) {
                        var event = results[id].value;
                        // add the key
                        event.id = id;
                        events.push(event);
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

TelemDS_Couchbase.prototype.getAllGameSessions = function(myds){
    return myds.getAllUserSessions()
        // send as activity
        .then(function(gameSessions){
            // shortcut if no session list
            if(!gameSessions) gameSessions = [];

            return this._getAllCouchGameSessions()
                .then(function(gameSessions2){
                    // combine mysql sessions and couchbase sessions
                    return gameSessions.concat(gameSessions2);
                }.bind(this));
        }.bind(this));
};


TelemDS_Couchbase.prototype._getAllCouchGameSessions = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    //
    this.client.view("telemetry", 'getAllGameSessionsByGameId').query(
        {
        },
        function(err, results) {
            if(err){
                console.error("CouchBase TelemetryStore: Get Sessions By UserId Error -", err);
                reject(err);
                return;
            }

            var keys = _.pluck(results, 'id');
            this._multiChunkGet(keys, {}, function(err, results){
                    if(err) {
                        if(err.code == 4101) {
                            var errors = [];
                            for(var r in results) {
                                if(results[r].error) {
                                    errors.push( results[r].error );
                                }
                            }
                            console.error("CouchBase TelemetryStore: Multi Get All GameSessions Errors -", errors);
                            reject(err);
                            return;
                        } else {
                            console.error("CouchBase TelemetryStore: Multi Get All GameSessions Error -", err);
                            reject(err);
                            return;
                        }
                    }

                    var gameSessions = _.pluck(results, 'value');
                    resolve(gameSessions);
                }.bind(this));
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
            var keys = _.pluck(results, 'id');

            //console.log("CouchBase TelemetryStore: keys", keys);
            this.client.getMulti(keys, {},
                function(err, results){
                    if(err){
                        console.error("CouchBase TelemetryStore: Multi Get CleanUp GameSessions Error -", err);
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
                                console.error("CouchBase TelemetryStore: Multi Set CleanUp GameSessions Error -", err);
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

TelemDS_Couchbase.prototype.saveUserGameData = function(userId, gameId, data){
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

TelemDS_Couchbase.prototype.getUserGameData = function(userId, gameId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = tConst.game.dataKey+":"+tConst.game.saveKey+":"+gameId+":"+userId;

    this.client.get(key, function(err, results){
        var data = null;
        // NOT "No such key"
        if(err) {
            if(err.code != 13) {
                console.error("CouchBase DataStore: Error -", err);
            }

            reject(err);
            return;
        }
        data = results.value;

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


TelemDS_Couchbase.prototype.getEventCount = function(gameId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = tConst.game.dataKey+"::"+tConst.game.countKey+"::"+gameId;

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


TelemDS_Couchbase.prototype.getAssessmentResults = function(gameId, userId, assessmentId){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        var key = tConst.aeng.key+":"+tConst.aeng.resultsKey+":"+gameId+":"+assessmentId+":"+userId;

        // get user game pref
        this.client.get(key, function(err, data) {
                if(err) {
                    // NOT "No such key"
                    if(err.code != 13) {
                        console.error("CouchBase TelemetryStore: Get Assessment Results Error -", err);
                        reject(err);
                        return;
                    }
                    else {
                        resolve({});
                        return;
                    }
                }

                resolve(data.value);
            }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};