/**
 * Couchbase Session Store Module
 */
// Third-party libs
var _         = require('underscore');
var couchbase = require('couchbase');
var deepcopy  = require('deepcopy');

//
var sessionMaxAge = 24*60*60; // one day in seconds

module.exports = function(connect){

    // Connect Session Store
    var Store = connect.session.Store;

    function CouchBaseStore(options) {
        this.options = _.extend(
            {
                host:     "localhost:8091",
                bucket:   "default",
                password: "",
                prefix:   "session:",
                ttl:      sessionMaxAge,
                client:   null
            },
            options
        );

        Store.call(this, this.options);

        if(this.options.client) {
            this.client = this.options.client;
        } else {
            this.client = new couchbase.Connection({
                host:     this.options.host,
                bucket:   this.options.bucket,
                password: this.options.password
            }, function(err) {
                console.error("CouchBase SessionStore: Error -", err);

                if(err) throw err;
            }.bind(this));
        }

        this.client.on('error', function (err) {
            console.error("CouchBase SessionStore: Error -", err);

            this.emit('disconnect');
        }.bind(this));
        this.client.on('connect', function () {
            this.emit('connect');
        }.bind(this));

    };

    // Inherit from Connect Session Store
    CouchBaseStore.prototype.__proto__ = Store.prototype;

    CouchBaseStore.prototype.get = function(sessionId, done){
        try {
            var key = this.options.prefix + sessionId;

            console.log("CouchBaseStore get key:", key);
            this.client.get(key, function(err, result) {
                if(err){
                    if(err.code == 13) { // No such key
                        console.log("CouchBaseStore: No such key");
                        return done();
                    } else {
                        console.error("CouchBase SessionStore: Get Error -", err);
                        return done(err);
                    }
                }

                return done(null, result.value);
            });
        } catch (err) {
            console.error("CouchBase SessionStore: Set Error -", err);
            done(err);
        }
    };

    CouchBaseStore.prototype.set = function(sessionId, session, done){
        try {
            var key     = this.options.prefix + sessionId;

            // get before set
            this.client.get(key, function(err, result){
                if(err){
                    if(err.code == 13) { // No such key
                        this._setSession(key, session, done);
                    } else {
                        if(err) { return done(err); }
                    }
                } else {
                    if( session.passport.hasOwnProperty('user') ) {
                        if( result.value.passport.hasOwnProperty('user') ) {
                            // already has user data
                            console.log("CouchBaseStore: touching session key:", key);
                            this.client.touch(key, function(err){
                                done(err);
                            });
                        } else {
                            this._setSession(key, session, done);
                        }
                    } else {
                        done(err);
                    }
                }

            }.bind(this));
        } catch (err) {
            console.error("CouchBase SessionStore: Set Error -", err);
            done(err);
        }
    };

    CouchBaseStore.prototype._setSession = function(key, session, done){
        var ttl     = this.options.ttl;
        var maxAge  = session.cookie.maxAge;

        if(_.isNumber(maxAge)) {
            // convert maxAge from milli seconds to seconds
            ttl = Math.floor(maxAge / 1000);
        }

        var data = deepcopy(session);
        console.log("CouchBaseStore set key:", key, ", data:", data);
        this.client.set(key, data, {
                expiry: ttl // in seconds
            },
            function(err, result){
                if(err){
                    console.error("CouchBase SessionStore: Set Error -", err);
                    return done(err);
                }
                done(err);
            }
        );
    };

    CouchBaseStore.prototype.destroy = function(sessionId, done){
        try {
            var key = this.options.prefix + sessionId;

            console.log("CouchBaseStore remove key:", key);
            this.client.remove(key, done);
        } catch (err) {
            console.error("CouchBase SessionStore: Destroy Error -", err);
            done(err);
        }
    };

    return CouchBaseStore;
};
