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
// Glasslab libs
var tConst     = require('./telemetry.const.js');
var rConst     = require('./routes.const.js');

function Collector(options){
    try{

        this.options = _.merge(
            {
                queue:     { port: null, host: null, db:0 },
                settings:  { protocal: 'http', host: 'localhost', port: 8082},
                collector: { port: 8081 }
            },
            options
        );

        this.app   = express();
        this.queue = redis.createClient(this.options.queue.port, this.options.queue.host, this.options.queue);
        if(this.options.queue.db) {
            this.queue.select(this.options.queue.db);
        }

        this.webAppUrl = this.options.auth.protocal+"://"+this.options.auth.host+":"+this.options.auth.port;

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
        //console.log("req.params:", req.params, ", req.body:", req.body);

        // forward to webapp server
        var url = this.webAppUrl + tConst.webapp.api +"/"+req.params.type + tConst.webapp.startsession;

        this.postData(url, req.body, outRes, function(body){
            body = JSON.parse(body);
            // add start session to Q
            this.qStartSession(body.gameSessionId);
        }.bind(this));
    } catch(err) {
        console.trace("Collector: Start Session Error -", err);
    }
};

Collector.prototype.sendBatchTelemetry = function(req, outRes){
    try {
        if(req.params.type == "game") {
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

        var done = function(req, outRes, jdata){
            // forward to webapp server
            var url = this.webAppUrl + tConst.webapp.api +"/"+req.params.type + tConst.webapp.endsession;

            this.postData(url, jdata, outRes, function(){
                // add end session to Q
                this.qEndSession(jdata.gameSessionId);
            }.bind(this));
        }.bind(this);

        if(req.params.type == "game") {
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

Collector.prototype.postData = function(url, jdata, outRes, cb){
    var purl = urlParser.parse(url);
    var data = JSON.stringify(jdata);

    var options = {
        host: purl.hostname,
        port: purl.port,
        path: purl.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    // TODO: PLAT-2 (Add http request timeout on start/end session)
    // http://stackoverflow.com/questions/6214902/how-to-set-a-timeout-on-a-http-request-in-node
    // http://nodejs.org/api/net.html#net_socket_settimeout_timeout_callback

    var req = http.request(options, function(res) {
        res.setEncoding('utf8');

        var body = "";
        res.on('data', function (chunk) {
            body += chunk;
        });

        res.on('end', function () {
            cb(body);

            outRes.writeHead(200, {
                'Content-Type':   'application/json',
                'Content-Length': Buffer.byteLength(body)
            });
            outRes.end(body);
        });
    });

    req.on("error", function(err){
        console.trace("Collector: postData Error -", err);
    });

    req.write(data);
    req.end();
}
// ---------------------------------------


// ---------------------------------------
// Queue function
Collector.prototype.qStartSession = function(id) {
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
        }
    );
}

Collector.prototype.qSendBatch = function(id, data) {
    var batchInKey = tConst.batchKey+":"+id+":"+tConst.inKey;

    // if object convert data to string
    if(_.isObject(data)) {
        data = JSON.stringify(data);
    }

    this.queue.lpush(batchInKey, data, function(err){
        if(err) {
            console.error("Collector: Batch Error -", err);
        }
    });
}

Collector.prototype.qEndSession = function(id) {
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
        }
    );
}
// ---------------------------------------

module.exports = Collector;
