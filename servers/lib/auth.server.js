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
//var urlParser  = require('url');
var http       = require('http');
var path       = require('path');
// Third-party libs
var _          = require('underscore');
var express    = require('express');
var passport   = require('passport');
var crypto     = require('crypto');
var request    = require('request');
var PassLocal  = require('passport-local').Strategy;
var RedisStore = require('connect-redis')(express);
// Glasslab libs
var MySQL      = require('./datastore.mysql.js');
var rConst     = require('./routes.const.js');

function AuthServer(settings){
    try {
        this.settings = _.extend(
            {
                auth: { port: 8082, secret: "keyboard kitty"}
            },
            settings
        );


        this.ds = new MySQL(this.settings.datastore);
        // Connect to data store
        this.ds.testConnection();

        this.app = express();

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
                store: new RedisStore(settings.sessionstore)
            }));

            // Use the LocalStrategy within Passport.
            //   Strategies in passport require a `verify` function, which accept
            //   credentials (in this case, a username and password), and invoke a callback
            //   with a user object.  In the real world, this would query a database;
            //   however, in this example we are using a baked-in set of users.
            passport.use(new PassLocal(
                function(username, password, done) {
                    console.log("Auth: check user/pass");

                    // TODO clean up DB requests
                    var q = "SELECT * FROM GL_USER WHERE username="+this.ds.escape(username);
                    this.ds.query(q,
                        function(err, data) {
                            if(err) {
                                return done(err);
                            }

                            if(!_.isArray(data) || data.length == 0) {
                                return done(null, false, { message: 'Unknown user ' + username });
                            }

                            var user = data[0];
                            var sha256 = crypto.createHash('sha256');
                            sha256.update(password, 'utf8');
                            hpass = sha256.digest('base64');

                            if(hpass != user.PASSWORD) {
                                return done(null, false, { message: 'Invalid password' });
                            }

                            console.log("Login OK");

                            return done(null, user);
                    }.bind(this));

                }.bind(this)
            ));

            // Passport session setup.
            //   To support persistent login sessions, Passport needs to be able to
            //   serialize users into and deserialize users out of the session.  Typically,
            //   this will be as simple as storing the user ID when serializing, and finding
            //   the user by ID when deserializing.
            passport.serializeUser(function serializeUser(user, done) {
                done(null, user.id);
            });

            passport.deserializeUser(function deserializeUser(id, done) {
                this.findById(id, function (err, user) {
                    done(err, user);
                }.bind(this));
            }.bind(this));

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

                this.forwardRequest(req, res);
                return;
            }

            if( _.find(rConst.auth.include, function(item){
                    if(req.path.substring(0, item.length) == item) return 1;
                })
            ){
                console.log("Include to Auth:", req.path);

                if( req.isAuthenticated()) {
                    this.forwardRequest(req, res);
                } else {
                    // error in auth, redirect back to login
                    console.error("Auth: path -", req.path);

                    res.redirect(rConst.api.login)
                }
                return;
            }

            this.forwardRequest(req, res);

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
            passport.authenticate('local', function(err, user, info) {
                if(err) {
                    return next(err);
                }

                if (!user) {
                    req.session.messages =  [info.message];
                    return res.redirect(rConst.api.login)
                }

                this.forwardRequest(req, res, function logInforwardRequest(err){
                    if(err) {
                        return next(err);
                    }

                    req.logIn(user, function(err) {
                        if(err) {
                            return next(err);
                        }
                    }.bind(this));

                }.bind(this));
            }.bind(this))(req, res, next);
        }.bind(this));

    } catch(err){
        console.trace("Auth: setupRoutes Error -", err);
    }
};

AuthServer.prototype.forwardRequest = function(req, res, done){
    var options = {
        protocal: this.settings.webapp.protocal,
        host:     this.settings.webapp.host,
        port:     this.settings.webapp.port,
        path:     req.url,
        method:   req.method,
        headers:  req.headers
    };

    var data = "";
    if(req.body) {
        data = JSON.stringify(req.body);
    }

    var sreq = http.request(options, function(sres) {
        sres.setEncoding('utf8');
        res.writeHead(sres.statusCode);

        sres.on('data', function(chunk){
            res.write(chunk);
        });

        sres.on('end', function(){
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

AuthServer.prototype.findById = function(id, done) {
    console.log("Auth: findById");

    // TODO clean up DB requests
    var q = "SELECT * FROM GL_USER WHERE id="+this.ds.escape(id);
    this.ds.query(q,
        function findById(err, data) {
            if(err) {
                return done(new Error( err.toString() ));
            }

            if(!_.isArray(data) || data.length == 0) {
                return done(new Error('User ' + id + ' does not exist'));
            }

            return done(null, data[0]);
        }.bind(this));
}

AuthServer.prototype.findByUsername = function(username, done) {
    console.log("findByUsername");

    // TODO clean up DB requests
    var q = "SELECT * FROM GL_USER WHERE username="+this.ds.escape(username);
    this.ds.query(q,
        function findByUsername(err, data) {
            if(err) {
                return done(new Error( err.toString() ));
            }

            if(!_.isArray(data) || data.length == 0) {
                return done(new Error('User ' + username + ' does not exist'));
            }

            return done(null, data[0]);
        }.bind(this));

}

module.exports = AuthServer;
