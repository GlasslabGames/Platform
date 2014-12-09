var fs             = require('fs');
var path           = require('path');
var _              = require('lodash');
var when           = require('when');
var aws            = require('aws-sdk');
var child          = require('child_process');

module.exports = S3Util;

//http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html
//http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-examples.html

function S3Util(options){
    // Get the AWS config
    this.options = options;

    // Set the AWS config
    if( !this.options.awsAccess ) {
        return;
    }
    aws.config = this.options.awsAccess;

    // Set the S3 object
    this.s3 = new aws.S3();

    // Set bucket variables
    this.bucket = "playfully";
}

// build the prefix param for s3, so operation can be done on all items that fall within this directory
function _s3PrefixBuilder(pathParams, isDirectory){
    pathParams = pathParams || [];
    if(isDirectory === undefined){
        isDirectory = true;
    }
    var prefix = pathParams.join('/');
    if(prefix.length > 0 && isDirectory){
        prefix += '/';
    }
    return prefix;
}

// demo method to test out s3 rest operations
S3Util.prototype.sample = function(key, data) {
    return when.promise(function(resolve, reject){
        this.putS3Object("PVZ/TEST/2/myText.txt", "data")
            .then(function(){
                return this.createS3Object(key, data);
            }.bind(this))
            .then(function(){
                return this.getS3Object(key);
            }.bind(this))
            .then(function(results){
                console.log(results);
                return this.deleteS3Object(key)
            }.bind(this))
            .then(function(){
                resolve();
                //return this.listS3Objects();
            }.bind(this))
            /*.then(function(list){
                list.forEach(function(object){
                    if(object.Key === key){
                        reject();
                    }
                }.bind(this));
                resolve();
            }.bind(this))*/
            .then(null, function(err){
                console.log('S3 Some Random - ', err);
                reject();
            }.bind(this));
    }.bind(this));
};


S3Util.prototype.getBucket = function(key) {
    return when.promise(function(resolve, reject) {
        var params = {};
    }.bind(this));
};

S3Util.prototype.createS3Bucket = function( bucket ) {
    return when.promise( function( resolve, reject ) {
        resolve();
        var params = {};
        params.Bucket = bucket;
        this.s3.createBucket( params, function( err, data ) {
            if( err ) {
                console.error( "S3 Create Bucket Error - ", err );
                reject( "Create Bucket" );
            }
            else {
                console.log( "S3 Bucket Created" );
                resolve();
            }
        }.bind( this ) );
    }.bind( this ) );
};

S3Util.prototype.createS3Object = function(key, data) {
    return when.promise(function(resolve, reject){
        var params = {};
        params.Bucket = this.bucket;
        params.Body = data;
        params.Key = key;
        this.s3.putObject(params, function(err, results){
            if(err){
                console.error('S3 Create Object Error - ', err);
                reject('create');
            } else{
                console.log('S3 Object created');
                resolve();
            }
        }.bind(this));
    }.bind(this));
};

