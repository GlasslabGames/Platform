/**
 * Telemetry Collector Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  express    - https://github.com/visionmedia/express
 *  multiparty - https://github.com/superjoe30/node-multiparty
 *  redis      - https://github.com/mranney/node_redis
 *
 */

var urlParser  = require('url');
var http       = require('http');
// Third-party libs
var _          = require('lodash');
var express    = require('express');
var multiparty = require('multiparty');
var redis      = require('redis');
// load at runtime
var RequestUtil, tConst, rConst;

module.exports = Collector;

function Collector(options){
    try{
        // Glasslab libs
        RequestUtil = require('./util.js').Request;
        aConst      = require('./auth.js').Const;
        tConst      = require('./telemetry.js').Const;
        rConst      = require('./routes.js').Const;

        this.options = _.merge(
            {
                queue:     { port: null, host: null, db:0 },
                settings:  { protocol: 'http', host: 'localhost', port: 8082},
                collector: { port: 8081 }
            },
            options
        );

        this.requestUtil = new RequestUtil(this.options);

        this.app   = express();
        this.queue = redis.createClient(this.options.queue.port, this.options.queue.host, this.options.queue);
        if(this.options.queue.db) {
            this.queue.select(this.options.queue.db);
        }

        this.webAppUrl = this.options.auth.protocol+"//"+this.options.auth.host+":"+this.options.auth.port;

        this.app.set('port', this.options.collector.port);
        this.app.use(express.logger());
        this.app.use(express.urlencoded());
        this.app.use(express.json());
        // If you want to use app.delete and app.put instead of using app.post
        // this.app.use(express.methodOverride());
        this.app.use(express.errorHandler({showStack: true, dumpExceptions: true}));

        this.setupRoutes();

        // start server
        http.createServer(this.app).listen(this.app.get('port'), function(){
            console.log('Collector: Server listening on port ' + this.app.get('port'));
        }.bind(this));

    } catch(err){
        console.trace("Collector: Error -", err);
    }
}

// ---------------------------------------
// HTTP Server request functions
Collector.prototype.setupRoutes = function() {
    this.app.post(rConst.api.startsession,       this.startSession.bind(this));
    this.app.post(rConst.api.sendtelemetrybatch, this.sendBatchTelemetry.bind(this));
    this.app.post(rConst.api.endsession,         this.endSession.bind(this));
}

Collector.prototype.startSession = function(req, outRes){
    try {
        var headers = { cookie: "" };
        var url = "http://localhost:" +this.options.validate.port + tConst.validate.api.session;
        //console.log("req.params:", req.params, ", req.body:", req.body);

        if(req.params.type == tConst.type.game) {
            url += "/"+req.body.userSessionId;
            delete req.body.userSessionId;
        } else {
            url += "/-";
            headers.cookie = req.headers.cookie;
        }

        //console.log("req:", req);
        //console.log("headers:", headers);
        //console.log("getSession url:", url);
        this.requestUtil.getRequest(url, headers, req, function(err, res, data){
            if(err) {
                console.log("Collector startSession Error:", err);
                return;
            }

            //console.log("statusCode:", res.statusCode, ", headers:",  res.headers);
            //console.log("data:", data);

            try {
                data = JSON.parse(data);
            } catch(err) {
                console.log("Collector startSession JSON parse Error:", err);
                return;
            }

            //console.log("req.params:", req.params, ", req.body:", req.body);

            // forward to webapp server
            this.requestUtil.forwardRequestToWebApp({
                    cookie: aConst.sessionCookieName+"="+data[aConst.webappSessionPrefix]
                },
                req,
                outRes,
                function(err, res, body){
                    if(err){
                        console.error("Collector: Error -", err);
                        return;
                    }

                    try{
                        body = JSON.parse(body);
                    } catch(err) {
                        console.error("Collector: JSON parse Error -", err);
                        //console.error("Collector: JSON data -", body);
                        return;
                    }

                    //console.log("Collector: JSON data:", body);

                    // add start session to Q
                    this.qStartSession(body.gameSessionId);
                }.bind(this)
            );
        }.bind(this) );

    } catch(err) {
        console.trace("Collector: Start Session Error -", err);
    }
};

