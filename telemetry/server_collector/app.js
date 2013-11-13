
/**
 * Module dependencies.
 *
 * redis - https://github.com/mranney/node_redis
 *
 */
var env     = "dev";

var express    = require('express');
var http       = require('http');
var request    = require('request');
var multiparty = require('multiparty')
var tCollector = require('./tcollector.js');


var col = new tCollector();
var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.use(express.logger( env ));
app.use(express.urlencoded());
app.use(express.json());
app.use(express.methodOverride());

var webAppServer = "http://localhost:8080"

// development only
if (env = 'dev') {
    app.use(express.errorHandler());
}

// ---------------------------------------
//
app.post('/api/:type/startsession', function(req, res){
    //console.log("req.params:", req.params, ", req.body:", req.body);

    // forward to webapp server
    request.post(webAppServer+"/api/"+req.params.type+"/startsession", function (err, postRes, body) {
        if(err) {
            res.status(500).send('Error:'+err);
            return;
        }

        // send response back
        res.send( body );

        body = JSON.parse(body);
        //console.log("body:", body);

        // add start session to Q
        col.start(body.gameSessionId);
    })
    .form(req.body);
});

app.post('/api/:type/sendtelemetrybatch', function(req, res){

    if(req.params.type == "game") {
        var form = new multiparty.Form();
        form.parse(req, function(err, fields) {
            fields.events        = fields.events[0];
            fields.gameSessionId = fields.gameSessionId[0];
            fields.gameVersion   = fields.gameVersion[0];

            //console.log("fields:", fields);
            col.batch(fields.gameSessionId, fields);
        });
    } else {
        // Queue Data
        col.batch(req.body.gameSessionId, req.body);
    }

    res.send();
});

app.post('/api/:type/endsession', function(req, res){
    //console.log("req.params:", req.params, ", req.body:", req.body);

    // forward to webapp server
    request.post(webAppServer+"/api/"+req.params.type+"/endsession", function (err, postRes, body) {
        if(err) {
            res.status(500).send('Error:'+err);
            return;
        }

        // send resonse back
        res.send( body );

        // add end session to Q
        col.end(req.body.gameSessionId);
    })
    .form(req.body);
});
// ---------------------------------------

/*
app.get('/api/telemetry/start/:id', function(req, res){
    col.start(req.params.id);
    res.send();
});

var id = 0;
app.get('/api/telemetry/batch/:id', function(req, res){
    id++;

    var data = JSON.stringify({"blah": "test-"+id });
    col.batch(req.params.id, data);

    res.send();
});

app.get('/api/telemetry/end/:id', function(req, res){
    col.end(req.params.id);
    res.send();
});
*/

http.createServer(app).listen(app.get('port'), function(){
    console.log('Express server listening on port ' + app.get('port'));
});
