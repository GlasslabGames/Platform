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
var parallel   = require('when/parallel');
var express    = require('express');
// load at runtime
var Util, aConst;
var myDS, cbDS;

module.exports = AssessmentServer;

function AssessmentServer(options){
    try{
        // Glasslab libs
        aConst      = require('./assessment.js').Const;
        myDS        = require('./telemetry.js').Datastore.MySQL;
        cbDS        = require('./telemetry.js').Datastore.Couchbase;
        Util        = require('./util.js');

        this.options = _.merge(
            {
                assessment: { port: 8084 }
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
        }.bind(this));

        this.myds.connect()
            // mysql connection ok, connect to couchbase
            .then(function(){
                return this.cbds.connect();
            }.bind(this))

            // couchbase ok
            .then(function(){
                console.log("Assessment: DS Connected");

                this.migrateOldDBEvents();
            }.bind(this))

            // catch all errors
            .then(null, function(err){
                this.stats.increment('error', 'DS.Init');
                console.trace("Assessment: Error -", err);
            }.bind(this));

    } catch(err){
        this.stats.increment('error', 'Generic');
        console.trace("Assessment: Error -", err);
    }
}


// ---------------------------------------
// HTTP Server request functions
AssessmentServer.prototype.setupRoutes = function() {
    this.app.get(aConst.api.getEventsByGameSession, this.getEventsByGameSession.bind(this));
};


AssessmentServer.prototype.getEventsByGameSession = function(req, res, next) {
    if( req.params.id ) {

        this.cbds.getEvents(req.params.id)
        .then(function(result){
            this.stats.increment('info', 'GetEvents.Done');
            this.requestUtil.jsonResponse(res, result);
        }.bind(this))
        // catch all errors
        .then(null, function(err){
            this.stats.increment('error', 'GetEvents');
            this.requestUtil.errorResponse(res, err);
        }.bind(this));

    } else {
        this.stats.increment('error', 'Session.Missing');
        this.requestUtil.errorResponse(res, "missing session");
    }
};


AssessmentServer.prototype.migrateOldDBEvents = function() {

    this.myds.getAllEvents()
        .then(function(ell){
            //console.log("ell:", ell);

            if(ell) {
                // move the next process of this stack and onto the event list
                setTimeout(function(){
                    ell.forEach(function(gSession){
                        //console.log("gSession:", gSession);

                        this.stats.gauge('info',     'MigrateEvents', gSession.events.length);
                        this.stats.increment('info', 'Events', gSession.events.length);

                        this.cbds.saveEvents(gSession)
                            // saveEvents, ok
                            .then(function(){
                                this.stats.increment('info', 'Couchbase.SaveEvents.Done');
                                return this.myds.removeArchiveEvents(gSession.gameSessionId);
                            }.bind(this),
                                // saveEvents error
                                function(err){
                                    this.stats.increment('error', 'MigrateEvents.Couchbase.SaveEvents');
                                    console.error("Assessment: Couchbase Error: could not save events, err:", err);
                                }.bind(this))

                            // removeArchiveEvents, ok
                            .then(function(){
                                console.log("Events migrated, events count:", gSession.events.length);
                                this.stats.increment('info', 'MigrateEvents.MySQL.RemoveEvents.Done');
                            }.bind(this),
                                // removeArchiveEvents, error
                                function(){
                                    this.stats.increment('error', 'MigrateEvents.MySQL.RemoveEvents');
                                    console.error("Assessment: MySQL Error: could not remove events");
                                }.bind(this));
                    }.bind(this));
                }.bind(this), 100);
            }

        }.bind(this))
        // catch all errors
        .then(null, function(err){
            this.stats.increment('error', 'MySQL.ArchivedActivityEvents');
            console.error("Assessment: Error getting archived activity events, err:", err);
        }.bind(this));

};