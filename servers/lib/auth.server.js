/**
 * Authentication Server Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  when       - https://github.com/cujojs/when
 *  express    - https://github.com/visionmedia/express
 *  passport   - https://github.com/jaredhanson/passport
 *
 *  node-edmodo-api - https://github.com/gabceb/node-edmodo-api
 *
 *  validator       - https://github.com/chriso/node-validator
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
var Util, aConst, rConst;

module.exports = AuthServer;

function AuthServer(options){
    try {
        var SessionServer, Strategy, WebStore;
        this.options = _.merge(
            {
                auth: { port: 8082 }
            },
            options
        );

        // Glasslab libs
        aConst        = require('./auth.js').Const;
        rConst        = require('./routes.js').Const;
        Util          = require('./util.js');
        SessionServer = require('./auth.js').SessionServer;
        WebStore      = require('./webapp.js').Datastore.MySQL;
        Strategy      = require('./auth.js').Strategy;

        this.stats            = new Util.Stats(this.options, "Auth");
        this.requestUtil      = new Util.Request(this.options);
        this.webstore         = new WebStore(this.options.webapp.datastore.mysql);
        this.glassLabStrategy = new Strategy.Glasslab(this.options);

        // if starts with DOT then add current dir to start
        if(this.options.webapp.staticContentPath.charAt(0) == '.') {
            this.options.webapp.staticContentPath = __dirname + "/" + this.options.webapp.staticContentPath;
        }

        this.app = express();
        this.app.set('port', this.options.auth.port);
        this.sessionServer = new SessionServer(
            this.options,
            this.app,
            this.setupRoutes.bind(this),
            function(passport){
                passport.use(this.glassLabStrategy);
            }.bind(this)
        );

        // start server
        http.createServer(this.app).listen(this.app.get('port'), function createServer(){
            console.log('---------------------------------------------');
            console.log('Auth: Server listening on port ' + this.app.get('port'));
            console.log('---------------------------------------------');
            this.stats.increment("info", "ServerStarted");
        }.bind(this));

    } catch(err){
        console.trace("Auth: Error -", err);
        this.stats.increment("error", "Generic");
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

        this.app.get(rConst.api.user.logout, function logoutRoute(req, res){
            //console.log("logout:", req.originalUrl);
            if( req.session &&
                req.session.passport &&
                req.session.passport.user) {
                // delete webapp session
                this.sessionServer.deleteWASession(req.session.passport.user[aConst.webappSessionPrefix]);
            }

            this.stats.increment("info", "Logout");
            req.logout();
            res.redirect(rConst.root);
        }.bind(this));

        // POST - login
        this.app.post(rConst.api.user.login, this.loginRoute.bind(this));

        // POST - register user
        this.app.post(rConst.api.user.regUser, this.registerUserRoute.bind(this));
        // POST - register manager
        this.app.post(rConst.api.user.regManager, this.registerManagerRoute.bind(this));

        // POST - update user data
        this.app.post(rConst.api.user.updateUser, this.updateUserRoute.bind(this));

        // Add include routes
        var includeRoute = function(req, res) {
            //console.log("Include to Auth:", req.originalUrl);
            this.stats.increment("info", "Route.Auth");

            if( req.isAuthenticated()) {
                this.stats.increment("info", "Route.Auth.Ok");

                /*
                if( req.method == 'POST') {
                    //
                    var results = req.path.match(/\/user\/([0-9]*)/);
                    // match finds results, an array with more then one element and the group is a number
                    if( results &&
                        results.length > 1 &&
                        !isNaN(parseInt(results[1]) ) ) {

                        this.stats.increment("info", "Route.UpdateUserData");
                        //console.log("Include to Auth - POST path:", req.path, ", results:", results);
                        this.updateUserRoute(req, res);
                        return;
                    }
                }
                */

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

