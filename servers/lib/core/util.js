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
var aws    = require('aws-sdk');

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

function getExpressLogger(options, express, stats){
    express.logger.token('remote-addy', function(req, res){
        if( req.headers.hasOwnProperty('x-forwarded-for') ){
            return req.headers['x-forwarded-for'];
        } else {
            return req.connection.remoteAddress;
        }
    });

    return express.logger(function(t, req, res){
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
            console.error("Error null status for response!!!");
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
     return express.logger(logFormat);
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
    Request: require('./util.request.js'),
    Stats:   require('./util.stats.js'),
    Email:   require('./util.email.js'),
    ConvertToString:  convertToString,
    PromiseContinue:  promiseContinue,
    PromiseError:     promiseError,
    GetExpressLogger: getExpressLogger,
    GetTimeStamp:     getTimeStamp,
    CheckTimeStamp:   checkTimeStamp,
    BuildURI:         buildUri,
    CreateUUID:       createUUID,
    String: {
        capitalize: capitalize
    },
    Reshape: reshape,
    WriteToCSV: writeToCSV
};

// writes data to a chosen file
function writeToCSV(data, file){
    return when.promise(function(resolve, reject){
        fs.appendFile(file, data, function(err){
            if(err){
                return reject(err);
            }
            resolve()
        }.bind(this))
    }.bind(this));
}

// sets s3 credentials and creates s3 instance
function s3Config(){
    var configPath = __dirname + '/../../../aws_config.json';
    aws.config.loadFromPath(configPath);
    var s3 = new aws.S3();
    return s3;
}

// places new s3 object in playfully bucket.  also could replace existing object at same key
function createS3Object(s3, key, data){
    return when.promise(function(resolve, reject){
        var params = {};
        params.Bucket = 'playfully';
        params.Body = data;
        params.Key = key;
        s3.putObject(params, function(err, results){
            if(err){
                console.error('S3 Create Object Error - ', err);
                reject('create');
            } else{
                console.log('S3 Object created');
                resolve();
            }
        }.bind(this));
    }.bind(this));
}

// demo method to test out s3 rest operations
function s3Start(key, data){
    var s3;
    return when.promise(function(resolve, reject){
        console.log('s3 begins');
        s3 = s3Config();
        createS3Object(s3, key, data)
            .then(function(){
                return getS3Object(s3, key);
            }.bind(this))
            .then(function(results){
                console.log(results);
                return deleteS3Object(s3, key)
            }.bind(this))
            .then(function(){
                return listS3Objects(s3);
            }.bind(this))
            .then(function(list){
                list.forEach(function(object){
                    if(object.Key === key){
                        reject();
                    }
                }.bind(this));
                resolve();
            }.bind(this))
            .catch(function(err){
                console.log('S3 Some Random - ', err);
                reject();
            }.bind(this));
    }.bind(this));
}

// gets s3 object from playfully bucket
function getS3Object(s3, key){
    return when.promise(function(resolve, reject){
        var params = {};
        params.Bucket = 'playfully';
        params.Key = key;

        s3.getObject(params, function(err, results){
            if(err){
                console.error('S3 Get Object Error - ', err);
                reject('get');
            } else{
                console.log('S3 Object Get');
                object = results.Body.toString();
                resolve(object);
            }
        }.bind(this));
    }.bind(this));
}

// deletes s3 object from playfully bucket
function deleteS3Object(s3, key){
    return when.promise(function(resolve, reject){
        var params = {};
        params.Bucket = 'playfully';
        params.Key = key;

        s3.deleteObject(params, function(err, results){
            if(err){
                console.error('S3 Delete Object Error - ', err);
                reject('delete');
            } else{
                console.log('S3 Object Deleted');
                resolve();
            }
        }.bind(this));
    }.bind(this));
}

// updates s3 object from playfully bucket
function updateS3Object(s3, key, data){
    return when.promise(function(resolve, reject){
        getS3Object(s3, key)
            .then(function(object){
                _.merge(object, data);
                return createS3Object(s3, key, object);
            }.bind(this))
            .then(function(){
                resolve();
            }.bind(this))
            .catch(function(err){
                reject('update');
            }.bind(this));
    }.bind(this));
}
// lists all the s3 objects in playfully bucket
function listS3Objects(s3){
    return when.promise(function(resolve, reject){
        var params = {};
        params.Bucket = 'playfully';

        s3.listObjects(params, function(err, data){
            if(err){
                console.error('S3 List Objects Error - ', err);
                reject('list');
            } else{
                console.log('S3 Object Listed');
                resolve(data.Contents);
            }
        }.bind(this));
    }.bind(this));
}

//http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html
//http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-examples.html

//s3Start('test', 'test data');
