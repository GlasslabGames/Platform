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
var RequestUtil, aConst;
var myDS, cbDS;

module.exports = AssessmentServer;

function AssessmentServer(options){
    try{
        // Glasslab libs
        RequestUtil = require('./util.js').Request;
        aConst      = require('./assessment.js').Const;
        myDS        = require('./telemetry.js').Datastore.MySQL;
        cbDS        = require('./telemetry.js').Datastore.Couchbase;

        this.options = _.merge(
            {
                assessment: { port: 8084 }
            },
            options
        );

        this.requestUtil = new RequestUtil(this.options);
        //this.ds          = new myDS(this.options.telemetry.datastore.mysql);
        this.ds          = new cbDS(this.options.telemetry.datastore.couchbase);

        this.app   = express();
        this.app.set('port', this.options.assessment.port);
        this.app.use(express.logger());
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

    } catch(err){
        console.trace("AssessmentServer: Error -", err);
    }
}

// ---------------------------------------
// HTTP Server request functions
AssessmentServer.prototype.setupRoutes = function() {
    this.app.get(aConst.api.getEventsByGameSession, this.getEventsByGameSession.bind(this));
};

AssessmentServer.prototype.getEventsByGameSession = function(req, res, next) {
    if( req.params.id ) {

        this.ds.getEvents(req.params.id)
        .then(function(result){
                this.requestUtil.jsonResponse(res, result);
        }.bind(this))
        // catch all errors
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this));


    } else {
        this.requestUtil.errorResponse(res, "missing session");
    }
};

