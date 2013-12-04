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
var urlParser  = require('url');
var http       = require('http');
// Third-party libs
var _          = require('underscore');
var express    = require('express');
var passport   = require('passport');
var PassLocal  = require('passport-local').Strategy;
// Glasslab libs
var MySQL     = require('./datastore.mysql.js');

var users = [
    { id: 1, username: 'bob', password: '1234', email: 'bob@example.com' },
    { id: 2, username: 'joe', password: '1234', email: 'joe@example.com' }
];


function findById(id, fn) {
    var idx = id - 1;
    if (users[idx]) {
        fn(null, users[idx]);
    } else {
        fn(new Error('User ' + id + ' does not exist'));
    }
}

function findByUsername(username, fn) {
    for (var i = 0, len = users.length; i < len; i++) {
        var user = users[i];
        if (user.username === username) {
            return fn(null, user);
        }
    }
    return fn(null, null);
}

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
    res.redirect('/login')
}


// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    findById(id, function (err, user) {
        done(err, user);
    });
});


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
        this.app.use(express.session({ secret: this.settings.auth.secret }));

        // Use the LocalStrategy within Passport.
        //   Strategies in passport require a `verify` function, which accept
        //   credentials (in this case, a username and password), and invoke a callback
        //   with a user object.  In the real world, this would query a database;
        //   however, in this example we are using a baked-in set of users.
        passport.use(new PassLocal(
            function(username, password, done) {
                // asynchronous verification, for effect...
                process.nextTick(function () {
                    // Find the user by username.  If there is no user with the given
                    // username, or the password is not correct, set the user to `false` to
                    // indicate failure and set a flash message.  Otherwise, return the
                    // authenticated `user`.
                    findByUsername(username, function(err, user) {
                        if (err) { return done(err); }
                        if (!user) { return done(null, false, { message: 'Unknown user ' + username }); }
                        if (user.password != password) { return done(null, false, { message: 'Invalid password' }); }
                        return done(null, user);
                    })
                });
            }
        ));

        this.app.use(passport.initialize());
        this.app.use(passport.session());
    }.bind(this));

    this.app.get('/', function(req, res){
        res.render('index', { user: req.user });
    });

    this.app.get('/account', ensureAuthenticated, function(req, res){
        res.render('account', { user: req.user });
    });

    this.app.get('/login', function(req, res){
        res.render('login', { user: req.user, message: req.session.messages });
    });

    this.app.get('/logout', function(req, res){
        req.logout();
        res.redirect('/');
    });


    this.app.post('/login', function(req, res, next) {
        passport.authenticate('local', function(err, user, info) {
            if (err) { return next(err) }
            if (!user) {
                req.session.messages =  [info.message];
                return res.redirect('/login')
            }
            req.logIn(user, function(err) {
                if (err) { return next(err); }
                return res.redirect('/missions');
            });
        })(req, res, next);
    });

    // start server
    http.createServer(this.app).listen(this.app.get('port'), function(){
        console.log('Auth: Server listening on port ' + this.app.get('port'));
    }.bind(this));
}

module.exports = AuthServer;
