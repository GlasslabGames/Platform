/**
 * Assessment Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  when       - https://github.com/cujojs/when
 *  express    - https://github.com/visionmedia/express
 *
 */

var http       = require('http');
// Third-party libs
var _          = require('lodash');
var when       = require('when');
var express    = require('express');
// load at runtime
var Util, aConst;
var myDS, cbDS;

module.exports = AssessmentServer;

function AssessmentServer(options){
    try{
        // Glasslab libs
        aConst = require('./assessment.js').Const;
        myDS   = require('./telemetry.js').Datastore.MySQL;
        cbDS   = require('./telemetry.js').Datastore.Couchbase;
        Util   = require('./util.js');

        this.options = _.merge(
            {
                assessment: {
                    port: 8084
                },
                telemetry: {
                    migrateCount: 5000
                }
            },
            options
        );

        this.requestUtil = new Util.Request(this.options);
        this.myds        = new myDS(this.options.telemetry.datastore.mysql);
        this.cbds        = new cbDS(this.options.telemetry.datastore.couchbase);
        this.stats       = new Util.Stats(this.options, "Assessment");

        this.app = express();
        this.app.set('port', this.options.assessment.port);

        this.app.use(Util.GetExpressLogger(this.options, express, this.stats));
        this.app.use(express.urlencoded());
        this.app.use(express.json());
        // If you want to use app.delete and app.put instead of using app.post
        // this.app.use(express.methodOverride());
        this.app.use(express.errorHandler({showStack: true, dumpExceptions: true}));

        this.setupRoutes();

        // start server
        http.createServer(this.app).listen(this.app.get('port'), function(){
            console.log('---------------------------------------------');
            console.log('Assessment: Server listening on port ' + this.app.get('port'));
            console.log('---------------------------------------------');
            this.stats.increment("info", "ServerStarted");
        }.bind(this));

        this.myds.connect()
            // mysql connection ok, connect to couchbase
            .then(function(){
                console.log("Assessment: myDS Connected");
                return this.cbds.connect();
            }.bind(this))

            // couchbase ok
            .then(function(){
                console.log("Assessment: cbDS Connected");
                this.cbds.migrateEventsFromMysql(this.stats, this.myds, this.options.telemetry.migrateCount)
                    .then(function() {
                        console.log("Assessment: Migrate Old DB Events Done!");
                    }.bind(this))
                    // catch all errors
                    .then(null, function(err){
                        // error
                        console.log("Assessment: Migrate Old DB Events Errors!");
                    }.bind(this));
            }.bind(this))

            // catch all errors
            .then(null, function(err){
                console.trace("Assessment: Error -", err);
                this.stats.increment('error', 'DS.Init');
            }.bind(this));

    } catch(err){
        console.trace("Assessment: Error -", err);
        this.stats.increment('error', 'Generic');
    }
}


// ---------------------------------------
// HTTP Server request functions
AssessmentServer.prototype.setupRoutes = function() {
    this.app.get(aConst.api.getEventsByGameSession, this.getEventsByGameSession.bind(this));
};


AssessmentServer.prototype.getEventsByGameSession = function(req, res) {
    if( req.params.id ) {

        this.cbds.getEvents(req.params.id)
        .then(function(result){
            this.stats.increment('info', 'GetEvents.Done');
            this.requestUtil.jsonResponse(res, result);
        }.bind(this))
        // catch all errors
        .then(null, function(err){
            this.stats.increment('error', 'GetEvents');
            this.requestUtil.errorResponse(res, err, 500);
        }.bind(this));

    } else {
        this.stats.increment('error', 'Session.Missing');
        this.requestUtil.errorResponse(res, "missing session", 404);
    }
};
