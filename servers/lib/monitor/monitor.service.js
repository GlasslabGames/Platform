/**
 * Monitor Server Module
 *
 * Module dependencies:
 *
 *
 */

var fs        = require('fs');
var path      = require('path');

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
        this.cron        = new CronJob(this.options.monitor.cron.time,
                                       _cronTask.bind(this),
                                       this.options.monitor.cron.enabled && validServer);

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

        .then(function(){
            /*
            // load csv file
            var dir = __dirname+'/parser_schema/';
            //console.log("dir:", dir);
            fs.readdir(dir, function(error, files) {
                _.forEach(files, function(file){
                    var fullFile = dir + file;

                    var gameId = path.basename(file, path.extname(file));
                    gameId = gameId.toUpperCase();

                    // skip all dot files
                    if(gameId.charAt(0) == '.') {
                        return;
                    }

                    this.store.getCsvDataByGameId(gameId)
                        .then(function(data){
                            // only set data if none exist
                            if(!data) {
                                return this.store.setCsvDataByGameId(gameId, fs.readFileSync(fullFile, {encoding: 'utf8'}) );
                            }
                        }.bind(this))
                        .then(resolve, reject);

                }.bind(this));
            }.bind(this));
            */
            
            resolve();
        }.bind(this))

        .then(null, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

function _cronTask() {
    console.log('Monitor cronTask start');
    var mockReq = {};
    var mockRes = {
        writeHead: function(){/*console.log('Monitor cronTask mockRes.writeHead()', arguments)*/},
        end: function(){console.log('Monitor cronTask response:', arguments)},
    };
    this.serviceManager.internalRoute('/api/v2/monitor/code/'+mConst.code+'/run', 'post', [mockReq, mockRes]);
};
