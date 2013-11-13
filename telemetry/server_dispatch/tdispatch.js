/**
 * Telemetry Dispatch Module
 *
 * Module dependencies:
 *   redis - https://github.com/mranney/node_redis
 *   mysql -
 *
 */
var _       = require('underscore');
var mysql   = require('mysql');
var redis   = require('redis');
var request = require('request');
var tConst  = require('../telemetry_const.js');

function tDispatch(settings){
    this.settings = {
        q: {
            port: null, host: null
        },
        ds: {} };
    if(settings && settings.queue)     this.settings.q  = settings.queue;
    if(settings && settings.datastore) this.settings.ds = settings.datastore;

    this.queue = redis.createClient(this.settings.q.port, this.settings.q.host, this.settings.q);

    this.startTelemetryPoll();
    this.startCleanOldSessionPoll();
}


tDispatch.prototype.startTelemetryPoll = function(){
    // fetch telemetry loop
    setInterval(function() {
        this.telemetryCheck();
    }.bind(this), tConst.dispatch.telemetryPollDelay);
}

tDispatch.prototype.telemetryCheck = function(){
    var telemetryInKey = tConst.telemetryKey+":"+tConst.inKey;

    this.queue.llen(telemetryInKey, function(err, count){
        if(err) {
            console.error("Dispatch Error:", err);
            return;
        }

        if(count > 0) {
            for(var i = 0; i < Math.min(count, tConst.dispatch.telemetryGetMax); i++){
                this.getTelemetryBatch();
            }
        }
    }.bind(this));
}


tDispatch.prototype.startCleanOldSessionPoll = function(){
    // fetch telemetry loop
    setInterval(function() {
        this.cleanOldSessionCheck();
    }.bind(this), tConst.dispatch.cleanupPollDelay);
}

tDispatch.prototype.cleanOldSessionCheck = function(){
    var telemetryMetaKey = tConst.telemetryKey+":"+tConst.metaKey;

    this.queue.hgetall(telemetryMetaKey, function(err, data){
        if(err) {
            console.error("Dispatch Error:", err);
            return;
        }

        if(_.isObject(data)){
            //console.log(telemetryMetaKey, " data:", data);
            // check date
            _.forEach(data, function(value, sessionId){
                var meta = JSON.parse(value);
                //console.log("id", sessionId, ", metaData:", meta);

                var startTime = new Date(meta.date).getTime();
                var now       = new Date().getTime();
                if(now - startTime > tConst.dispatch.sessionExpire){
                    // clean up session
                    console.log("!!! Expired Cleaning Up - id", sessionId, ", metaData:", meta);

                    this.cleanupSession(sessionId);
                }
            }.bind(this));
        }
    }.bind(this));
}

tDispatch.prototype.cleanupSession = function(sessionId, execFinalCB){
    var telemetryActiveKey = tConst.telemetryKey+":"+tConst.activeKey;
    var telemetryMetaKey   = tConst.telemetryKey+":"+tConst.metaKey;
    var batchInKey         = tConst.batchKey+":"+sessionId+":"+tConst.inKey;
    var batchActiveKey     = tConst.batchKey+":"+sessionId+":"+tConst.activeKey;

    // remove telemetryData with sessionId
    this.queue.srem(telemetryActiveKey, sessionId, function(err){
        if(err) {
            console.error("Dispatch endBatchIn telemetryActiveKey srem Error:", err);
            return;
        }

        // execute final callback
        if(execFinalCB) execFinalCB();

    }.bind(this));

    // remove batch in list
    this.queue.del(batchInKey, function(err){
        if(err) {
            console.error("Dispatch endBatchIn batchInKey del Error:", err);
            return;
        }
    }.bind(this));

    // remove batch active list
    this.queue.del(batchActiveKey, function(err){
        if(err) {
            console.error("Dispatch endBatchIn batchActiveKey del Error:", err);
            return;
        }
    }.bind(this));

    // remove meta info
    this.queue.hdel(telemetryMetaKey, sessionId, function(err){
        if(err) {
            console.error("Dispatch endBatchIn telemetryMetaKey del Error:", err);
            return;
        }
    }.bind(this));
}

tDispatch.prototype.updateSessionMetaData = function(sessionId){
    var telemetryMetaKey = tConst.telemetryKey+":"+tConst.metaKey;

    this.queue.hset(telemetryMetaKey, sessionId,
        JSON.stringify( {
            date: new Date()
        }),
        function(err){
            if(err) {
                console.error("Dispatch getTelemetryBatch hset Error:", err);
                return;
            }
        }.bind(this)
    );
}

tDispatch.prototype.getTelemetryBatch = function(){
    var telemetryInKey     = tConst.telemetryKey+":"+tConst.inKey;
    var telemetryActiveKey = tConst.telemetryKey+":"+tConst.activeKey;

    // move telemetry item from in to active
    this.queue.rpop(telemetryInKey, function(err, telemData){
        if(err) {
            console.error("Dispatch getTelemetryBatch Error:", err);
            return;
        }

        // if telemetry has data
        if(telemData) {
            // convert string to object
            telemData = JSON.parse(telemData);
            console.log("Dispatch getTelemetryBatch data:", telemData);

            // update date in meta data
            this.updateSessionMetaData(telemData.id);

            if(telemData.type == "start"){
                this.queue.sadd(telemetryActiveKey, telemData.id, function(err){
                    if(err) {
                        console.error("Dispatch getTelemetryBatch sadd Error:", err);
                        return;
                    }

                    this.startBatchInPoll(telemData.id);
                }.bind(this));
            } else {
                this.endBatchIn(telemData.id);
            }
        }
    }.bind(this));
}

