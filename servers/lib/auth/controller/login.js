
var aConst = require('../auth.const.js');
var _      = require('lodash');


module.exports = {
    logout:   logout,
    glassLabLogin: glassLabLogin
};

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

function glassLabLogin(req, res, next) {
    this.stats.increment("info", "Route.Login");

    //console.log("Auth loginRoute");
    var auth = this.passport.authenticate('glasslab', function(err, user, info) {
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

        user.sessionId = req.session.id;

        // login
        //console.log("login:", user);
        req.logIn(user, function(err) {
            if(err) {
                this.stats.increment("error", "Route.Login.Auth.LogIn");
                return next(err);
            }

            // get courses
            if( (user.systemRole == aConst.role.student) ||
                (user.systemRole == aConst.role.instructor) ||
                (user.systemRole == aConst.role.manager) ||
                (user.systemRole == aConst.role.admin) ) {
                this.webstore.getUserCourses(user.id)
                    .then(function(courses){
                        // add courses
                        var tuser = _.clone(user);
                        tuser.courses = courses;
                        // TODO: remove after the web site dep has been updated
                        tuser.role = tuser.systemRole;

                        this.stats.increment("info", "Route.Login.Auth.GetUserCourses.Done");
                        this.requestUtil.jsonResponse(res, tuser);
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

    auth(req, res, next);
};