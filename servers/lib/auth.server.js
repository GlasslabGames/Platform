/**
 * Authentication Server Module
 *
 * Module dependencies:
 *  underscore - https://github.com/jashkenas/underscore
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
var _          = require('underscore');
var express    = require('express');
var passport   = require('passport');
var request    = require('request');
var couchbase  = require('couchbase');

//var PassLocal  = require('passport-local').Strategy;
var Strategy   = require('./auth.strategy.js');
//var RediexsStore = require('connect-redis')(express);
var CouchBaseexsStore = require('./sessionstore.couchbase.js')(express);

// Glasslab libs
var aConst     = require('./auth.const.js');
var rConst     = require('./routes.const.js');
var WebStore   = require('./datastore.web.js');

module.exports = AuthServer;

function errorResponce(res, errorStr){
    var error = JSON.stringify({ error: errorStr });
    res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": error.length
    });
    res.end( error );
}

function jsonResponce(res, obj){
    var json = JSON.stringify(obj);
    res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": json.length
    });
    res.end( json );
}

function AuthServer(options){
    try {
        this.options = _.extend(
            {
                auth: { port: 8082, secret: "keyboard kitty"}
            },
            options
        );

        this.app = express();

        this.webstore = new WebStore(this.options);

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
        this.exsStore = new CouchBaseexsStore(this.options.sessionstore);

        this.app.configure(function() {
            this.app.set('port', this.options.auth.port);

            this.app.set('views', __dirname + '/../views');
            this.app.set('view engine', 'ejs');
            this.app.engine('ejs', require('ejs-locals'));

            this.app.use(express.logger());
            this.app.use(express.errorHandler({showStack: true, dumpExceptions: true}));

            this.app.use(express.cookieParser());
            this.app.use(express.urlencoded());
            this.app.use(express.json());
            this.app.use(express.methodOverride());

            this.app.use(express.session({
                secret: this.options.auth.secret,
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
        }.bind(this));

        // setup app routes
        this.setupRoutes();

        // start server
        http.createServer(this.app).listen(this.app.get('port'), function createServer(){
            console.log('Auth: Server listening on port ' + this.app.get('port'));
        }.bind(this));

    } catch(err){
        console.trace("Auth: Error -", err);
    }
}

AuthServer.prototype.setupRoutes = function() {
    try {
        // GET
        /*
        this.app.get(rConst.crossDomain, function(req, res){
            // need to resolve relative path to absolute, to prevent "Error: Forbidden"
            res.sendfile( path.resolve(__dirname + '/../static' + rConst.crossDomain) );
        });
        */
        this.app.get(rConst.api.logout, function logoutRoute(req, res){
            req.logout();
            res.redirect(rConst.root);
        }.bind(this));

        this.app.get(rConst.api.session.validate, function validateSession(req, res, next){
            if(req.connection.remoteAddress == "127.0.0.1")
            {
                if( req.params.id ) {
                    // using proxy session get real session
                    this.sessionStore.get(aConst.proxySessionPrefix+":"+req.params.id, function(err, result) {
                        if(err) {
                            console.error("CouchBase validateSession: Error -", err);
                            errorResponce(res, err.toString());
                        }

                        console.log("CouchBase SessionStore: value:", result.value);
                        if(result.value.session) {
                            this.sessionStore.get(this.exsStore.getSessionPrefix()+":"+result.value.session, function(err, result) {
                                if(err) {
                                    console.error("CouchBase validateSession: Error -", err);
                                    errorResponce(res, err.toString());
                                }

                                if(result.value.passport.user) {
                                    jsonResponce(res, result.value.passport);
                                } else {
                                    errorResponce(res, "No user data");
                                }
                            }.bind(this));
                        }

                    }.bind(this));
                } else {
                    errorResponce(res, "Missing ID");
                }
            } else {
                console.error("CouchBase validateSession invalid remoteAddress ", req.connection.remoteAddress);
                next();
            }
        }.bind(this));

        // POST - login
        this.app.post(rConst.api.login, this.loginRoute.bind(this));

        // Add exclude routes
        var excludeRoute = function(req, res) {
            console.log("Exclude From Auth:", req.path);
            this.forwardRequest(req.session.passport.user, req, res);
            return;
        }.bind(this);
        for(var e in rConst.auth.exclude){
            this.app.use(rConst.auth.exclude[e], excludeRoute);
        }

        // Add include routes
        var includeRoute = function(req, res, next) {
            console.log("Include to Auth:", req.path);
            if( req.isAuthenticated()) {
                console.log("Auth passport user:", req.session.passport.user);
                this.forwardRequest(req.session.passport.user, req, res, null, true);
                //console.log("Auth passport user:", req.session.passport.user);
            } else {
                // error in auth, redirect back to login
                console.error("Auth: Not Authenticated");
                res.redirect(rConst.api.login)
            }
            return;
        }.bind(this);
        for(var i in rConst.auth.include){
            this.app.use(rConst.auth.include[i], includeRoute);
        }

        // DEFAULT
        this.app.use(function defaultRoute(req, res, next) {

            this.forwardRequest(req.session.passport.user, req, res);

        }.bind(this));

    } catch(err){
        console.trace("Auth: setupRoutes Error -", err);
    }
};

