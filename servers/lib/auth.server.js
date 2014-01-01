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
var request    = require('request');
var couchbase  = require('couchbase');
var check      = require('validator').check;

// load at runtime
var RequestUtil, aConst, rConst, SessionServer, WebStore;

module.exports = AuthServer;

function AuthServer(options){
    try {
        // Glasslab libs
        RequestUtil   = require('./util.js').Request;
        aConst        = require('./auth.js').Const;
        rConst        = require('./routes.js').Const;
        SessionServer = require('./auth.js').SessionServer;
        WebStore      = require('./webapp.js').Datastore.MySQL;

        this.options = _.merge(
            {
                auth: { port: 8082 }
            },
            options
        );

        this.requestUtil = new RequestUtil(this.options);
        this.webstore    = new WebStore(this.options.webapp.datastore.mysql);

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

        this.app.get(rConst.api.user.logout, function logoutRoute(req, res){
            console.log("logout:", req.path);
            req.logout();
            res.redirect(rConst.root);
        }.bind(this));

        // POST - login
        this.app.post(rConst.api.user.login, this.loginRoute.bind(this));

        // POST - register user
        this.app.post(rConst.api.user.regUser, this.registerUserRoute.bind(this));
        // POST - register manager
        this.app.post(rConst.api.user.regManager, this.registerManagerRoute.bind(this));

        // Add include routes
        var includeRoute = function(req, res) {
            console.log("Include to Auth:", req.path);
            if( req.isAuthenticated()) {
                var user = req.session.passport.user;
                var cookie = "";
                if(user){
                    cookie = aConst.sessionCookieName+"="+user[aConst.webappSessionPrefix];
                }

                //console.log("Auth passport user:", user);

                this.requestUtil.forwardRequestToWebApp({ cookie: cookie }, req, res);
                //console.log("Auth passport user:", req.session.passport.user);
            } else {
                // error in auth, redirect back to login
                console.error("Auth: Not Authenticated");
                res.redirect(rConst.root)
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

AuthServer.prototype.registerUserRoute = function(req, res, next) {
    // only allow for POST on login
    if(req.method != 'POST') { next(); return;}

    //console.log("Auth registerUserRoute - body:", req.body);
    if( req.body.username  &&
        req.body.firstName && req.body.lastName &&
        req.body.type &&
        _.isNumber(req.body.associatedId) &&
        req.body.password  && !_.isEmpty(req.body.password) )
    {
        this.registerUser(req, res, next);
    } else {
        this.requestUtil.errorResponse(res, "missing some fields", 400);
    }
};

/**
 * Registers a user with role of instructor or student
 * 1. get institution
 * 2. create the new user
 * 3. if student, enroll them in the course
 * @param registrationData the data to register a user
 * @return user object on success, otherwise null (error output handled here)
 */
AuthServer.prototype.registerUser = function(req, res, next) {
    var systemRole = aConst.role.student;
    var courseId, institutionId;

    var registerErr = function(err, code){
        if(!code) code = 500;

        console.error("AuthServer registerUser Error:", err);
        this.requestUtil.jsonResponse(res, err, code);
    }.bind(this);

    var register = function(institutionId){
        var userData = {
            username:         req.body.username,
            firstName:        req.body.firstName,
            lastName:         req.body.lastName,
            email:            req.body.email,
            password:         req.body.password,
            systemRole:       systemRole,
            institutionId:    institutionId,
            loginType:        aConst.login.type.glassLabV2
        };

        this.sessionServer.registerUser(userData)
            .then(function(userId){
                // if student, enroll in course
                if(systemRole == aConst.role.student) {
                    // courseId
                   return this.webstore.addUserToCourse(courseId, userId, systemRole)
                        .then(function(){
                            this.glassLabLogin(req, res, next);
                        }.bind(this));
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
                register(data.id);
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
                institutionId = data[0].institutionId;
                register(institutionId);
            }.bind(this))
            // catch all errors
            .then(null, registerErr);
    }
}


AuthServer.prototype.registerManagerRoute = function(req, res, next) {
    // only allow for POST on login
    if(req.method != 'POST') { next(); return;}

    console.log("Auth registerManagerRoute - body:", req.body);
    if( req.body.username  && req.body.key && req.body.institution &&
        req.body.firstName && req.body.lastName &&
        req.body.password  && _.isEmpty(req.body.password) )
    {
        this.registerManager(req, res, next);
    } else {
        this.requestUtil.errorResponse(res, "missing some fields", 400);
    }
};

/**
 * Registers a user with role of manager
 * 1. get / create institution
 * 2. create code for new institution
 * 3. create the new user
 * 4. update license data
 * @param registrationData the data to register a user
 * @return user object on success, otherwise null (error output handled here)
 */
AuthServer.prototype.registerManager = function(req, res, next) {

    // TODO

}


AuthServer.prototype.loginRoute = function(req, res, next) {
    // only allow for POST on login
    if(req.method != 'POST') { next(); return;}

    this.glassLabLogin(req, res, next);
};

AuthServer.prototype.glassLabLogin = function(req, res, next) {
    //console.log("Auth loginRoute");
    var auth = passport.authenticate('glasslab', function(err, user, info) {
        if(err) {
            return next(err);
        }

        if (!user) {
            req.session.messages =  [info.message];
            return res.redirect(rConst.api.user.login)
        }

        this.sessionServer.getWebSession(req, res, function(err, session, done){
            if(err) {
                return next(err);
            }

            // save proxy session
            user[aConst.webappSessionPrefix] = session;
            user.sessionId = req.session.id;

            // login
            //console.log("login:", user);
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

                        if(done) {
                            done(user, req, function(){
                                res.writeHead(200);
                                res.end( JSON.stringify(tuser) );
                            }.bind(this));
                        } else {
                            res.writeHead(200);
                            res.end( JSON.stringify(tuser) );
                        }
                    }.bind(this)
                );
            }.bind(this));
        }.bind(this));

    }.bind(this));

    auth(req, res, next);
};