Collector.prototype.sendBatchTelemetry = function(req, outRes){
    try {
        if(req.params.type == tConst.type.game) {
            var form = new multiparty.Form();
            form.parse(req, function(err, fields) {
                if(err){
                    console.error("Collector: Error -", err);
                    outRes.status(500).send('Error:'+err);
                    return;
                }

                if(fields){
                    if(fields.events)        fields.events        = fields.events[0];
                    if(fields.gameSessionId) fields.gameSessionId = fields.gameSessionId[0];
                    if(fields.gameVersion)   fields.gameVersion   = fields.gameVersion[0];

                    //console.log("fields:", fields);
                    this.qSendBatch(fields.gameSessionId, fields);
                }

                outRes.send();
            }.bind(this));
        } else {
            //console.log("send telemetry batch body:", req.body);
            // Queue Data
            this.qSendBatch(req.body.gameSessionId, req.body);

            outRes.send();
        }
    } catch(err) {
        console.trace("Collector: Send Telemetry Batch Error -", err);
    }
};

Collector.prototype.endSession = function(req, outRes){
    try {
        //console.log("req.params:", req.params, ", req.body:", req.body);

        var done = function(req, outRes, jdata) {
            // forward to webapp server
            if(jdata.gameSessionId) {
                // save events
                this.qSendBatch(jdata.gameSessionId, jdata, function sendBatchdone(){
                    req.body = jdata;
                    this.requestUtil.forwardRequestToWebApp({}, req, outRes, function forwardRequestDone(){
                        // add end session to Q
                        this.qEndSession(jdata.gameSessionId);
                    }.bind(this));
                }.bind(this));
            } else {
                var err = "gameSessionId missing!";
                console.error("Error:", err);
                outRes.status(500).send('Error:'+err);
            }
        }.bind(this);

        if(req.params.type == tConst.type.game) {
            var form = new multiparty.Form();
            form.parse(req, function(err, fields) {
                if(err){
                    console.error("Error:", err);
                    outRes.status(500).send('Error:'+err);
                    return;
                }

                if(fields){
                    if(fields.events)        fields.events        = fields.events[0];
                    if(fields.gameSessionId) fields.gameSessionId = fields.gameSessionId[0];
                    if(fields.gameVersion)   fields.gameVersion   = fields.gameVersion[0];

                    //console.log("fields:", fields);
                    done(req, outRes, fields);
                }
            });
        } else {
            //console.log("end session body:", req.body);
            done(req, outRes, req.body);
        }
    } catch(err) {
        console.trace("Collector: End Session Error -", err);
    }
};

// ---------------------------------------


// ---------------------------------------
// Queue function
Collector.prototype.qStartSession = function(id, done) {
    var telemetryInKey = tConst.telemetryKey+":"+tConst.inKey;

    this.queue.lpush(telemetryInKey,
        JSON.stringify({
            id: id,
            type: tConst.start
        }),
        function(err){
            if(err) {
                console.error("Collector: Start Error-", err);
            }

            // done callback
            if(done) done();
        }
    );
}

Collector.prototype.qSendBatch = function(id, data, done) {
    var batchInKey = tConst.batchKey+":"+id+":"+tConst.inKey;

    // if object convert data to string
    if(_.isObject(data)) {
        data = JSON.stringify(data);
    }

    this.queue.lpush(batchInKey, data, function(err){
        if(err) {
            console.error("Collector: Batch Error -", err);
        }

        // done callback
        if(done) done();
    });
}

Collector.prototype.qEndSession = function(id, done) {
    var telemetryInKey = tConst.telemetryKey+":"+tConst.inKey;

    this.queue.lpush(telemetryInKey,
        JSON.stringify({
            id: id,
            type: tConst.end
        }),
        function(err){
            if(err) {
                console.error("Collector: End Error -", err);
            }

            // done callback
            if(done) done();
        }
    );
}
// ---------------------------------------
