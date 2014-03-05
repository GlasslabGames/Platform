/**
 * Assessment Distiller Module
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
var child_process   = require('child_process');
// Glasslab libs
var aeConst;

module.exports = Distiller;

function Distiller(options){
    var Util, Assessment, Telemetry;

    // Glasslab libs
    Telemetry  = require('./telemetry.js');
    Assessment = require('./assessment.js');
    Util       = require('./util.js');
    aeConst    = Assessment.Const;

    this.options = _.merge(
        {
            webapp: { protocol: "http", host: "localhost", port: 8080 },
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
    this.aeDS          = new Assessment.Datastore.Couchbase(this.options.assessment.datastore.couchbase);
    this.SD_Function   = new Assessment.Distiller.Func.SC();
    this.stats         = new Util.Stats(this.options, "Assessment.Distiller");
    this.stats         = new Util.Stats(this.options, "Assessment.Distiller");

    this.webAppUrl     = this.options.webapp.protocol+"//"+this.options.webapp.host+":"+this.options.webapp.port;
    this.assessmentUrl = this.webAppUrl+"/WekaServlet";//api/game/assessment/";

    this.dataDS.connect()
        .then(function(){
            console.log("Distiller: Data DS Connected");
            this.stats.increment("info", "Couchbase.Connect");
        }.bind(this),
        function(err){
            console.trace("Distiller: Data DS Error -", err);
            this.stats.increment("error", "Couchbase.Connect");
        }.bind(this));

    this.aeDS.connect()
        .then(function(){
            console.log("Distiller: AE DS Connected");
            this.stats.increment("info", "Couchbase.Connect");
        }.bind(this),
            function(err){
                console.trace("Distiller: AE DS Error -", err);
                this.stats.increment("error", "Couchbase.Connect");
            }.bind(this));

    this.startTelemetryPoll();
    this.startCleanOldSessionPoll();

    console.log('---------------------------------------------');
    console.log('Distiller: Waiting for messages...');
    console.log('---------------------------------------------');
    this.stats.increment("info", "ServerStarted");
}


Distiller.prototype.startTelemetryPoll = function(){
    // fetch assessment loop
    setInterval(function() {
        this.telemetryCheck();
    }.bind(this), this.options.distiller.pollDelay);
}

Distiller.prototype.telemetryCheck = function(){
    this.queue.getInCount()
        .then(
            function(count){
                if(count > 0) {
                    console.log("Distiller: telemetryCheck count:", count);
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


Distiller.prototype.startCleanOldSessionPoll = function(){
    // fetch assessment loop
    setInterval(function() {
        this.cleanOldSessionCheck();
    }.bind(this), this.options.distiller.cleanupPollDelay);
}

Distiller.prototype.cleanOldSessionCheck = function(){
    this.queue.cleanOldSessionCheck()
        .then(
            function(){
                console.log("Distiller: cleanOldSessionCheck done");
                this.stats.increment("info", "CleanOldSessionCheck.Done");
            }.bind(this),
            function(err){
                console.error("Distiller: cleanOldSessionCheck Error:", err);
                this.stats.increment("error", "CleanOldSessionCheck");
            }.bind(this)
        );
}

Distiller.prototype.getTelemetryBatch = function(){

    this.queue.getTelemetryBatch()
        // cleanup session
        .then(function(telemData){
            if(telemData.type == aeConst.queue.end) {
                return this.runAssessment(telemData.id)
                            .then( function(){
                                return this.queue.cleanupSession(telemData.id)
                            }.bind(this) );
            } else {
                return this.queue.cleanupSession(telemData.id);
            }
        }.bind(this))

        // catch all ok
        .then( function(){
            //console.log("Distiller: all done");
        }.bind(this))

        // catch all errors
        .then(null, function(err){
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
        .then(function(events){
            // Run distiller function
            var distilledData = this.SD_Function.process(events);
            console.log( "Distilled data: " + distilledData );

            // If the distilled data has no WEKA key, don't save anything
            if( !distilledData || !distilledData.bayesKey ) {
                console.log( "no bayes key found in distilled data" );
                resolve();
                return;
            }

            // save distilled data
            return this.aeDS.saveDistilledData(gameSessionId, distilledData);
        }.bind(this))
        .then(function(distilledData){

            // If the bayes key is empty, there is no WEKA to perform, resolve
            if( !distilledData || !distilledData.bayesKey ) {
                console.log( "no bayes key found in weka data" );
                resolve();
                return;
            }


            // Set the command line string for the WEKA processor
            var commandString = " SimpleBayes " + distilledData.bayesKey;

            // Use the distilled data to get the bayes key and evidence fragments to pass to the WEKA server
            var evidenceFragments = distilledData.fragments;
            for( var i = 0; i < evidenceFragments.length; i++ ) {
                commandString += " " + evidenceFragments[i].value;//evidenceFragments[i].key + "=" + evidenceFragments[i].value;
            }


            // Before we trigger the WEKA process, we need to make sure we set the current working directory
            // and execute the batch file or shell script, depending on the platform
            process.chdir( '../../Assessment/build' );
            var scriptToExecute = 'run_assessment';
            console.log( "Executing bayes on " + process.platform + " at " + process.cwd() );
            if( process.platform === "win32" ) {
                scriptToExecute += '.bat';
            }
            else {
                scriptToExecute += '.sh';
            }
            // Use the distilled data to get the bayes key and evidence fragments to pass to the WEKA process
            child_process.exec( scriptToExecute + commandString,
                function( error, data, stderr ) {
                    console.log( "data: " + data );
                    //console.log( "stderr: " + stderr );
                    if( error !== null ) {
                        console.log( "exec error: " + error );
                        reject( error );
                    } else {
                        // save bayes data
                        this.aeDS.saveBayesOutputData(gameSessionId, data)
                        .then(function(){
                            // successfully ran bayes, done
                            resolve();
                        }.bind(this));
                    }
                }.bind(this)
            );

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