AuthServer.prototype.forwardAuthenticatedRequestToWebApp = function(user, req, res, alreadyTried) {
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

/**
 * Registers a user with role of instructor or student
 * 1. get institution
 * 2. create the new user
 * 3. if student, enroll them in the course
 */
AuthServer.prototype.registerUserRoute = function(req, res, next) {
    // only allow for POST on login
    if(req.method != 'POST') { next(); return;}

    this.stats.increment("info", "Route.Register.User");
    //console.log("Auth registerUserRoute - body:", req.body);

    req.body.username  = Util.ConvertToString(req.body.username);
    req.body.firstName = Util.ConvertToString(req.body.firstName);
    req.body.lastName  = Util.ConvertToString(req.body.lastName);
    req.body.password  = Util.ConvertToString(req.body.password);
    req.body.type      = Util.ConvertToString(req.body.type);

    if( !(
            req.body.username &&
            req.body.firstName &&
            req.body.lastName &&
            req.body.password  &&
            req.body.type &&
            _.isNumber(req.body.associatedId)
        ) )
    {
        this.stats.increment("error", "Route.Register.User.MissingFields");
        this.requestUtil.errorResponse(res, "missing some fields", 400);
        return;
    }

    var systemRole = aConst.role.student;
    var courseId, institutionId;

    var registerErr = function(err, code){
        if(!code) code = 500;

        this.stats.increment("error", "Route.Register.User");
        console.error("AuthServer registerUser Error:", err);
        this.requestUtil.jsonResponse(res, err, code);
    }.bind(this);

    var register = function(institutionId){
        var userData = {
            username:      req.body.username,
            firstName:     req.body.firstName,
            lastName:      req.body.lastName,
            email:         req.body.email,
            password:      req.body.password,
            systemRole:    systemRole,
            institutionId: institutionId,
            loginType:     aConst.login.type.glassLabV2
        };

        this._registerUser(userData)
            .then(function(userId){
                // if student, enroll in course
                if(systemRole == aConst.role.student) {
                    // courseId
                    this.stats.increment("info", "AddUserToCourse");
                    this.webstore.addUserToCourse(courseId, userId, systemRole)
                        .then(function(){
                            this.stats.increment("info", "Route.Register.User."+Util.String.capitalize(systemRole)+".Created");
                            this.glassLabLogin(req, res, next);
                        }.bind(this))
                        // catch all errors
                        .then(null, registerErr);
                } else {
                    this.stats.increment("info", "Route.Register.User."+Util.String.capitalize(systemRole)+".Created");
                    this.glassLabLogin(req, res, next);
                }
            }.bind(this))
            // catch all errors
            .then(null, registerErr);
    }.bind(this);

    // is institution -> instructor
    if(req.body.type.toLowerCase() == aConst.code.type.institution) {
        systemRole = aConst.role.instructor;
        // validate institution Id (associatedId == institutionId)
        institutionId = req.body.associatedId;
        this.webstore.getInstitution(institutionId)
            // register, passing in institutionId
            .then(function(data){
                if( data &&
                    data.length &&
                    institutionId == data[0].ID) {
                    register(institutionId);
                } else {
                    this.stats.increment("error", "Route.Register.User.InvalidInstitution");
                    registerErr({"error": "institution not found"});
                }
            }.bind(this))
            // catch all errors
            .then(null, registerErr);
    } else {
        // else student
        // get institution Id from course
        courseId = req.body.associatedId;
        this.webstore.getInstitutionIdFromCourse(courseId)
            // register, passing in institutionId
            .then(function(data){
                if(data && data.length) {
                    institutionId = data[0].institutionId;
                    register(institutionId);
                } else {
                    this.stats.increment("error", "Route.Register.User.InvalidInstitution");
                    registerErr({"error": "institution not found"});
                }
            }.bind(this))
            // catch all errors
            .then(null, registerErr);
    }

    this.stats.increment("info", "Route.Register.User."+Util.String.capitalize(systemRole));
};

/**
 * Registers a user with role of manager
 * 1. validate institution not already taken
 * 2. validate license key
 * 3. create the new user
 *    1. validate email and unique
 *    2. validate username unique
 * 4. create institution
 * 5. create code with institutionId
 * 6. update license institutionId, redeemed(true), expiration(date -> now + LICENSE_VALID_PERIOD)
 * 7. update user with institutionId
 */
AuthServer.prototype.registerManagerRoute = function(req, res, next) {
    // only allow for POST on login
    if(req.method != 'POST') { next(); return;}

    // make sure inputs are strings
    req.body.email     = Util.ConvertToString(req.body.email);
    req.body.firstName = Util.ConvertToString(req.body.firstName);
    req.body.lastName  = Util.ConvertToString(req.body.lastName);
    req.body.password  = Util.ConvertToString(req.body.password);
    req.body.key       = Util.ConvertToString(req.body.key);

    this.stats.increment("info", "Route.Register.Manager");
    //console.log("Auth registerManagerRoute - body:", req.body);
    if( !(
            req.body.email  &&
            req.body.firstName &&
            req.body.lastName &&
            req.body.password &&
            req.body.institution &&
            req.body.key
        ) )
    {
        this.stats.increment("error", "Route.Register.Manager.MissingFields");
        this.requestUtil.errorResponse(res, "missing some fields", 400);
    }

    // copy email to username for login
    req.body.username = req.body.email;
    var user = req.session.passport.user;
    var cookie = "";
    if(user){
        cookie = aConst.sessionCookieName+"="+user[aConst.webappSessionPrefix];
    }
    this.requestUtil.forwardRequestToWebApp({ cookie: cookie }, req, null,
        function(err, sres, data){
            if(err) {
                this.requestUtil.errorResponse(res, err, 500);
            }

            if(sres.statusCode == 200) {
                this.stats.increment("info", "Route.Register.Manager.Created");
                this.glassLabLogin(req, res, next);
            } else {
                this.stats.increment("error", "Route.Register.Manager.ForwardRequest");

                // don't use requestUtil response as it could contain custom headers, thus writing head
                res.writeHead(sres.statusCode, sres.headers);
                res.end(data);
            }
        }.bind(this));

    // TODO: refactor this and create license system
    /*
     // validate email
     this.sessionServer.validateEmail(req.body.email)

     // validate license key
     .then(function(){
     return this.license.checkLicense(req.body.key)
     }.bind(this))

     // validate institution not already taken
     .then(function(){
     return this.license.checkInstitution(req.body.institution)
     }.bind(this))

     // catch all errors
     .then(null, function(err, code){

     }.bind(this));
     */
};

AuthServer.prototype._registerUser = function(userData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
        if( (userData.loginType == aConst.login.type.glassLabV1) ||
            (userData.loginType == aConst.login.type.glassLabV2) ){
            this.glassLabStrategy.registerUser(userData)
                .then(resolve, reject);
        } else {
            this.stats.increment("error", "RegisterUser.InvalidLoginType");
            reject({error: "invalid login type"});
        }
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

AuthServer.prototype._updateUserData = function(userData, loginUserSessionData){
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

AuthServer.prototype.updateUserRoute = function(req, res, next) {
    // only allow for POST on login
    if(req.method != 'POST') { next(); return; }
    // only if authenticated
    if(!req.isAuthenticated()) { next(); return; }

    this.stats.increment("info", "Route.Update.User");
    //console.log("Auth updateUserRoute - body:", req.body);
    if( !(req.body.id) )
    {
        this.stats.increment("error", "Route.Update.User.MissingId");
        this.requestUtil.errorResponse(res, "missing the id", 400);
        return;
    }

    if( !(
            req.body.username &&
            req.body.firstName &&
            req.body.lastName
        ) )
    {
        this.stats.increment("error", "Route.Update.User.MissingFields");
        this.requestUtil.errorResponse(res, "missing data fields", 400);
        return;
    }

    var userData = {
        id:            req.body.id,
        username:      req.body.username,
        firstName:     req.body.firstName,
        lastName:      req.body.lastName,
        email:         req.body.email,
        name:          req.body.name,
        password:      req.body.password,
        systemRole:    req.body.role,
        institutionId: req.body.institution,
        loginType:     aConst.login.type.glassLabV2  // TODO add login type to user data on client
    };

    var loginUserSessionData = req.session.passport.user;

    // wrap getSession in promise
    this._updateUserData(userData, loginUserSessionData)
    // save changed data
    .then(function(dataChanged){
        if(dataChanged) {
            this.stats.increment("info", "Route.Update.User.Changed");
            return this.sessionServer.updateUserDataInSession(req.session);
        } else {
            return Util.PromiseContinue();
        }
    }.bind(this))
    // all ok
    .then(function(){
        this.stats.increment("info", "Route.Update.User.Done");
        this.requestUtil.jsonResponse(res, userData);
    }.bind(this))
    // error
    .catch(function(err){
        this.stats.increment("error", "Route.Update.User");
        console.error("Auth - updateUserRoute error:", err);
        this.requestUtil.errorResponse(res, err, 400);
    }.bind(this)
    );
}


AuthServer.prototype.loginRoute = function(req, res, next) {
    // only allow for POST on login
    if(req.method != 'POST') { next(); return;}

    this.stats.increment("info", "Route.Login");
    this.glassLabLogin(req, res, next);
};

AuthServer.prototype.glassLabLogin = function(req, res, next) {
    //console.log("Auth loginRoute");
    var auth = passport.authenticate('glasslab', function(err, user, info) {
        if(err) {
            this.stats.increment("error", "Route.Login.Auth");
            this.requestUtil.errorResponse(res, "login auth", 500);
            return;
        }

        if (!user) {
            //req.session.messages =  [info];
            //res.redirect(rConst.api.user.login);
            this.stats.increment("error", "Route.Login.NoUser");
            this.requestUtil.errorResponse(res, info, 401);
            return;
        }

        this.sessionServer.getWebSession(function(err, waSession, saveWebSession){
            if(err) {
                this.stats.increment("error", "Route.Login.Auth.Session");
                return next(err);
            }

            // save proxy session
            user[aConst.webappSessionPrefix] = waSession;
            user.sessionId = req.session.id;

            // login
            //console.log("login:", user);
            req.logIn(user, function(err) {
                if(err) {
                    this.stats.increment("error", "Route.Login.Auth.LogIn");
                    return next(err);
                }

                // get courses
                if( (user.role == aConst.role.student) ||
                    (user.role == aConst.role.instructor) ||
                    (user.role == aConst.role.manager) ||
                    (user.role == aConst.role.admin) ) {
                    this.webstore.getUserCourses(user.id)
                        .then(function(courses){
                            // add courses
                            var tuser = _.clone(user);
                            tuser.courses = courses;

                            if(saveWebSession) {
                                saveWebSession(waSession, tuser.sessionId, function(){
                                    this.stats.increment("info", "Route.Login.Auth.GetUserCourses.SaveWebSession");
                                    this.requestUtil.jsonResponse(res, tuser);
                                }.bind(this));
                            } else {
                                this.stats.increment("info", "Route.Login.Auth.GetUserCourses.Done");
                                this.requestUtil.jsonResponse(res, tuser);
                            }
                        }.bind(this))
                        .then(null, function(err){
                            this.stats.increment("error", "Route.Login.Auth.LogIn.GetCourse");
                            next(err);
                        }.bind(this));
                } else {
                    this.stats.increment("error", "Route.Login.Auth.LogIn.InvalidRole");
                    next(new Error("invalid role"));
                }

            }.bind(this));
        }.bind(this));

    }.bind(this));

    auth(req, res, next);
};