/**
 * Telemetry Queue Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  redis      - https://github.com/mranney/node_redis
 *  when       - https://github.com/cujojs/when
 *
 */
// Third-party libs
var _     = require('lodash');
var redis = require('redis');
var when  = require('when');
// Glasslab libs
var tConst;

module.exports = Telem_Queue;

function Telem_Queue(options){
    tConst = require('./telemetry.js').Const;

    this.options = _.merge(
        {
            queue: { port: null, host: null, db:0 }
        },
        options
    );

    this.q = redis.createClient(this.options.queue.port, this.options.queue.host, this.options.queue);

    if(this.options.queue.db) {
        this.q.select(this.options.queue.db);
    }
}

Telem_Queue.prototype.startSession = function(sessionId, userId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var telemetryMetaKey = tConst.telemetryKey+":"+tConst.metaKey;

    this.q.hset(telemetryMetaKey, sessionId,
        JSON.stringify( {
            date:  new Date(),
            userId: userId,
            state:  tConst.start
        }),
        function(err){
            if(err) {
                console.error("Queue: setSessionState Error:", err);
                reject(err);
                return;
            }

            resolve();
        }.bind(this)
    );
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Telem_Queue.prototype.validateSession = function(sessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var telemetryMetaKey = tConst.telemetryKey+":"+tConst.metaKey;

    this.q.hget(telemetryMetaKey, sessionId,
        function(err, data){
            if(err) {
                console.error("Queue: getSessionState Error:", err);
                reject(err);
                return;
            }

            var jdata = null;
            try {
                jdata = JSON.parse(data);
            } catch(err) {
                console.error("Queue: Error -", err, ", JSON data:", row);
                reject(err);
                return;
            }

            resolve(jdata);
        }.bind(this)
    );
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Telem_Queue.prototype.endSession = function(sessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var telemetryMetaKey = tConst.telemetryKey+":"+tConst.metaKey;
    var telemetryInKey   = tConst.telemetryKey+":"+tConst.inKey;

    // get session first
    this.validateSession(sessionId)
        .then(function(data){

            this.q.hset(telemetryMetaKey, sessionId,
                JSON.stringify( {
                    date:   new Date(), // update date
                    userId: data.userId,
                    state:  tConst.end  // update state
                }),
                function(err){
                    if(err) {
                        console.error("Queue: setSessionState Error:", err);
                        reject(err);
                        return;
                    }

                    // all ok, now add end to
                    this.q.lpush(telemetryInKey,
                        JSON.stringify({
                            id: sessionId,
                            type: tConst.end
                        }),
                        function(err){
                            if(err) {
                                console.error("Queue: End Error -", err);
                                reject(err);
                                return;
                            }

                            resolve();
                        }.bind(this)
                    );
                }.bind(this));

        }.bind(this), reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Telem_Queue.prototype.getInCount = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var telemetryInKey = tConst.telemetryKey+":"+tConst.inKey;

    this.q.llen(telemetryInKey, function(err, count){
        if(err) {
            console.error("Queue: Error:", err);
            reject(err);
            return;
        }

        resolve(count);
    }.bind(this));
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Telem_Queue.prototype.cleanOldSessionCheck = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var telemetryMetaKey = tConst.telemetryKey+":"+tConst.metaKey;

    this.q.hgetall(telemetryMetaKey, function(err, data){
        if(err) {
            console.error("Dispatcher: hgetall Error:", err);
            reject(err);
            return;
        }

        if(_.isObject(data)){
            //console.log(telemetryMetaKey, " data:", data);
            // check date

            var promiseList = [];
            _.forEach(data, function(value, gameSessionId){
                var meta = value;
                try {
                    meta = JSON.parse(meta);
                } catch(err) {
                    console.error("Queue: parse meta Error -", err, ", JSON data:", meta);
                    reject(err);
                    return;
                }
                //console.log("id", gameSessionId, ", metaData:", meta);

                var startTime = new Date(meta.date).getTime();
                var now       = new Date().getTime();
                if(now - startTime > this.options.dispatcher.sessionExpire){
                    // clean up session
                    console.log("Queue: !!! Expired Cleaning Up - id", gameSessionId, ", metaData:", meta);

                    promiseList.push( this.cleanupSession(gameSessionId) );
                }
            }.bind(this));

            when.all(promiseList)
                .then(function(){
                    resolve();
                }.bind(this));
        }
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Telem_Queue.prototype.cleanupSession = function(gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var telemetryMetaKey = tConst.telemetryKey+":"+tConst.metaKey;

    // remove meta info
    this.q.hdel(telemetryMetaKey, gameSessionId, function(err){
        if(err) {
            console.error("Queue: endBatchIn telemetryMetaKey del Error:", err);
            reject(err);
            return;
        }

        resolve();
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}


Telem_Queue.prototype.getTelemetryBatch = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var telemetryInKey = tConst.telemetryKey+":"+tConst.inKey;

    // pop in item off telemetry queue
    this.q.rpop(telemetryInKey, function(err, telemData){
        if(err) {
            console.error("Queue: getTelemetryBatch Error:", err);
            reject(err);
            return;
        }

        // if telemetry has data
        if(telemData) {
            // convert string to object
            try {
                telemData = JSON.parse(telemData);
            } catch(err) {
                console.error("Queue: getTelemetryBatch Error -", err, ", JSON data:", telemData);
                reject(err);
                return;
            }
            console.log("Queue: getTelemetryBatch data:", telemData);

            resolve(telemData);
        }
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}