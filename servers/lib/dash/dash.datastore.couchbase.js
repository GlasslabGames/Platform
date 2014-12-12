/**
 * Dash DataStore Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  when   - https://github.com/cujojs/when
 *
 */
// Third-party libs
var _         = require('lodash');
var when      = require('when');
var guard     = require('when/guard');
var couchbase = require('couchbase');
// load at runtime
var Util;

module.exports = DashDS_Couchbase;

function DashDS_Couchbase(options){
    // Glasslab libs
    Util   = require('../core/util.js');
    tConst = require('./dash.const.js');

    this.options = _.merge(
        {
            host:     "localhost:8091",
            bucket:   "default",
            password: "",
            gameSessionExpire: 1*1*60 //24*60*60 // in seconds
        },
        options
    );
}

DashDS_Couchbase.prototype.connect = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var options = {
        host:     this.options.host,
        bucket:   this.options.bucket,
        password: this.options.password,
        connectionTimeout: this.options.timeout || 60000,
        operationTimeout:  this.options.timeout || 60000
    };
    this.client = new couchbase.Connection(options, function(err) {
        console.error("CouchBase DashStore: Error -", err);

        if(err) throw err;
    }.bind(this));

    this.client.on('error', function (err) {
        console.error("CouchBase DashStore: Error -", err);
        reject(err);
    }.bind(this));

    this.client.on('connect', function () {
        //console.log("CouchBase DashStore: Options -", options);
        /*this.saveMessageCenterMessage( { icon: "my_icon3", subject: "Blinky says shut up again", message: "This message." } );
        this.saveMessageCenterMessage( { icon: "my_icon2", subject: "Blinky says shut up", message: "This is a hateful message." } );
        this.saveMessageCenterMessage( { icon: "my_icon1", subject: "Blinky doesn't want to say hello", message: "This is another message." } );
        this.saveMessageCenterMessage( { icon: "my_icon", subject: "Blinky Wants to Say Hello to You", message: "This is a message." } );*/
        //this.getMessageCenterMessages( "message", 3, true);
        resolve();
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


DashDS_Couchbase.prototype.getMessageCenterCount = function( messageId ) {
    return when.promise(function(resolve, reject){

        var key = tConst.dataStore.dataKey + "::" + tConst.dataStore.countKey + "::" + tConst.dataStore[ messageId + "Key" ];
        this.client.get(key, function(err, data) {
            var count = 0;
            if(err) {
                console.error( "CouchBase DashStore: Get Message Center Count Error -", err );
                reject(err);
                return;
            }
            else {
                count = data.value;
            }

            resolve( count );
        }.bind(this));

    }.bind(this));
};

DashDS_Couchbase.prototype.getMessageCenterMessages = function(messageType, limit, ascending) {
    return when.promise(function(resolve, reject){

        this.getMessageCenterCount( messageType )
            .then(function(count) {
                var keys = [];
                for( var i = 0; i < limit; i++ ) {
                    var value = ascending ? i + 1 : count - i;
                    if( value <= count && value > 0 ) {
                        var key = tConst.dataStore.dataKey + ":" + tConst.dataStore.messageCenterKey + ":" + tConst.dataStore[ messageType + "Key" ] + ":" + value;
                        keys.push( key );
                    }
                }

                this.client.getMulti( keys, {}, function( err, results ) {
                    if( err ) {
                        console.error( "CouchBase DashStore: Get Message Center Messages Error -", err );
                        reject( err );
                        return;
                    }
                    resolve( results );
                });

            }.bind(this))
            .then(null, function(err) {
                reject( err  );
            }.bind(this));

    }.bind(this));
};

DashDS_Couchbase.prototype.saveMessageCenterMessage = function( message ) {
    return when.promise(function(resolve, reject){

        // Set the timestamp in the message
        message.timestamp = Util.GetTimeStamp();

        var key = tConst.dataStore.dataKey + "::" + tConst.dataStore.countKey + "::" + tConst.dataStore.messageKey;
        this.client.incr(key, {initial: 1}, function(err, data) {
            if(err) {
                console.error( "CouchBase DashStore: Incr Message Center Count Error -", err );
                reject(err);
                return;
            }

            key = tConst.dataStore.dataKey + ":" + tConst.dataStore.messageCenterKey + ":" + tConst.dataStore.messageKey + ":" + data.value;
            this.client.add(key, message, function(err, results){
                if(err) {
                    console.error( "CouchBase DashStore: Set Message Center Message Error -", err );
                    reject(err);
                    return;
                }
                resolve();
            }.bind(this));
        }.bind(this));

    }.bind(this));
};
