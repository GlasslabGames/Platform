
var path   = require('path');
var _      = require('lodash');
var lConst = require('../../lms/lms.const.js');
var aConst = require('../../auth/auth.const.js');
var Util   = require('../../core/util.js');
var emailTemplates = require('email-templates');
var nodemailer     = require('nodemailer');
var uuid      = require('node-uuid');

module.exports = {
    showUser:            showUser,
    registerUserV1:      registerUserV1,
    registerUserV2:      registerUserV2,
    registerManager:     registerManager,
    updateUser:          updateUser,
    resetPasswordSend:   resetPasswordSend,
    resetPasswordVerify: resetPasswordVerify,
    resetPasswordUpdate: resetPasswordUpdate
};
var exampleIn = {};
var exampleOut = {};

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
function registerUserV1(req, res, next) {
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

    var systemRole = lConst.role.student;
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
                if(systemRole == lConst.role.student) {
                    // courseId
                    this.stats.increment("info", "AddUserToCourse");
                    this.lmsStore.addUserToCourse(userId, courseId, systemRole)
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
        systemRole = lConst.role.instructor;
        // validate institution Id (associatedId == institutionId)
        institutionId = req.body.associatedId;
        this.lmsStore.getInstitution(institutionId)
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
        this.lmsStore.getInstitutionIdFromCourse(courseId)
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


/**
 * Registers a user with role of instructor or student
 * 1. get institution
 * 2. create the new user
 * 3. if student, enroll them in the course
 */
function registerUserV2(req, res, next, serviceManager) {
    this.stats.increment("info", "Route.Register.User");
    //console.log("Auth registerUserRoute - body:", req.body);

    var regData = {
        username:      "",
        firstName:     "",
        lastName:      "",
        password:      "",
        email:         "",
        systemRole:    req.body.systemRole,
        loginType:     aConst.login.type.glassLabV2
    };

    if(regData.systemRole == lConst.role.student) {
        regData.username   = Util.ConvertToString(req.body.username);
        regData.password   = Util.ConvertToString(req.body.password);
        regData.firstName  = Util.ConvertToString(req.body.firstName);
        regData.lastName   = Util.ConvertToString(req.body.lastName);
        // optional
        regData.regCode    = Util.ConvertToString(req.body.regCode);

        if(!regData.username) {
            this.requestUtil.errorResponse(res, "missing username", 400);
            return;
        }
        if(!regData.password) {
            this.requestUtil.errorResponse(res, "missing password", 400);
            return;
        }
        if(!regData.firstName) {
            this.requestUtil.errorResponse(res, "missing firstName", 400);
            return;
        }
    }
    else if(regData.systemRole == lConst.role.instructor) {
        // email and username is the same
        req.body.username  = req.body.email;
        regData.username   = Util.ConvertToString(req.body.username);
        regData.password   = Util.ConvertToString(req.body.password);
        regData.firstName  = Util.ConvertToString(req.body.firstName);
        regData.lastName   = Util.ConvertToString(req.body.lastName);

        regData.email      = Util.ConvertToString(req.body.email);

        if(!regData.username) {
            this.requestUtil.errorResponse(res, "missing email", 400);
            return;
        }
        if(!regData.password) {
            this.requestUtil.errorResponse(res, "missing password", 400);
            return;
        }
        if(!regData.firstName) {
            this.requestUtil.errorResponse(res, "missing firstName", 400);
            return;
        }
        if(!regData.email) {
            this.requestUtil.errorResponse(res, "missing email", 400);
            return;
        }
    } else {
        this.requestUtil.errorResponse(res, "invalid systemRole", 401);
        return;
    }

    var registerErr = function(err, code){
        if(!code) code = 500;

        this.stats.increment("error", "Route.Register.User");
        console.error("AuthServer registerUser Error:", err);
        this.requestUtil.jsonResponse(res, err, code);
    }.bind(this);


    var register = function(regData, courseId) {
        this._registerUser(regData)
            .then(function(userId){

                // if student, enroll in course
                if( regData.systemRole == lConst.role.student &&
                    courseId) {

                    // courseId
                    this.stats.increment("info", "AddUserToCourse");
                    this.lmsStore.addUserToCourse(userId, courseId, regData.systemRole)
                        .then(function(){
                            this.stats.increment("info", "Route.Register.User."+Util.String.capitalize(regData.systemRole)+".Created");
                            serviceManager.internalRoute('/api/v2/auth/login/glasslab', [req, res, next]);
                        }.bind(this))
                        // catch all errors
                        .then(null, registerErr);
                } else {

                    this.stats.increment("info", "Route.Register.User."+Util.String.capitalize(regData.systemRole)+".Created");
                    serviceManager.internalRoute('/api/v2/auth/login/glasslab', [req, res, next]);
                }
            }.bind(this))
            // catch all errors
            .then(null, registerErr);
    }.bind(this);


    // instructor
    if(regData.systemRole == lConst.role.instructor) {
        register(regData);
    }
    // else student
    else if(regData.systemRole == lConst.role.student) {
        if(regData.regCode)
        {
            // get course Id from course code
            this.lmsStore.getCourseIdFromCourseCode(regData.regCode)
                // register, passing in institutionId
                .then(function(courseId){
                    if(courseId) {
                        // get rid of reg code, not longer needed
                        delete regData.regCode;
                        ;
                        register(regData, courseId);
                    } else {
                        this.stats.increment("error", "Route.Register.User.InvalidInstitution");
                        registerErr({"error": "course not found"});
                    }
                }.bind(this))
                // catch all errors
                .then(null, registerErr);
        } else {
            register(regData);
        }
    }

    this.stats.increment("info", "Route.Register.User."+Util.String.capitalize(regData.systemRole));
}

exampleIn.resetPasswordSend =
{
    "email": "asdasd@test.com"
};
function resetPasswordSend(req, res, next) {
    if( req.body.email &&
        _.isString(req.body.email) &&
        req.body.email.length) {
        var email = req.body.email;
        var resetCode = uuid.v1();

        var expirationTime = Util.GetTimeStamp() + aConst.passwordReset.expirationInterval;

        // 1) valid user email and get the user data
        //    update user account with code
        this.glassLabStrategy.getUserByEmail(email)
            .then(function(userData) {
                userData.resetCode           = resetCode;
                userData.resetCodeExpiration = expirationTime;
                userData.resetCodeStatus     = aConst.passwordReset.status.sent;

                return this.glassLabStrategy.updateUserDataInDS(userData)
                    .then(function(){

                        var emailData = {
                            user: userData,
                            server: {
                                host: req.headers.host,
                                code: resetCode
                            }
                        };

                        // TODO: move this to a util
                        // 2) send email
                        var templatesDir = path.join(__dirname, "../email-templates");

                        emailTemplates(templatesDir, { open: '{{', close: '}}' }, function(err, template) {
                            if(err) {
                                this.stats.increment("error", "Route.ResetPasswordSend.ReadingTemplates");
                                console.err("Auth: Error reading templates -", err);
                                this.requestUtil.errorResponse(res, {error: "internal error, try again later"}, 500);
                                return;
                            }

                            // Send a single email
                            template('password-reset', emailData, function(err, html, text) {
                                if (err) {
                                    this.stats.increment("error", "Route.ResetPasswordSend.BuildingEmail");
                                    console.err("Auth: Error building email -", err);
                                    this.requestUtil.errorResponse(res, {error: "internal error, try again later"}, 500);
                                } else {

                                    var transport = nodemailer.createTransport("SMTP", this.options.auth.transport);
                                    var emailSettings = {
                                        from: "<accounts@glasslabgames.org>",
                                        to: userData.email,
                                        subject: "Reset your password for Glasslab",
                                        html: html,
                                        // generateTextFromHTML: true,
                                        text: text
                                    };

                                    transport.sendMail(emailSettings, function(err, responseStatus) {
                                        if (err) {
                                            this.stats.increment("error", "Route.ResetPasswordSend.SendEmail");
                                            console.err("Auth: Error sending email -", err);
                                            this.requestUtil.errorResponse(res, {error: "internal error, try again later"}, 500);
                                        } else {
                                            this.stats.increment("info", "Route.ResetPasswordSend.SendEmail");
                                            console.log(responseStatus.message);
                                            this.requestUtil.jsonResponse(res, {});
                                        }
                                    }.bind(this));

                                }
                            }.bind(this));
                        }.bind(this));
                    }.bind(this));
            }.bind(this))

            // catch all errors
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err, 400);
            }.bind(this))

    } else {
        this.requestUtil.errorResponse(res, "invalid or missing email", 401);
    }
}

