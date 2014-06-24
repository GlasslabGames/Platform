/**
 * Assessment Distiller Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  redis      - https://github.com/mranney/node_redis
 *  couchnode  - https://github.com/couchbase/couchnode
 *
 */
var fs      = require('fs');
var path    = require('path');
// Third-party libs
var _       = require('lodash');
var when    = require('when');
var child_process   = require('child_process');
// Glasslab libs
var aeConst;

module.exports = Distiller;

function Distiller(options){
    var Util, Assessment, Telemetry;

    // Glasslab libs
    Util       = require('../core/util.js');
    Telemetry  = require('../data/data.js');
    Assessment = require('./assessment.js');
    aeConst    = Assessment.Const;

    this.options = _.merge(
        {
            distiller: {
                getMax:    20,
                pollDelay: 1000,          // (1 second) in milliseconds
                cleanupPollDelay: 3600000 // (1 hour)   in milliseconds
            }
        },
        options
    );

    this.requestUtil   = new Util.Request(this.options);
    this.queue         = new Assessment.Queue.Redis(this.options.assessment.queue);
    this.dataDS        = new Telemetry.Datastore.Couchbase(this.options.telemetry.datastore.couchbase);
    this.userDS        = new Telemetry.Datastore.MySQL(this.options.telemetry.datastore.mysql);
    this.aeDS          = new Assessment.Datastore.Couchbase(this.options.assessment.datastore.couchbase);
    this.SD_Function   = new Assessment.Distiller.Func.SC();
    this.stats         = new Util.Stats(this.options, "Assessment.Distiller");

    this.wekaFileData = {};
    this.loadWekaFiles();

    this.dataDS.connect()
        .then(function(){
            console.log("Distiller: Data DS Connected");
            this.stats.increment("info", "Telemetry.Data.Couchbase.Connect");
        }.bind(this),
        function(err){
            console.trace("Distiller: Data DS Error -", err);
            this.stats.increment("error", "Telemetry.Data.Couchbase.Connect");
        }.bind(this));

    this.aeDS.connect()
        .then(function(){
            console.log("Distiller: AE DS Connected");
            this.stats.increment("info", "Assessment.AE.Couchbase.Connect");
        }.bind(this),
            function(err){
                console.trace("Distiller: AE DS Error -", err);
                this.stats.increment("error", "Assessment.AE.Couchbase.Connect");
            }.bind(this));

    this.userDS.connect()
        .then(function(){
            console.log("Distiller: User DS Connected");
            this.stats.increment("info", "Assessment.User.MySQL.Connect");
        }.bind(this),
        function(err){
            console.trace("Distiller: User DS Error -", err);
            this.stats.increment("error", "Assessment.User.MySQL.Connect");
        }.bind(this));

    /*
    // TODO: remove this after running test
    this.addAllOldSessionsForProcess()
        .then(function(){
            this.startTelemetryPoll();
        }.bind(this),
        function(err){
            console.trace("Distiller: Add All Old Session For Process Error -", err);
            this.stats.increment("error", "Assessment.OldSessionProcess");
        }.bind(this));
    */
    this.startTelemetryPoll();

    console.log('---------------------------------------------');
    console.log('Distiller: Waiting for messages...');
    console.log('---------------------------------------------');
    this.stats.increment("info", "ServerStarted");
}