AuthServer.prototype.loginRoute = function(req, res, next) {
    // only allow for POST on login
    if(req.method != 'POST') { next(); return;}

    console.log("Auth loginRoute");

    var auth = passport.authenticate('glasslab', function(err, user, info) {
        if(err) {
            return next(err);
        }

        if (!user) {
            req.session.messages =  [info.message];
            return res.redirect(rConst.api.login)
        }

        this.getWebSession(req, res, function(err, session){
            if(err) {
                return next(err);
            }

            // save proxy session
            user[aConst.proxySessionPrefix] = session;

            console.log("logIn:", user);
            req.logIn(user, function(err) {
                if(err) {
                    return next(err);
                }

                // get courses
                this.webstore.getCourses(user.id,
                    function(err, courses){
                        // add courses
                        var tuser = _.clone(user);
                        tuser.courses = courses;
                        // no need to send web session
                        delete tuser.webSession;

                        var key  = aConst.proxySessionPrefix+":"+user[aConst.proxySessionPrefix];
                        var data = { session: req.sessionID.toString() };
                        console.log("Auth sessionStore set key:", key, ", data:", data);

                        // write proxy session, set expire the same as the session
                        this.sessionStore.set( key, data, {
                                expiry: this.exsStore.getSessionTTL()
                            },
                            function(err, result) {
                                if(err) {
                                    console.error("Auth: sessionStore "+aConst.proxySessionPrefix+" Error -", err);
                                    return next(err);
                                }
                            }.bind(this)
                        );

                        res.writeHead(200);
                        res.end( JSON.stringify(tuser) );
                    }.bind(this)
                );
            }.bind(this));

        }.bind(this));

    }.bind(this));

    auth(req, res, next);
};

AuthServer.prototype.getWebSession = function(req, res, done){
    var url = this.options.webapp.protocal+"://"+this.options.webapp.host+":"+this.options.webapp.port+"/api/config"
    request.get(url, function(err, pres){
        if(err) {
            done(err, null);
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
                done(null, mCookieParts[aConst.sessionCookieName])
            } else {
                done(new Error("could not get "+aConst.sessionCookieName), null);
            }
        } else {
            console.error("Auth: Error - No cookie set in proxy!");
            errorResponce(res, "Could not get cookie");
        }
    }.bind(this));
};

AuthServer.prototype.forwardRequest = function(user, req, res, done, auth){

    var options = {
        protocal: this.options.webapp.protocal,
        host:     this.options.webapp.host,
        port:     this.options.webapp.port,
        path:     req.originalUrl,
        method:   req.method,
        headers:  req.headers
    };

    // if user, override cookie otherwise no cookie
    if(user) {
        options.headers.cookie = aConst.sessionCookieName+"="+user[aConst.proxySessionPrefix];
    } else {
        delete options.headers.cookie;
    }

    var data = "";
    if(req.body && req.method == "POST") {
        data = JSON.stringify(req.body);
    }

    if(auth){
        console.log("forwardRequest url:", options.path);
        console.log("forwardRequest headers:", options.headers.cookies);
        console.log("forwardRequest data:", data);
    }

    var sreq = http.request(options, function(sres) {
        sres.setEncoding('utf8');
        res.writeHead(sres.statusCode);
        if(auth){
            console.log("forwardRequest sres headers:", sres.headers);
        }

        var data = "";
        sres.on('data', function(chunk){
            data += chunk;
            res.write(chunk);
        });

        sres.on('end', function(){
            if(auth){
                console.log("forwardRequest data:", data);
            }

            res.end();
            // call done function if exist
            if(done) {
                done(null);
            }
        });

    }).on('error', function(e) {
        console.error("Auth: forwardRequest Error -", e.message);
        res.writeHead(500);
        res.end();

        done(e);
    });

    if(data.length > 0) {
        sreq.write( data );
    }

    sreq.end();
};
