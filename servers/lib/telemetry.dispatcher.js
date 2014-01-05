/**
 * Telemetry Dispatcher Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  redis      - https://github.com/mranney/node_redis
 *  couchnode  - https://github.com/couchbase/couchnode
 *
 */
// Third-party libs
var _       = require('lodash');
var when    = require('when');
var redis   = require('redis');
// Glasslab libs
var tConst, myDS, cbDS, RequestUtil;

function Dispatcher(options){
    tConst      = require('./telemetry.js').Const;
    myDS        = require('./telemetry.js').Datastore.MySQL;
    cbDS        = require('./telemetry.js').Datastore.Couchbase;
    RequestUtil = require('./util.js').Request;

    this.options = _.merge(
        {
            queue: { port: null, host: null },
            webapp: { protocol: "http", host: "localhost", port: 8080},
            dispatcher: {
                telemetryGetMax: 20,
                telemetryPollDelay: 1000,     // (1 second) in milliseconds
                assessmentDelay:    1000,     // (1 second) in milliseconds
                cleanupPollDelay:   3600000,  // (1 hour)   in milliseconds
                sessionExpire:      14400000  // (4 hours)  in milliseconds
            }
        },
        options
    );

    this.requestUtil   = new RequestUtil(this.options);
    this.queue         = redis.createClient(this.options.queue.port, this.options.queue.host, this.options.queue);
    this.webAppUrl     = this.options.webapp.protocol+"//"+this.options.webapp.host+":"+this.options.webapp.port;
    this.assessmentUrl = this.webAppUrl+"/api/game/assessment/";

    //this.ds            = new myDS(this.options.telemetry.datastore.mysql);
    this.ds            = new cbDS(this.options.telemetry.datastore.couchbase);

    this.startTelemetryPoll();
    this.startCleanOldSessionPoll();

    console.log('---------------------------------------------');
    console.log('Dispatcher: Waiting for messages...');
    console.log('---------------------------------------------');
}


Dispatcher.prototype.startTelemetryPoll = function(){
    // fetch telemetry loop
    setInterval(function() {
        this.telemetryCheck();
    }.bind(this), this.options.dispatcher.telemetryPollDelay);
}

Dispatcher.prototype.telemetryCheck = function(){
    var telemetryInKey = tConst.telemetryKey+":"+tConst.inKey;

    this.queue.llen(telemetryInKey, function(err, count){
        if(err) {
            console.error("Dispatcher: Error:", err);
            return;
        }

        if(count > 0) {
            console.log("telemetryInKey:", telemetryInKey, ", count:", count);

            for(var i = 0; i < Math.min(count, this.options.dispatcher.telemetryGetMax); i++){
                this.getTelemetryBatch();
            }
        }
    }.bind(this));
}


Dispatcher.prototype.startCleanOldSessionPoll = function(){
    // fetch telemetry loop
    setInterval(function() {
        this.cleanOldSessionCheck();
    }.bind(this), this.options.dispatcher.cleanupPollDelay);
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
                var meta = value;
                try {
                    meta = JSON.parse(meta);
                } catch(err) {
                    console.error("Dispatcher: meta Error -", err, ", JSON data:", meta);
                    return;
                }
                //console.log("id", sessionId, ", metaData:", meta);

                var startTime = new Date(meta.date).getTime();
                var now       = new Date().getTime();
                if(now - startTime > this.options.dispatcher.sessionExpire){
                    // clean up session
                    console.log("!!! Expired Cleaning Up - id", sessionId, ", metaData:", meta);

                    this.cleanupSession(sessionId);
                }
            }.bind(this));
        }
    }.bind(this));
}