Distiller.prototype.addAllOldSessionsForProcess = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    this.userDS.getAllGameSessions()
        .then(function(sessionList){
            var promiseList = [];

            for(var i = 0; i < sessionList.length; i++) {
                // add queue push api to promise list
                promiseList.push( this.queue.pushJob( sessionList[i] ) );
            }

            return when.all(promiseList);
        }.bind(this))

        .then(function(){
            console.log("Done adding all old sessions for process");
        }.bind(this))

        .then(resolve, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Distiller.prototype.loadWekaFiles = function(){
    try{
        var dir = "./lib/aeng/bayes/";
        var files = fs.readdirSync(dir);

        files.forEach(function(file){
            // skip dot files
            if(file.charAt(0) != '.') {
                var name = path.basename(file, path.extname(file));
                this.wekaFileData[name] = fs.readFileSync(dir + file, 'utf-8');
            }
        }.bind(this));
    } catch(err) {
        console.error("Distiller: Load Weka Files Error -", err);
    }

    console.log('Distiller: Loaded Weka XML Files');
};


Distiller.prototype.startTelemetryPoll = function(){
    // fetch assessment loop
    setInterval(function() {
        this.telemetryCheck();
    }.bind(this), this.options.distiller.pollDelay);
};


Distiller.prototype.telemetryCheck = function(){
    this.queue.getJobCount()
        .then(
            function(count) {
                if(count > 0) {
                    //console.log("Distiller: telemetryCheck count:", count);
                    this.stats.increment("info", "GetIn.Count", count);

                    for(var i = 0; i < Math.min(count, this.options.distiller.getMax); i++){
                        this.getTelemetryBatch();
                    }
                }
            }.bind(this),
            function(err){
                console.log("Distiller: telemetryCheck Error:", err);
                this.stats.increment("error", "TelemetryCheck.GetInCount");
            }.bind(this)
        );
}

Distiller.prototype.getTelemetryBatch = function(){

    this.queue.popJob()
        // cleanup session
        .then(function(data){
            if(data.type == aeConst.queue.end) {
                return this.runAssessment(data.id)
                    .then( function(){
                        // TODO: use assessment DS for queue
                        return this.dataDS.endQSession(data.id)
                    }.bind(this) );
            } else {
                // TODO: use assessment DS for queue
                return this.dataDS.cleanupQSession(data.id);
            }
        }.bind(this))

        // catch all ok
        .then( function(){
            //console.log("Distiller: all done");
        }.bind(this))

        // catch all errors
        .then(null, function(err) {
            console.error("Distiller: endBatchIn - Error:", err);
            this.stats.increment("error", "GetTelemetryBatch");
        }.bind(this));
}

Distiller.prototype.runAssessment = function(gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    if(this.options.env == "dev") {
        console.log("Distiller: Execute Assessment Delay - gameSessionId:", gameSessionId);
    }
    this.stats.increment("info", "ExecuteAssessment.StartDelay");

    this.dataDS.getEvents(gameSessionId)
        .then(function(eventsData) {
            if(!eventsData ||
               !eventsData.events ||
                eventsData.events.length == 0) {
                console.warn( "Distiller: No events found to distilled" );
                resolve();
                return;
            }

            // Run distiller function
            var distilledData = this.SD_Function.preProcess(eventsData);
            //console.log( "Distilled data:", JSON.stringify(distilledData, null, 2) );

            // If the distilled data has no WEKA key, don't save anything
            if( !distilledData || !distilledData.bayes.key ) {
                console.warn( "Distiller: No bayes key found in distilled data" );
                resolve();
                return;
            }

            // save distilled data
            //return this.aeDS.saveDistilledData(gameSessionId, distilledData);
            return distilledData;
        }.bind(this))
        .then(function(distilledData) {
            // shortcut missing distilledData
            if(!distilledData) return;
            //console.log("distilledData:", distilledData);

            // If the bayes key is empty, there is no WEKA to perform, resolve
            if( !distilledData || !distilledData.bayes.key ) {
                //console.log( "no bayes key found in weka data" );
                resolve();
                return;
            }

            // Set the command line string for the WEKA processor
            var commandString = " SimpleBayes";
            // weka files was not loaded
            if(!this.wekaFileData.hasOwnProperty(distilledData.bayes.key)) {
                console.error( "Distiller: weka file missing from cache: ", distilledData.bayes.key);
                reject();
                return;
            }
            // add weka file length
            commandString += " " + this.wekaFileData[distilledData.bayes.key].length;

            // add root node
            commandString += " " + distilledData.bayes.root;

            // Use the distilled data to get the bayes key and evidence fragments to pass to the WEKA server
            var evidenceFragments = distilledData.bayes.fragments;
            for(var i in evidenceFragments) {
                commandString += " " + i + " " + evidenceFragments[i];
            }

            // Before we trigger the WEKA process, we need to make sure we set the current working directory
            // and execute the batch file or shell script, depending on the platform
            process.chdir( this.options.assessment.wekaPath );
            var scriptToExecute = '';
            //console.log( "Executing bayes on " + process.platform + " at " + process.cwd() );
            if( process.platform === "win32" ) {
                scriptToExecute += 'run_assessment.bat';
            } else {
                scriptToExecute += './run_assessment.sh';
            }

            // run child process in promise
            return when.promise( function(resolve2, reject2) {
                // Use the distilled data to get the bayes key and evidence fragments to pass to the WEKA process
                //console.log( "bayes file: ", distilledData.bayes.key );
                //console.log( "execute: ", scriptToExecute + commandString );

                var aeWeka = child_process.exec( scriptToExecute + commandString,
                    function( error, data, stderr ) {
                        //console.log( "weka data: ", data );
                        //console.log( "stderr: ", stderr );
                        if( error !== null ) {
                            //console.log( "exec error: " + error );
                            reject2( error );
                        } else {
                            resolve2({distilled: distilledData, weka: data});
                        }
                    }.bind(this)
                );

                aeWeka.stdin.write(this.wekaFileData[distilledData.bayes.key]);
                aeWeka.stdin.end();
            }.bind(this))
        }.bind(this))

        .then(function(data) {
            // shortcut missing data
            if(!data) return;

            try {
                data.weka = JSON.parse(data.weka);
                // process wekaResults and distilled Data
                var compData = this.SD_Function.postProcess(data.distilled, data.weka);

                if(compData) {
                    // get session info (userId, courseId)
                    return this.userDS.getSessionInfo(gameSessionId)
                        .then(function(sessionInfo) {
                            if(sessionInfo) {
                                console.log( "Distiller: Running Assessment..." );
                                // save Competency Results to DB
                                return this.userDS.saveCompetencyResults(sessionInfo, compData);
                            }
                        }.bind(this));
                }
            } catch(err) {
                // invalid json data
                console.error("Distiller: Invalid Competency JSON data - Error:", err);
                reject(err);
            }
        }.bind(this))
        .then(function() {
            console.log( "Distiller: Assessment Complete -", gameSessionId);
        }.bind(this))

        // catch all error
        .then(null, function(err){
            console.error("Distiller: runAssessment - Error:", err);
            this.stats.increment("error", "GetTelemetryBatch");

            reject(err);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}
