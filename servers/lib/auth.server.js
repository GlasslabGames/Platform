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

//var PassLocal  = require('passport-local').Strategy;
var Strategy   = require('./auth.strategy.js');
//var RedisStore = require('connect-redis')(express);
var CouchBaseStore = require('./sessionstore.couchbase.js')(express);

// Glasslab libs
var rConst     = require('./routes.const.js');
var WebStore   = require('./datastore.web.js');

module.exports = AuthServer;

function AuthServer(settings){
    try {
        this.settings = _.extend(
            {
                auth: { port: 8082, secret: "keyboard kitty"}
            },
            settings
        );

        this.app = express();

        this.webstore = new WebStore(this.settings);

        this.app.configure(function() {
            this.app.set('port', this.settings.auth.port);

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
                secret: this.settings.auth.secret,
                //store: new RedisStore(this.settings.sessionstore)
                store: new CouchBaseStore(this.settings.sessionstore)
            }));

            passport.use(new Strategy.Glasslab(this.settings));

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
        this.app.use(function defaultRoute(req, res, next) {

            // if logout or login then use next handler
            if( (req.method == 'GET'  && req.path == rConst.api.logout) ||
                (req.method == 'POST' && req.path == rConst.api.login) ) {
                next();
                return;
            }

            if( _.find(rConst.auth.exclude, function(item){
                    if(req.path.substring(0, item.length) == item) return 1;
                })
            ){
                console.log("Exclude From Auth:", req.path);
                this.forwardRequest(req.session.passport.user, req, res);
                return;
            }

            if( _.find(rConst.auth.include, function(item){
                    if(req.path.substring(0, item.length) == item) return 1;
                })
            ){
                console.log("Include to Auth:", req.path);
                if( req.isAuthenticated()) {
                    this.forwardRequest(req.session.passport.user, req, res);

                    console.log("Auth passport user:", req.session.passport.user);
                } else {
                    // error in auth, redirect back to login
                    console.error("Auth: path -", req.path);

                    res.redirect(rConst.api.login)
                }
                return;
            }

            this.forwardRequest(req.session.passport.user, req, res);

        }.bind(this));

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
        });

        // POST
        this.app.post(rConst.api.login, function loginRoute(req, res, next) {

            var auth = passport.authenticate('glasslab', function(err, user, info) {
                if(err) {
                    return next(err);
                }

                if (!user) {
                    req.session.messages =  [info.message];
                    return res.redirect(rConst.api.login)
                }

                this.getWebSession(req, function(err, session){
                    if(err) {
                        return next(err);
                    }

                    // save web session
                    user.webSession = session;

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

                                //console.log("login user:", tuser);

                                res.writeHead(200);
                                res.end( JSON.stringify(tuser) );
                            }.bind(this)
                        );
                    }.bind(this));
                }.bind(this));

            }.bind(this));

            auth(req, res, next);

        }.bind(this));

    } catch(err){
        console.trace("Auth: setupRoutes Error -", err);
    }
};

AuthServer.prototype.getWebSession = function(req, done){
    var cookieSessionId = "JSESSIONID";
    var options = {
        protocal: this.settings.webapp.protocal,
        host:     this.settings.webapp.host,
        port:     this.settings.webapp.port,
        path:     req.url,
        method:   req.method,
        headers:  req.headers
    };
    delete options.headers.cookie;

    var url = this.settings.webapp.protocal+"://"+this.settings.webapp.host+":"+this.settings.webapp.port+"/api/config"
    request.get(url, function(err, res, body){
        if(err) {
            done(err, null);
        }

        // parse cookie, to get web session
        var mCookieParts = {};
        var aCookieParts = res.headers['set-cookie'][0].split(';');
        for(var p in aCookieParts) {
            var cp = aCookieParts[p].split('=');
            mCookieParts[cp[0]] = cp[1] || "";
        }

        if(mCookieParts.hasOwnProperty(cookieSessionId)) {
            //console.log("cookieParts:", mCookieParts);
            done(null, mCookieParts[cookieSessionId])
        } else {
            done(new Error("could not get "+cookieSessionId), null);
        }

    });
};

AuthServer.prototype.forwardRequest = function(user, req, res, done){

    var options = {
        protocal: this.settings.webapp.protocal,
        host:     this.settings.webapp.host,
        port:     this.settings.webapp.port,
        path:     req.url,
        method:   req.method,
        headers:  req.headers
    };
    //console.log("forwardRequest path:", options.path);
    //console.log("forwardRequest headers:", req.headers);

    // if user, override cookie otherwise no cookie
    if(user) {
        options.headers.cookie = "JSESSIONID="+user.webSession;
    } else {
        delete options.headers.cookie;
    }

    var data = "";
    if(req.body) {
        data = JSON.stringify(req.body);
    }

    var sreq = http.request(options, function(sres) {
        sres.setEncoding('utf8');
        res.writeHead(sres.statusCode);
        //console.log("forwardRequest sres headers:", sres.headers);

        var data = "";
        sres.on('data', function(chunk){
            data += chunk;
            res.write(chunk);
        });

        sres.on('end', function(){
            //console.log("forwardRequest data:", data);

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
