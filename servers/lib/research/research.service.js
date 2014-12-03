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
            // Run the cron job
            //this.cronJob();

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

        }.bind(this))

        .then(null, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

// ongoing job that schedules the parser to write data to a csv file
// will end after a certain number of successful jobs
// goal: integrate with s3 buckets and notification emails
ResearchService.prototype.cronJob = function(){
    var serviceManager = this.serviceManager;

    // hard coded ids array for now
    // when integrate info.json couchbase stuff, then can use view to find list of all ids programmatically
    var ids = ['SC', 'AA-1', 'AW-1'];
    var index = 0;
    var eventCount = 0;
    var startProcess;
    var upToDate;

    // actual time wanted: new CronJob('0 0 0 * * *', function(){
    // will alter this time for prototyping
    new CronJob('0 0 0 * * *', function(){
        var startTime = Date.now();
        startProcess = Date.now();
        function archiveCheck(){
            var currentTime = Date.now();
            // four hours in milliseconds, job runs from 12 am to 4 am pacific time.
            var fourHours = 14400000;
            if(currentTime - startTime < fourHours && index < ids.length){
                serviceManager.internalRoute("/api/v2/research/archive", 'get', [ids[index], eventCount, startProcess])
                    .then(function(output){
                        upToDate = output[0];
                        eventCount = output[1];
                        if(upToDate){
                            eventCount = 0;
                            index++;
                            startProcess = Date.now();
                        }
                        archiveCheck();
                    }.bind(this))
                    .then(null, function(err){
                        if(err !== 'invalid route'){
                            // email failure notification
                            console.error('Cron Error -',err);
                        }
                    }.bind(this));
            } else{
                console.log('completed cron job');
                // email success notification
            }
        }
        archiveCheck();
    }.bind(this), null, true, "America/Los_Angeles");
};
