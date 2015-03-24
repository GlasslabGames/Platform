
var _      = require('lodash');
var when   = require('when');
var Util   = require('../../core/util.js');
var lConst = require('../../lms/lms.const.js');
var User   = require('./user.js');

module.exports = {
    logout:   logout,
    glassLabLogin: glassLabLogin,
    loginStatus: loginStatus
};


function loginStatus(req, res){

    if( req.isAuthenticated() ) {
        this.requestUtil.jsonResponse(res, { status: "ok", info: "login valid" } );
    } else {
        this.requestUtil.errorResponse(res, { status: "error", error: {key:'user.login.notLoggedIn'}}, 200 );
    }
}

function logout(req, res){
    //console.log("logout:", req.originalUrl);
    if( req.session &&
        req.session.passport &&
        req.session.passport.user) {
        // TODO
        // delete webapp session
        //this.sessionServer.deleteSession();
    }

    this.stats.increment("info", "Logout");
    req.logout();
    //res.redirect("/");
    this.requestUtil.jsonResponse(res, {} );
}

/*
Cases:
  1) already logged
    - update session
    - respond with user data
  2) not logged
    - validate user login
    - update session
    - respond with user data
*/
function glassLabLogin(req, res, next) {
    this.stats.increment("info", "Route.Login");
    //console.log("Auth loginRoute");
    var authenticate = glassLabLogin_Authenticate.bind(this);
    authenticate(req, res, next)
        .then(function(user){
            var login = glassLabLogin_LogIn.bind(this);
            return login(req, user);
        }.bind(this))
        .then(function(user){
            this.requestUtil.jsonResponse(res, user);
        }.bind(this))

        // catch all errors
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err.message, err.code);
        }.bind(this));
}

function glassLabLogin_Authenticate(req, res, next) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var auth = this.passport.authenticate('glasslab', function(err, user, info) {
        if(err) {
            this.stats.increment("error", "Route.Login.Auth");
            reject({ message: {key:"user.login.general"}, code: 500 });
            return;
        }

        if (!user) {
            //req.session.messages =  [info];
            //res.redirect(rConst.api.user.login);
            this.stats.increment("error", "Route.Login.NoUser");
            reject({ message: _.merge( {key:"user.login.invalid"}, info ), code: 401 });
            return;
        }

        resolve(user);
    }.bind(this));

    // run auth
    auth(req, res, next);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}

function glassLabLogin_LogIn(req, user) {

// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    user.sessionId = req.session.id;

    // login
    //console.log("login:", user);
    req.logIn(user, function(err) {
        if(err) {
            this.stats.increment("error", "Route.Login.Auth.LogIn");
            reject(err);
            return;
        }
        
        // TODO: move this to LMS service API, for service isolation
        // get courses
        if( (user.role == lConst.role.student) ||
            (user.role == lConst.role.instructor) ||
            (user.role == lConst.role.manager) ||
            (user.role == lConst.role.admin) ) {
            this.lmsStore.getCoursesbyStudentId(user.id)
                .then(function(courses){
                    // add courses
                    var tuser = _.clone(user);
                    tuser.courses = courses;

                    this.stats.increment("info", "Route.Login.Auth.GetUserCourses.Done");
                    resolve(tuser);
                }.bind(this))
                .then(null, function(err){
                    this.stats.increment("error", "Route.Login.Auth.LogIn.GetCourse");
                    reject(err);
                }.bind(this));
        }
        else if( user.role == lConst.role.developer ) {
            var dashService = this.serviceManager.get("dash").service;
            dashService.telmStore.getDeveloperProfile(user.id, true)
                .then(function(result) {
                    if (result === "no profile") {
                        var data = {};
                        // create new developer profile on couchbase
                        return this.authDataStore.setDeveloperProfile(user.id, data);
                    }
                }.bind(this))
                .then(function(){
                    this.stats.increment("info", "Route.Login.Auth.Developer.Done");
                    resolve( user );
                }.bind(this))
                .then(null, function(err){
                    console.log("Developer Couchbase Error - ", err);
                    reject(err);
                }.bind(this))
        }
        else {
            this.stats.increment("error", "Route.Login.Auth.LogIn.InvalidRole");
            reject(new Error("invalid role"));
        }
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}
