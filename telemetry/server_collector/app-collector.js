
/**
 * Module dependencies.
 *
 * redis - https://github.com/mranney/node_redis
 *
 */
var env     = "dev";

var express    = require('express');
var http       = require('http');
var urlParser  = require('url');
var request    = require('request');
var multiparty = require('multiparty');

var tCollector = require('./tcollector.js');
var settings   = require('../server_config.json');

var col = new tCollector(settings);
var app = express();

// all environments
app.set('port', process.env.PORT || 8081);
app.use(express.logger( env ));
app.use(express.urlencoded());
app.use(express.json());
app.use(express.methodOverride());

var webAppUrl = settings.webapp.protocal+"://"+settings.webapp.host+":"+settings.webapp.port;

// development only
if (env = 'dev') {
    app.use(express.errorHandler());
}

// ---------------------------------------
//
app.post('/api/:type/startsession', function(req, res){
    //console.log("req.params:", req.params, ", req.body:", req.body);

    // forward to webapp server
    var url = webAppUrl+"/api/"+req.params.type+"/startsession";

    postData(url, req.body, res, function(body){
        body = JSON.parse(body);
        // add start session to Q
        col.start(body.gameSessionId);
    });
});

app.post('/api/:type/sendtelemetrybatch', function(req, res){

    if(req.params.type == "game") {
        var form = new multiparty.Form();
        form.parse(req, function(err, fields) {
            if(fields.events)        fields.events        = fields.events[0];
            if(fields.gameSessionId) fields.gameSessionId = fields.gameSessionId[0];
            if(fields.gameVersion)   fields.gameVersion   = fields.gameVersion[0];

            //console.log("fields:", fields);
            col.batch(fields.gameSessionId, fields);
        });
    } else {
        //console.log("send telemetry batch body:", req.body);
        // Queue Data
        col.batch(req.body.gameSessionId, req.body);
    }

    res.send();
});

app.post('/api/:type/endsession', function(req, res){
    //console.log("req.params:", req.params, ", req.body:", req.body);

    function endSession(req, res, jdata){
        // forward to webapp server
        var url = webAppUrl+"/api/"+req.params.type+"/endsession";

        postData(url, jdata, res, function(body){
            body = JSON.parse(body);
            // add end session to Q
            col.end(body.gameSessionId);
        });
    }

    if(req.params.type == "game") {
        var form = new multiparty.Form();
        form.parse(req, function(err, fields) {
            if(fields.events)        fields.events        = fields.events[0];
            if(fields.gameSessionId) fields.gameSessionId = fields.gameSessionId[0];
            if(fields.gameVersion)   fields.gameVersion   = fields.gameVersion[0];

            //console.log("fields:", fields);
            endSession(req, res, fields);
        });
    } else {
        //console.log("end session body:", req.body);
        endSession(req, res, req.body);
    }
});
// ---------------------------------------

process.on('uncaughtException', function(err) {
    console.trace("Collector Uncaught Error:", err);
});

function postData(url, jdata, outRes, cb){
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
        console.error("url:", url, ", Error:", err);
        outRes.status(500).send('Error:'+err);
    });

    req.write(data);
    req.end();
}


http.createServer(app).listen(app.get('port'), function(){
    console.log('Express server listening on port ' + app.get('port'));
});
