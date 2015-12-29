/**
 * Monitor Server Module
 *
 * Module dependencies:
 *
 *
 */

var fs        = require('fs');
var path      = require('path');
var memwatch  = require('memwatch-next');

var _         = require('lodash');
var when      = require('when');
var CronJob   = require('cron').CronJob;
var mConst    = require('./monitor.const.js');

// load at runtime
var Util;

module.exports = MonitorService;

function MonitorService(options, serviceManager){
    try {
        var Monitor;

        this.options = _.merge(
            { },
            options
        );

        // Glasslab libs
        Util     = require('../core/util.js');
        Monitor = require('./monitor.js');
        MySQL   = require('../core/datastore.mysql.js');

        // add multiGetChunkSize to couchbase options
        this.options.monitor.datastore.couchbase.multiGetChunkSize = this.options.monitor.dataChunkSize;

        this.requestUtil = new Util.Request(this.options);

        // This Couchbase store maybe used to store persistent monitoring data.
        this.store       = new Monitor.Datastore.Couchbase(this.options.monitor.datastore.couchbase);
        this.stats       = new Util.Stats(this.options, "Monitor");
        
        // This is the mysql DB being monitored, not one being used by monitoring app.
        var connectOptions = _.merge(
            {
                "host"    : "localhost",
                "user"    : "root",
                "password": "",
                "database": ""
            },
            this.options.monitor.tests.mysql
        );
        this.monds = new MySQL(connectOptions);
        
        this.workingdata = { };
        
        var validServer = this.options.services.name && options.monitor.cron.server == this.options.services.name;
        this.cron = new CronJob(this.options.monitor.cron.time,
                            _cronTask.bind(this),
                            this.options.monitor.cron.enabled && validServer);

        if (this.options.monitor.memwatch.log || this.options.monitor.memwatch.stats) {
            memwatch.on('stats', function(stats) {
                if (this.options.monitor.memwatch.log) {
                    console.infoExt("GC", "FULLGC", stats.num_full_gc, "INCGC", stats.num_inc_gc, "COMPACT", stats.heap_compactions, "TREND", stats.usage_trend, "ESTBASE", stats.estimated_base, "CURBASE", stats.current_base, "MIN", stats.min, "MAX", stats.max);
                }
                if (this.options.monitor.memwatch.stats) {
                    this.stats.set("info", "num_full_gc", stats.num_full_gc);
                    this.stats.set("info", "num_inc_gc", stats.num_full_gc);
                    this.stats.set("info", "heap_compactions", stats.heap_compactions);
                    this.stats.set("info", "usage_trend", stats.usage_trend);
                    this.stats.set("info", "estimated_base", stats.estimated_base);
                    this.stats.set("info", "current_base", stats.current_base);
                    this.stats.set("info", "min_base", stats.min);
                    this.stats.set("info", "max_base", stats.max);
                }
            }.bind(this));
        }
        
        this.serviceManager = serviceManager;
        
    } catch(err) {
        console.trace("Auth: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

MonitorService.prototype.start = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // test connection to Couchbase
    this.store.connect()
        .then(function(){
            console.log("MonitorService: Couchbase DS Connected");
            this.stats.increment("info", "Couchbase.Connect");
        }.bind(this),
        function(err){
            console.trace("MonitorService: Couchbase DS Error -", err);
            this.stats.increment("error", "Couchbase.Connect");
        }.bind(this))
        .then(function () {
            this.cron.start();
        }.bind(this))
        .then(resolve, reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

function _cronTask() {
    console.log('Monitor cronTask start');
    var mockReq = {
        "params": { "code": mConst.code },
        "protocol": this.options.monitor.cron.protocol || "http",
        "headers": {"host": this.options.monitor.cron.host || "localhost:8001"}
    }, mockRes = {
        writeHead: function(){ /* console.log('Monitor cronTask mock res.writeHead()', arguments) */ },
        end: function(){console.log('Monitor cronTask response:', arguments)},
    };
    this.serviceManager.internalRoute('/api/v2/monitor/code/:code/run', 'get', [mockReq, mockRes]);
};
