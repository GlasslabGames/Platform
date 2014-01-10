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
var tConst;

module.exports = Dispatcher;

function Dispatcher(options){
    var RequestUtil, cbDS;
    var Telem = require('./telemetry.js');

    tConst      = Telem.Const;
    cbDS        = Telem.Datastore.Couchbase;
    RequestUtil = require('./util.js').Request;

    this.options = _.merge(
        {
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
    this.queue         = new Telem.Queue.Redis(this.options);
    this.cbds          = new cbDS(this.options.telemetry.datastore.couchbase);

    this.webAppUrl     = this.options.webapp.protocol+"//"+this.options.webapp.host+":"+this.options.webapp.port;
    this.assessmentUrl = this.webAppUrl+"/api/game/assessment/";

    this.cbds.connect()
        .then(function(){
            console.log("Dispatcher: DS Connected");
        }.bind(this),
        function(err){
            console.trace("Dispatcher: DS Error -", err);
        }.bind(this));

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
    this.queue.getInCount()
        .then(
            function(count){
                if(count > 0) {
                    console.log("Dispatcher: telemetryCheck count:", count);

                    for(var i = 0; i < Math.min(count, this.options.dispatcher.telemetryGetMax); i++){
                        this.getTelemetryBatch();
                    }
                }
            }.bind(this),
            function(err){
                console.log("Dispatcher: telemetryCheck Error:", err);
            }.bind(this)

        );
}


Dispatcher.prototype.startCleanOldSessionPoll = function(){
    // fetch telemetry loop
    setInterval(function() {
        this.cleanOldSessionCheck();
    }.bind(this), this.options.dispatcher.cleanupPollDelay);
}

Dispatcher.prototype.cleanOldSessionCheck = function(){
    this.queue.cleanOldSessionCheck()
        .then(
            function(){
                console.error("Dispatcher: cleanOldSessionCheck done");
            }.bind(this),
            function(err){
                console.error("Dispatcher: cleanOldSessionCheck Error:", err);
            }.bind(this)
        );
}

Dispatcher.prototype.getTelemetryBatch = function(){

    this.queue.getTelemetryBatch()
        // cleanup session
        .then(function(telemData){
            if(telemData.type == tConst.end) {
                return this.executeAssessment(telemData.id)
                            .then( function(){
                                return this.queue.cleanupSession(telemData.id)
                            }.bind(this) );
            } else {
                return this.queue.cleanupSession(telemData.id);
            }
        }.bind(this))

        // catch all ok
        .then( function(){
            //console.log("Dispatcher: all done");
        }.bind(this))

        // catch all errors
        .then(null, function(err){
            console.error("Dispatcher: endBatchIn - Error:", err);
        }.bind(this));
}

Dispatcher.prototype.executeAssessment = function(gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    if(this.options.env == "dev") {
        console.log("Dispatcher: Execute Assessment Delay - gameSessionId:", gameSessionId);
    }

    // wait some time before start assessment
    setTimeout(function(){
        var url = this.assessmentUrl + gameSessionId;
        this.requestUtil.getRequest(url, null, function(err, res) {
            if(err) {
                console.error("url:", url, ", Error:", err);
                res.status(500).send('Error:'+err);
                reject(err);
                return;
            }

            if(this.options.env == "dev") {
                console.log("Dispatcher: Started Assessment - gameSessionId:", gameSessionId);
            }
            resolve();
        }.bind(this));

    }.bind(this), this.options.dispatcher.assessmentDelay);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
}
