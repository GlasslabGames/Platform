/**
 * Request Util Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *
 */
var http       = require('http');
var urlParser  = require('url');
var path       = require('path');
// Third-party libs
var _          = require('lodash');

module.exports = RequestUtil;

function RequestUtil(options){
    this.options = _.merge(
        {
            request: { httpTimeout: 5000 }
        },
        options
    );
}

RequestUtil.prototype.errorResponse = function(res, errorStr){
    var error = JSON.stringify({ error: errorStr });
    res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": error.length
    });
    res.end( error );
};

RequestUtil.prototype.jsonResponse = function(res, obj){
    var json = JSON.stringify(obj);
    res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": json.length
    });
    res.end( json );
};

RequestUtil.prototype.getRequest = function(url, headers, req, done){
    var purl = urlParser.parse(url);

    var options = {
        protocol: purl.protocol,
        hostname: purl.hostname,
        port:     purl.port,
        path:     purl.path,
        method:   "GET",
        headers:  headers
    };

    //console.log("getRequest options:", options);
    this.sendRequest(options, null, null, done);
}

RequestUtil.prototype.postRequest = function(url, headers, jdata, req, done){
    var purl = urlParser.parse(url);
    var data = JSON.stringify(jdata);

    var options = {
        protocol: purl.protocol,
        hostname: purl.hostname,
        port:     purl.port,
        path:     purl.path,
        method:   "POST",
        headers:  headers
    };

    console.log("getRequest options:", options);
    this.sendRequest(options, data, null, done);
};

RequestUtil.prototype.forwardPostRequest = function(url, jdata, resOut, done){
    var purl = urlParser.parse(url);
    var data = JSON.stringify(jdata);

    var options = {
        protocol: purl.protocol,
        hostname: purl.hostname,
        port:     purl.port,
        path:     purl.path,
        method:   "POST",
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    this.sendRequest(options, data, resOut, done);
};

RequestUtil.prototype.forwardRequestToWebApp = function(opts, req, resOut, done, auth){
    var options = _.merge(
        {
            protocol: this.options.webapp.protocol || "http:",
            host:     this.options.webapp.host,
            port:     this.options.webapp.port,
            path:     req.originalUrl,
            method:   req.method,
            headers: _.cloneDeep(req.headers)
        },
        opts
    );

    // if user, override cookie otherwise no cookie
    if(options.cookie) {
        options.headers.cookie = options.cookie;
        delete options.cookie;
    } else {
        delete options.headers.cookie;
    }

    // remove unnecessary headers
    delete options.headers['user-agent'];
    delete options.headers['origin'];
    delete options.headers['accept-encoding'];
    delete options.headers['content-length'];
    delete options.headers['referer'];

    var data = "";
    if(req.body && req.method == "POST") {
        data = JSON.stringify(req.body);
    }

    //console.log("forwardRequest options:", options);
    //console.log("forwardRequest data:", data);

    this.sendRequest(options, data, resOut, done);
};

RequestUtil.prototype.sendRequest = function(options, data, resOut, done){

    var sreq = http.request(options, function(sres) {
        if(resOut) {
            // remove set cookie, but send rest
            delete sres.headers['set-cookie'];

            resOut.writeHead(sres.statusCode, sres.headers);

            var data = "";
            sres.on('data', function(chunk){
                data += chunk;
                resOut.write(chunk);
            });

            sres.on('end', function(){
                resOut.end();
                // call done function if exist
                if(done) done(null, data);
            });
        } else {
            //console.log("sendRequest statusCode:", sres.statusCode, ", headers:",  sres.headers);

            var data = "";
            sres.on('data', function(chunk){
                data += chunk;
            });

            sres.on('end', function(){
                if(done) done(null, sres, data);
            });
        }
    });

    sreq.on("error", function(err) {
        console.error("Auth: sendRequest Error -", err.message);
        if(resOut) {
            resOut.writeHead(500);
            resOut.end();
        }

        if(done) done(err);
    });

    // request timeout
    sreq.on('socket', function(socket) {
        socket.setTimeout(this.options.request.httpTimeout);
        socket.on('timeout', function() {
            sreq.abort();
        });
    }.bind(this));

    if(data) {
        if(_.isObject(data)) {
            // convert data to string
            data = JSON.stringify(data);
        }

        if(data.length > 0) {
            sreq.write( data );
        }
    }

    sreq.end();
};
