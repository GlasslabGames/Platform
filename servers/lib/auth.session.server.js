/**
 * Authentication Proxy Server Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  when       - https://github.com/cujojs/when
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
var when       = require('when');
var express    = require('express');
var passport   = require('passport');
var couchbase  = require('couchbase');

// load at runtime
var aConst, rConst;

module.exports = AuthSessionServer;

function AuthSessionServer(options, app, routes, loadStrategies){
    try {
        var CouchbaseStore, Util;

        aConst         = require('./auth.js').Const;
        rConst         = require('./routes.js').Const;
        CouchbaseStore = require('./sessionstore.couchbase.js')(express);
        Util           = require('./util.js');

        this.options = _.merge(
            {
                webapp: {
                    protocol: "http",
                    host:     "localhost",
                    port:     8080,
                    staticContentPath: "../../../Root/web-app"
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
        this.stats       = new Util.Stats(this.options, "Auth.Session");
        this.requestUtil = new Util.Request(this.options);

        this.sessionStore = new couchbase.Connection({
            host:     this.options.sessionstore.host,
            bucket:   this.options.sessionstore.bucket,
            password: this.options.sessionstore.password
        }, function(err) {
            console.error("Couchbase SessionStore: Error -", err);
            this.sessionStore.stats.increment("error", "Couchbase.Connect");
            if(err) throw err;
        }.bind(this));


        // pass session store to express session store strategy, via options
        this.options.sessionstore.client = this.sessionStore;
        // express session store
        this.exsStore = new CouchbaseStore(this.options.sessionstore);

        this.app.configure(function() {

            this.app.use(Util.GetExpressLogger(this.options, express, this.stats));
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

            // load strategies
            if(loadStrategies) loadStrategies(passport);

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
        this.stats.increment("error", "Generic");
    }
}

AuthSessionServer.prototype.getCookieWASession = function(req, done){
    if(req.session.passport && req.session.passport.user){
        var data = this.buildWASession( req.session.passport.user[aConst.webappSessionPrefix] );
        done(null, data);
    } else {
        this.stats.increment("error", "WASession");
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
                //console.warn("AuthSessionServer webapp session key missing:", key);
                this.stats.increment("warn", "WASession.Missing");
                done();
            } else {
                this.stats.increment("error", "WASession");
                done(err);
            }
            return;
        }

        this.stats.increment("info", "WASession.Get");
        if(done) done(null, result);
    }.bind(this));
};

AuthSessionServer.prototype.deleteWASession = function(id){
    var key = aConst.webappSessionPrefix+":"+id;

    this.sessionStore.remove(key, function(err, result) {
        this.stats.increment("info", "WASession.Delete");
    }.bind(this));
};

AuthSessionServer.prototype.getSession = function(id, done){
    var key = this.exsStore.getSessionPrefix()+":"+id;

    this.sessionStore.get(key, function(err, result) {
        if(err) {
            if(err.code == 13) { // No such key
                console.warn("AuthSessionServer session key missing:", key);
                this.stats.increment("warn", "Session.KeyMissing");
                done();
            } else {
                this.stats.increment("error", "Session");
                done(err);
            }
            return;
        }

        this.stats.increment("info", "Session.Get");
        if(done) done(null, result);
    }.bind(this));
};

AuthSessionServer.prototype.updateWebSessionInSession = function(sessionId, session, done){
    var data = _.cloneDeep(session);
    delete data.id;
    delete data.req;

    this.exsStore.set(sessionId, data, function(err) {
        if(err) {
            done(err);
        }

        this.stats.increment("info", "Session.Update.WASession");
        done(null, data.passport.user);
    }.bind(this));
};

AuthSessionServer.prototype.getWebSession = function(done){
    var url = this.options.webapp.protocol+"//"+this.options.webapp.host+":"+this.options.webapp.port+"/api/session";

    var saveWebSession = function(waSession, sessionId, next){
        var key  = aConst.webappSessionPrefix+":"+waSession;
        var data = { session: sessionId };
        //console.log("Auth sessionStore set key:", key, ", data:", data);

        // write proxy session, set expire the same as the session
        this.sessionStore.set( key, data, {
                expiry: this.exsStore.getSessionTTL()
            },
            function(err) {
                if(err) {
                    console.error("Auth: sessionStore "+aConst.webappSessionPrefix+" Error -", err);
                    this.stats.increment("error", "GetWebSession");
                    if(next) next(err);
                }

                this.stats.increment("info", "WASession.Set");
                if(next) next();
            }.bind(this)
        );
    }.bind(this);

    this.requestUtil.getRequest(url, null, function(err, pres){
        if(err) {
            if(done) done(err);
            console.error("Auth: sessionStore Error -", err, ", url:", url);
            return;
        }

        this.stats.increment("info", "GetWebSession");
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
                this.stats.increment("error", "GetWebSession.GetRequest.MissingCookieName");
                if(done) done(new Error("could not get "+aConst.sessionCookieName));
            }
        } else {
            console.error("Auth: Error - No cookie set in proxy!");
            this.stats.increment("error", "GetWebSession.GetRequest.NoSetCookie");
            if(done) done(new Error("could not get cookie"));
        }
    }.bind(this));
};

AuthSessionServer.prototype.updateUserDataInSession = function(session){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var data = _.cloneDeep(session);
    delete data.id;
    delete data.req;

    var key = this.exsStore.getSessionPrefix()+":"+data.passport.user.sessionId;
    this.exsStore.set(key, data, function(err) {
        if(err) {
            this.stats.increment("error", "UpdateUserDataInSession");
            reject({"error": "failure", "exception": err}, 500);
            return;
        }
        resolve();
    }.bind(this));
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};
