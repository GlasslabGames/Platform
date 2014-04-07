
var _      = require('lodash');
var when   = require('when');
var Util   = require('../../core/util.js');
var lConst = require('../../lms/lms.const.js');

module.exports = {
    logout:   logout,
    glassLabLogin: glassLabLogin,
    loginStatus: loginStatus
};


function loginStatus(req, res){

    if( req.isAuthenticated() ) {
        this.requestUtil.jsonResponse(res, { status: "ok", info: "login valid"} );
    } else {
        this.requestUtil.errorResponse(res, "login invalid");
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
    res.redirect("/");
}

/*
Cases:
  1) already logged in without deviceId in body
  2) already logged in with deviceId in body
  3) not logged in without deviceId in body
  4) not logged in with deviceId in body
*/
function glassLabLogin(req, res, next) {
    this.stats.increment("info", "Route.Login");

    var userInfo;
    if( req.session &&
        req.session.passport &&
        req.session.passport.user) {
        // already logged in?
        if( req.isAuthenticated() ) {
            userInfo = req.session.passport.user;
        }
    }

    var promise;
    if(!userInfo) {
        // login validation
        //console.log("Auth loginRoute");
        var authenticate = glassLabLogin_Authenticate.bind(this);

        promise = authenticate(req, res, next)
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err.message, err.code);
            }.bind(this))
    } else {
        promise = Util.PromiseContinue(userInfo);
    }

    if( req.body &&
        req.body.deviceId &&
        req.body.deviceId.length ) {
        // deviceId exists and is not none zero length
        promise.then(function(user){
                // update device Id
                //console.log("deviceId:", req.body.deviceId);
                return this.authStore.updateUserDeviceId(user.id, req.body.deviceId)
                    .then(function(){
                        return user;
                    }.bind(this));
            }.bind(this))

            // catch all errors
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this));
    }

    promise.then(function(user){
            var login = glassLabLogin_LogIn.bind(this);
            return login(req, user);
        }.bind(this))
        .then(function(user){
            this.requestUtil.jsonResponse(res, user);
        }.bind(this))

        // catch all errors
        .then(null, function(err){
            next(err);
        }.bind(this));
}

function glassLabLogin_Authenticate(req, res, next) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var auth = this.passport.authenticate('glasslab', function(err, user, info) {
        if(err) {
            this.stats.increment("error", "Route.Login.Auth");
            reject({ message: {error:"try again later", key:"general"}, code:500 });
            return;
        }

        if (!user) {
            //req.session.messages =  [info];
            //res.redirect(rConst.api.user.login);
            this.stats.increment("error", "Route.Login.NoUser");
            reject({ message: info, code:401 });
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
        if( (user.systemRole == lConst.role.student) ||
            (user.systemRole == lConst.role.instructor) ||
            (user.systemRole == lConst.role.manager) ||
            (user.systemRole == lConst.role.admin) ) {
            this.lmsStore.getUserCourses(user.id)
                .then(function(courses){
                    // add courses
                    var tuser = _.clone(user);
                    tuser.courses = courses;
                    // TODO: remove after the web site dep has been updated
                    tuser.role = tuser.systemRole;

                    this.stats.increment("info", "Route.Login.Auth.GetUserCourses.Done");
                    resolve(tuser);
                }.bind(this))
                .then(null, function(err){
                    this.stats.increment("error", "Route.Login.Auth.LogIn.GetCourse");
                    reject(err);
                }.bind(this));
        } else {
            this.stats.increment("error", "Route.Login.Auth.LogIn.InvalidRole");
            reject(new Error("invalid role"));
        }
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}
