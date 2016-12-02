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
var exampleOut = {};

function TelemDS_Couchbase(options,serviceManager){
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
            multiSetChunkSize:   10,
            multiViewChunkSize:  20,
            multiGetParallelNum: 2,
            multiSetParallelNum: 1
        },
        options
    );
    this.serviceManager = serviceManager;
    this.currentDBVersion = 0.7;
}

TelemDS_Couchbase.prototype.connect = function(myds){
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
        console.errorExt("DataStore Couchbase TelemetryStore", err);

        if(err) throw err;
    }.bind(this));

    this.client.on('error', function (err) {
        console.errorExt("DataStore Couchbase TelemetryStore", err);
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


TelemDS_Couchbase.prototype._chunk_getMulti = function(keys, options, callback){
    // create buckets of keys with each one having a max size of ChunckSize
    var taskList = Util.Reshape(keys, this.options.multiGetChunkSize);

    var guardedAsyncOperation = guard(guard.n(this.options.multiGetParallelNum), function (all, ckeys){
        return when.promise(function(resolve, reject) {
            this.client.getMulti(ckeys, options, function(err, results){
                    if(err) {
                        reject( { error: err, results: results } );
                        return;
                    }

                    // merge two objects
                    all = _.merge(all, results);
                    resolve(all);
                });
        }.bind(this));
    }.bind(this));

    when.reduce(taskList, guardedAsyncOperation, {})
        .then(function(all){
            callback(null, all);
        }, function(err){
            callback(err.error, err.results);
        })
};

TelemDS_Couchbase.prototype._chunk_viewKeys= function(bucket, view, keys, options, callback){
    // create buckets of keys with each one having a max size of ChunckSize
    var taskList = Util.Reshape(keys, this.options.multiViewChunkSize);

    var guardedAsyncOperation = guard(guard.n(this.options.multiGetParallelNum), function (all, ckeys){
        return when.promise(function(resolve, reject) {
            this.client.view(bucket, view).query( _.merge({ keys: ckeys }, options),
                function(err, results){
                    if(err) {
                        reject(err);
                        return;
                    }

                    // merge two arrays
                    all = all.concat(results);
                    resolve(all);
                });
        }.bind(this));
    }.bind(this));

    when.reduce(taskList, guardedAsyncOperation, [])
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
        if(st < 10000000000) st *= 1000;

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
        if(st < 10000000000) st *= 1000;

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

//
var gdv_getGameSessionsByUserId = function (doc, meta)
{
    var values = meta.id.split(':');
    if( (values[0] == 'gd') &&
        (values[1] == 'gs') &&
        (meta.type == 'json') &&
        doc.hasOwnProperty('userId') &&
        doc.hasOwnProperty('gameId') &&
        doc.hasOwnProperty('gameSessionId')
      )
    {
        emit( [
            doc.gameId.toUpperCase(),
            doc.userId
        ] );
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

var gdv_getEndedSessionsByDeviceId = function (doc, meta)
{
    var values = meta.id.split(':');
    if( (values[0] == 'gd') &&
        (values[1] == 'gs') &&
        (meta.type == 'json') &&
        doc.hasOwnProperty('deviceId') &&
        doc.hasOwnProperty('state') &&
        doc['state'] == 'ended' )
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
        doc.hasOwnProperty('gameId') )
    {
        emit( doc.gameId );
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

var gdv_getAllGameInformation = function (doc, meta)
{
    var values = meta.id.split(':');
    if( (values[0] == 'gi' ) &&
        (meta.type == 'json') )
    {
        emit( meta.id );
    }
};

var gdv_getAllGameAchievements = function (doc, meta)
{
    var values = meta.id.split(':');
    if( (values[0] === 'ga' ) &&
        (meta.type === 'json') )
    {
        emit( meta.id );
    }
};

var gdv_getAllGameInformationAndGameAchievements = function(doc, meta)
{
    var values = meta.id.split(':');
    if( ((values[0] === 'gi') ||
        (values[0] === 'ga')) &&
        (meta.type === 'json') )
    {
        emit( meta.id );
    }
};

var gdv_getAllDeveloperProfiles = function(doc, meta)
{
    var values = meta.id.split(':');
    if((values[0] === 'di') &&
        (values[1] === 'u')){
        emit( meta.id );
    }
};

var gdv_getAllDeveloperGamesAwaitingApproval = function(doc, meta) {
    var values = meta.id.split(':');
    if(values[0] === 'dgaa' && (!doc.hasOwnProperty('status') || doc['status'] == "submitted")){
        emit( meta.id );
    }
}

var gdv_getAllDeveloperGamesRejected = function(doc, meta) {
    var values = meta.id.split(':');
    if(values[0] === 'dgaa' && (doc['status'] == "rejected" || doc['status'] == "pulled")){
        emit( meta.id );
    }
}

var gdv_getAllDeveloperGameAccessRequestsAwaitingApproval = function(doc, meta) {
    var values = meta.id.split(':');
    if(values[0] === 'di' && values[1] === 'u'){
        for(var gameId in doc){
            if(!doc[gameId].hasOwnProperty('verifyCodeStatus') || doc[gameId].verifyCodeStatus === 'approve') {
                emit( values[2], {
                    "gameId": gameId,
                    "verifyCode": doc[gameId].verifyCode
                });
            }
        }
    }
}

var gdv_getAllDeveloperGameAccessRequestsDenied = function(doc, meta) {
    var values = meta.id.split(':');
    if(values[0] === 'di' && values[1] === 'u'){
        for(var gameId in doc){
            if(doc[gameId].hasOwnProperty('verifyCodeStatus') && doc[gameId].verifyCodeStatus === 'revoked') {
                emit( values[2], {
                    "gameId": gameId,
                    "verifyCode": doc[gameId].verifyCode
                });
            }
        }
    }
}

var gdv_getAllMatches = function(doc, meta){
    var values = meta.id.split(':');
    if((values[0] === 'gd') &&
        (values[1] === 'm')){
        var players = doc.data.players;
        var status;
        for(var userId in players){
            status = players[userId].playerStatus;
            emit( userId, status );
        }
    }
};

var gdv_getAllCourseGameProfiles = function(doc, meta){
    var values = meta.id.split(':');
    if((values[0] === "lms") &&
       (values[1] === "c")){
        emit(meta.id);
    }
};

var gdv_getAllGameSaves = function(doc, meta){
    var values = meta.id.split(':');
    if((values[0] === "gd") &&
       (values[1] === "save")){
        emit(meta.id);
    }
};

var gdv_getLatestGameSessionsByUserId = function (doc, meta) {
    var values = meta.id.split(':');
    if( (values[0] == 'gd') &&
        (values[1] == 'gs') &&
        (meta.type == 'json') &&
        doc.hasOwnProperty('gameId') &&
        doc.hasOwnProperty('userId') &&
        doc.hasOwnProperty('serverEndTimeStamp'))
    {
        emit([doc.userId, doc.gameId],
            [doc.serverStartTimeStamp, doc.gameSessionId]);
    }
};

var gdv_getLatestGameSessionsByUserId_reduce = function(keys, values, rereduce) {
    var max;

    values.forEach(function(v) {
        if (!max || v[0] > max[0]) {
            max = v;
        }
    });
    return max;

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
            getEndedSessionsByDeviceId : {
                map: gdv_getEndedSessionsByDeviceId
            },
            getAllGameSessionsByGameId : {
                map: gdv_getAllGameSessionsByGameId
            },
            getGameSessionsByUserId: {
                map: gdv_getGameSessionsByUserId
            },
            getAllAchievementsByDeviceId: {
                map: gdv_getAllAchievementsByDeviceId
            },
            getLastDeviceIdByGameId: {
                map: gdv_getLastDeviceIdByGameId
            },
            getAllGameInformation: {
                map: gdv_getAllGameInformation
            },
            getAllGameAchievements: {
                map: gdv_getAllGameAchievements
            },
            getAllGameInformationAndGameAchievements: {
                map: gdv_getAllGameInformationAndGameAchievements
            },
            getAllDeveloperProfiles: {
                map: gdv_getAllDeveloperProfiles
            },
            getAllDeveloperGamesAwaitingApproval: {
                map: gdv_getAllDeveloperGamesAwaitingApproval
            },
            getAllDeveloperGamesRejected: {
                map: gdv_getAllDeveloperGamesRejected
            },
            getAllDeveloperGameAccessRequestsAwaitingApproval: {
                map: gdv_getAllDeveloperGameAccessRequestsAwaitingApproval
            },
            getAllDeveloperGameAccessRequestsDenied: {
                map: gdv_getAllDeveloperGameAccessRequestsDenied
            },
            getAllMatches: {
                map: gdv_getAllMatches
            },
            getAllCourseGameProfiles: {
                map: gdv_getAllCourseGameProfiles
            },
            getAllGameSaves: {
                map: gdv_getAllGameSaves
            },
            getLatestGameSessionsByUserId: {
                map: gdv_getLatestGameSessionsByUserId,
                reduce: gdv_getLatestGameSessionsByUserId_reduce
            }
        }
    };

    // convert function to string
    for(var i in this.telemDDoc.views) {
        if( this.telemDDoc.views[i].hasOwnProperty('map') ) {
            this.telemDDoc.views[i].map = this.telemDDoc.views[i].map.toString();
        }
        if( this.telemDDoc.views[i].hasOwnProperty('reduce') ) {
            this.telemDDoc.views[i].reduce = this.telemDDoc.views[i].reduce.toString();
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
                console.errorExt("DataStore Couchbase TelemetryStore", err);
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
            console.errorExt("DataStore Couchbase TelemetryStore", err);
            reject(err);
            return;
        }

        resolve();
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.migrateDataAuto = function(myds) {
// add promise wrapper
return when.promise(function (resolve, reject) {
// ------------------------------------------------

    console.log("CouchBase TelemetryStore: Getting Data Schema Info...");
    this.getDataSchemaInfo()
        .then(function (info) {
            //console.log("CouchBase TelemetryStore: Data Schema Info:", info);

            if( info.version != this.currentDBVersion ) {
                info.version = this.currentDBVersion;
            }

            // ensure there is a property migrated
            if(!info.migrated) {
                info.migrated = {
                    addGames: false
                };
            }

            // add a list of functions to be called
            var tasks = [];
            if ( !info.migrated.addGames ) {
                tasks.push(
                    function() {
                        console.log("CouchBase TelemetryStore: Auto Migrate Add Games...");
                        return this._migrate_AddGames(myds)
                            .then(function() {
                                console.log("CouchBase TelemetryStore: Auto Migrate Add Games: Done!");
                                info.migrated.addGames = true;
                                return this.updateDataSchemaInfo(info);
                            }.bind(this))
                    }.bind(this)
                );
            }

            if(tasks.length) {
                // create a guarded Task function
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
                    }.bind(this))
                    // catch all errors
                    .then(null, reject);
            }
        }.bind(this))

        .then(function () {
            // all done
            console.log("CouchBase TelemetryStore: All Done Auto Migrating");
        }.bind(this))

        // all done
        .then(resolve, reject);

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
        .then(function(info) {
            //console.log("CouchBase TelemetryStore: Data Schema Info:", info);

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
                        return this._migrate_EventAchievements()
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
                         return this._migrate_Events_AddingGameId(myds)
                            .then(function () {
                                 console.log("CouchBase TelemetryStore: Migrate Events to Add GameId: Done!");
                                info.migrated.addGameId = true;
                                return this.updateDataSchemaInfo(info);
                            }.bind(this))
                    }.bind(this)
                );
            }

            if(tasks.length) {
                // create a guarded Task function
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
                    }.bind(this))

                    // catch all errors
                    .then(null, reject);
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


TelemDS_Couchbase.prototype._migrate_EventAchievements = function() {
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



TelemDS_Couchbase.prototype._migrate_Events_AddingGameId = function(myds) {
    // get all sessions
    return this.getAllGameSessions(myds)
        // get all events per session
        .then(function(gameSessions) {
            // if no deviceIds skip to next
            if(!gameSessions) return;

            console.log("CouchBase TelemetryStore: Migrating Adding GameId to", gameSessions.length, "Sessions");
            var guardedAsyncOperation = guard(guard.n(this.options.multiGetParallelNum), function(gameSession){

                //console.log("CouchBase TelemetryStore: Migrating Getting Events - gameId:", gameSession.gameId, ", gameSessionId:", gameSession.gameSessionId);
                // get events
                return this.getRawEvents(gameSession.gameSessionId)
                    .then(function(events) {
                        try {
                            //console.log("events:", events);
                            // if no deviceIds skip to next
                            if(!(events && events.length)) {
                                console.log("CouchBase TelemetryStore: Migrating No Events to Add - gameId:", gameSession.gameId, ", gameSessionId:", gameSession.gameSessionId, ", Events:", events);
                                return;
                            }

                            // extract+remove all ids
                            // create list of keys
                            var keys = [];
                            var outEvents = [];
                            var id;
                            var gameId    = gameSession.gameId;
                            var gameLevel = gameSession.gameLevel;
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

                                            events[i].gameOldId = events[i].clientId;
                                            events[i].gameId = "SC";

                                            delete events[i].clientId;
                                        } else {
                                            console.errorExt("DataStore Couchbase TelemetryStore", "Migrating Event clientId does not match possible!! Event:", events[i]);
                                            ok = false;
                                        }
                                    }

                                    // if not gameLevel add one from session info
                                    if(!events[i].gameLevel) {
                                        events[i].gameLevel = gameLevel;
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
                        }
                        catch(err) {
                            console.errorExt("DataStore Couchbase TelemetryStore", "Migrating getRawEvents Error:", err);
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
                    console.errorExt("DataStore Couchbase TelemetryStore", "Remove Keys Error -", errList);
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
                console.errorExt("DataStore Couchbase TelemetryStore", "Get Last DeviceId By GameId View Error -", err);
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

    this._chunk_viewKeys("telemetry", "getAllAchievementsByDeviceId", deviceIds, {
            stale: false
        },
        function(err, results){
            if(err){
                console.errorExt("DataStore Couchbase TelemetryStore", "Get Achievements View Error -", err);
                reject(err);
                return;
            }

            if(results.length == 0) {
                resolve([]);
                return;
            }

            var keys = _.pluck(results, 'id');
            //console.log("CouchBase TelemetryStore: keys", keys);
            this._chunk_getMulti(keys, {},
                function(err, results){
                    if(err){
                        console.errorExt("DataStore Couchbase TelemetryStore", "Multi Get Achievements Error -", err);
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
                    console.errorExt("DataStore Couchbase TelemetryStore", "Update DataSchema Version Error -", err);
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
                console.errorExt("DataStore Couchbase TelemetryStore", "Get DataSchema Info Error -", err);
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

TelemDS_Couchbase.prototype._migrate_AddGames = function(myds) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // get list of all courses
    myds.getAllCourses()
        .then(function(courses){
            // build list for multiset games
            var kv = {}, key, v;
            for(var i = 0; i < courses.length; i++){
                key = tConst.lms.key+":"+tConst.lms.courseKey+":"+courses[i].id+":"+tConst.lms.gameKey;

                if(courses[i].institutionId != null) {
                    v = {
                        "SC": { "settings": { "missionProgressLock": courses[i].freePlay } }
                    };
                } else {
                    v = {
                        "AA-1": { "settings": {} }
                    };
                }

                kv[key] = { value: v };
            }
            //console.log("kv:", kv);

            return this.mulitSetGames(kv);
        }.bind(this))

        .then(function(){
            resolve();
        }.bind(this))

        // catch all errors
        .then(null, reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


TelemDS_Couchbase.prototype._migrate_OldDB_SaveEvents = function(stats, myds, gameId, data, ids, sessionToGameLevelMap) {
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
                    console.errorExt("DataStore Couchbase TelemetryStore", "Assessment - could not save events -", err);
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
                    console.errorExt("DataStore Couchbase TelemetryStore", "Assessment - MySQL Error: could not remove events");
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
                console.errorExt("DataStore Couchbase TelemetryStore", "Incr Event Count Error -", err);
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
            console.errorExt("DataStore Couchbase TelemetryStore", "Set Event Error -", err);
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
                console.errorExt("DataStore Couchbase TelemetryStore", "Incr Event Count Error -", err);
                reject(err);
                return;
            }

            var kv = {}, key;
            var kIndex = data.value - events.length + 1;
            for(var i = 0; i < events.length; i++) {

                //key = tConst.game.dataKey+":"+tConst.game.eventKey+":"+kIndex;
                key = tConst.game.dataKey+":"+tConst.game.eventKey+":"+gameId+":"+kIndex;

                // convert old gameType to correct gameLevel
                if(events[i].gameType) {
                    events[i].gameLevel = events[i].gameType;
                    delete events[i].gameType;
                }

                events[i].serverTimeStamp = Util.CheckTimeStamp(events[i].serverTimeStamp);
                events[i].clientTimeStamp = Util.CheckTimeStamp(events[i].clientTimeStamp);

                kv[key] = { value: _.cloneDeep(events[i]) };

                kIndex++;
            }
            //console.log("kv:", kv);

            // see setMulti for keyValue format
            // https://github.com/couchbase/couchnode/blob/master/lib/connection.js
            this.client.addMulti(kv, {}, function(err){
                if(err){
                    console.errorExt("DataStore Couchbase TelemetryStore", "Set Event Error -", err);
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
                console.errorExt("DataStore Couchbase TelemetryStore", "Get Events View Error -", err);
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
            this._chunk_getMulti(keys, {},
                function(err, results){
                    if(err){
                        console.errorExt("DataStore Couchbase TelemetryStore", "Multi Get Events Error -", err);
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
                            eventName:       revent.eventName,
                            eventData:       revent.eventData,
                            totalTimePlayed: revent.totalTimePlayed,
                            gameLevel:       revent.gameLevel
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
                console.errorExt("DataStore Couchbase TelemetryStore", "Get Events View Error -", err);
                reject(err);
                return;
            }

            if(results.length == 0) {
                resolve([]);
                return;
            }

            var keys = _.pluck(results, 'id');
            //console.log("CouchBase TelemetryStore: keys", keys);
            this._chunk_getMulti(keys, {},
                function(err, results){
                    if(err){
                        if(err.code == 4101) {
                            var errors = [];
                            for(var r in results) {
                                if(results[r].error) {
                                    errors.push( results[r].error );
                                }
                            }
                            console.errorExt("DataStore Couchbase TelemetryStore", "Multi Get RawEvents Errors -", errors);
                        } else {
                            console.errorExt("DataStore Couchbase TelemetryStore", "Multi Get RawEvents Error -", err);
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

TelemDS_Couchbase.prototype.getNumEvents = function(gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    this.client.view("telemetry", "getEventsByGameSessionId").query({
            key: gameSessionId
        },
        function(err, results){
            if(err){
                console.errorExt("DataStore Couchbase TelemetryStore", "Get Events View Error -", err);
                reject(err);
                return;
            }

            resolve(results.length);

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
            console.errorExt("DataStore Couchbase TelemetryStore", "Validate Session Error -", err);
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


TelemDS_Couchbase.prototype.getGameSessionsInfoByUserId = function(gameId, userId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    gameId = gameId.toUpperCase();
    // tConst.game.session.started

    this.client.view("telemetry", 'getGameSessionsByUserId').query(
        {
            key: [gameId, userId]
        },
        function(err, results) {
            if(err){
                console.errorExt("DataStore Couchbase TelemetryStore", "Get Sessions By UserId Error -", err);
                reject(err);
                return;
            }

            var keys = _.pluck(results, 'id');
            var promiseList = [];

            // TODO: gaurded
            keys.forEach( function(key) {
                var kparts = key.split(":");
                var gameSessionId = kparts[2];

                // get session info
                var p = this.getGameSession(gameSessionId)
                    .then(function(gameSessionInfo){
                        // get of each session event key count
                        return this.getNumEvents(gameSessionId)
                            .then(function(numEvents){
                                var st = Util.CheckTimeStamp(gameSessionInfo.serverStartTimeStamp);
                                var et = Util.CheckTimeStamp(gameSessionInfo.serverEndTimeStamp);

                                return {
                                    timeDiff: et - st,
                                    gameSessionId: gameSessionId,
                                    gameLevel: gameSessionInfo.gameLevel,
                                    numEvents: numEvents,
                                    state: gameSessionInfo.state
                                };
                            }.bind(this))
                    }.bind(this));

                promiseList.push(p);

            }.bind(this) );

            when.reduce(promiseList, function(sum, info){
                sum.push(info);
                return sum;
            }.bind(this), [])
                .then(function(infolist){
                    resolve(infolist);
                }.bind(this))
        }.bind(this)
    );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


TelemDS_Couchbase.prototype.getRawGameSessionsInfoByUserId = function(gameId, userId){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        gameId = gameId.toUpperCase();
        // tConst.game.session.started

        this.client.view("telemetry", 'getGameSessionsByUserId').query(
            {
                key: [gameId, userId]
            },
            function(err, results) {
                if(err){
                    console.errorExt("DataStore Couchbase TelemetryStore", "Get Sessions By UserId Error -", err);
                    reject(err);
                    return;
                }

                var keys = _.pluck(results, 'id');
                var promiseList = [];

                // TODO: gaurded
                keys.forEach( function(key) {
                    var kparts = key.split(":");
                    var gameSessionId = kparts[2];

                    // get session info
                    var p = this.getGameSession(gameSessionId)
                        .then(function(gameSessionInfo){
                            return gameSessionInfo;
                        }.bind(this));
                    promiseList.push(p);

                }.bind(this) );

                when.reduce(promiseList, function(sum, info){
                    sum.push(info);
                    return sum;
                }.bind(this), [])
                    .then(function(infolist){
                        resolve(infolist);
                    }.bind(this))
            }.bind(this)
        );

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.getGameSessionIdsByUserId = function(gameId, userId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    gameId = gameId.toUpperCase();
    // tConst.game.session.started

    this.client.view("telemetry", 'getGameSessionsByUserId').query(
        {
            key: [gameId, userId]
        },
        function(err, results) {
            if(err){
                console.errorExt("DataStore Couchbase TelemetryStore", "Get Sessions By UserId Error -", err);
                reject(err);
                return;
            }

            var gameSessionIds = [];
            for(var i = 0; i < results.length; i++ ) {
                var kparts = results[i].id.split(":");
                gameSessionIds.push( kparts[2] );
            }

            resolve(gameSessionIds);
        }.bind(this)
    );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.getLatestGameSessions = function(gameId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    this.client.view("telemetry", 'getLatestGameSessionsByUserId').query(
        {
            group_level: 2
        },
        function(err, results) {
            if(err){
                console.errorExt("DataStore Couchbase TelemetryStore", "Get Latest Sessions By UserId Error -", err);
                reject(err);
                return;
            }

            var results_for_game = _.filter(results, function(r) { return r.key[1] == gameId; });
            var mapped_results = _.map(results_for_game, function(r) {
                return {
                    userId: r.key[0],
                    gameId: r.key[1],
                    gameSessionId: r.value[1],
                    gameSessionTimestamp: r.value[0]
                }
            });

            resolve(mapped_results);

        }.bind(this)
    );
// ------------------------------------------------
}.bind(this));
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
                console.errorExt("DataStore Couchbase TelemetryStore", "Get Sessions By UserId Error -", err);
                reject(err);
                return;
            }

            var keys = _.pluck(results, 'id');
            this._chunk_getMulti(keys, {}, function(err, results){
                    if(err) {
                        if(err.code == 4101) {
                            var errors = [];
                            for(var r in results) {
                                if(results[r].error) {
                                    errors.push( results[r].error );
                                }
                            }
                            console.errorExt("DataStore Couchbase TelemetryStore", "Multi Get All GameSessions Errors -", errors);
                            reject(err);
                            return;
                        } else {
                            console.errorExt("DataStore Couchbase TelemetryStore", "Multi Get All GameSessions Error -", err);
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


TelemDS_Couchbase.prototype.getGameSession = function(gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = tConst.game.dataKey+":"+tConst.game.gameSessionKey+":"+gameSessionId;

    // get data
    this.client.get(key,
        function(err, results){
            if(err){
                console.errorExt("DataStore Couchbase TelemetryStore", "Get Game Session Error -", err);
                reject(err);
                return;
            }

            resolve(results.value);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


TelemDS_Couchbase.prototype.cleanUpOldGameSessionsV2 = function(deviceId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // use view to find ended session for a deviceId
    // tConst.game.session.ended
    this.client.view("telemetry", 'getEndedSessionsByDeviceId').query(
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
            console.errorExt("DataStore Couchbase TelemetryStore", "Get Events View Error -", err);
            reject(err);
            return;
        }

        if(results.length > 0) {
            var keys = _.pluck(results, 'id');

            //console.log("CouchBase TelemetryStore: keys", keys);
            this._chunk_getMulti(keys, {},
                function(err, results){
                    if(err){
                        console.errorExt("DataStore Couchbase TelemetryStore", "Multi Get CleanUp GameSessions Error -", err);
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
                                console.errorExt("DataStore Couchbase TelemetryStore", "Multi Set CleanUp GameSessions Error -", err);
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
            console.errorExt("DataStore Couchbase TelemetryStore", "Start Game Session Error -", err);
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
                console.errorExt("DataStore Couchbase TelemetryStore", "End Game Session V2 Error -", err);
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
                        console.errorExt("DataStore Couchbase TelemetryStore", "Start Game Session Error -", err);
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
                    console.warnExt("DataStore Couchbase TelemetryStore", "End Q - Session Id Missing -", gameSessionId);
                    resolve();
                } else {
                    console.errorExt("DataStore Couchbase TelemetryStore", "End Q Session Error -", err);
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
                        console.errorExt("DataStore Couchbase TelemetryStore", "Start Game Session Error -", err);
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
                console.errorExt("DataStore Couchbase TelemetryStore", "Cleanup Q Session Error -", err);
                reject(err);
                return;
            }

            var gameSessionData    = data.value;
            gameSessionData.qstate = tConst.game.session.cleanup;

            // replace with updated
            this.client.replace(key, gameSessionData,
                function(err, data){
                    if(err){
                        console.errorExt("DataStore Couchbase TelemetryStore", "Start Game Session Error -", err);
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
            console.errorExt("DataStore Couchbase TelemetryStore", "Save Game Data Error -", err);
            reject(err);
            return;
        }

        resolve(data);
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.removeUserGameData = function(userId, gameId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = tConst.game.dataKey+":"+tConst.game.saveKey+":"+gameId+":"+userId;

// set game data
    this.client.remove(key, {},
        function(err, data){
            if(err){
                console.errorExt("DataStore Couchbase TelemetryStore", "Remove Game Data Error -", err);
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
                console.errorExt("DataStore Couchbase TelemetryStore", err);
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
                console.errorExt("DataStore Couchbase TelemetryStore", "Save User Pref Data Error -", err);
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
                    console.errorExt("DataStore Couchbase TelemetryStore", err);
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
                        console.errorExt("DataStore Couchbase TelemetryStore", err);
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

        this._chunk_getMulti(keys, {}, function(err, data) {
            // it's ok if one fails, need to check them all for errors
            if( err &&
                !err.code == 4101) {
                console.errorExt("DataStore Couchbase TelemetryStore", err);
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
                        console.errorExt("DataStore Couchbase TelemetryStore", device.error);
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

        this._chunk_getMulti(keys, {}, function(err, data){
            // it's ok if one fails, need to check them all for errors
            if( err &&
                !err.code == 4101) {
                console.errorExt("DataStore Couchbase TelemetryStore", "getMultiUserSavedGames Error -", err);
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
                        console.errorExt("DataStore Couchbase TelemetryStore", "getMultiUserSavedGames Error -", gamedata.error);
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
                    console.errorExt("DataStore Couchbase TelemetryStore", "Get User Pref Data Error -", err);
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
    this._chunk_getMulti(keys, {},
        function(err, data){
            // it's ok if one fails, need to check them all for errors
            if( err &&
                !err.code == 4101) {
                console.errorExt("DataStore Couchbase TelemetryStore", "getMultiGamePlayInfo Error -", err);
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
                        console.errorExt("DataStore Couchbase TelemetryStore", "getMultiGamePlayInfo Error -", gamedata.error);
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
                    console.errorExt("DataStore Couchbase TelemetryStore", "addTotalTimePlayed Error -", err);
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
                        console.errorExt("DataStore Couchbase TelemetryStore", "addTotalTimePlayed Error -", err);
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
                console.errorExt("DataStore Couchbase TelemetryStore", "postGameAchievement Error -", err);
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
                    console.errorExt("DataStore Couchbase TelemetryStore", "postGameAchievement Error -", err);
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
                    console.errorExt("DataStore Couchbase TelemetryStore", "Get Event Count Data Error -", err);
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


TelemDS_Couchbase.prototype.saveAssessmentResults = function(userId, gameId, assessmentId, data){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = tConst.aeng.key+":"+tConst.aeng.resultsKey+":"+gameId+":"+assessmentId+":"+userId;

    // get user game pref
    this.client.set(key, data,
        function(err, data) {
            if(err) {
                console.errorExt("DataStore Couchbase TelemetryStore", "Save Assessment Results Error -", err);
                reject(err);
                return;
            }

            resolve(data);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


TelemDS_Couchbase.prototype.getAssessmentResults = function(userId, gameId, assessmentId){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        gameId = gameId.toUpperCase();

        var key = tConst.aeng.key+":"+tConst.aeng.resultsKey+":"+gameId+":"+assessmentId+":"+userId;

        // get user game pref
        this.client.get(key, function(err, data) {
                if(err) {
                    // NOT "No such key"
                    if(err.code != 13) {
                        console.errorExt("DataStore Couchbase TelemetryStore", "Get Assessment Results Error -", err);
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


TelemDS_Couchbase.prototype.getConfigs = function(gameId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    gameId = gameId.toUpperCase();

    var key = tConst.game.configKey+":"+gameId;

     // get game config
    this.client.get(key, function(err, data) {
        if(err) {
            // NOT "No such key"
            if(err.code != 13) {
                console.errorExt("DataStore Couchbase TelemetryStore", "Get Config Error -", err);
                reject(err);
                return;
            }
            else {
                reject(err);
                return;
            }
        }
        resolve(data.value)
    }.bind(this));
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.updateConfigs = function(gameId, config){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    gameId = gameId.toUpperCase();

    var key = tConst.game.configKey+":"+gameId;

    // get game config
    this.client.set(key, config,
        function(err, data) {
            if(err) {
                console.errorExt("DataStore Couchbase TelemetryStore", "Set Config Error - ", err);
                reject(err);
                return;
            }

            resolve(config);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


exampleOut.getGamesForCourse = {
    "SC": { "settings": { "missionProgressLock": false } },
    "AA-1": {}
};
TelemDS_Couchbase.prototype.getGamesForCourse = function(courseId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = tConst.lms.key+":"+tConst.lms.courseKey+":"+courseId+":"+tConst.lms.gameKey;

    // get game config
    this.client.get(key,
        function(err, results) {
            if(err) {
                if(err.code == 13) {
                    resolve({});
                } else {
                    console.errorExt("DataStore Couchbase TelemetryStore", "Get Games For Course Error - ", err);
                    reject(err);
                }
                return;
            }

            resolve(results.value);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

exampleIn.updateGamesForCourse = {
    "SC": { "settings": { "missionProgressLock": false } },
    "AA-1": {}
};
TelemDS_Couchbase.prototype.updateGamesForCourse = function(courseId, data){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var key = tConst.lms.key+":"+tConst.lms.courseKey+":"+courseId+":"+tConst.lms.gameKey;

    // get game config
    this.client.set(key, data,
        function(err, data) {
            if(err) {
                console.errorExt("DataStore Couchbase TelemetryStore", "Set Games For Course Error - ", err);
                reject(err);
                return;
            }

            resolve(data);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Couchbase.prototype.mulitSetGames = function(kv){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    // get game config
    this.client.setMulti(kv, {},
        function(err, data) {
            if(err) {
                console.errorExt("DataStore Couchbase TelemetryStore", "Multi Set Games For Course Error - ", err);
                reject(err);
                return;
            }

            resolve(data);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


TelemDS_Couchbase.prototype.multiGetDistinctGamesForCourses = function(courseIds) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var keys = [];
    for(var i = 0; i < courseIds.length; i++) {
        var key = tConst.lms.key+":"+tConst.lms.courseKey+":"+courseIds[i]+":"+tConst.lms.gameKey;
        keys.push(key);
    }

    // get game config
    this._chunk_getMulti(keys, {},
        function(err, data) {
            if(err) {
                if(err.code != 4101) {
                    console.errorExt("DataStore Couchbase TelemetryStore", "Get Games For Course Error - ", err);
                    reject(err);
                    return;
                }
            }

            var games = {};
            for(var k in data) {
                if(data[k].value) {
                    games = _.merge(games, data[k].value);
                }
            }

            resolve(games);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


TelemDS_Couchbase.prototype.updateGameSessionV2 = function(gameSessionId, data) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var key = tConst.game.dataKey+":"+tConst.game.gameSessionKey+":"+gameSessionId;
    // get data
    this.client.get(key, function(err, results) {
        if(err){
            console.errorExt("DataStore Couchbase TelemetryStore", "Start Game Session Error -", err);
            reject(err);
            return;
        }

        data = _.merge(results.value, data);
        // set data
        this.client.set(key, data, function(err, results) {
            resolve(data);
        }.bind(this));
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

// gets game information
// after preliminary research, I have found the only function that directly accesses the info.json or achievement.json files is DashService._loadGameFiles
// results are built into DashService._games, which is used in various DashService methods
// _isValidGameId, getListOfVisibleGameIds, geGameAchievements, getGameDetails, getGameMissions,
// getGameBasicInfo, getGameAssessmentInfo, getGameReportInfo, getGameReleases, getListOfAchievements
// refer to the comments above these DashService methods to see where they are being used
// isAchievement used to determine whether to use a ga or gi code for the couchbase lookup
TelemDS_Couchbase.prototype._getGameInformation = function(gameId, isAchievement, test){
    return when.promise(function(resolve, reject){

        // game names are not case sensitive
        gameId = gameId.toUpperCase();
        var key;
        if(isAchievement){
            key = tConst.game.gameAchievementKey+":"+gameId;
        } else{
            key = tConst.game.gameInfoKey+":"+gameId;
        }
        // get data
        this.client.get(key, function(err, results) {
            if(err && !test){
                console.errorExt("DataStore Couchbase TelemetryStore", "Get Game Information Error -", err);
                reject(err);
                return;
            } else if(err){
                resolve("no object");
                return;
            }
            resolve(results.value);
        }.bind(this) );
    }.bind(this) );
};

// internal method to create new gi and ga game files in couchbase.  Used in migration.
TelemDS_Couchbase.prototype._createGameInformation = function(gameId, data, isAchievement){
    return when.promise(function(resolve, reject){
        var key;

        if(isAchievement){
            key = tConst.game.gameAchievementKey+":"+gameId;
        } else{
            key = tConst.game.gameInfoKey+":"+gameId;
        }

        this.client.set(key, data, function(err, results){
            if(err){
                console.errorExt("DataStore Couchbase TelemetryStore", "Create Game Information Error -", err);
                reject(err);
                return;
            }
            resolve(data);
        }.bind(this));
    }.bind(this));
};

// retrieves game information, merges with past data, and writes to couchbase
// isAssessment used to determine whether to use a ga or gi code for the couchbase lookup
TelemDS_Couchbase.prototype._updateGameInformation = function(gameId, data, isAchievement){
    return when.promise(function(resolve, reject){
        //get data
        return this._getGameInformation(gameId, isAchievement)
            .then(function(results){
                // game names are not case sensitive
                gameId = gameId.toUpperCase();
                var key;
                if(isAchievement){
                    key = tConst.game.gameAchievementKey+":"+gameId;
                } else{
                    key = tConst.game.gameInfoKey+":"+gameId;
                }

                var mergedData = _.merge(results, data);
                this.client.set(key, mergedData, function(err, results){
                    if(err){
                        console.errorExt("DataStore Couchbase TelemetryStore", "Update Game Information Error -", err);
                        reject(err);
                        return;
                    }
                    resolve(mergedData);
                }.bind(this));
            }.bind(this));
    }.bind(this));
};

// getter method for gi:gameId.  Returns a promise
TelemDS_Couchbase.prototype.getGameInformation = function(gameId, test){
    test = test || false;
    return this._getGameInformation(gameId, false, test);
};

// create method for gi:gameId.  Returns a promise.  No preexisting key needed.
TelemDS_Couchbase.prototype.createGameInformation = function(gameId, data){
    return this._createGameInformation(gameId, data, false);
};

// update method for gi:gameId.  Returns a promise
TelemDS_Couchbase.prototype.updateGameInformation = function(gameId, data) {
    return this._updateGameInformation(gameId, data, false)
};

// getter method for ga:gameId.  Returns a promise
TelemDS_Couchbase.prototype.getGameAchievements = function(gameId){
    return this._getGameInformation(gameId, true);
};

// create method for ga:gameId.  Returns a promise.  No preexisting key needed.
TelemDS_Couchbase.prototype.createGameAchievements = function(gameId, data){
    return this._createGameInformation(gameId, data, true);
};

// update method for ga:gameId.  Returns a promise
TelemDS_Couchbase.prototype.updateGameAchievements = function(gameId, data){
    return this._updateGameInformation(gameId, data, true);
};

// queries a particular view for a list of couchbase ids
// returns all the document data from those ids
TelemDS_Couchbase.prototype._getAllGameInformation = function(type){
    return when.promise(function(resolve, reject){
        var map;
        if(type === "Information"){
            map = "getAllGameInformation";
        } else if (type === "Achievements"){
            map = "getAllGameAchievements";
        } else if (type === "Both"){
            map = "getAllGameInformationAndGameAchievements"
        }
        this.client.view("telemetry", map).query(
            {
            },
            function(err, results) {
                if(err) {
                    console.errorExt("DataStore Couchbase TelemetryStore", "Get Game " + type + " Error -", err);
                    reject(err);
                    return;
                }
                var keys = _.pluck(results, 'id');
                this._chunk_getMulti(keys, {}, function(err, results){
                    if(err) {
                        if(err.code == 401) {
                            var errors = [];
                            for(var r in results) {
                                if(results[r].error) {
                                    errors.push( results[r].error );
                                }
                            }
                            console.errorExt("DataStore Couchbase TelemetryStore", "Get Game " + type + " Errors -", errors);
                            reject(err);
                            return;
                        } else {
                            console.errorExt("DataStore Couchbase TelemetryStore", "Get Game " + type + " Error -", err);
                            reject(err);
                            return;
                        }
                    }
                    var information = {};
                    _.forEach(results, function(game, gameId){
                        information[gameId] = game.value;
                    }.bind(this));
                    resolve(information);
                }.bind(this));
            }.bind(this));
    }.bind(this));
};

// gets all couchbase data from the 'gi' files
TelemDS_Couchbase.prototype.getAllGameInformation = function(){
    return this._getAllGameInformation('Information');
};

// gets all couchbase data from the 'ga' files
TelemDS_Couchbase.prototype.getAllGameAchievements = function(){
    return this._getAllGameInformation('Achievements');
};

// gets all couchbase data from the 'gi' and 'ga' files
TelemDS_Couchbase.prototype.getAllGameInformationAndGameAchievements = function(){
    return this._getAllGameInformation('Both');
};

TelemDS_Couchbase.prototype.getDeveloperProfile = function(userId, test){
    return when.promise(function(resolve, reject){
        var key = tConst.datastore.keys.developer + ":" + tConst.datastore.keys.user + ":" + userId;
        this.client.get(key, function(err, results) {
            if(err && !test){
                console.errorExt("DataStore Couchbase TelemetryStore", err);
                reject(err);
            } else if (err){
                resolve("no profile");
            }
            resolve(results.value);
        }.bind(this));
    }.bind(this));
};

TelemDS_Couchbase.prototype.getAllDeveloperProfiles = function(){
    return when.promise(function(resolve, reject){
        var map = "getAllDeveloperProfiles";
        this.client.view("telemetry", map).query(
            {

            },
            function(err, results) {
                if (err) {
                    console.errorExt("DataStore Couchbase TelemetryStore", "Get Developer Profiles Error -", err);
                    reject(err);
                    return;
                }

                var keys = _.pluck(results, 'id');
                this._chunk_getMulti(keys, {}, function (err, results) {
                    if (err) {
                        console.errorExt("DataStore Couchbase TelemetryStore", "Get Developer Profiles Error -", err);
                        reject(err);
                        return;
                    }
                    var devProfiles = {};
                    _.forEach(results, function (developer, key) {
                        var value = developer.value;
                        if(typeof value === "string"){
                            value = JSON.parse(value)
                        }
                        devProfiles[key] = value;
                    });
                    resolve(devProfiles);
                }.bind(this));
            }.bind(this));
    }.bind(this));
};

TelemDS_Couchbase.prototype.createMatch = function(gameId, matchData) {
    return when.promise(function (resolve, reject) {

        var key = tConst.game.dataKey + "::" + tConst.game.matchKey + "::" + gameId;
        this.client.incr(key, {initial: 1}, function (err, data) {
            if (err) {
                console.errorExt("DataStore Couchbase TelemetryStore", "Incr Match Count Error -", err);
                reject(err);
                return;
            }
            var matchId = data.value;
            var match = {
                id: matchId,
                data: matchData
            };
            key = tConst.game.dataKey + ":" + tConst.game.matchKey + ":" + gameId + ":" + matchId;
            this.client.add(key, match, function (err, results) {
                if (err) {
                    console.errorExt("DataStore Couchbase TelemetryStore", "Create Match Error -", err);
                    reject(err);
                    return;
                }
                resolve(match);
            }.bind(this));
        }.bind(this));
    }.bind(this));
};

TelemDS_Couchbase.prototype.getMatch = function(gameId, matchId){
    return when.promise(function(resolve, reject){
        var key = tConst.game.dataKey + ":" + tConst.game.matchKey + ":" + gameId + ":" + matchId;
        this.client.get(key, function(err, results){
            if(err){
                console.errorExt("DataStore Couchbase TelemetryStore", "Get Match Error -", err);
                reject(err);
                return;
            }
            resolve(results.value);
        });
    }.bind(this));
};

TelemDS_Couchbase.prototype.updateMatch = function(gameId, matchId, data){
    return when.promise(function(resolve, reject){
        var key = tConst.game.dataKey + ":" + tConst.game.matchKey + ":" + gameId + ":" + matchId;
        this.client.set(key, data, function(err, results){
            if(err){
                console.errorExt("DataStore Couchbase TelemetryStore", "Update Match Error -", err);
                reject(err);
                return;
            }
            resolve(results.value);
        });
    }.bind(this));
};

TelemDS_Couchbase.prototype.multiGetMatches = function(gameId, matchIds){
    return when.promise(function(resolve, reject){
        var keys = [];
        var key;
        matchIds.forEach(function(matchId){
            key = tConst.game.dataKey + ":" + tConst.game.matchKey + ":" + gameId + ":" + matchId;
            keys.push(key);
        });
        this._chunk_getMulti(keys, {}, function(err, results){
            if(err){
                var message = "The key does not exist on the server";
                var keyExistError = true;
                keys.forEach(function(key){
                    if(results[key].error.message === message){
                        results[key] = "The key does not exist on the server";
                    } else if(results[key].error && results[key].error.message !== message){
                        keyExistError = false;
                    }
                });
                if(keyExistError){
                    resolve(results);
                    return;
                }
                console.errorExt("DataStore Couchbase TelemetryStore", "Get Matches Error -", err);
                reject(err);
                return;
            }
            resolve(results);
        }.bind(this));
    }.bind(this));
};

TelemDS_Couchbase.prototype.multiSetMatches = function(matches){
    return when.promise(function(resolve, reject){
        this._chunk_setMulti(matches, {}, function(err, results){
            if(err){
                console.errorExt("DataStore Couchbase TelemetryStore", "Update Matches Error -", err);
                reject(err);
                return;
            }
            resolve(results.value);
        }.bind(this));
    }.bind(this));
};

TelemDS_Couchbase.prototype._chunk_setMulti = function(kv, options, callback){
    // create buckets of keys with each one having a max size of ChunckSize
    var keyList = Object.keys(kv);
    var taskList = Util.Reshape(keyList, this.options.multiGetChunkSize);

    var guardedAsyncOperation = guard(guard.n(this.options.multiSetParallelNum), function (all, ckeys){
        return when.promise(function(resolve, reject) {
            var setKVs = {};
            ckeys.forEach(function(key){
                setKVs[key] = kv[key];
            });
            //console.log(JSON.stringify(this.client.setMulti));
            this.client.setMulti(setKVs, options, function(err, results){
                if(err) {
                    reject( { error: err, results: results } );
                    return;
                }

                // merge two objects
                all = _.merge(all, results);
                resolve(all);
            }.bind(this));
        }.bind(this));
    }.bind(this));

    when.reduce(taskList, guardedAsyncOperation, {})
        .then(function(all){
            callback(null, all);
        }, function(err){
            callback(err.error, err.results);
        });
};

TelemDS_Couchbase.prototype.getAllGameMatchesByUserId = function(gameId, userId, status){
    return when.promise(function(resolve, reject){

        var map = "getAllMatches";
        var userKey = "" + userId;
        this.client.view("telemetry", map).query(
            {
                key: userKey
            },
            function(err, results){
                if(err){
                    if(err.code === 4101){
                        var errors = [];
                        for(var r in results) {
                            if(results[r].error) {
                                errors.push( results[r].error );
                            }
                        }
                        console.errorExt("DataStore Couchbase TelemetryStore", "Get Game Matches: View Errors -", errors);
                    } else{
                        console.errorExt("DataStore Couchbase TelemetryStore", "Get Game Matches: View Error -", err);
                    }
                    reject(err);
                    return;
                }

                var keys = [];
                _(results).forEach(function(result){
                    if(status === "all" || result.value === status){
                        keys.push(result.id);
                    }
                });

                this._chunk_getMulti(keys, {}, function(err, results){
                    if(err){
                        if(err.code === 4101){
                            var errors = [];
                            for(var r in results) {
                                if(results[r].error) {
                                    errors.push( results[r].error );
                                }
                            }
                            console.errorExt("DataStore Couchbase TelemetryStore", "Get Game Matches: Multi Get Errors -", errors);
                        } else{
                            console.errorExt("DataStore Couchbase TelemetryStore", "Get Game Matches: Multi Get Error -", err);
                        }
                        reject(err);
                        return;
                    }
                    var output = {};
                    var value;
                    var matchId;
                    _.forEach(results, function(match, key){
                        value = match.value;
                        matchId = value.id;
                        output[matchId] = value;
                    });
                    resolve(output);
                }.bind(this));
            }.bind(this));
    }.bind(this));
};

TelemDS_Couchbase.prototype.getAllCourseGameProfiles = function(){
    return when.promise(function(resolve, reject){
        var map = "getAllCourseGameProfiles";
        this.client.view("telemetry", map).query(
            {

            },
            function(err, results){
                if(err){
                    console.errorExt("DataStore Couchbase TelemetryStore", "Update All Course Game Profiles Error -", err);
                    reject(err);
                    return;
                }
                var keys = _.pluck(results, "id");
                this._chunk_getMulti(keys, {}, function(err, results){
                    if(err){
                        console.errorExt("DataStore Couchbase TelemetryStore", "Update All Course Game Profiles Error -", err);
                        reject(err);
                        return;
                    }
                    var courses = {};
                    _(results).forEach(function(result, key){
                        courses[key] = result.value;
                    });
                    resolve(courses);
                });
            }.bind(this));
    }.bind(this));
};

TelemDS_Couchbase.prototype.getGamesCourseMap = function(gameIds){
    return when.promise(function(resolve, reject){

        this.getAllCourseGameProfiles()
            .then(function(courses){
                var gameCourseMap = {};
                _(gameIds).forEach(function(gameId){
                    gameCourseMap[gameId] = {};
                });
                _(courses).forEach(function(course, key){
                    var courseId = key.split(":")[2];
                    _(gameIds).forEach(function(gameId){
                        if(course[gameId]){
                            gameCourseMap[gameId][courseId] = true;
                        }
                    });
                });
                resolve(gameCourseMap);
            })
            .then(null, function(err){
                console.errorExt("DataStore Couchbase TelemetryStore", "Get Games Course Map Error -",err);
                reject(err);
            });
    }.bind(this));
};

TelemDS_Couchbase.prototype.multiSetCourseGameProfiles = function(courses){
    return when.promise(function(resolve, reject){
        this._chunk_setMulti(courses, {}, function(err, results){
            if(err){
                console.errorExt("DataStore Couchbase TelemetryStore", "Update Course Game Profiles Error -",err);
                reject(err);
                return;
            }
            resolve(results.value);
        });
    }.bind(this));
};

TelemDS_Couchbase.prototype.multiGetCourseGameProfiles = function(courseIds){
    return when.promise(function(resolve, reject){
        var keys = [];
        var key;
        courseIds.forEach(function(courseId){
            key = tConst.lms.key + ":" + tConst.lms.courseKey + ":" + courseId + ":" + tConst.lms.gameKey;
            keys.push(key);
        });
        this._chunk_getMulti(keys, {}, function(err, results){
            if(err){
                console.errorExt("DataStore Couchbase TelemetryStore", "Multi Get Course Game Profiles Error -", err);
                reject(err);
                return;
            }
            //var outputs = _.pluck(results, 'value');
            resolve(results);
        }.bind(this));
    }.bind(this));
};

TelemDS_Couchbase.prototype.deleteGameSavesByGameId = function(gameId){
    return when.promise(function(resolve, reject){
        var map = "getAllGameSaves";
        var key = "gd:save:" + gameId.toUpperCase();
        this.client.view("telemetry", map).query({
            startkey: key
        }, function(err, results){
            if(err){
                console.errorExt("DataStore Couchbase TelemetryStore", "Delete Game Saves By Game Id Error -", err);
                reject(err);
                return;
            }
            var keys = _.pluck(results, "key");
            this._removeKeys(keys)
                .then(function(){
                    resolve()
                })
                .then(null, function(err){
                    console.errorExt("DataStore Couchbase TelemetryStore", "Delete Game Saves By Game Id -", gameId, " Error -", err);
                    reject(err);
                });
            resolve(results);
        }.bind(this));
    }.bind(this));
};

// create method for di:o (developer info/organization).  Returns a promise.  No preexisting key needed.
TelemDS_Couchbase.prototype.createDeveloperOrganization = function(devId, data){
    return when.promise(function(resolve, reject){
        var key = tConst.datastore.keys.developer + ":" + tConst.developer.organizationKey + ":" + devId;

        this.client.set(key, data, function(err, results){
            if(err){
                console.errorExt("DataStore Couchbase TelemetryStore", "Create Developer Organization Error -", err);
                reject(err);
                return;
            }
            resolve(data);
        }.bind(this));
    }.bind(this));
};

// get method for di:o (developer info/organization).  Returns a promise.
TelemDS_Couchbase.prototype.getDeveloperOrganization = function(devId){
    return when.promise(function(resolve, reject){
        var key = tConst.datastore.keys.developer + ":" + tConst.developer.organizationKey + ":" + devId;

        this.client.get(key, function(err, results) {
            if(err) {
                if(err.code != 13) {
                    console.errorExt("DataStore Couchbase TelemetryStore", err);
                    reject(err);
                    return;
                }
                
                resolve("no org");
            } else {
                resolve(results.value);
            }
        }.bind(this));
    }.bind(this));
};

TelemDS_Couchbase.prototype.getAllDeveloperGamesAwaitingApproval = function() {
    return when.promise(function(resolve, reject){
        var map = "getAllDeveloperGamesAwaitingApproval";
        this.client.view("telemetry", map).query(
            {

            },
            function(err, results) {
                if (err) {
                    console.errorExt("DataStore Couchbase TelemetryStore", "getAllDeveloperGamesAwaitingApproval Error -", err);
                    reject(err);
                    return;
                }

                var keys = _.pluck(results, 'id');
                this._chunk_getMulti(keys, {}, function (err, results) {
                    if (err) {
                        console.errorExt("DataStore Couchbase TelemetryStore", "getAllDeveloperGamesAwaitingApproval Error -", err);
                        reject(err);
                        return;
                    }
                    var devProfiles = {};
                    _.forEach(results, function (developer, key) {
                        var value = developer.value;
                        if(typeof value === "string"){
                            value = JSON.parse(value)
                        }
                        devProfiles[key] = value;
                    });
                    resolve(devProfiles);
                }.bind(this));
            }.bind(this));
    }.bind(this));
};

TelemDS_Couchbase.prototype.getAllDeveloperGamesRejected = function() {
    return when.promise(function(resolve, reject){
        var map = "getAllDeveloperGamesRejected";
        this.client.view("telemetry", map).query(
            {

            },
            function(err, results) {
                if (err) {
                    console.errorExt("DataStore Couchbase TelemetryStore", "getAllDeveloperGamesRejected Error -", err);
                    reject(err);
                    return;
                }

                var keys = _.pluck(results, 'id');
                this._chunk_getMulti(keys, {}, function (err, results) {
                    if (err) {
                        console.errorExt("DataStore Couchbase TelemetryStore", "getAllDeveloperGamesRejected Error -", err);
                        reject(err);
                        return;
                    }
                    var devProfiles = {};
                    _.forEach(results, function (developer, key) {
                        var value = developer.value;
                        if(typeof value === "string"){
                            value = JSON.parse(value)
                        }
                        devProfiles[key] = value;
                    });
                    resolve(devProfiles);
                }.bind(this));
            }.bind(this));
    }.bind(this));
};

TelemDS_Couchbase.prototype.getAllDeveloperGameAccessRequestsAwaitingApproval = function() {
    return when.promise(function(resolve, reject){
        var map = "getAllDeveloperGameAccessRequestsAwaitingApproval";
        this.client.view("telemetry", map).query(
            {

            },
            function(err, results) {
                if (err) {
                    console.errorExt("DataStore Couchbase TelemetryStore", "getAllDeveloperGameAccessRequestsAwaitingApproval Error -", err);
                    reject(err);
                    return;
                }

                var keys = _.pluck(results, 'id');
                this._chunk_getMulti(keys, {}, function (err, results) {
                    if (err) {
                        console.errorExt("DataStore Couchbase TelemetryStore", "getAllDeveloperGameAccessRequestsAwaitingApproval Error -", err);
                        reject(err);
                        return;
                    }

                    var accessRequests = {};
                    _.forEach(results, function (developerProfile, id) {
                        var profileId = id.split(':');
                        var userId = profileId[2];
                        var value = developerProfile.value;
                        if (!accessRequests[userId]) {
                            accessRequests[userId] = {}
                        }
                        for (var gameId in value) {
                            if (value[gameId].verifyCodeStatus === 'approve') {
                                accessRequests[userId][gameId] = value[gameId].verifyCode;
                            }
                        }
                    });
                    resolve(accessRequests);
                }.bind(this));
            }.bind(this));
    }.bind(this));
};

TelemDS_Couchbase.prototype.getAllDeveloperGameAccessRequestsDenied = function() {
    return when.promise(function(resolve, reject){
        var map = "getAllDeveloperGameAccessRequestsDenied";
        this.client.view("telemetry", map).query(
            {

            },
            function(err, results) {
                if (err) {
                    console.errorExt("DataStore Couchbase TelemetryStore", "getAllDeveloperGameAccessRequestsDenied Error -", err);
                    reject(err);
                    return;
                }

                var keys = _.pluck(results, 'id');
                this._chunk_getMulti(keys, {}, function (err, results) {
                    if (err) {
                        console.errorExt("DataStore Couchbase TelemetryStore", "getAllDeveloperGameAccessRequestsDenied Error -", err);
                        reject(err);
                        return;
                    }

                    var accessRequests = {};
                    _.forEach(results, function (developerProfile, id) {
                        var profileId = id.split(':');
                        var userId = profileId[2];
                        var value = developerProfile.value;
                        if (!accessRequests[userId]) {
                            accessRequests[userId] = {}
                        }
                        for (var gameId in value) {
                            if (value[gameId].verifyCodeStatus === 'revoked') {
                                accessRequests[userId][gameId] = value[gameId].verifyCode;
                            }
                        }
                    });
                    resolve(accessRequests);
                }.bind(this));
            }.bind(this));
    }.bind(this));
};

TelemDS_Couchbase.prototype.setDeveloperGameStatus = function(gameId, userId, agentId, status){
    return when.promise(function(resolve, reject){
        var key = tConst.datastore.keys.developerGameApprovalActivity + ":" + gameId;
        var data;
        
        this.client.get(key, function(err, results) {
            var now = Date.now();
            if(err) {
                if(err.code != 13) {
                    console.errorExt("DataStore Couchbase TelemetryStore", "setDeveloperGameStatus Error -", err);
                    reject(err);
                    return;
                }
                
                // new entry
                data = {
                    gameId: gameId,
                    userId: (userId != 0 ? userId : agentId),
                    ts: now,
                    status: status,
                    activity: [ {
                        action: status,
                        ts: now,
                        agent: agentId
                    } ]
                };
            } else {
                data = results.value;
                if (userId != 0) {
                    data.userId = userId;
                }
                data.ts = now;
                data.status = status;
                if (data.activity === undefined) {
                    // migrate old doc
                    data.activity = [];
                }
                data.activity.push({
                        action: status,
                        ts: now,
                        agent: agentId
                    });
            }
            
            this.client.set(key, data, function(err, results){
                if(err){
                    console.errorExt("DataStore Couchbase TelemetryStore", "setDeveloperGameStatus Error -", err);
                    reject(err);
                    return;
                }
                resolve(data);
            }.bind(this));
        }.bind(this));
    }.bind(this));
};

TelemDS_Couchbase.prototype.getDeveloperGameStatus = function(gameId, allowMissing) {
    return when.promise(function(resolve, reject){
        var key = tConst.datastore.keys.developerGameApprovalActivity + ":" + gameId;
        var data;
        
        this.client.get(key, function(err, results) {
            if(err) {
                if(!allowMissing || err.code != 13) {
                    console.errorExt("DataStore Couchbase TelemetryStore", "getDeveloperGameStatus Error -", err);
                    reject(err);
                    return;
                }
                
                resolve("missing");
            } else {
                resolve(results.value);
            }
        }.bind(this));
    }.bind(this));
}


