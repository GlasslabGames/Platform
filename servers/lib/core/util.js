/**
 * Util Module
 *
 * Module dependencies:
 *   when - https://github.com/cujojs/when
 *
 */
var url    = require('url');
var moment = require('moment');
var when   = require('when');
var _      = require('lodash');
var uuid   = require('node-uuid');
var fs     = require('fs');
var morgan = require('morgan');

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

function convertToString(item) {
    if(!item) {
        item = "";
    }
    else if(!_.isString(item)) {
        item = item.toString();
    }
    return item;
}

function promiseContinue(val){
    return when.promise( function(resolve){
        resolve(val);
    });
}

function promiseError(err){
    return when.promise( function(resolve, reject){
        reject(err);
    });
}

function createUUID() {
    return uuid.v1();
}

// build valid URI/URL
function buildUri(options, path) {
    var uri = "";

    if(options.protocol) {
        uri += options.protocol+"//";
    } else {
        uri += "http://";
    }

    if(options.host) {
        uri += options.host;
    } else {
        uri += "localhost";
    }

    if(options.port) {
        uri += ":"+options.port;
    }

    if(path && _.isString(path)) {
        // make sure first char is a slash
        if(path.charAt(0) != '/') {
            uri += "/";
        }
        uri += path;
    }

    return uri;
}

// seconds from Unix Epoch
function getTimeStamp(dt){
    if(!dt) {
        dt = moment.utc();
    } else if (dt instanceof Date) {
        dt = moment.utc(dt);
    }

    return dt.valueOf();
}

// if time less then 10000000000 then return time in milliseconds, otherwise time is ok
function checkTimeStamp(time) {
    return (time < 10000000000) ? time * 1000 : time;
}

function dateString(){      // ISO 8601, local time
    var dGMT = new Date();
    var tzo = dGMT.getTimezoneOffset()*1000*60;
    var dLoc = new Date(dGMT.getTime()-tzo);
    return dLoc.toISOString().substring(0,19).replace(/T/," ");
}

function dateGmtString(){      // ISO 8601, GMT
    return new Date().toISOString().substring(0,19).replace(/T/," ").concat(" GMT");
}

function getMorganLogger(options, stats){
    morgan.token('remote-addy', function(req, res){
        if( req.headers.hasOwnProperty('x-forwarded-for') ){
            return req.headers['x-forwarded-for'];
        } else {
            return req.connection.remoteAddress;
        }
    });

    return morgan(function(t, req, res){
        var rTime = t['response-time'](req, res);
        var contentLength = t['res'](req, res, 'content-length');
        var status = t['status'](req, res);
        var URL = t['url'](req, res);

        if(stats) {
            var pathname = url.parse(URL).pathname;
            // remove initial slash if it exists
            if(pathname.charAt(0) == '/') {
                pathname = pathname.slice(1);
            }
            // replace all double slashes with single
            pathname = pathname.replace(/\/\//g, '/');

            // create list delimitated by slashes so we can detect root and api
            var ulist = pathname.split('/');
            // capitalize each key
            if(ulist.length > 0) {
                // merge to dots
                pathname = ulist.join('.');
            } else {
                pathname = "_root";
            }

            stats.gauge("info", "Route.ResponseTime."+pathname, rTime);

            if(ulist.length > 0 &&
                ulist[0] == 'api') {
                stats.gauge("info", "Route.Api.ResponseTime", rTime);
            } else {
                stats.gauge("info", "Route.Static.ResponseTime", rTime);
            }

            stats.saveRoot();
            if(ulist.length > 0 &&
                ulist[0] == 'api') {
                stats.setRoot('Route.Api');
            } else {
                // static
                stats.setRoot('Route.Static');
            }
            stats.gauge("info", "ResponseTime", rTime);
            stats.restoreRoot();
        }

        // status is null
        if(!status) {
            console.warnExt("Util", "Error null status for response!!!");
            status = "";
        }

        // method type "OPTIONS" is a preflighted request with the introduction of cors
        // they usually return 204 which means no data is sent back, but is approves the incoming POST request
        var method = t['method'](req, res);
        if( method && method == "OPTIONS" ) {
            return method+' '+URL+' '+status;
        }

        return t['remote-addy'](req, res)+' - - ['+
            t['date'](req, res)+'] "'+
            method+' '+
            URL+' HTTP/'+
            t['http-version'](req, res)+'" '+
            status+' '+
            (contentLength || '-')+' "'+
            (t['referrer'](req, res) || '-')+'" "'+
            (t['user-agent'](req, res) || '-')+'" ('+
            rTime+' ms)';
    });

    /*
     var logFormat = ':remote-addy - - [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" (:response-time ms)';
     return morgan(logFormat);
     */
}

// http://stackoverflow.com/questions/19178782/how-to-reshape-an-array-with-lodash
// In:  array = [1, 2, 3, 4, 5, 6, ,7, 8], n = 3
// Out: [[1, 2, 3], [4, 5, 6], [7, 8]]
function reshape(array, n){
    return _.compact(array.map(function(el, i){
        if (i % n === 0) {
            return array.slice(i, i + n);
        }
    }));
}

module.exports = {
    Request:            require('./util.request.js'),
    Stats:              require('./util.stats.js'),
    Email:              require('./util.email.js'),
    S3Util:             require('./util.s3.js'),
    StripeUtil:         require('./util.stripe.js'),
    LogUtil:            require('./util.log.js'),

    ConvertToString:    convertToString,
    PromiseContinue:    promiseContinue,
    PromiseError:       promiseError,
    GetMorganLogger:    getMorganLogger,
    GetTimeStamp:       getTimeStamp,
    CheckTimeStamp:     checkTimeStamp,
    DateString:         dateString,
    DateGMTString:      dateGmtString,
    BuildURI:           buildUri,
    CreateUUID:         createUUID,
    String: {
        capitalize:     capitalize
    },
    Reshape:            reshape,
    writeToCSV:         writeToCSV,
    updateSession:      updateSession
};

// writes data to a chosen file
function writeToCSV(data, file){
    var copiedData = [].concat( data );
    return when.promise(function(resolve, reject){
        fs.appendFile(file, copiedData, function(err){
            if(err){
                return reject(err);
            }
            resolve()
        }.bind(this))
    }.bind(this));
}

function updateSession(req){
    return when.promise(function(resolve, reject){
        try{
            req.session.save(function(){
                resolve()
            });
        } catch(err){
            console.errorExt("Util", "Session Reload Error -",err);
            reject(err);
        }
    }.bind(this));
}