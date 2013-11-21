/**
 * Telemetry Collector Module
 *
 * Module dependencies:
 *   redis - https://github.com/mranney/node_redis
 *
 */

var _      = require('underscore');
var redis  = require('redis');
var tConst  = require('./telemetry.const.js');

function Collector(settings){
    this.settings = {
        q: {
            port: null, host: null
        },
        ds: {} };
    if(settings && settings.queue)     this.settings.q  = settings.queue;

    this.queue = redis.createClient(this.settings.q.port, this.settings.q.host, this.settings.q);
}

Collector.prototype.start = function(id) {
    var telemetryInKey = tConst.telemetryKey+":"+tConst.inKey;

    this.queue.lpush(telemetryInKey,
        JSON.stringify({
            id: id,
            type: "start"
        }),
        function(err){
            if(err) {
                console.error("Collector Start Error:", err);
            }
        }
    );
}

Collector.prototype.batch = function(id, data) {
    var batchInKey = tConst.batchKey+":"+id+":"+tConst.inKey;

    // if object convert data to string
    if(_.isObject(data)) {
        data = JSON.stringify(data);
    }

    this.queue.lpush(batchInKey, data, function(err){
        if(err) {
            console.error("Collector Batch Error:", err);
        }
    });
}

Collector.prototype.end = function(id) {
    var telemetryInKey = tConst.telemetryKey+":"+tConst.inKey;

    this.queue.lpush(telemetryInKey,
        JSON.stringify({
            id: id,
            type: "end"
        }),
        function(err){
            if(err) {
                console.error("Collector End Error:", err);
            }
        }
    );
}

module.exports = Collector;
