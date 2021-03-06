/**
 * Request Util Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *
 */
var http       = require('http');
var https      = require('https');
var urlParser  = require('url');
var path       = require('path');
// Third-party libs
var _          = require('lodash');
var when       = require('when');

module.exports = RequestUtil;

function RequestUtil(options, errors){
    this.options = _.merge(
        {
            request: { httpTimeout: 5000 }
        },
        options
    );

    this.errors = errors || {};
}

RequestUtil.prototype.getFullHostUrl = function(req) {
    var protocal = "http://";
    if(req.connection.encrypted) {
        protocal = "https://";
    }

    return protocal + req.headers.host;
};

// add no cache headers to HttpServerResponse
RequestUtil.prototype.noCache = function (res) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate"); // HTTP 1.1.
    res.setHeader("Pragma", "no-cache"); // HTTP 1.0.
    res.setHeader("Expires", "-1"); // Proxies.
};

RequestUtil.prototype.errorResponse = function(res, obj, code){
    // default 400 error code
    if(!code) { code = 400; }

    if(_.isString(obj)) {
        try{
            // is string, try to convert to object
            obj = JSON.parse(obj);
        } catch(err) {
            // this is ok
        }
        obj = { status: "error", error: obj };
    }

    if(_.isObject(obj)) {
        // if has key then try to get error message using key from errors map
        if(obj.key &&
           this.errors.hasOwnProperty(obj.key)) {
           obj.error  = this.errors[obj.key];
           obj.status = "error";
        }

        if(!obj.statusCode) {
            obj.statusCode = code;
        }

        // if object does not contain error, then set error to object
        if(!obj.error) {
            obj = { error: obj };
        }
    }

    this.jsonResponse(res, obj, obj.statusCode);
};

RequestUtil.prototype.downloadResponse = function(res, data, name, type){
    if(!name) { name = "download"; }
    if(!type) { type = "application/force-download"; }

    res.writeHead(200, {
        "Content-Type": type
        ,"Content-Disposition": "attachment; filename=\""+name+"\""
        //,"Content-Length": data.length
    });
    res.end( data );
};

RequestUtil.prototype.textResponse = function(res, data, code, type){
    if(!code) { code = 200; }
    if(!type) { type = "text/plain"; }

    res.writeHead(code, {
        "Content-Type": type
    });
    res.end( data );
};

RequestUtil.prototype.jsonResponse = function(res, obj, code){
    var json = _.isObject(obj) ? JSON.stringify(obj) : obj;
    if(!code) { code = 200; }

    res.writeHead(code, {
        "Content-Type": "application/json"
    });
    res.end( json );
};

RequestUtil.prototype.getRequest = function(url, headers, done){
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
};

RequestUtil.prototype.postRequest = function(url, headers, jdata, done){
    var purl = urlParser.parse(url);
    var data = JSON.stringify(jdata);

    var options = {
        protocol: purl.protocol || "http:",
        hostname: purl.hostname || "localhost",
        port:     purl.port,
        path:     purl.path,
        method:   "POST",
        headers:  headers
    };

    //console.log("getRequest options:", options);
    this.sendRequest(options, data, null, done);
};

/*
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
*/

RequestUtil.prototype.sendRequest = function(options, data, resOut, done){
    var protocolFunc;

    if ( options.protocol === 'https:' ) {
        protocolFunc = https;
    } else {
        protocolFunc = http;
    }

    var sreq = protocolFunc.request(options, function(sres) {
            // handle attachments
            if(  sres.headers['content-disposition'] &&
                (sres.headers['content-disposition'].indexOf('attachment') != -1) ) {
                sres.setEncoding('binary');
            }

            //console.log("sendRequest statusCode:", sres.statusCode, ", headers:",  sres.headers);
            if(resOut) {
                // remove set cookie, but send rest
                delete sres.headers['set-cookie'];
                resOut.writeHead(sres.statusCode, sres.headers);
            }

            var data = "";
            sres.on('data', function(chunk){
                data += chunk;
                if(resOut) resOut.write(chunk);
            });

            sres.on('end', function(){
                if(resOut) resOut.end();
                // call done function if exist
                if(done) done(null, sres, data);
            });
        });

        sreq.on("error", function(err) {
            console.errorExt("Util", "sendRequest Error -", err.message);
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
                if(resOut) {
                    resOut.writeHead(500);
                    resOut.end();
                }
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


// promisify request
RequestUtil.prototype.request = function(url, data, rmethod, headers) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        // default headers to empty object
        if(!headers) {
            headers = {};
        }

        // default get
        var method = "get";

        // if data then post
        if(data) {
            method = "post";
        }
        // if type set then use it
        if(rmethod) {
            method = rmethod;
        }

        if (_.isObject(data)) {
            // if object convert to string
            data = JSON.stringify(data);
            headers = {
                "Content-Type": "application/json"
            }
        }

        var callback = function (err, res, rdata) {
            if (err) {
                reject(err);
                return;
            }

            if (res.statusCode != 200) {
                reject(rdata);
            } else {
                try {
                    var jdata = JSON.parse(rdata);
                    resolve(jdata);
                } catch (err) {
                    // invalid JSON
                    reject(err);
                }
            }
        }.bind(this);

        var purl = urlParser.parse(url);
        var options = {
            protocol: purl.protocol || "http:",
            hostname: purl.hostname || "localhost",
            port:     purl.port,
            path:     purl.path,
            method:   method,
            headers:  headers
        };

        this.sendRequest(options, data, null, callback);
// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};