/**
 * Authentication Server Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  when       - https://github.com/cujojs/when
 *  express    - https://github.com/visionmedia/express
 *  passport   - https://github.com/jaredhanson/passport
 *  validator  - https://github.com/chriso/node-validator
 *  google oauth - https://github.com/jaredhanson/passport-google-oauth
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
var check      = require('validator').check;

// load at runtime
var Util, aConst, rConst, lConst;

module.exports = AuthService;

function AuthService(options){
    try {
        var Accounts, WebStore, LMSStore, AuthStore;
        this.options = _.merge(
            {
                auth: { port: 8082 }
            },
            options
        );

        // Glasslab libs
        rConst        = require('../routes.js').Const;
        Util          = require('../core/util.js');
        aConst        = require('./auth.js').Const;
        Accounts      = require('./auth.js').Accounts;
        AuthStore     = require('./auth.js').Datastore.Couchbase;

        this.stats            = new Util.Stats(this.options, "Auth");
        this.requestUtil      = new Util.Request(this.options);
        this.authStore        = new AuthStore(this.options.auth.datastore.couchbase);
        this.accountsManager  = new Accounts.Manager(this.options);
        this.glassLabStrategy = this.accountsManager.get("glasslab");

        // TODO: find all webstore, lmsStore dependancies and move to using service APIs
        WebStore      = require('../dash/dash.js').Datastore.MySQL;
        lConst        = require('../lms/lms.js').Const;
        LMSStore      = require('../lms/lms.js').Datastore.MySQL;
        this.webstore = new WebStore(this.options.webapp.datastore.mysql);
        this.lmsStore = new LMSStore(this.options.lms.datastore.mysql);

    } catch(err){
        console.trace("Auth: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

AuthService.prototype.appConfig = function(app) {
    this.passport = passport;

    // setup passport for all account types
    this.accountsManager.setupPassport(this.passport, this);

    // session de/serialize
    this.passport.serializeUser(function serializeUser(user, done) {
        done(null, user);
    });
    this.passport.deserializeUser(function deserializeUser(user, done) {
        done(null, user);
    });

    app.use(this.passport.initialize());
    app.use(this.passport.session());

    // setup app routes for all account types
    this.accountsManager.setupRoutes(app, this.passport);
}


AuthService.prototype.start = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // connect to auth store
    this.authStore.connect()
        .then(function(){
            console.log("AuthService: Couchbase Auth DS Connected");
            this.stats.increment("info", "Couchbase.Connect");
        }.bind(this),
            function(err){
                console.trace("AuthService: Couchbase Auth Error -", err);
                this.stats.increment("error", "Couchbase.Connect");
            }.bind(this))

        // connect to webstore
        .then(function(){
            return this.webstore.connect();
        }.bind(this))
        .then(function(){
            console.log("AuthService: MySQL Web DS Connected");
            this.stats.increment("info", "MySQL.Connect");
        }.bind(this),
            function(err){
                console.trace("AuthService: MySQL Web DS Error -", err);
                this.stats.increment("error", "MySQL.Connect");
            }.bind(this))

        // connect to lmsStore
        .then(function(){
            return this.lmsStore.connect();
        }.bind(this))
        .then(function(){
            console.log("AuthService: MySQL LMS DS Connected");
            this.stats.increment("info", "MySQL.Connect");
        }.bind(this),
            function(err){
                console.trace("AuthService: MySQL LMS DS Error -", err);
                this.stats.increment("error", "MySQL.Connect");
            }.bind(this))

        .then(resolve, reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


AuthService.prototype.setupRoutes = function() {
    try {

        // Add include routes
        var includeRoute = function(req, res) {
            //console.log("Include to Auth:", req.originalUrl);
            this.stats.increment("info", "Route.Auth");

            if( req.isAuthenticated()) {
                this.stats.increment("info", "Route.Auth.Ok");

                //console.log("Auth passport user:", user);
                var user = req.session.passport.user;
                this.forwardAuthenticatedRequestToWebApp(user, req, res);

                //console.log("Auth passport user:", req.session.passport.user);
            } else {
                this.stats.increment("error", "Route.Auth.Fail");
                // error in auth, redirect back to login
                //console.log("headers:", req.headers);
                console.error("Auth: Not Authenticated");

                if(req.originalUrl.indexOf("/api") != -1) {
                    res.status(400).end();
                } else {
                    res.clearCookie('connect.sid', { path: '/' });
                    res.redirect(rConst.login);
                }
            }
            return;
        }.bind(this);

        // Add exclude routes
        var excludeRoute = function(req, res) {
            this.stats.increment("info", "Route.NoAuth");

            //console.log("Exclude From Auth:", req.originalUrl);
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

        // static dir content
        for(var i in rConst.static.dirs){
            var fullPath, route;
            if(_.isObject(rConst.static.dirs[i])) {
                route = rConst.static.dirs[i].route;
                fullPath = path.resolve(this.options.webapp.staticContentPath + rConst.static.dirs[i].path);
            } else {
                route = rConst.static.dirs[i];
                fullPath = path.resolve(this.options.webapp.staticContentPath + rConst.static.dirs[i]);
            }

            console.log("Static Dir Content:", route, "->", fullPath);
            this.app.use(route, express.static(fullPath) );
        }

        // static files content
        _.forEach(rConst.static.files, function (item) {
            var fullPath, route;
            if(_.isObject(item)) {
                route = item.route;
                fullPath = path.resolve(this.options.webapp.staticContentPath + item.path);

                console.log("Static File Content:", route, "->", fullPath);
                this.app.get(route, function(req, res){
                    // need to resolve relative path to absolute, to prevent "Error: Forbidden"
                    res.sendfile( fullPath );
                } );
            }
        }.bind(this));

        this.app.get(rConst.root, function(req, res){
            console.log("static root:", req.originalUrl);
            this.stats.increment("info", "Route.Static.Root");

            var fullPath = path.resolve(this.options.webapp.staticContentPath + rConst.static.root);
            res.sendfile( fullPath );
        }.bind(this));

        // DEFAULT
        this.app.use(function defaultRoute(req, res) {
            this.stats.increment("info", "Route.Default");

            console.log("defaultRoute:", req.originalUrl);
            res.redirect(rConst.root);
        }.bind(this));

    } catch(err){
        console.trace("Auth: setupRoutes Error -", err);
        this.stats.increment("error", "Route.Generic");
    }
};


AuthService.prototype.forwardAuthenticatedRequestToWebApp = function(user, req, res, alreadyTried) {
    var cookie = "";
    if(user){
        cookie = aConst.sessionCookieName+"="+user[aConst.webappSessionPrefix];
    }

    this.requestUtil.forwardRequestToWebApp({ cookie: cookie }, req, null,
        function(err, sres, data){
            var statusCode = 500;

            if(err) {
                console.error("forwardRequestToWebApp:", err);
                res.writeHead(statusCode);
                res.end();
                return;
            }

            if(!sres) {
                res.writeHead(statusCode);
                res.end();
                return;
            }

            if( sres.statusCode) {
                statusCode = Math.floor(sres.statusCode/100)*100;
            }

            if( statusCode == 200 ||
                statusCode == 300) {
                res.writeHead(sres.statusCode, sres.headers);

                // handle attachments
                if( sres.headers['content-disposition'] &&
                    (sres.headers['content-disposition'].indexOf('attachment') != -1) ) {
                    res.end(data, 'binary');
                } else {
                    res.end(data);
                }
            }
            else if(statusCode == 400){
                //console.log("includeRoute forwardRequestToWebApp - err:", err, ", data:", data);
                if(alreadyTried) {
                    this.requestUtil.errorResponse(res, data, sres.statusCode);
                    return;
                }

                try {
                    data = JSON.parse(data);
                } catch(err){
                    // error is ok
                }

                // check if need to update webSession
                if( sres.statusCode == 401 &&
                    _.isObject(data) &&
                    data.key == "must.login") {

                    // update session
                    this.sessionServer.getWebSession(function(err, waSession, saveWebSession){
                        if(err) {
                            res.writeHead(sres.statusCode, sres.headers);
                            res.end(JSON.stringify(data));
                            return;
                        }

                        if(saveWebSession) {

                            // save web session
                            saveWebSession(waSession, req.session.id, function(err){
                                if(err) {
                                    this.requestUtil.errorResponse(res, err, 500);
                                    return;
                                }

                                // update web session in session store
                                req.session.passport.user[aConst.webappSessionPrefix] = waSession;
                                this.sessionServer.updateWebSessionInSession(req.session.id, req.session, function(err, user){
                                    if(err) {
                                        this.requestUtil.errorResponse(res, err, 500);
                                        return;
                                    }

                                    // try again
                                    this.forwardAuthenticatedRequestToWebApp(user, req, res, true);
                                }.bind(this));
                            }.bind(this));
                        }
                    }.bind(this));
                } else {
                    res.writeHead(sres.statusCode, sres.headers);
                    res.end(JSON.stringify(data));
                    return;
                }
            } else {
                this.stats.increment("error", "ForwardToWebApp");

                // all else errors
                this.requestUtil.errorResponse(res, data, sres.statusCode || 500);
            }
    }.bind(this));
}


AuthService.prototype.registerUser = function(userData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    this.glassLabStrategy.registerUser(userData)
        .then(resolve, reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

AuthService.prototype.checkUserPerminsToUserData = function(userData, loginUserSessionData){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // TODO: switch based on user (from userId) login type
    if( (userData.loginType == aConst.login.type.glassLabV1) ||
        (userData.loginType == aConst.login.type.glassLabV2) ){
        this.glassLabStrategy.checkUserPerminsToUserData(userData, loginUserSessionData)
            .then(resolve, reject);
    } else {
            this.stats.increment("error", "RegisterUser.InvalidLoginType");
            reject({error: "invalid login type"});
    }
// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};



AuthService.prototype._updateUserData = function(userData, loginUserSessionData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
        if( (userData.loginType == aConst.login.type.glassLabV1) ||
            (userData.loginType == aConst.login.type.glassLabV2) ){
            this.glassLabStrategy.updateUserData(userData, loginUserSessionData)
                .then(resolve, reject);
        } else {
            this.stats.increment("error", "RegisterUser.InvalidLoginType");
            reject({error: "invalid login type"});
        }
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};
