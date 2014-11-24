var fs             = require('fs');
var path           = require('path');
var _              = require('lodash');
var when           = require('when');
var aws    = require('aws-sdk');

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
            .catch(function(err){
                console.log('S3 Some Random - ', err);
                reject();
            }.bind(this));
    }.bind(this));
}


S3Util.prototype.getBucket = function(key) {
    return when.promise(function(resolve, reject) {
        var params = {};
    }.bind(this));
}

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
}

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
}

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
}

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
}

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
}

// updates s3 object from playfully bucket
S3Util.prototype.updateS3Object = function(key, data){
    return when.promise(function(resolve, reject){
        getS3Object(this.s3, key)
            .then(function(object){
                _.merge(object, data);
                return createS3Object(this.s3, key, object);
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
S3Util.prototype.listS3Objects = function(){
    return when.promise(function(resolve, reject){
        var params = {};
        params.Bucket = this.bucket;

        this.s3.listObjects(params, function(err, data){
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