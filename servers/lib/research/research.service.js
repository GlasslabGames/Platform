/**
 * Research Server Module
 *
 * Module dependencies:
 *
 *
 */

var fs        = require('fs');
var path      = require('path');

var _         = require('lodash');
var when      = require('when');
var csv       = require('csv');
var CronJob   = require('cron').CronJob;
var rConst    = require('./research.const.js');

// load at runtime
var Util;

module.exports = ResearchService;

function ResearchService(options, serviceManager){
    try {
        var Research;

        this.options = _.merge(
            { },
            options
        );

        // Glasslab libs
        Util     = require('../core/util.js');
        Research = require('./research.js');

        // add multiGetChunkSize to couchbase options
        this.options.research.datastore.couchbase.multiGetChunkSize = this.options.research.dataChunkSize;

        this.requestUtil = new Util.Request(this.options);
        this.store       = new Research.Datastore.Couchbase(this.options.research.datastore.couchbase);
        this.stats       = new Util.Stats(this.options, "Research");
        
        var validServer = this.options.services.name && options.research.cron.server == this.options.services.name;
        this.cronEnabled = this.options.research.cron.enabled && validServer;
        this.cron        = new CronJob(this.options.research.cron.time, _cronTask.bind(this));
        this.serviceManager = serviceManager;
        
    } catch(err) {
        console.trace("Auth: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

ResearchService.prototype.start = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // test connection to Couchbase
    this.store.connect()
        .then(function(){
            console.log("ResearchService: Couchbase DS Connected");
            this.stats.increment("info", "Couchbase.Connect");
        }.bind(this),
        function(err){
            console.trace("ResearchService: Couchbase DS Error -", err);
            this.stats.increment("error", "Couchbase.Connect");
        }.bind(this))

        .then(function(){
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
                
                if (this.cronEnabled) {
                    this.cron.start();
                }
            }.bind(this));

        }.bind(this))

        .then(null, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

function _cronTask() {
    console.log('Research cronTask start');
    var mockReq = {};
    var mockRes = {
        writeHead: function(){/*console.log('Research cronTask mockRes.writeHead()', arguments)*/},
        end: function(){console.log('Research cronTask response:', arguments)},
    };
    this.serviceManager.internalRoute('/api/v2/research/code/'+rConst.code+'/archive', 'post', [mockReq, mockRes]);
};