Dispatcher.prototype.cleanupSession = function(sessionId, cb){
    var telemetryMetaKey   = tConst.telemetryKey+":"+tConst.metaKey;
    var batchInKey         = tConst.batchKey+":"+sessionId+":"+tConst.inKey;

    // remove batch in list
    this.queue.del(batchInKey, function(err){
        if(err) {
            console.error("Dispatcher: endBatchIn batchInKey del Error:", err);
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

    if(cb) cb();
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

    // pop in item off telemetry queue
    this.queue.rpop(telemetryInKey, function(err, telemData){
        if(err) {
            console.error("Dispatcher: getTelemetryBatch Error:", err);
            return;
        }

        // if telemetry has data
        if(telemData) {
            // convert string to object
            try {
                telemData = JSON.parse(telemData);
            } catch(err) {
                console.error("Dispatcher: getTelemetryBatch Error -", err, ", JSON data:", telemData);
                return;
            }
            //console.log("Dispatcher: getTelemetryBatch data:", telemData);

            // update date in meta data
            this.updateSessionMetaData(telemData.id);
            this.endBatchIn(telemData.id);
        }
    }.bind(this));
}

Dispatcher.prototype.endBatchIn = function(sessionId){
    if(this.options.env == "dev") {
        console.log("Dispatcher: endBatchIn sessionId:", sessionId);
    }

    // remove all events from
    this.processBatch(sessionId, function(){

        // cleanup session
        this.cleanupSession(sessionId, function executeAssessment(){

            // execute assessment
            if(this.options.env == "dev") {
                console.log("Dispatcher: Assessment Delay - SessionId:", sessionId);
            }
            // wait some time before start assessment
            setTimeout(function(){

                var url = this.assessmentUrl + sessionId;
                this.requestUtil.getRequest(url, null, function (err, postRes, body) {
                    if(err) {
                        console.error("url:", url, ", Error:", err);
                        res.status(500).send('Error:'+err);
                        return;
                    }

                    if(this.options.env == "dev") {
                        console.log("Dispatcher: Started Assessment - SessionId:", sessionId);
                    }
                }.bind(this));

            }.bind(this), this.options.dispatcher.assessmentDelay);

        }.bind(this));

    }.bind(this));
}

Dispatcher.prototype.processBatch = function(sessionId, done){
    var batchInKey = tConst.batchKey+":"+sessionId+":"+tConst.inKey;

    // check items in batch list
    this.queue.llen(batchInKey, function(err, count){
        if(err) {
            console.error("Dispatcher: startBatchIn Error:", err);
            return;
        }
        //console.log("batchInCheck batchInKey:", batchInKey, ", count:", count);

        // get all items
        this.queue.lrange(batchInKey, 0, count, function(err, data){
            //console.log("batchInCheck batchInKey:", batchInKey, ", data:", data);

            var row, jrow;
            var jdata = {
                userId:        null,
                gameSessionId: "",
                gameVersion:   "",
                events:        []
            };
            for(var i in data) {
                row = data[i];

                // send to datastore server
                try {
                    jrow = JSON.parse(row);
                } catch(err) {
                    console.error("Dispatcher: Error -", err, ", JSON data:", row);
                    break;
                }
                //console.log("Dispatcher: JSON data:", jrow);

                if(jrow.userId) {
                    jdata.userId = jrow.userId;
                }
                if(jrow.gameSessionId) {
                    jdata.gameSessionId = jrow.gameSessionId;
                }
                if(jrow.gameVersion) {
                    jdata.gameVersion = jrow.gameVersion;
                }

                if(jrow.events) {

                    if(_.isString(jrow.events)) {
                        try {
                            jrow.events = JSON.parse(jrow.events);
                        } catch(err) {
                            console.error("Dispatcher: Error -", err, ", JSON events:", jrow.events);
                            break;
                        }
                    }

                    if(!jrow.events.length) {
                        break;
                    }

                    if(jrow.gameSessionId) {
                        jdata.gameSessionId = jrow.gameSessionId;
                    } else {
                        console.error("Dispatcher: sendItemToDataStore row missing gameSessionId");
                        break;
                    }

                    // copy evernts
                    for(var e in jrow.events) {
                        jdata.events.push( jrow.events[e] );
                    }

                    // set version (in case it's set in an events
                    if(jrow.gameVersion) {
                        jdata.gameVersion   = jrow.gameVersion;
                    }
                }
            }

            if(jdata.gameSessionId && jdata.events.length > 0) {
                //console.log("Dispatcher: events:", jdata.events);
                console.log("Dispatcher: ended session gameSessionID:", jdata.gameSessionId, ", event count:", jdata.events.length);

                this.ds.saveEvents(jdata)
                    .then(
                        function(){ done(); },
                        function(err){ done(err); }
                    );
            } else {
                console.error("Dispatcher: sendItemToDataStore missing gameSessionId");
            }

        }.bind(this));

    }.bind(this));
}


module.exports = Dispatcher;
