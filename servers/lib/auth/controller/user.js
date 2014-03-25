
var aConst = require('../auth.const.js');
var _      = require('lodash');
var Util   = require('../../core/util.js');

module.exports = {
    showUser:        showUser,
    registerUser:    registerUser,
    registerManager: registerManager,
    updateUser:      updateUser
};


/**
 TODO
 */
function showUser(req, res, next) {
    if( req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.params &&
        req.params.hasOwnProperty("id")) {
        var loginUserSessionData = req.session.passport.user;

        // check perms before returning user info
        this.webstore.getUserInfoById(req.params.id)
            .then(function(userData){
                return this.checkUserPerminsToUserData(userData, loginUserSessionData)
            }.bind(this))
            // ok, send data
            .then(function(userData){
                this.requestUtil.jsonResponse(res, userData);
            }.bind(this))
            // error
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this))
    } else {
        this.requestUtil.errorResponse(res, "not logged in");
    }
}

/**
 * Registers a user with role of instructor or student
 * 1. get institution
 * 2. create the new user
 * 3. if student, enroll them in the course
 */
function registerUser(req, res, next) {
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
function registerManager(req, res, next) {
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

 function updateUser(req, res, next, serviceManager) {
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
        loginType:     aConst.login.type.glassLabV2  // TODO add login type to user data on client
    };
    if(req.body.username) {
        userData.username = req.body.username;
    }
    if(req.body.firstName) {
        userData.firstName = req.body.firstName;
    }
    if(req.body.lastName) {
        userData.lastName = req.body.lastName;
    }
    if(req.body.name) {
        userData.name = req.body.name;
    }
    if(req.body.email) {
        userData.email = req.body.email;
    }
    if(req.body.systemRole || req.body.role) {
        userData.systemRole = req.body.systemRole || req.body.role;
    }
    if(req.body.institutionId || req.body.institution) {
        userData.institutionId = req.body.institutionId || req.body.institution;
    }
    if(req.body.password) {
        userData.password = req.body.password;
    }

    var loginUserSessionData = req.session.passport.user;

    // wrap getSession in promise
    this._updateUserData(userData, loginUserSessionData)
        // save changed data
        .then(function(data){
            if(data.changed) {
                // update session user data
                req.session.passport.user = data.user;
                this.stats.increment("info", "Route.Update.User.Changed");
                return serviceManager.updateUserDataInSession(req.session)
                    .then(function() {
                        return data.user;
                    }.bind(this));
            } else {
                return data.user;
            }
        }.bind(this))
        // all ok
        .then(function(userData){
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
};