function resetPasswordVerify(req, res, next) {
    if( req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length) {

        // 1) validate the code and get user data
        this.glassLabStrategy.findUser("reset_code", req.params.code)
            .then(function(userData) {
                if(Util.GetTimeStamp() > userData.resetCodeExpiration) {
                    this.requestUtil.errorResponse(res, {error: "code expired", key:"code.expired"}, 400);
                } else {
                    if(userData.resetCodeStatus == aConst.passwordReset.status.sent) {
                        // update status
                        userData.resetCodeStatus = aConst.passwordReset.status.inProgress;
                        return this.glassLabStrategy.updateUserDataInDS(userData)
                            .then(function() {
                                this.requestUtil.jsonResponse(res, {});
                            }.bind(this));
                    } else {
                        this.requestUtil.errorResponse(res, {error: "code expired", key:"code.expired"}, 400);
                    }
                }
            }.bind(this))

            // catch all errors
            .then(null, function(err) {
                if( err.error &&
                    err.error == "user not found") {
                    this.requestUtil.errorResponse(res, {error: "code expired", key:"code.expired"}, 400);
                } else {
                    this.requestUtil.errorResponse(res, err, 400);
                }
            }.bind(this));

    } else {
        this.requestUtil.errorResponse(res, {error: "missing code", key:"missing.code.pass"}, 401);
    }
}

