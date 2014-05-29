
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
        this.requestUtil.jsonResponse(res, { status: "ok", info: "login valid" } );
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

    var userInfo;
    if( req.session &&
        req.session.passport &&
        req.session.passport.user) {
        // already logged in?
        if( req.isAuthenticated() ) {
            userInfo = req.session.passport.user;
            
            // for old cached sessions, migrate them over to role instead of systemRole
            if(userInfo.systemRole && !userInfo.role)
            {
                userInfo.role = userInfo.systemRole;
                delete userInfo.systemRole;
            }
        }
    }

    var promise;
    if(!userInfo) {
        // login validation
        //console.log("Auth loginRoute");
        var authenticate = glassLabLogin_Authenticate.bind(this);
        promise = authenticate(req, res, next);
    } else {
        promise = Util.PromiseContinue(userInfo);
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
            reject({ message: { error:"try again later", key:"general" }, code:500 });
            return;
        }

        if (!user) {
            //req.session.messages =  [info];
            //res.redirect(rConst.api.user.login);
            this.stats.increment("error", "Route.Login.NoUser");
            reject({ message: _.merge( { error:"invalid username or password", key:"invalid" }, info ), code: 401 });
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
            this.lmsStore.getUserCourses(user.id)
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
        } else {
            this.stats.increment("error", "Route.Login.Auth.LogIn.InvalidRole");
            reject(new Error("invalid role"));
        }
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}