tDispatch.prototype.endBatchIn = function(sessionId){
    //console.log("Dispatch endBatchIn sessionId:", sessionId);
    var batchInKey         = tConst.batchKey+":"+sessionId+":"+tConst.inKey;
    var batchActiveKey     = tConst.batchKey+":"+sessionId+":"+tConst.activeKey;

    // check in done
    this.queue.lrange(batchInKey, 0, -1, function(err, list){
        if(err) {
            console.error("Dispatch", batchInKey, "Error:", err);
            return;
        }

        //console.log("Dispatch endBatchIn", batchInKey, "list:", list);
        if(list.length == 0) {

            // check active done
            this.queue.lrange(batchActiveKey, 0, -1, function(err, list){
                if(err) {
                    console.error("Dispatch endBatchIn",  batchActiveKey, "Error:", err);
                    return;
                }

                //console.log("Dispatch endBatchIn", batchActiveKey, "list:", list);
                if(list.length == 0) {
                    //console.log(sessionId, "- Done");

                    // cleanup session
                    this.cleanupSession(sessionId, function executeAssessment(){

                        // execute assessment
                        console.log(sessionId, "- Run Assessment!!");

                        // TODO add the request

                    }.bind(this));

                } else {
                    //console.log(batchActiveKey, "not done, count:", list.length);

                    // try again until empty
                    setTimeout(function(){
                        this.endBatchIn(sessionId);
                    }.bind(this), tConst.dispatch.batchInPollDelay);
                }
            }.bind(this));
        } else {
            //console.log(batchInKey, "not done, count:", list.length);

            // try again until empty
            setTimeout(
                function(){
                    this.endBatchIn(sessionId);
                }.bind(this),
                tConst.dispatch.batchInPollDelay
            );
        }
    }.bind(this));
}

tDispatch.prototype.startBatchInPoll = function(sessionId){
    setInterval(
        function(){
            this.batchInCheck(sessionId);
        }.bind(this),
        tConst.dispatch.batchInPollDelay
    );
}

tDispatch.prototype.batchInCheck = function(sessionId){
    var batchInKey = tConst.batchKey+":"+sessionId+":"+tConst.inKey;

    // check items in batch list
    this.queue.llen(batchInKey, function(err, count){
        if(err) {
            console.error("Dispatch startBatchIn Error:", err);
            return;
        }

        //console.log("batchInCheck batchInKey:", batchInKey, ", count:", count);
        if(count > 0) {
            for(var i = 0; i < Math.min(tConst.dispatch.batchGetMax, count); i++){
                // adding to batch
                this.processItem(sessionId);
            }
        }
    }.bind(this));
}

tDispatch.prototype.processItem = function(sessionId){
    var batchInKey     = tConst.batchKey+":"+sessionId+":"+tConst.inKey;
    var batchActiveKey = tConst.batchKey+":"+sessionId+":"+tConst.activeKey;

    // move item from In to Active
    this.queue.rpoplpush(batchInKey, batchActiveKey, function(err, data){
        if(err) {
            console.error("Dispatch processItem Error:", err);
            return;
        }

        // update date in meta data
        this.updateSessionMetaData(sessionId);

        //console.log("sendItemToDataStore batchActiveKey:", batchActiveKey, ", data:", data);
        this.sendItemToDataStore(batchActiveKey, data);

    }.bind(this));
}

tDispatch.prototype.processDone = function(err, batchActiveKey, data){
    if(err) {
        console.error("Dispatch processDone saved Error:", err);
        return;
    }

    //console.log("processDone batchActiveKey:", batchActiveKey, ", data:", data);
    // move item from active to done
    this.queue.lrem(batchActiveKey, 0, data, function(err){
        if(err) {
            console.error("Dispatch processDone final Error:", err);
            return;
        }

        //console.log("done with:", data);
    }.bind(this));
}

tDispatch.prototype.sendItemToDataStore = function(batchActiveKey, data){
    // curry (aka, use closure to save batchActiveKey and data)
    var done = function(key, data){
        return function(err){
            this.processDone(err, key, data);
        }.bind(this)
    }.bind(this);

    //console.log("Dispatch sendItemToDataStore data:", data);

    // send to datastore server
    jdata = JSON.parse(data);
    jdata.events = JSON.parse(jdata.events);

    // Connect to data store and save
    this.ds = mysql.createConnection(this.settings.ds);
    this.ds.connect();
    for(var i in jdata.events){
        var q = [
            "NULL",
            0,
            mysql.escape(JSON.stringify(jdata.events[i].eventData)),
            "NOW()",
            mysql.escape(jdata.gameVersion),
            mysql.escape(jdata.gameSessionId),
            "NOW()",
            mysql.escape(jdata.events[i].name),
            "UNIX_TIMESTAMP(NOW())"
        ];
        q = "INSERT INTO GL_ACTIVITY_EVENTS (id, version, data, date_created, game, game_session_id, last_updated, name, timestamp, user_id) " +
            "SELECT "+q.join(',')+", user_id FROM GL_SESSION WHERE SESSION_ID="+mysql.escape(jdata.gameSessionId);
        //console.log('q:', q);

        var cb = done(batchActiveKey, data);
        this.ds.query(q, function(err) {
            //console.log('rows:', rows, ", fields:", fields);
            cb(err);
        }.bind(this));
    }
    this.ds.end();
}

module.exports = tDispatch;