// gets s3 object from playfully bucket
S3Util.prototype.getS3Object = function(key){
    return when.promise(function(resolve, reject){
        var params = {};
        params.Bucket = this.bucket;
        params.Key = key;

        this.s3.getObject(params, function(err, results){
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
};

// gets s3 object from playfully bucket
S3Util.prototype.putS3Object = function(key, data){
    var copiedData = data + "";
    return when.promise(function(resolve, reject){
        var params = {};
        params.Bucket = this.bucket;
        params.Key = key;
        params.Body = copiedData;

        this.s3.putObject(params, function(err, results){
            if(err){
                console.error('S3 Put Object Error - ', err);
                reject('put object');
            } else{
                console.log('S3 Object Put');
                resolve();
            }
        }.bind(this));
    }.bind(this));
};

// deletes s3 object from playfully bucket
S3Util.prototype.deleteS3Object = function(key){
    return when.promise(function(resolve, reject){
        var params = {};
        params.Bucket = this.bucket;
        params.Key = key;

        this.s3.deleteObject(params, function(err, results){
            if(err){
                console.error('S3 Delete Object Error - ', err);
                reject('delete');
            } else{
                console.log('S3 Object Deleted');
                resolve();
            }
        }.bind(this));
    }.bind(this));
};

// updates s3 object from playfully bucket
S3Util.prototype.updateS3Object = function(key, data){
    return when.promise(function(resolve, reject){
        this.getS3Object(key)
            .then(function(object){
                _.merge(object, data);
                return this.createS3Object(key, object);
            }.bind(this))
            .then(function(){
                resolve();
            }.bind(this))
            .then(null, function(err){
                reject('update');
            }.bind(this));
    }.bind(this));
};

// lists all the s3 objects in playfully bucket
S3Util.prototype.listS3Objects = function(prefix){
    return when.promise(function(resolve, reject){
        var params = {};
        params.Bucket = this.bucket;
        params.Prefix = prefix;
        this.s3.listObjects(params, function(err, data){
            if(err){
                console.error('S3 List Objects Error - ', err);
                reject(err);
            } else{
                var list = data.Contents;
                var outList = [];
                list.forEach(function(item){
                    if(item.Key.indexOf('.') !== -1){
                        outList.push(item);
                    }
                });
                resolve(outList);
            }
        }.bind(this));
    }.bind(this));
};

// grabs url signed for get requests, for csv parser page
S3Util.prototype._getSignedUrl = function(key) {
    var params = {};
    params.Bucket = this.bucket;
    params.Key = key;
    return when.promise(function(resolve, reject){
        this.s3.getSignedUrl('getObject', params, function (err, url) {
            if (err) {
                console.error('Get Signed Url Error - ', err);
                reject('signedUrl');
            } else {
                resolve(url);
            }
        }.bind(this));
    }.bind(this));
};

// grabs signed urls for all objects that fall within a particular prefix directory structure
S3Util.prototype.getSignedUrls = function(docType, pathParams, isDirectory){
    return when.promise(function(resolve, reject){
        var prefix = _s3PrefixBuilder(pathParams, isDirectory);
        this.listS3Objects(prefix)
            .then(function(list){
                var signedUrlList = [];
                list.forEach(function(object){
                    var key = object.Key;
                    docType = docType || '*';
                    var endType = key.slice(key.lastIndexOf('.')+1);
                    if(endType === docType || docType === '*'){
                        signedUrlList.push(this._getSignedUrl(key));
                    }
                }.bind(this));
                return when.all(signedUrlList);
            }.bind(this))
            .then(function(signedUrlList){
                resolve(signedUrlList);
            }.bind(this))
            .then(null, function(err){
                reject(err);
            }.bind(this));
    }.bind(this));
};


// only works if you have awscli installed and configured with aws credentials
// can be used to move or rename an object in s3 just as mv would be used in the unix terminal
function _mvS3Object(startKey, endKey){
    return when.promise(function(resolve, reject){
        var command = 'aws s3 mv ' + startKey + ' ' + endKey;
        child.exec(command, function(err, stdout, stderr){
            if(err){
                reject(err);
            } else if(stderr){
                reject(stderr);
            } else if(stdout){
                resolve(stdout);
            } else{
                reject({'no.response': 'no response'});
            }
        });
    });
}

// changes the names of all files that lie within a certain prefix, based on rules created in a formatter method
S3Util.prototype.alterS3ObjectNames = function(formatter, docType, pathParams, isDirectory){
    return when.promise(function(resolve, reject){
        if(docType === undefined){
            return reject({'no.docType.present': 'Method needs a document type'});
        }
        var prefix = _s3PrefixBuilder(pathParams, isDirectory);
        this.listS3Objects(prefix)
            .then(function(list){
                var promiseList = [];
                list.forEach(function(object){
                    var key = object.Key;
                    var endType = key.slice(key.lastIndexOf('.')+1);
                    if(endType === docType){
                        var keys = formatter.call(this, key);
                        if(Array.isArray(keys)){
                            var startKey = keys[0];
                            var endKey = keys[1];
                            //console.log('start:', startKey,'end:',endKey);
                            promiseList.push(this._mvS3Object(startKey, endKey));
                        } else if(typeof keys !== 'string'){
                            // if not string, is an error
                            return reject(keys);
                        }
                    }
                }.bind(this));
                return when.all(promiseList);
            }.bind(this))
            .then(function(promiseList) {
                resolve(JSON.stringify(promiseList));
            })
            .then(null, function(err){
                reject(err);
            });
    }.bind(this));
};
