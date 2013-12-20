/**
 * Authentication Server Module
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
var RequestUtil, aConst, rConst, SessionServer;

module.exports = AuthServer;

function AuthServer(options){
    try {
        // Glasslab libs
        RequestUtil   = require('./util.js').Request;
        aConst        = require('./auth.js').Const;
        rConst        = require('./routes.js').Const;
        SessionServer = require('./auth.js').SessionServer;
        WebStore      = require('./datastore.web.js');

        this.options = _.merge(
            {
                auth: { port: 8082 }
            },
            options
        );

        this.requestUtil = new RequestUtil(this.options);

        this.webstore = new WebStore(this.options);

        this.app = express();
        this.app.set('port', this.options.auth.port);
        this.sessionServer = new SessionServer(this.options, this.app, this.setupRoutes.bind(this));

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
            console.log("logout:", req.path);
            req.logout();
            res.redirect(rConst.root);
        }.bind(this));

        // POST - login
       this.app.post(rConst.api.login, this.loginRoute.bind(this));

        // Add include routes
        var includeRoute = function(req, res) {
            console.log("Include to Auth:", req.path);
            if( req.isAuthenticated()) {
                var user = req.session.passport.user;
                var cookie = "";
                if(user){
                    cookie = aConst.sessionCookieName+"="+user[aConst.webappSessionPrefix];
                }

                console.log("Auth passport user:", user);

                this.requestUtil.forwardRequestToWebApp({ cookie: cookie }, req, res, null, true);
                //console.log("Auth passport user:", req.session.passport.user);
            } else {
                // error in auth, redirect back to login
                console.error("Auth: Not Authenticated");
                res.redirect(rConst.api.login)
            }
            return;
        }.bind(this);

        // Add exclude routes
        var excludeRoute = function(req, res) {
            console.log("Exclude From Auth:", req.path);
            var user = req.session.passport.user;
            var cookie = "";
            if(user){
                cookie = aConst.sessionCookieName+"="+user[aConst.webappSessionPrefix];
            }

            this.requestUtil.forwardRequestToWebApp({cookie: cookie}, req, res);
            return;
        }.bind(this);

        // add excludeRoutes
        for(var e in rConst.auth.exclude){
            console.log("Exclude:", rConst.auth.exclude[e]);
           this.app.use(rConst.auth.exclude[e], excludeRoute);
        }

        // add includeRoutes
        for(var e in rConst.auth.include){
            console.log("Include:", rConst.auth.include[e]);
           this.app.use(rConst.auth.include[e], includeRoute);
        }

        // add specialRoutes
        for(var e in rConst.auth.special){
            console.log("Special:", rConst.auth.special[e]);
            this.app[rConst.auth.special[e].include](rConst.auth.special[e].route, includeRoute);
            this.app[rConst.auth.special[e].exclude](rConst.auth.special[e].route, excludeRoute);
        }

        // static content
        for(var i in rConst.static.include){
            var fullPath = path.resolve(__dirname + this.options.webapp.staticContentPath + rConst.static.include[i]);
            console.log("Static Content fullPath:", fullPath);
           this.app.use(rConst.static.include[i], express.static(fullPath) );
        }

       this.app.get("/", function(req, res){
            console.log("static root:", req.path);
            var fullPath = path.resolve(__dirname + this.options.webapp.staticContentPath + rConst.static.root);
            res.sendfile( fullPath );
        }.bind(this));

        // DEFAULT
       this.app.use(function defaultRoute(req, res) {
            console.log("defaultRoute:", req.path);
            res.redirect(rConst.root);
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

        this.sessionServer.getWebSession(req, res, function(err, session, done){
            if(err) {
                return next(err);
            }

            // save proxy session
            user[aConst.webappSessionPrefix] = session;

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

                        done(user, req, function(){
                            res.writeHead(200);
                            res.end( JSON.stringify(tuser) );
                        }.bind(this));
                    }.bind(this)
                );
            }.bind(this));

        }.bind(this));

    }.bind(this));

    auth(req, res, next);
};

/*
AuthServer.prototype.forwardRequest = function(user, req, res, done, auth){

    var options = {
        protocol: this.options.webapp.protocol,
        host:     this.options.webapp.host,
        port:     this.options.webapp.port,
        path:     req.originalUrl,
        method:   req.method,
        headers:  req.headers
    };

    // if user, override cookie otherwise no cookie
    if(user) {
        options.headers.cookie = aConst.sessionCookieName+"="+user[aConst.webappSessionPrefix];
    } else {
        delete options.headers.cookie;
    }

    var data = "";
    if(req.body && req.method == "POST") {
        data = JSON.stringify(req.body);
    }

    if(auth){
        console.log("forwardRequest url:",     options.path);
        console.log("forwardRequest method:",  options.method);
        console.log("forwardRequest cookie:",  options.headers.cookie);
        console.log("forwardRequest data:",    data);
        //console.log("forwardRequest user:",    user);
    }

    var sreq = http.request(options, function(sres) {
        // remove set cookie, but send test
        delete sres.headers['set-cookie'];
        res.writeHead(sres.statusCode, sres.headers);

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
*/