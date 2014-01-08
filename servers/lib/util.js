/**
 * Util Module
 *
 * Module dependencies:
 *   when        - https://github.com/cujojs/when
 *   node-statsd - https://github.com/sivy/node-statsd
 *
 */
var when   = require('when');

function promiseContinue(){
    return when.promise( function(resolve){
        resolve();
    });
}

function getExpressLogger(options, express, stats){
    express.logger.token('remote-addy', function(req, res){
        if( req.headers.hasOwnProperty('x-forwarded-for') ){
            return req.headers['x-forwarded-for'];
        }
        else if( req.headers.hasOwnProperty('remote-addr') ){
            return req.headers['remote-addr'];
        }
    });

    return express.logger(function(t, req, res){
        var rTime = t['response-time'](req, res);
        var contentLength = t['res'](req, res, 'content-length');

        if(stats) {
            stats.gauge("info", "Response.Time", rTime);
        }

        return t['remote-addy'](req, res)+' - - ['+
            t['date'](req, res)+'] "'+
            t['method'](req, res)+' '+
            t['url'](req, res)+' HTTP/'+
            t['http-version'](req, res)+'" '+
            t['status'](req, res)+' '+
            (contentLength || '-')+' "'+
            (t['referrer'](req, res) || '-')+'" "'+
            (t['user-agent'](req, res) || '-')+'" ('+
            rTime+' ms)';
    });

    /*
    var logFormat = ':remote-addy - - [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" (:response-time ms)';
    return express.logger(logFormat);
    */
}

module.exports = {
    Request: require('./util.request.js'),
    Stats:   require('./util.stats.js'),
    PromiseContinue: promiseContinue,
    GetExpressLogger: getExpressLogger
};
