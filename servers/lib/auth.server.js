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
var PassLocal  = require('passport-local').Strategy;
var RedisStore = require('connect-redis')(express);
// Glasslab libs
var MySQL      = require('./datastore.mysql.js');
var apiConts   = require('./api.routes.const.js');

function AuthServer(settings){
    this.settings = _.extend(
        {
            auth: {
                port: 8082,
                secret: "keyboard kitty"
            }
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

                        return done(null, user);
                }.bind(this));


            }.bind(this)
        ));

        // Passport session setup.
        //   To support persistent login sessions, Passport needs to be able to
        //   serialize users into and deserialize users out of the session.  Typically,
        //   this will be as simple as storing the user ID when serializing, and finding
        //   the user by ID when deserializing.
        passport.serializeUser(function(user, done) {
            done(null, user.id);
        });

        passport.deserializeUser(function(id, done) {
            this.findById(id, function (err, user) {
                done(err, user);
            }.bind(this));
        }.bind(this));

        this.app.use(passport.initialize());
        this.app.use(passport.session());
    }.bind(this));

    // GET
    this.app.get(apiConts.root, function(req, res){
        res.render('index', { user: req.user });
    });

    this.app.get(apiConts.crossDomain, function(req, res){
        // need to resolve relative path to absolute, to prevent "Error: Forbidden"
        res.sendfile( path.resolve(__dirname + '/../static' + apiConts.crossDomain) );
    });

    this.app.get(apiConts.account,
        this.ensureAuthenticated.bind(this),
        function(req, res){
            res.render('account', { user: req.user });
    });

    this.app.get(apiConts.login, function(req, res){
        res.render('login', {
            user:    req.user,
            message: req.session.messages
        });
    });

    this.app.get(apiConts.logout, function(req, res){
        req.logout();
        res.redirect(apiConts.root);
    });

    // POST
    this.app.post(apiConts.login, function(req, res, next) {
        passport.authenticate('local', function(err, user, info) {
            if(err) {
                return next(err);
            }

            if (!user) {
                req.session.messages =  [info.message];
                return res.redirect(apiConts.logout)
            }

            req.logIn(user, function(err) {
                if (err) { return next(err); }
                return res.redirect(apiConts.root);
            });
        })(req, res, next);
    });

    // start server
    http.createServer(this.app).listen(this.app.get('port'), function(){
        console.log('Auth: Server listening on port ' + this.app.get('port'));
    }.bind(this));
}

AuthServer.prototype.findById = function(id, done) {
    console.log("findById");

    // TODO clean up DB requests
    var q = "SELECT * FROM GL_USER WHERE id="+this.ds.escape(id);
    this.ds.query(q,
        function(err, data) {
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
        function(err, data) {
            if(err) {
                return done(new Error( err.toString() ));
            }

            if(!_.isArray(data) || data.length == 0) {
                return done(new Error('User ' + username + ' does not exist'));
            }

            return done(null, data[0]);
        }.bind(this));

}

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
AuthServer.prototype.ensureAuthenticated = function(req, res, next) {
    if (req.isAuthenticated()) {
        // all ok, move on
        return next();
    }

    res.redirect(apiConts.login);
}

module.exports = AuthServer;