exampleIn.resetPasswordUpdate = {
    "password":"123",
    "code":"c987c960-b6fc-11e3-9058-7d52ee769e0e"
};
function resetPasswordUpdate(req, res, next) {
    if( req.body.code &&
        _.isString(req.body.code) &&
        req.body.code.length &&
        req.body.password &&
        _.isString(req.body.password) &&
        req.body.password.length) {

        // 1) validate the code and get user data
        this.glassLabStrategy.findUser("reset_code", req.body.code)
            .then(function(userData) {
                if(Util.GetTimeStamp() > userData.resetCodeExpiration) {
                    this.requestUtil.errorResponse(res, {error: "code expired", key:"code.expired"}, 400);
                } else if(userData.resetCodeStatus == aConst.passwordReset.status.inProgress) {
                    return this.glassLabStrategy.encryptPassword(req.body.password)
                        .then(function(password) {
                            // update status
                            userData.password = password;
                            userData.resetCodeStatus = "NULL";
                            userData.resetCodeExpiration = "NULL";
                            userData.resetCode = "NULL";

                            return this.glassLabStrategy.updateUserDataInDS(userData);
                        }.bind(this))
                        .then(function() {
                            this.requestUtil.jsonResponse(res, {});
                        }.bind(this));
                }
            }.bind(this))

            // catch all errors
            .then(null, function(err) {
                this.requestUtil.errorResponse(res, err, 400);
            }.bind(this));

    } else {
        this.requestUtil.errorResponse(res, {error: "missing code", key:"missing.code.pass"}, 401);
    }
}
