/**
 * Telemetry Dispatcher Module
 *
 * Module dependencies:
 *   redis - https://github.com/mranney/node_redis
 *   mysql -
 *
 */
var _       = require('underscore');
var redis   = require('redis');
var request = require('request');
var MySQL   = require('./datastore.mysql.js');
var tConst  = require('./telemetry.const.js');

function Dispatcher(settings){
    this.settings = _.extend(settings,
        {
            q: { port: null, host: null },
            ds: {},
            wa: { protocal:"http", host:"localhost", port: "8080"}
        });
    if(this.settings && this.settings.queue)     this.settings.q  = this.settings.queue;
    if(this.settings && this.settings.webapp)    this.settings.wa = this.settings.webapp;

    this.queue         = redis.createClient(this.settings.q.port, this.settings.q.host, this.settings.q);
    this.webAppUrl     = this.settings.wa.protocal+"://"+this.settings.wa.host+":"+this.settings.wa.port;
    this.assessmentUrl = this.webAppUrl+"/api/game/assessment/";

    this.ds = new MySQL(this.settings.datastore);
    // Connect to data store
    this.ds.testConnection();

    this.startTelemetryPoll();
    this.startCleanOldSessionPoll();

    console.log('Dispatcher: Waiting for messages...');
}


Dispatcher.prototype.startTelemetryPoll = function(){
    // fetch telemetry loop
    setInterval(function() {
        this.telemetryCheck();
    }.bind(this), this.settings.dispatcher.telemetryPollDelay);
}

Dispatcher.prototype.telemetryCheck = function(){
    var telemetryInKey = tConst.telemetryKey+":"+tConst.inKey;

    this.queue.llen(telemetryInKey, function(err, count){
        if(err) {
            console.error("Dispatcher: Error:", err);
            return;
        }

        if(count > 0) {
            for(var i = 0; i < Math.min(count, this.settings.dispatcher.telemetryGetMax); i++){
                this.getTelemetryBatch();
            }
        }
    }.bind(this));
}


Dispatcher.prototype.startCleanOldSessionPoll = function(){
    // fetch telemetry loop
    setInterval(function() {
        this.cleanOldSessionCheck();
    }.bind(this), this.settings.dispatcher.cleanupPollDelay);
}

Dispatcher.prototype.cleanOldSessionCheck = function(){
    var telemetryMetaKey = tConst.telemetryKey+":"+tConst.metaKey;

    this.queue.hgetall(telemetryMetaKey, function(err, data){
        if(err) {
            console.error("Dispatcher: Error:", err);
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
                if(now - startTime > this.settings.dispatcher.sessionExpire){
                    // clean up session
                    console.log("!!! Expired Cleaning Up - id", sessionId, ", metaData:", meta);

                    this.cleanupSession(sessionId);
                }
            }.bind(this));
        }
    }.bind(this));
}

Dispatcher.prototype.cleanupSession = function(sessionId, execFinalCB){
    var telemetryActiveKey = tConst.telemetryKey+":"+tConst.activeKey;
    var telemetryMetaKey   = tConst.telemetryKey+":"+tConst.metaKey;
    var batchInKey         = tConst.batchKey+":"+sessionId+":"+tConst.inKey;
    var batchActiveKey     = tConst.batchKey+":"+sessionId+":"+tConst.activeKey;

    // remove telemetryData with sessionId
    this.queue.srem(telemetryActiveKey, sessionId, function(err){
        if(err) {
            console.error("Dispatcher: endBatchIn telemetryActiveKey srem Error:", err);
            return;
        }

        // execute final callback
        if(execFinalCB) execFinalCB();

    }.bind(this));

    // remove batch in list
    this.queue.del(batchInKey, function(err){
        if(err) {
            console.error("Dispatcher: endBatchIn batchInKey del Error:", err);
            return;
        }
    }.bind(this));

    // remove batch active list
    this.queue.del(batchActiveKey, function(err){
        if(err) {
            console.error("Dispatcher: endBatchIn batchActiveKey del Error:", err);
            return;
        }
    }.bind(this));

    // remove meta info
    this.queue.hdel(telemetryMetaKey, sessionId, function(err){
        if(err) {
            console.error("Dispatcher: endBatchIn telemetryMetaKey del Error:", err);
            return;
        }
    }.bind(this));
}

