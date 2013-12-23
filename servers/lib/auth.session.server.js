/**
 * Authentication Proxy Server Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  express    - https://github.com/visionmedia/express
 *  passport   - https://github.com/jaredhanson/passport
 *
 *  node-edmodo-api - https://github.com/gabceb/node-edmodo-api
 *
 *
 */
var http       = require('http');
var path       = require('path');
// Third-party libs
var _          = require('lodash');
var express    = require('express');
var passport   = require('passport');
var request    = require('request');
var couchbase  = require('couchbase');

// load at runtime
var Strategy, CouchbaseStore, aConst, rConst, WebStore;

module.exports = AuthSessionServer;

function errorResponce(res, errorStr){
    var error = JSON.stringify({ error: errorStr });
    res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": error.length
    });
    res.end( error );
}


function AuthSessionServer(options, app, routes){
    try {
        Strategy       = require('./auth.js').Strategy;
        CouchbaseStore = require('./sessionstore.couchbase.js')(express);
        aConst         = require('./auth.js').Const;
        rConst         = require('./routes.js').Const;

        this.options = _.merge(
            {
                webapp: {
                    protocol: "http",
                    host:     "localhost",
                    port:     8080,
                    staticContentPath: "/../../../Root/web-app"
                },
                sessionstore: {
                    "host":     "localhost:8091",
                    "bucket":   "glasslab_webapp",
                    "password": "glasslab"
                }
            },
            options
        );

        this.app = app;

        this.sessionStore = new couchbase.Connection({
            host:     this.options.sessionstore.host,
            bucket:   this.options.sessionstore.bucket,
            password: this.options.sessionstore.password
        }, function(err) {
            console.error("CouchBase SessionStore: Error -", err);
            if(err) throw err;
        }.bind(this));


        // pass session store to express session store strategy, via options
        this.options.sessionstore.client = this.sessionStore;
        // express session store
        this.exsStore = new CouchbaseStore(this.options.sessionstore);

        this.app.configure(function() {

            this.app.use(express.logger());
            this.app.use(express.compress());
            this.app.use(express.errorHandler({showStack: true, dumpExceptions: true}));

            this.app.use(express.cookieParser());
            this.app.use(express.urlencoded());
            this.app.use(express.json());
            this.app.use(express.methodOverride());

            this.app.use(express.session({
                secret: this.options.auth.secret,
                cookie: {
                    path: '/'
                    //, domain: this.options.auth.host+":"+this.options.frontend.port
                },
                store:  this.exsStore
            }));

            passport.use(new Strategy.Glasslab(this.options));

            // session de/serialize
            passport.serializeUser(function serializeUser(user, done) {
                done(null, user);
            });
            passport.deserializeUser(function deserializeUser(user, done) {
                done(null, user);
            });

            this.app.use(passport.initialize());
            this.app.use(passport.session());

            // setup app routes
            if(routes) routes();
        }.bind(this));

    } catch(err){
        console.trace("Auth: Error -", err);
    }
}

AuthSessionServer.prototype.getCookieWASession = function(req, done){
    if(req.session.passport && req.session.passport.user){
        var data = this.buildWASession( req.session.passport.user[aConst.webappSessionPrefix] );
        done(null, data);
    } else {
        done("User info missing");
    }
};

AuthSessionServer.prototype.buildWASession = function(sessionId){
    var data = {};
    data[aConst.webappSessionPrefix] = sessionId;
    return data;
};

AuthSessionServer.prototype.getWASession = function(id, done){
    var key = aConst.webappSessionPrefix+":"+id;

    this.sessionStore.get(key, function(err, result) {
        if(err) {
            if(err.code == 13) { // No such key
                console.warn("AuthSessionServer webapp session key missing:", key);
                done();
            } else {
                done(err);
            }
            return;
        }

        if(done) done(null, result);
    }.bind(this));
};

AuthSessionServer.prototype.getSession = function(id, done){
    var key = this.exsStore.getSessionPrefix()+":"+id;

    this.sessionStore.get(key, function(err, result) {
        if(err) {
            if(err.code == 13) { // No such key
                console.warn("AuthSessionServer session key missing:", key);
                done();
            } else {
                done(err);
            }
            return;
        }

        if(done) done(null, result);
    }.bind(this));
};


AuthSessionServer.prototype.getWebSession = function(req, res, done){
    var url = this.options.webapp.protocol+"//"+this.options.webapp.host+":"+this.options.webapp.port+"/api/config"

    var saveWebSession = function(user, req, next){
        var key  = aConst.webappSessionPrefix+":"+user[aConst.webappSessionPrefix];
        var data = { session: req.sessionID.toString() };
        console.log("Auth sessionStore set key:", key, ", data:", data);

        // write proxy session, set expire the same as the session
        this.sessionStore.set( key, data, {
                expiry: this.exsStore.getSessionTTL()
            },
            function(err) {
                if(err) {
                    console.error("Auth: sessionStore "+aConst.webappSessionPrefix+" Error -", err);
                    next(err);
                }

                if(next) next();
            }.bind(this)
        );
    }.bind(this);

    request.get(url, function(err, pres){
        if(err) {
            if(done) done(err);
        }

        // parse cookie, to get web session
        var mCookieParts = {};
        if(_.isArray(pres.headers['set-cookie'])) {
            var aCookieParts = pres.headers['set-cookie'][0].split(';');
            for(var p in aCookieParts) {
                var cp = aCookieParts[p].split('=');
                mCookieParts[cp[0]] = cp[1] || "";
            }

            if(mCookieParts.hasOwnProperty(aConst.sessionCookieName)) {
                //console.log("cookieParts:", mCookieParts);
                if(done) done(null, mCookieParts[aConst.sessionCookieName], saveWebSession)
            } else {
                if(done) done(new Error("could not get "+aConst.sessionCookieName));
            }
        } else {
            console.error("Auth: Error - No cookie set in proxy!");
            errorResponce(res, "Could not get cookie");
        }
    }.bind(this));
};

