/**
 * Assessment Queue Module
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
var aeConst;

module.exports = AE_Queue;

function AE_Queue(options){
    aeConst = require('./assessment.js').Const;

    this.options = _.merge(
        {
            port: null,
            host: null,
            db: 0,
            sessionExpire: 14400000
        },
        options
    );

    this.q = redis.createClient(this.options.port, this.options.host, this.options);

    this.keyMeta = aeConst.keys.assessment+":"+aeConst.keys.meta;
    this.keyIn   = aeConst.keys.assessment+":"+aeConst.keys.in;

    if(this.options.db) {
        this.q.select(this.options.db);
    }
}

AE_Queue.prototype.startSession = function(sessionId, userId, gameLevel){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    this.q.hset(this.keyMeta, sessionId,
        JSON.stringify( {
            date:  new Date(),
            userId: userId,
            gameLevel: gameLevel,
            state:  aeConst.queue.start
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

AE_Queue.prototype.validateSession = function(sessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    this.q.hget(this.keyMeta, sessionId,
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

AE_Queue.prototype.endSession = function(sessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // get session first
    this.validateSession(sessionId)
        .then(function(data){

            this.q.hset(this.keyMeta, sessionId,
                JSON.stringify( {
                    date:   new Date(), // update date
                    userId: data.userId,
                    state:  aeConst.queue.end  // update state
                }),
                function(err){
                    if(err) {
                        console.error("Queue: setSessionState Error:", err);
                        reject(err);
                        return;
                    }

                    // all ok, now add end to
                    this.q.lpush(this.keyIn,
                        JSON.stringify({
                            id: sessionId,
                            type: aeConst.queue.end
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

AE_Queue.prototype.getInCount = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    this.q.llen(this.keyIn, function(err, count){
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

AE_Queue.prototype.cleanOldSessionCheck = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    this.q.hgetall(this.keyMeta, function(err, data){
        if(err) {
            console.error("Queue: hgetall Error:", err);
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
                if(now - startTime > this.options.sessionExpire){
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

AE_Queue.prototype.cleanupSession = function(gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // remove meta info
    this.q.hdel(this.keyMeta, gameSessionId, function(err){
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


AE_Queue.prototype.getTelemetryBatch = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // pop in item off telemetry queue
    this.q.rpop(this.keyIn, function(err, telemData){
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