Dispatcher.prototype.updateSessionMetaData = function(sessionId){
    var telemetryMetaKey = tConst.telemetryKey+":"+tConst.metaKey;

    this.queue.hset(telemetryMetaKey, sessionId,
        JSON.stringify( {
            date: new Date()
        }),
        function(err){
            if(err) {
                console.error("Dispatcher: getTelemetryBatch hset Error:", err);
                return;
            }
        }.bind(this)
    );
}

Dispatcher.prototype.getTelemetryBatch = function(){
    var telemetryInKey     = tConst.telemetryKey+":"+tConst.inKey;
    var telemetryActiveKey = tConst.telemetryKey+":"+tConst.activeKey;

    // move telemetry item from in to active
    this.queue.rpop(telemetryInKey, function(err, telemData){
        if(err) {
            console.error("Dispatcher: getTelemetryBatch Error:", err);
            return;
        }

        // if telemetry has data
        if(telemData) {
            // convert string to object
            telemData = JSON.parse(telemData);
            //console.log("Dispatcher: getTelemetryBatch data:", telemData);

            // update date in meta data
            this.updateSessionMetaData(telemData.id);

            if(telemData.type == "start"){
                this.queue.sadd(telemetryActiveKey, telemData.id, function(err){
                    if(err) {
                        console.error("Dispatcher: getTelemetryBatch sadd Error:", err);
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

Dispatcher.prototype.endBatchIn = function(sessionId){
    if(this.settings.env == "dev") {
        console.log("Dispatcher: endBatchIn sessionId:", sessionId);
    }

    var batchInKey         = tConst.batchKey+":"+sessionId+":"+tConst.inKey;
    var batchActiveKey     = tConst.batchKey+":"+sessionId+":"+tConst.activeKey;

    // check in done
    this.queue.lrange(batchInKey, 0, -1, function(err, list){
        if(err) {
            console.error("Dispatch", batchInKey, "Error:", err);
            return;
        }

        //console.log("Dispatcher: endBatchIn", batchInKey, "list:", list);
        if(list.length == 0) {

            // check active done
            this.queue.lrange(batchActiveKey, 0, -1, function(err, list){
                if(err) {
                    console.error("Dispatcher: endBatchIn",  batchActiveKey, "Error:", err);
                    return;
                }

                //console.log("Dispatcher: endBatchIn", batchActiveKey, "list:", list);
                if(list.length == 0) {
                    //console.log(sessionId, "- Done");

                    // cleanup session
                    this.cleanupSession(sessionId, function executeAssessment(){

                        // execute assessment
                        if(this.settings.env == "dev") {
                            console.log("Dispatcher: Assessment Delay - SessionId:", sessionId);
                        }
                        // wait 10 seconds
                        setTimeout(function(){

                            var url = this.assessmentUrl + sessionId;
                            request.post(url, function (err, postRes, body) {
                                if(err) {
                                    console.error("url:", url, ", Error:", err);
                                    res.status(500).send('Error:'+err);
                                    return;
                                }

                                if(this.settings.env == "dev") {
                                    console.log("Dispatcher: Started Assessment - SessionId:", sessionId);
                                }
                            }.bind(this));

                        }.bind(this), this.settings.dispatcher.assessmentDelay);

                    }.bind(this));

                } else {
                    //console.log(batchActiveKey, "not done, count:", list.length);

                    // try again until empty
                    setTimeout(function(){
                        this.endBatchIn(sessionId);
                    }.bind(this), this.settings.dispatcher.batchInPollDelay);
                }
            }.bind(this));
        } else {
            //console.log(batchInKey, "not done, count:", list.length);

            // try again until empty
            setTimeout(
                function(){
                    this.endBatchIn(sessionId);
                }.bind(this),
                this.settings.dispatcher.batchInPollDelay
            );
        }
    }.bind(this));
}

Dispatcher.prototype.startBatchInPoll = function(sessionId){
    setInterval(
        function(){
            this.batchInCheck(sessionId);
        }.bind(this),
        this.settings.dispatcher.batchInPollDelay
    );
}

Dispatcher.prototype.batchInCheck = function(sessionId){
    var batchInKey = tConst.batchKey+":"+sessionId+":"+tConst.inKey;

    // check items in batch list
    this.queue.llen(batchInKey, function(err, count){
        if(err) {
            console.error("Dispatcher: startBatchIn Error:", err);
            return;
        }

        //console.log("batchInCheck batchInKey:", batchInKey, ", count:", count);
        if(count > 0) {
            for(var i = 0; i < Math.min(this.settings.dispatcher.batchGetMax, count); i++){
                // adding to batch
                this.processItem(sessionId);
            }
        }
    }.bind(this));
}

Dispatcher.prototype.processItem = function(sessionId){
    var batchInKey     = tConst.batchKey+":"+sessionId+":"+tConst.inKey;
    var batchActiveKey = tConst.batchKey+":"+sessionId+":"+tConst.activeKey;

    // move item from In to Active
    this.queue.rpoplpush(batchInKey, batchActiveKey, function(err, data){
        if(err) {
            console.error("Dispatcher: processItem Error:", err);
            return;
        }

        // update date in meta data
        this.updateSessionMetaData(sessionId);

        //console.log("sendItemToDataStore batchActiveKey:", batchActiveKey, ", data:", data);
        this.sendItemToDataStore(batchActiveKey, data);

    }.bind(this));
}

Dispatcher.prototype.processDone = function(err, batchActiveKey, data){
    if(err) {
        jdata = JSON.parse(data);
        this.cleanupSession(jdata.gameSessionId);
        console.error("Dispatcher: processDone saved Error:", err);
    }

    //console.log("processDone batchActiveKey:", batchActiveKey, ", data:", data);
    // move item from active to done
    this.queue.lrem(batchActiveKey, 0, data, function(err){
        if(err) {
            console.error("Dispatcher: processDone final Error:", err);
            return;
        }

        //console.log("done with:", data);
    }.bind(this));
}

Dispatcher.prototype.sendItemToDataStore = function(batchActiveKey, data){
    // curry (aka, use closure to save batchActiveKey and data)
    var done = function(key, data){
        return function(err){
            this.processDone(err, key, data);
        }.bind(this)
    }.bind(this);
    var doneCB = done(batchActiveKey, data);

    //console.log("Dispatcher: sendItemToDataStore data:", data);

    // send to datastore server
    try {
        jdata = JSON.parse(data);
    } catch(err) {
        console.error("Dispatcher: Error -", err, ", JSON data:", data);
        return;
    }
    try {
        jdata.events = JSON.parse(jdata.events);
    } catch(err) {
        console.error("Dispatcher: Error -", err, ", JSON events:", data);
        return;
    }

    // if no events
    if(!jdata.events.length) {
        doneCB(null);
        return;
    }

    if(jdata.gameSessionId) {
        var qInsertData = [];
        for(var i in jdata.events){
            var row = [
                "NULL",
                0,
                this.ds.escape(JSON.stringify(jdata.events[i].eventData)),
                "NOW()",
                this.ds.escape(jdata.gameVersion),
                this.ds.escape(jdata.gameSessionId),
                "NOW()",
                this.ds.escape(jdata.events[i].name),
                "UNIX_TIMESTAMP(NOW())",
                "(SELECT user_id FROM GL_SESSION WHERE SESSION_ID="+this.ds.escape(jdata.gameSessionId)+")"
            ];
            qInsertData.push( "("+row.join(",")+")" );
        }

        q = "INSERT INTO GL_ACTIVITY_EVENTS (id, version, data, date_created, game, game_session_id, last_updated, name, timestamp, user_id) VALUES ";
        q += qInsertData.join(",");
        //console.log('q:', q);

        this.ds.addQuery(q, function(err) {
            doneCB(err);
        }.bind(this));
    } else {
        console.error("Dispatcher: sendItemToDataStore missing gameSessionId");
    }
}

module.exports = Dispatcher;

