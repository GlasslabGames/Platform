
var path      = require('path');
var _         = require('lodash');
var when      = require('when');
var lConst    = require('../../lms/lms.const.js');
var aConst    = require('../../auth/auth.const.js');
var Util      = require('../../core/util.js');

module.exports = {
    getUserProfileData:			getUserProfileData,
    registerUserV1:				registerUserV1,
    registerUserV2:				registerUserV2,
    verifyEmailCode:			verifyEmailCode,
    verifyBetaCode:				verifyBetaCode,
    verifyDeveloperCode:		verifyDeveloperCode,
    getUserDataById:			getUserDataById,
    updateUserData:				updateUserData,
    getUserBadgeList:			getUserBadgeList,
    updateUserBadgeList:		updateUserBadgeList,
    resetPasswordSend:			resetPasswordSend,
    resetPasswordVerify:		resetPasswordVerify,
    resetPasswordUpdate:		resetPasswordUpdate,
    requestDeveloperGameAccess:	requestDeveloperGameAccess,
    approveDeveloperGameAccess:	approveDeveloperGameAccess,
    eraseStudentInfo:			eraseStudentInfo,
    eraseInstructorInfo:		eraseInstructorInfo,
    deleteUser:					deleteUser
};

var exampleIn = {};
var exampleOut = {};


function getUserProfileData(req, res, next) {

    if( req.session &&
        req.session.passport &&
        req.session.passport.user) {
        var userData = req.session.passport.user;
        // check perms before returning user info
        this.webstore.getUserInfoById(userData.id)
            // ok, send mdata
            .then(function(data){
                userData = data;
                return _updateUserSession(userData, req);
            }.bind(this))
            .then(function(){
                this.requestUtil.jsonResponse(res, userData);
            }.bind(this))
            // error
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this))
    } else {
        this.requestUtil.errorResponse(res, { status: "error", error: {key:'user.login.notLoggedIn'}}, 200);
    }
}

function _updateUserSession(userData, req){
    var update = false;
    _(userData).forEach(function(value, property){
        if(value !== req.user[property]){
            update = true;
        }
        req.user[property] = value;
    });
    _(req.user).forEach(function(value, property){
        if(userData[property] === undefined){
            delete req.user[property];
            update = true;
        }
    });
    if(update){
        return Util.updateSession(req);
    }
}

function getUserDataById(req, res, next) {
    if( req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.params &&
        req.params.hasOwnProperty("userId")) {
        var loginUserSessionData = req.session.passport.user;

        // check perms before returning user info
        this.webstore.getUserInfoById(req.params.userId)
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

exampleIn.updateUserData = {
    "userId":        25,
    "username":      "test2",
    "firstName":     "test",
    "lastName":      "2",
    "email":         "test2@email.com",
    "password":      "test"
};
function updateUserData(req, res, next, serviceManager) {
    this.stats.increment("info", "Route.Update.User");
    //console.log("Auth updateUserRoute - body:", req.body);
    if( !(req.body.userId) )
    {
        this.stats.increment("error", "Route.Update.User.MissingId");
        //this.requestUtil.errorResponse(res, "missing the userId", 400);
        this.requestUtil.errorResponse(res, {key:"user.update.general"}, 400);
        return;
    }

    var loginUserSessionData = req.session.passport.user;

    var userData = {
        id:            req.body.userId,
        loginType:     aConst.login.type.glassLabV2
    };
    // add body data to userData
    userData = _.merge(userData, req.body);

    // legacy
    if(req.body.institutionId || req.body.institution) {
        userData.institutionId = req.body.institutionId || req.body.institution;
    }

    // wrap getSession in promise
    this._updateUserData(userData, loginUserSessionData)
        // save changed data
        .then(function(data) {
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
        .then(null, function(err){
            this.stats.increment("error", "Route.Update.User");
            console.error("Auth - updateUserRoute error:", err);
            //this.requestUtil.errorResponse(res, err, 400);
            this.requestUtil.errorResponse(res, {key:"user.update.general"}, 400);
        }.bind(this) );
};


function getUserBadgeList(req, res, next) {
    if( ! ( req.session && req.session.passport && req.session.passport.user )) {
		this.requestUtil.errorResponse(res, "not logged in");
    	return;
    }

    var userId = req.params.userId;
    if( ! userId )
    {
        this.requestUtil.errorResponse(res, {key:"user.update.general"}, 400);
        return;
    }

    this.webstore.getUserBadgeListById( userId )
   		// TODO: KMY: Add .then() to handle updating status of any "redeemed": false entries - before returning them
        .then(function(results){
			this.requestUtil.jsonResponse( res, results );
        }.bind(this))
        // error
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
};

function updateUserBadgeList(req, res, next) {
    if( ! ( req.session && req.session.passport && req.session.passport.user && req.params)) {
		this.requestUtil.errorResponse(res, "not logged in");
    	return;
    }

	// TODO: KMY: add stat for updating badge_list
	// (several spots)
    this.stats.increment("info", "Route.Update.User");

    var userId = req.body.userId;
    if( ! userId )
    {
        this.stats.increment("error", "Route.Update.User.MissingId");
        this.requestUtil.errorResponse(res, {key:"user.update.general"}, 400);
        return;
    }

    // Can only modify our own list
    if ( req.session.passport.user.userId != userId ) {
    	// TODO: KMY: need a new error for this
        this.stats.increment("error", "Route.Update.User.MissingId");
        this.requestUtil.errorResponse(res, {key:"user.update.general"}, 400);
        return;
    }

    // Direct update
    this._updateUserBadgeList( req.body.userId, req.body.badgeList )
    	.then(function(data) {
            this.stats.increment("info", "Route.Update.User.Done");
            this.requestUtil.jsonResponse(res, data);
    	}.bind(this))
		.then(null,function(err) {
            this.stats.increment("error", "Route.Update.User");
            console.error("Auth - updateUserBadgeListRoute error:", err);
            this.requestUtil.errorResponse(res, {key:"user.update.general"}, 400);
		}.bind(this));
};

function addUserBadgeList(req, res, next) {
    if( ! ( req.session && req.session.passport && req.session.passport.user && req.params) ) {
		this.requestUtil.errorResponse(res, "not logged in");
    	return;
    }

    var userId = req.params.userId;
    if( ! userId )
    {
        this.stats.increment("error", "Route.Update.User.MissingId");
        this.requestUtil.errorResponse(res, {key:"user.update.general"}, 400);
        return;
    }

    var newBadge = req.params.badge;
    if( ! newBadge )
    {
        this.stats.increment("error", "Route.Update.User.MissingId");
        this.requestUtil.errorResponse(res, {key:"user.update.general"}, 400);
        return;
    }

	// TODO: KMY: add stat for updating badge_list
	// (several spots)

    this.webstore.getUserBadgeListById( userId )
        .then(function(results) {
        	return results;
        }.bind(this))
	        .then(function( badgeList ) {
	        	var add = true;
	        	if ( badgeList.length > 0 ) {
		        	// Ignore if already exists
		        	badgeList.forEach( function( badge ) {
						if ( newBadge.id == badge.id ) {
							add = false;
						}
					});

					if ( add ) {
						badgeList.push( newBadge );
						return badgeList;
					} else {
						return [];
					}
	        	}
	        }.bind(this))
		        .then( function( badgeList ) {
				    this._updateUserBadgeList( userId, badgeList )
		        }.bind(this))
			    	.then(function( data ) {
			            this.stats.increment("info", "Route.Update.User.Done");
						this.requestUtil.jsonResponse(res, data);
			    	}.bind(this))
	// catch all errors
    .then(null, function(err){
	    this.stats.increment("error", "Route.Update.User");
	    console.error("Auth - updateUserBadgeListRoute error:", err);
	    this.requestUtil.errorResponse(res, {key:"user.update.general"}, 400);
    }.bind(this));
};

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

    var role = lConst.role.student;
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
            role:          role,
            institutionId: institutionId,
            loginType:     aConst.login.type.glassLabV2
        };

        this.registerUser(userData)
            .then(function(userId){
                // if student, enroll in course
                if(role == lConst.role.student) {
                    // courseId
                    this.stats.increment("info", "AddUserToCourse");
                    this.lmsStore.addUserToCourse(userId, courseId, role)
                        .then(function(){
                            this.stats.increment("info", "Route.Register.User."+Util.String.capitalize(role)+".Created");
                            this.glassLabLogin(req, res, next);
                        }.bind(this))
                        // catch all errors
                        .then(null, registerErr);
                } else {
                    this.stats.increment("info", "Route.Register.User."+Util.String.capitalize(role)+".Created");
                    this.glassLabLogin(req, res, next);
                }
            }.bind(this))
            // catch all errors
            .then(null, registerErr);
    }.bind(this);

    // is institution -> instructor
    if(req.body.type.toLowerCase() == aConst.code.type.institution) {
        role = lConst.role.instructor;
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

    this.stats.increment("info", "Route.Register.User."+Util.String.capitalize(role));
};

/**
 * Registers a user with role of instructor or student
 * 1. get institution
 * 2. create the new user
 * 3. if student, enroll them in the course
 */

function registerUserV2(req, res, next, serviceManager) {
    this.stats.increment("info", "Route.Register.User");

    var regData = {
        username:      "",
        firstName:     "",
        lastName:      "",
        password:      "",
        email:         "",
        state:         "",
        school:        "",
        role:          req.body.role,
        loginType:     aConst.login.type.glassLabV2,
        trial:         false,
        subscribe:     false
    };

    if(regData.role == lConst.role.student) {
        regData.username   = Util.ConvertToString(req.body.username);
        regData.password   = Util.ConvertToString(req.body.password);
        regData.firstName  = Util.ConvertToString(req.body.firstName);

        // optional
        regData.lastName   = Util.ConvertToString(req.body.lastName);
        regData.regCode    = Util.ConvertToString(req.body.regCode);

        if(!regData.username) {
            //this.requestUtil.errorResponse(res, "missing username", 400);
            this.requestUtil.errorResponse(res, {key:"user.create.input.missing.username"}, 400);
            return;
        }
        if(!regData.password) {
            //this.requestUtil.errorResponse(res, "missing password", 400);
            this.requestUtil.errorResponse(res, {key:"user.create.input.missing.password"}, 400);
            return;
        }
        if(!regData.firstName) {
            //this.requestUtil.errorResponse(res, "missing firstName", 400);
            this.requestUtil.errorResponse(res, {key:"user.create.input.missing.firstName"}, 400);
            return;
        }
    }
    else if(regData.role == lConst.role.instructor) {
        // email and username is the same
        req.body.username   = req.body.email;
        regData.username    = Util.ConvertToString(req.body.username);
        regData.password    = Util.ConvertToString(req.body.password);
        regData.firstName   = Util.ConvertToString(req.body.firstName);
        regData.lastName    = Util.ConvertToString(req.body.lastName);
        regData.school      = Util.ConvertToString(req.body.school);
        regData.email       = Util.ConvertToString(req.body.email);
        regData.state       = Util.ConvertToString(req.body.state);
        regData.standards   = Util.ConvertToString(req.body.standards);


        if(!regData.username) {
            this.requestUtil.errorResponse(res, {key:"user.create.input.missing.username"}, 400);
            return;
        }
        if(!regData.password) {
            this.requestUtil.errorResponse(res, {key:"user.create.input.missing.password"}, 400);
            return;
        }
        if(!regData.firstName) {
            this.requestUtil.errorResponse(res, {key:"user.create.input.missing.firstName"}, 400);
            return;
        }
        if(!regData.email) {
            this.requestUtil.errorResponse(res, {key:"user.create.input.missing.email"}, 400);
            return;
        }
        if (!regData.state) {
            this.requestUtil.errorResponse(res, {key: "user.create.input.missing.state"}, 400);
            return;
        }
        if (!regData.school) {
            this.requestUtil.errorResponse(res, {key: "user.create.input.missing.school"}, 400);
            return;
        }
        if (!regData.standards) {
            regData.standards = "CCSS";
        }
        if(req.query.hasOwnProperty('upgrade')){
            regData.trial = req.query.upgrade === 'trial';
            regData.subscribe = req.query.upgrade === 'subscribe';
        }
        if (regData.subscribe) {
            if (req.query.hasOwnProperty('seatsSelected')) {
                regData.seatsSelected = parseInt(req.query.seatsSelected);
            }
            if (req.query.hasOwnProperty('packageType')) {
                regData.packageType = req.query.packageType;
            }
        }

    }
    else if( regData.role == lConst.role.developer ) {
        // email and username is the same
        req.body.username   = req.body.email;
        regData.username    = Util.ConvertToString(req.body.username);
        regData.password    = Util.ConvertToString(req.body.password);
        regData.firstName   = Util.ConvertToString(req.body.firstName);
        regData.lastName    = Util.ConvertToString(req.body.lastName);
        regData.email       = Util.ConvertToString(req.body.email);


        if(!regData.username) {
            this.requestUtil.errorResponse(res, {key:"user.create.input.missing.username"}, 400);
            return;
        }
        if(!regData.password) {
            this.requestUtil.errorResponse(res, {key:"user.create.input.missing.password"}, 400);
            return;
        }
        if(!regData.firstName) {
            this.requestUtil.errorResponse(res, {key:"user.create.input.missing.firstName"}, 400);
            return;
        }
        if(!regData.email) {
            this.requestUtil.errorResponse(res, {key:"user.create.input.missing.email"}, 400);
            return;
        }
    }
    else {
        this.requestUtil.errorResponse(res, {key:"user.create.invalid.role"}, 401);
        return;
    }

    var registerErr = function(err, code){
        if(!code) code = 500;

        if(err.statusCode) {
            code = err.statusCode;
        }

        if(!err.key) {
            err.key = "user.create.general";
        }

        this.stats.increment("error", "Route.Register.User");
        //console.error("AuthServer registerUser Error:", err);
        this.requestUtil.errorResponse(res, err, code);
    }.bind(this);

    var userID;
    var licService = this.serviceManager.get("lic").service;
    var register = function(regData, courseId, hasLicense) {
        return this.registerUser(regData)
            .then(function(userId){
                userID = userId;
                // if student
                if( regData.role == lConst.role.student) {

                    // if courseId then enroll in class
                    if(courseId) {
                        // courseId
                        this.stats.increment("info", "AddUserToCourse");
                        _enrollPremiumIfPremium.call(this, userId, courseId, hasLicense)
                            .then(function(status){
                                if(typeof status === "string"){
                                    return status;
                                }
                                return this.lmsStore.addUserToCourse(userId, courseId, regData.role)
                            }.bind(this))
                            .then(function(status) {
                                if(status === "lic.students.full"){
                                    registerErr({key:status}, 404);
                                    this.stats.increment("error", "Route.Register.User.LicStudentsFull");
                                    return;
                                }
                                if(status === "lms.course.not.premium"){
                                    registerErr({key:status}, 404);
                                    this.stats.increment("error", "Route.Register.User.LmsCourseNotPremium");
                                    return;
                                }
                                this.stats.increment("info", "Route.Register.User."+Util.String.capitalize(regData.role)+".Created");
                                serviceManager.internalRoute('/api/v2/auth/login/glasslab', 'post', [req, res, next]);
                            }.bind(this))
                            // catch all errors
                            .then(null, function(err){
                                console.error("Register Error -",err);
                                registerErr(err, 404);
                            });
                    } else {
                        this.stats.increment("info", "Route.Register.User."+Util.String.capitalize(regData.role)+".Created");
                        serviceManager.internalRoute('/api/v2/auth/login/glasslab', 'post', [req, res, next]);
                    }
                }
                // if instructor
                else if( regData.role == lConst.role.instructor )
                {
                    var promise;
                    if(req.body.newsletter) {
                        promise = this.subscribeToNewsletter(
                            this.options.auth.email.mailChimp.apiKey,
                            this.options.auth.email.mailChimp.mailListName,
                            regData)
                            // errors
                            .then(null, function(err){
                                this.stats.increment("error", "Route.Register.User.SubscribeToNewsletter");
                                console.error("Auth: RegisterUserV2 - Error", err);
                                this.requestUtil.errorResponse(res, {key:"user.create.general"}, 500);
                            }.bind(this))
                    } else {
                        // do nothing api
                        promise = Util.PromiseContinue();
                    }

                    promise
                        .then(function(){
                            // send email verification code
                            return sendVerifyEmail.call(this, regData, req.protocol, req.headers.host);
                            // beta
                            //return sendBetaConfirmEmail.call(this, regData, req.protocol, req.headers.host);

                        }.bind(this))
                        // all ok
                        .then(function(){
                            this.stats.increment("info", "Route.Register.User."+Util.String.capitalize(regData.role)+".Created");
                            this.requestUtil.jsonResponse(res, {});
                            // Disabled auto login after registering
                            // serviceManager.internalRoute('/api/v2/auth/login/glasslab', 'post', [req, res, next]);
                        }.bind(this))
                        // error
                        .then(null, function(err){
                            this.stats.increment("error", "Route.Register.User.sendRegisterEmail");
                            console.error("Auth: RegisterUserV2 - Error", err);
                            this.requestUtil.errorResponse(res, {key:"user.create.general"}, 500);
                        }.bind(this))

                }
                // if developer
                else if( regData.role == lConst.role.developer ) {
                    sendDeveloperConfirmEmail.call( this, regData, req.protocol, req.headers.host )
                        .then(function(){
                            this.stats.increment("info", "Route.Register.User."+Util.String.capitalize(regData.role)+".Created");
                            this.requestUtil.jsonResponse(res, {});
                        }.bind(this))
                        // error
                        .then(null, function(err){
                            this.stats.increment("error", "Route.Register.User.sendRegisterEmail");
                            console.error("Auth: RegisterUserV2 - Error", err);
                            this.requestUtil.errorResponse(res, {key:"user.create.general"}, 500);
                        }.bind(this))
                }
            }.bind(this))
            // catch all errors
            .then(null, registerErr);
    }.bind(this);

    //var gameId;
    //if(req.body.gameId){
    //    gameId = req.body.gameId.toUpperCase();
    //}
    //var email = regData.email;
    //var developerProfile;
    // instructor
    if( regData.role == lConst.role.instructor ||
        regData.role == lConst.role.developer ) {
        register(regData)
            //.then(function(){
                //if(regData.role === lConst.role.developer && gameId){
                //    var dashService = this.serviceManager.get("dash").service;
                //    return dashService.telmStore.getGameInformation(gameId, true);
                //}
            //}.bind(this))
            .then(function(/*found*/){
                if(regData.role === lConst.role.developer){
                    developerProfile = {};
                    // email messaging if requests access to nonexistant game
                    //if(found && found !== "no object"){
                    //    developerProfile[gameId] = {};
                    //}
                    // create new developer profile on couchbase
                    return this.authDataStore.setDeveloperProfile(userID, developerProfile);
                }
            }.bind(this))
            //.then(function(){
            //    return sendDeveloperGameConfirmEmail.call(this, userID, email, gameId, developerProfile, req.protocol, req.headers.host);
            //}.bind(this))
            .then(null, function(err){
                console.log("Registration Error -",err);
            });
    }
    // else student
    else if(regData.role == lConst.role.student) {
        if(regData.regCode)
        {
            var courseId;
            // get course Id from course code
            this.lmsStore.getCourseIdFromCourseCode(regData.regCode)
                // register, passing in institutionId
                .then(function(id){
                    courseId = id;
                    if(courseId) {
                        // get rid of reg code, not longer needed
                        delete regData.regCode;
                        return this.lmsStore.isCoursePremium(courseId);
                    } else {
                        return "user.enroll.code.invalid"
                    }
                }.bind(this))
                .then(function(isPremium){
                    if(typeof isPremium === "string"){
                        return isPremium;
                    }
                    if(isPremium === false){
                        return false;
                    }
                    return licService.myds.getLicenseFromPremiumCourse(courseId);
                })
                .then(function(license){
                    if(license === "user.enroll.code.invalid"){
                        registerErr({key:license}, 404);
                        this.stats.increment("error", "Route.Register.User.InvalidInstitution");
                        return;
                    }
                    var hasLicense;
                    if(license === false){
                        hasLicense = false;
                    } else{
                        hasLicense = true;
                    }
                    var studentSeatsRemaining = license["student_seats_remaining"];
                    if(studentSeatsRemaining === 0){
                        this.requestUtil.errorResponse(res, {key: "lic.students.full"}, 404);
                        this.stats.increment("error", "Route.Register.User.licStudentsFull");
                        return;
                    }
                    register(regData, courseId, hasLicense);
                }.bind(this))
                // catch all errors
                .then(null, function(err){
                    registerErr(err, 404);
                    console.error("Student Registration Error -",err);
                });
        } else {
            register(regData);
        }
    }

    this.stats.increment("info", "Route.Register.User."+Util.String.capitalize(regData.role));
}
// if a course is a premium course, enroll student in license. else, do nothing
function _enrollPremiumIfPremium(userId, courseId, hasLicense){
    return when.promise(function(resolve, reject){
        if(hasLicense){
            var licService = this.serviceManager.get("lic").service;
            licService.enrollStudentInPremiumCourse(userId, courseId)
                .then(function(status){
                    if(typeof status === "string"){
                        resolve(status);
                    }
                    resolve();
                })
                .then(null, function(err){
                    reject(err);
                });
        } else {
            resolve();
        }
    }.bind(this));
}

function sendBetaConfirmEmail(regData, protocol, host) {

    var email = regData.email;

    if( !(email &&
        _.isString(email) &&
        email.length) ) {
        this.requestUtil.errorResponse(res, {key:"user.verifyEmail.user.emailNotExist"}, 401);
    }

    var verifyCode = Util.CreateUUID();

    return this.getAuthStore().findUser('email', email)
        .then(function(userData) {
            userData.verifyCode           = verifyCode;
            userData.verifyCodeStatus     = aConst.verifyCode.status.beta;
            // School + District Info + Phone Number for Beta
            userData.school = regData.school;
            userData.district = regData.district;
            userData.phoneNumber = regData.phoneNumber;
            return this.glassLabStrategy.updateUserData(userData)
                .then(function(){
                    var emailData = {
                        subject: "GlassLabGames.org Beta confirmation",
                        to: this.options.auth.beta.email.to,
                        user: userData,
                        code: verifyCode,
                        host: protocol+"://"+host
                    };
                    var email = new Util.Email(
                        this.options.auth.beta.email,
                        path.join(__dirname, "../email-templates"),
                        this.stats);
                    email.send('beta-verify', emailData)
                        .then(function(){
                            // all ok
                        }.bind(this))
                        // error
                        .then(null, function(err){
                            console.error('failed to send email:',  err);
                        }.bind(this));

                }.bind(this));
        }.bind(this))
        // catch all errors
        .then(null, function(err) {
            if( err.error &&
                err.error == "user not found") {
                this.requestUtil.errorResponse(res, {key:"user.verifyEmail.user.emailNotExist"}, 400);
            } else {
                console.error("AuthService: sendBetaConfirmEmail Error -", err);
                this.requestUtil.errorResponse(res, {key:"user.verifyEmail.general"}, 400);
            }
        }.bind(this))
}

function sendDeveloperConfirmEmail(regData, protocol, host) {

    var email = regData.email;

    if( !(email &&
        _.isString(email) &&
        email.length) ) {
        this.requestUtil.errorResponse(res, {key:"user.verifyEmail.user.emailNotExist"}, 401);
    }

    var verifyCode = Util.CreateUUID();

    return this.getAuthStore().findUser('email', email)
        .then(function(userData) {
            userData.verifyCode           = verifyCode;
            userData.verifyCodeStatus     = aConst.verifyCode.status.approve;
            return this.glassLabStrategy.updateUserData(userData)
                .then(function(){

                    var emailData = {
                        subject: "GlassLab Games Developer confirmation",
                        to: this.options.auth.developer.email.to,
                        user: userData,
                        code: verifyCode,
                        host: protocol+"://"+host
                    };
                    var email = new Util.Email(
                        this.options.auth.developer.email,
                        path.join(__dirname, "../email-templates"),
                        this.stats);
                    email.send('developer-verify', emailData)
                        .then(function(){
                            // all ok
                        }.bind(this))
                        // error
                        .then(null, function(err){
                            console.error('failed to send email:',  err);
                        }.bind(this));

                }.bind(this));
        }.bind(this))
        // catch all errors
        .then(null, function(err) {
            if( err.error &&
                err.error == "user not found") {
                this.requestUtil.errorResponse(res, {key:"user.verifyEmail.user.emailNotExist"}, 400);
            } else {
                console.error("AuthService: sendDeveloperConfirmEmail Error -", err);
                this.requestUtil.errorResponse(res, {key:"user.verifyEmail.general"}, 400);
            }
        }.bind(this))
}

function verifyBetaCode(req, res, next) {
    if( !(req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length) ) {
        this.requestUtil.errorResponse(res, {key:"user.verifyEmail.code.missing"}, 401);
    }
    // 1) verify the beta code and get user data
    this.getAuthStore().findUser("verify_code", req.params.code)
        .then(function(userData) {
                if( userData.verifyCodeStatus === aConst.verifyCode.status.beta ||
                    userData.verifyCodeStatus === aConst.verifyCode.status.approve ) {
                    return when.resolve(userData);
                }
                else if(userData.verifyCodeStatus === aConst.verifyCode.status.sent) {
                    if( !req.query.hasOwnProperty('resend') ||
                        !req.query.resend
                    ) {
                        this.requestUtil.jsonResponse(res, {"text": "Verify Email has already been sent, add \"?resend=1\" at the end of the url if you want to resend", "statusCode":200});
                    } else {
                        // force send email again
                        return when.resolve(userData);
                    }
                }
                else if(userData.verifyCodeStatus === aConst.verifyCode.status.verified) {
                    this.requestUtil.jsonResponse(res, {"text": "Email has been verified by the user", "statusCode":200});
                }
                else {
                    this.requestUtil.errorResponse(res, {key:"user.verifyEmail.general"}, 400);
                }

        }.bind(this),
        function(err) {
            if( err.error &&
                err.error == "user not found") {
                this.requestUtil.errorResponse(res, {key:"user.verifyEmail.code.missing"}, 400);
            } else {
                console.error("AuthService: validateBetaCode Error -", err);
                this.requestUtil.errorResponse(res, {key:"user.verifyEmail.general"}, 400);
            }
        }.bind(this))
        .then(function(userData) {
            if(!userData) return; // no data so skip

            // send verification email to registered user
            return sendVerifyEmail.call(this, userData, req.protocol, req.headers.host, userData.verifyCode);
        }.bind(this))
        .then(function(sent) {
            if(!sent) return; // no data so skip, error already handled above

            this.requestUtil.jsonResponse(res, {"text": "Successfully Confirmed Beta User. Verification email sent to Beta User", "statusCode":200});
        }.bind(this))
        .then(null, function(err) {
            console.log(err);
            this.requestUtil.errorResponse(res, {key:"user.verifyEmail.general"});
        });
}

function verifyDeveloperCode(req, res, next) {
    if( !(req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length) ) {
        this.requestUtil.errorResponse(res, {key:"user.verifyEmail.code.missing"}, 401);
    }
    // 1) verify the beta code and get user data
    this.getAuthStore().findUser("verify_code", req.params.code)
        .then(function(userData) {
            if( userData.verifyCodeStatus === aConst.verifyCode.status.approve ) {
                return when.resolve(userData);
            }
            else if(userData.verifyCodeStatus === aConst.verifyCode.status.sent) {
                if( !req.query.hasOwnProperty('resend') ||
                    !req.query.resend
                    ) {
                    this.requestUtil.jsonResponse(res, {"text": "Verify Email has already been sent, add \"?resend=1\" at the end of the url if you want to resend", "statusCode":200});
                } else {
                    // force send email again
                    return when.resolve(userData);
                }
            }
            else if(userData.verifyCodeStatus === aConst.verifyCode.status.verified) {
                this.requestUtil.jsonResponse(res, {"text": "Email has been verified by the user", "statusCode":200});
            }
            else {
                this.requestUtil.errorResponse(res, {key:"user.verifyEmail.general"}, 400);
            }

        }.bind(this),
            function(err) {
                if( err.error &&
                    err.error == "user not found") {
                    this.requestUtil.errorResponse(res, {key:"user.verifyEmail.code.missing"}, 400);
                } else {
                    console.error("AuthService: verifyDeveloperCode Error -", err);
                    this.requestUtil.errorResponse(res, {key:"user.verifyEmail.general"}, 400);
                }
            }.bind(this))
        .then(function(userData) {
            if(!userData) return; // no data so skip

            // send verification email to registered user
            return sendDeveloperVerifyEmail.call(this, userData, req.protocol, req.headers.host, userData.verifyCode);
        }.bind(this))
        .then(function(sent) {
            if(!sent) return; // no data so skip, error already handled above

            this.requestUtil.jsonResponse(res, {"text": "Successfully Confirmed Developer. Verification email sent to the Developer", "statusCode":200});
        }.bind(this))
        .then(null, function(err) {
            console.log(err);
            this.requestUtil.errorResponse(res, {key:"user.verifyEmail.general"});
        });
}

function sendVerifyEmail(regData, protocol, host) {
    if( !(regData.email &&
        _.isString(regData.email) &&
        regData.email.length) ) {
        this.requestUtil.errorResponse(res, {key:"user.verifyEmail.user.emailNotExist"}, 401);
    }
    if(this.options.env === "prod" || this.options.env === "stage"){
        protocol = "https";
    }
    var verifyCode = Util.CreateUUID();
    var expirationTime = Util.GetTimeStamp() + aConst.verifyCode.expirationInterval;

    return this.getAuthStore().findUser('email', regData.email)
        .then(function(userData) {
            userData.verifyCode           = verifyCode;
            userData.verifyCodeExpiration = expirationTime;
            userData.verifyCodeStatus     = aConst.verifyCode.status.sent;
            userData.trial                = regData.trial;
            userData.subscribe            = regData.subscribe;
            userData.seatsSelected        = regData.seatsSelected;
            userData.packageType          = regData.packageType;

            return this.glassLabStrategy.updateUserData(userData)
                .then(function(){
                    var emailData = {
                        subject: "GlassLab Games - Verify your email",
                        to:   userData.email,
                        user: userData,
                        code: verifyCode,
                        host: protocol+"://"+host
                    };

                    var email = new Util.Email(
                        this.options.auth.email,
                        path.join(__dirname, "../email-templates"),
                        this.stats);
                    return email.send('register-verify', emailData)
                        .then(function(){
                            // all ok
                            return true;
                        }.bind(this))
                        // error
                        .then(null, function(err){
                            console.error('failed to send email:',  err);
                        }.bind(this));

                }.bind(this));
        }.bind(this))
        // catch all errors
        .then(null, function(err) {
            if( err.error &&
                err.error == "user not found") {
                this.requestUtil.errorResponse(res, {key:"user.verifyEmail.user.emailNotExist"}, 400);
            } else {
                console.error("AuthService: sendVerifyEmail Error -", err);
                this.requestUtil.errorResponse(res, {key:"user.verifyEmail.general"}, 400);
            }
        }.bind(this))

}

function sendDeveloperVerifyEmail(regData, protocol, host) {
    if( !(regData.email &&
        _.isString(regData.email) &&
        regData.email.length) ) {
        this.requestUtil.errorResponse(res, {key:"user.verifyEmail.user.emailNotExist"}, 401);
    }
    if(this.options.env === "prod" || this.options.env === "stage"){
        protocol = "https";
    }
    var verifyCode = Util.CreateUUID();
    var expirationTime = Util.GetTimeStamp() + aConst.verifyCode.expirationInterval;

    return this.getAuthStore().findUser('email', regData.email)
        .then(function(userData) {
            userData.verifyCode           = verifyCode;
            userData.verifyCodeExpiration = expirationTime;
            userData.verifyCodeStatus     = aConst.verifyCode.status.sent;

            return this.glassLabStrategy.updateUserData(userData)
                .then(function(){
                    var emailData = {
                        subject: "GlassLab Games - Verify your email",
                        to:   userData.email,
                        user: userData,
                        code: verifyCode,
                        host: protocol+"://"+host
                    };

                    var email = new Util.Email(
                        this.options.auth.email,
                        path.join(__dirname, "../email-templates"),
                        this.stats);
                    return email.send('register-developer-verify', emailData)
                        .then(function(){
                            // all ok
                            return true;
                        }.bind(this))
                        // error
                        .then(null, function(err){
                            console.error('failed to send email:',  err);
                        }.bind(this));

                }.bind(this));
        }.bind(this))
        // catch all errors
        .then(null, function(err) {
            if( err.error &&
                err.error == "user not found") {
                this.requestUtil.errorResponse(res, {key:"user.verifyEmail.user.emailNotExist"}, 400);
            } else {
                console.error("AuthService: sendVerifyEmail Error -", err);
                this.requestUtil.errorResponse(res, {key:"user.verifyEmail.general"}, 400);
            }
        }.bind(this))

}

function verifyEmailCode(req, res, next, serviceManager) {

    if( !(req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length) ) {
        this.requestUtil.errorResponse(res, {key:"user.verifyEmail.code.missing"}, 401);
    }

    // 1) validate the code and get user data
    this.getAuthStore().findUser("verify_code", req.params.code)
        .then(function(userData) {
            // check if code expired
            if(Util.GetTimeStamp() > userData.verifyCodeExpiration && process.env.HYDRA_ENV !== 'dev') {
                this.requestUtil.errorResponse(res, {key:"user.verifyEmail.code.expired"}, 400);
            } else {

                if(userData.verifyCodeStatus === aConst.verifyCode.status.sent) {
                    // change status to verified
                    userData.verifyCodeStatus = aConst.verifyCode.status.verified;
                    // Disabled while one shot login is active - look inside verifyOneShotLogin
                    //userData.verifyCode        = "NULL";
                    userData.verifyCodeExpiration = "NULL";

                    // automatically login user in
                    return this.glassLabStrategy.updateUserData(userData)
                        .then(function() {
                            return when.promise(function(resolve,reject) {
                                req.body.verifyCode = req.params.code;
                                serviceManager.internalRoute('/api/v2/auth/login/glasslab', 'post', [req, res, next]);
                                resolve();
                            }).then(function() {
                                return userData;
                            });
                        }.bind(this));
                } else {
                    this.requestUtil.errorResponse(res, {key:"user.verifyEmail.alreadyValidated"}, 400);
                }
            }
        }.bind(this),
            function(err) {
                // potential cases if user not found:
                // 1. incorrect verification code
                // TODO account for:
                // 2. user account deleted because user did not verify email in time
                if( err.error &&
                    err.error == "user not found") {
                    this.requestUtil.errorResponse(res, {key:"user.verifyEmail.code.missing"}, 400);
                } else {
                    console.error("AuthService: verifyEmailCode Error -", err);
                    this.requestUtil.errorResponse(res, {key:"user.verifyEmail.general"}, 400);
                }
        }.bind(this))
        .then(function(userData) {
            // 2) send welcome email to developers
            if( userData.role === lConst.role.developer ) {
                return sendDeveloperWelcomeEmail.call(this, this.options.auth.email, userData, req.protocol, req.headers.host);
            }
            // 2) send welcome email to everyone else
            else {
                return sendWelcomeEmail.call(this, this.options.auth.email, userData, req.protocol, req.headers.host);
            }
        }.bind(this))
        // catch all errors
        .then(null, function(err) {
            console.log(err);
            this.requestUtil.errorResponse(res, {key:"user.welcomeEmail.general"});
        });
}


function sendWelcomeEmail(emailOptions, regData, protocol, host){
    var verifyCode = Util.CreateUUID();
    // store code
    // 1) store code
    /*
     var emailData = {
     user: regData,
     code: verifyCode
     };
     */
    // TODO
    // instructor or admin (all require email)
    // 2) send email
    var emailData = {
        subject: "Welcome to GlassLabGames.org!",
        to:   regData.email,
        user: regData,
        host: protocol+"://"+host
    };
    var email = new Util.Email(
        emailOptions,
        path.join(__dirname, "../email-templates"),
        this.stats);

    return email.send('register-welcome', emailData);
}

function sendDeveloperWelcomeEmail(emailOptions, regData, protocol, host){
    var verifyCode = Util.CreateUUID();
    // store code
    // 1) store code
    /*
     var emailData = {
     user: regData,
     code: verifyCode
     };
     */
    // TODO
    // instructor or admin (all require email)
    // 2) send email
    var emailData = {
        subject: "Welcome to GlassLab Games Developer!",
        to:   regData.email,
        user: regData,
        host: protocol+"://"+host
    };
    var email = new Util.Email(
        emailOptions,
        path.join(__dirname, "../email-templates"),
        this.stats);

    return email.send('register-developer-welcome', emailData);
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
        var resetCode = Util.CreateUUID();

        var expirationTime = Util.GetTimeStamp() + aConst.passwordReset.expirationInterval;

        // 1) valid user email and get the user data
        //    update user account with code
        this.getAuthStore().findUser('email', email)
            .then(function(userData) {
                userData.resetCode           = resetCode;
                userData.resetCodeExpiration = expirationTime;
                userData.resetCodeStatus     = aConst.passwordReset.status.sent;

                return this.glassLabStrategy.updateUserData(userData)
                    .then(function(){
                        //
                        // 2) send email
                        var emailData = {
                            subject: "Your GlassLabGames.org Password",
                            to:   userData.email,
                            user: userData,
                            code: resetCode,
                            host: req.protocol+"://"+req.headers.host
                        };

                        var email = new Util.Email(
                            this.options.auth.email,
                            path.join(__dirname, "../email-templates"),
                            this.stats);
                        email.send('password-reset', emailData)
                            .then(function(){
                                // all ok
                                this.requestUtil.jsonResponse(res, {});
                            }.bind(this))
                            // error
                            .then(null, function(err){
                                this.requestUtil.errorResponse(res, err, 500);
                            }.bind(this));

                    }.bind(this));
            }.bind(this))

            // catch all errors
            .then(null, function(err) {
                if( err.error &&
                    err.error == "user not found") {
                    var userData = {};
                    userData.email = req.body.email;
                    var emailData = {
                        subject: "Your GlassLabGames.org Password",
                        to:   userData.email,
                        user: userData,
                        host: req.protocol+"://"+req.headers.host
                    };
                    var email = new Util.Email(
                        this.options.auth.email,
                        path.join(__dirname, "../email-templates"),
                        this.stats);
                    email.send('password-reset-nonuser', emailData)
                        .then(function(){
                            // all ok
                            this.requestUtil.jsonResponse(res, {});
                        }.bind(this))
                        // error
                        .then(null, function(err){
                            this.requestUtil.errorResponse(res, err, 500);
                        }.bind(this));
                } else {
                    console.error("AuthService: resetPasswordSend Error -", err);
                    this.requestUtil.errorResponse(res, {key:"user.passwordReset.general"}, 400);
                }
            }.bind(this))

    } else {
        this.requestUtil.errorResponse(res, {key:"user.passwordReset.user.emailNotExist"}, 401);
    }
}

function resetPasswordVerify(req, res, next) {
    if( req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length) {

        // 1) validate the code and get user data
        this.getAuthStore().findUser("reset_code", req.params.code)
            .then(function(userData) {
                if(Util.GetTimeStamp() > userData.resetCodeExpiration) {
                    this.requestUtil.errorResponse(res, {key:"user.passwordReset.code.expired"}, 400);
                } else {
                    if(userData.resetCodeStatus == aConst.passwordReset.status.sent) {
                        // update status
                        userData.resetCodeStatus = aConst.passwordReset.status.inProgress;

                        // remove password as this is not changing, so password is not updated
                        delete userData.password;

                        return this.glassLabStrategy.updateUserData(userData)
                            .then(function() {
                                this.requestUtil.jsonResponse(res, {});
                            }.bind(this));
                    } else {
                        this.requestUtil.errorResponse(res, {key:"user.passwordReset.code.expired"}, 400);
                    }
                }
            }.bind(this))

            // catch all errors
            .then(null, function(err) {
                if( err.error &&
                    err.error == "user not found") {
                    this.requestUtil.errorResponse(res, {key:"user.passwordReset.code.expired"}, 400);
                } else {
                    console.error("AuthService: resetPasswordVerify Error -", err);
                    this.requestUtil.errorResponse(res, {key:"user.passwordReset.general"}, 400);
                }
            }.bind(this));

    } else {
        this.requestUtil.errorResponse(res, {key:"user.passwordReset.code.missing"}, 401);
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
        this.getAuthStore().findUser("reset_code", req.body.code)
            .then(function(userData) {
                if(Util.GetTimeStamp() > userData.resetCodeExpiration) {
                    this.requestUtil.errorResponse(res, {key:"user.passwordReset.code.expired"}, 400);
                } else if(userData.resetCodeStatus == aConst.passwordReset.status.inProgress) {
                    if (this.glassLabStrategy.validatePassword(req.body.password) !== true) {
                        return;
                    }
                  
                    return this.glassLabStrategy.encryptPassword(req.body.password)
                        .then(function(password) {
                            // update status
                            userData.password = password;
                            userData.resetCodeStatus = "NULL";
                            userData.resetCodeExpiration = "NULL";
                            userData.resetCode = "NULL";

                            // If this user missed the verify code, we can authorize them here as well
                            if( userData.verifyCodeStatus === aConst.verifyCode.status.sent ) {
                                userData.verifyCodeStatus = aConst.verifyCode.status.verified;
                                userData.verifyCodeExpiration = "NULL";
                            }

                            return this.glassLabStrategy.updateUserData(userData);
                        }.bind(this))
                        .then(function() {
                            this.requestUtil.jsonResponse(res, {});
                        }.bind(this));
                }
            }.bind(this))

            // catch all errors
            .then(null, function(err) {
                console.error("AuthService: resetPasswordUpdate Error -", err);
                this.requestUtil.errorResponse(res, {key:"user.passwordReset.general"}, 400);
            }.bind(this));

    } else {
        this.requestUtil.errorResponse(res, {key:"user.passwordReset.code.missing"}, 401);
    }
}

function requestDeveloperGameAccess(req, res){
    var userId = req.user.id;
    var gameId = req.params.gameId.toUpperCase();
    if(req.user.role !== "developer"){
        this.requestUtil.errorResponse(res, {key:"auth.access.invalid"},401);
        return;
    }
    var developerProfile;
    var dashService = this.serviceManager.get("dash").service;
    dashService.telmStore.getGameInformation(gameId, true)
        .then(function(found){
            if(found === "no object"){
                return found;
            }
            // fix check access flow.  perhaps use helper method in events. reorganize.
            var dashGames = this.serviceManager.get("dash").lib.Controller.games;
            var dashService = this.serviceManager.get("dash").service;
            return dashGames.getDeveloperGameIds.call(dashService, userId, true);
        }.bind(this))
        .then(function(data){
            developerProfile = data;
            if(developerProfile === "no object") {
                return developerProfile;
            } else if(!!developerProfile[gameId] &&
                developerProfile[gameId].verifyCodeStatus) {
                if( developerProfile[gameId].verifyCodeStatus === "approve" ) {
                    return "already requested";
                }
                else {
                    return "already has";
                }
            } else{
                developerProfile[gameId] = {};
                return this.authStore.getUserEmail(userId);
            }
        }.bind(this))
        .then(function(state){
            if(state !== "no object" && state !== "already has" && state !== "already requested") {
                var email = state;
                return sendDeveloperGameConfirmEmail.call(this, userId, email, gameId, developerProfile, req.protocol, req.headers.host);
            }
            return state;
        }.bind(this))
        .then(function(state){
            if(state === "no object") {
                this.requestUtil.errorResponse(res, {key:"user.invalid.gameId", error: "This is an invalid game Id."}, 401);
            } else if(state === "already has") {
                this.requestUtil.errorResponse(res, {key:"user.has.access", error: "You have already have access to this game."}, 401);
            } else if(state === "already requested") {
                this.requestUtil.errorResponse(res, {key:"user.has.requested", error: "You have already requested access to this game. Please wait for admin approval."}, 401);
            } else{
                // send email to developers telling them that we will need to approve their request for access.
                // game added to couchbase gets a status of "pending"
                // perhaps three levels of status, "pending", "approved", and "denied"
                res.end('{"status": "needs admin approval"}');
            }
        }.bind(this))
        .then(null, function(err){
            if(err !== "errorResponse"){
                this.requestUtil.errorResponse(res, err, 401);
                console.trace(err);
            }
        }.bind(this));
}

function sendDeveloperGameConfirmEmail(userId, devEmail, gameId, developerProfile, protocol, host) {
    return when.promise(function(resolve, reject){
        var verifyCode = Util.CreateUUID();
        developerProfile[gameId].verifyCode = verifyCode;
        developerProfile[gameId].verifyCodeStatus = aConst.verifyCode.status.approve;
        this.authDataStore.setDeveloperProfile(userId, developerProfile)
            .then(function() {
                var emailData = {
                    subject: "GlassLab Games - Developer Game Request",
                    to: this.options.auth.developer.email.to,
                    devEmail: devEmail,
                    gameId: gameId,
                    code: verifyCode,
                    host: protocol + "://" + host
                };
                var email = new Util.Email(
                    this.options.auth.developer.email,
                    path.join(__dirname, "../email-templates"),
                    this.stats);
                return email.send('developer-request-game-verify', emailData);
            }.bind(this))
            .then(function(){
                resolve();
                // all ok
            }.bind(this))
            // error
            .then(null, function(err){
                console.error("AuthService: sendDeveloperGameConfirmEmail Error -", err);
                this.requestUtil.errorResponse(res, {key:"user.verifyGameEmail.general"}, 400);
                reject("errorResponse");
            }.bind(this))
    }.bind(this));
}

function approveDeveloperGameAccess(req, res){
    var userId;
    var devEmail;
    var gameId = req.params.gameId;
    var code = req.params.code;
    if( !(req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length) ) {
        this.requestUtil.errorResponse(res, {key:"user.verifyGameEmail.code.missing"}, 401);
    }
    _getDeveloperByCode.call(this, code, gameId)
        .then(function(id) {
            userId = id;
            return this.getAuthStore().findUser("id", userId);
        }.bind(this))
        .then(function(userData){
            devEmail = userData.email;
            var dashService = this.serviceManager.get("dash").service;
            return dashService.telmStore.getDeveloperProfile(userId);
        }.bind(this))
        .then(function(profile){
            profile[gameId].verifyCodeStatus = aConst.verifyCode.status.verified;
            return this.authDataStore.setDeveloperProfile(userId, profile);
        }.bind(this))
        .then(function(){
            return sendDeveloperGameApprovalEmail.call(this, devEmail, gameId, req.protocol, req.headers.host);
        }.bind(this))
        .then(function(){
            this.requestUtil.jsonResponse(res, {"text": "Approved Game for Developer. Notification email sent to the Developer", "statusCode":200});
        }.bind(this))
        .then(function(err){
            this.requestUtil.errorResponse(res, {key:"user.verifyGameEmail.general"});
        }.bind(this));
}

function sendDeveloperGameApprovalEmail(devEmail, gameId, protocol, host) {
    if( !(devEmail &&
        _.isString(devEmail) &&
        devEmail.length) ) {
        this.requestUtil.errorResponse(res, {key:"user.verifyGameEmail.user.emailNotExist"}, 401);
    }
    return when.promise(function(resolve, reject){
        this.getAuthStore().findUser('email', devEmail)
            .then(function(userData){
                var emailData = {
                    subject: "GlassLab Games - Game request approval",
                    to: devEmail,
                    user: userData,
                    gameId: gameId,
                    host: protocol + "://" + host
                };
                var email = new Util.Email(
                    this.options.auth.email,
                    path.join(__dirname, "../email-templates"),
                    this.stats);
                return email.send('developer-game-approved', emailData);
            }.bind(this))
            .then(function(){
                resolve()
            })
            .then(null, function(err){
                reject(err);
            });
    }.bind(this));
}

function _getDeveloperByCode(code, gameId){
    return when.promise(function(resolve, reject){
        var dashService = this.serviceManager.get('dash').service;
        dashService.telmStore.getAllDeveloperProfiles()
            .then(function(devProfiles){
                var developerId;
                _(devProfiles).some(function(profile, key) {
                    if( profile[gameId] &&
                        profile[gameId].verifyCode === code ) {
                        var components = key.split(':');
                        developerId = components[2];
                        return true;
                    }
                });
                resolve(developerId);
            }.bind(this))
            .then(null, function(err){
                reject(err);
            });
    }.bind(this));
}

function eraseStudentInfo(req, res){

    console.log(' ');
    console.log(Util.DateGMTString()+' ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ ');
    console.log(Util.DateGMTString()+' ++++ ');
    console.log(Util.DateGMTString()+' ++++    eraseStudentInfo() called ... ');
    console.log(Util.DateGMTString()+' ++++ ');
    console.log(Util.DateGMTString()+' ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ ');

    if(req.user.role !== "admin"){

        console.log(Util.DateGMTString(), 'user', req.user.id, req.user.role,
            req.user.username, 'attempted to erase student records but is not an admin.');

        this.requestUtil.errorResponse(res, { key: "user.permit.invalid"});
        return;
    }

    if(!(req.body && req.body.userId)){

        console.log(Util.DateGMTString(), 'user', req.user.id, req.user.role,
            req.user.username, 'attempted to erase student records but corect information was not supplied.');

        this.requestUtil.errorResponse(res, { key: "user.delete.information"});
        return;
    }

    console.log(Util.DateGMTString(), 'user', req.user.id, req.user.role,
        req.user.username, 'starting to erase student records for',
        req.body.userId, req.body.username);

    var deleteUserId = req.body.userId;
    var promise;

    this.authStore.findUser("id", deleteUserId)
    .then(function(foundUser){

        console.log(' ');
        console.log('               id =', foundUser.id);
        console.log('         username =', foundUser.username);
        console.log('        firstName =', foundUser.firstName);
        console.log('         lastName =', foundUser.lastName);
        console.log('            email =', foundUser.email);
        console.log('             role =', foundUser.role);
        console.log('             type =', foundUser.type);
        console.log('    institutionId =', foundUser.institutionId);
        console.log('          enabled =', foundUser.enabled);

        // console.log('        foundUser =', foundUser);

        if('student' !== foundUser.role){
            console.log(' * * * * Operation Canceled * * * * ');
            console.log('This function only removes student records.');
            console.log('The supplied userId is not for a student.');
            this.requestUtil.errorResponse(res, { key: "user.delete.information"});
            return;
        }

        promise = _deleteStudentAccount.call(this, deleteUserId);
        return promise;

    }.bind(this))
    .then(function(status){

        console.log(' status =', status);

        this.requestUtil.jsonResponse(res, { status: "ok"});

    }.bind(this))
    .then(null, function(err){
        console.error(Util.DateGMTString(), 'Delete User Error -',err);
        if(err.error === "user not found"){
            this.requestUtil.errorResponse(res, { key: "user.delete.access"});
            return;
        }
        this.requestUtil.errorResponse(res, { key: "user.delete.general"});
    }.bind(this));
}

function eraseInstructorInfo(req, res){
    
    console.log(' ');
    console.log(Util.DateGMTString()+' ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ ');
    console.log(Util.DateGMTString()+' ++++ ');
    console.log(Util.DateGMTString()+' ++++    eraseInstructorInfo() called ... ');
    console.log(Util.DateGMTString()+' ++++ ');
    console.log(Util.DateGMTString()+' ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ ');
    
    if(req.user.role !== "admin"){
        
        console.log(Util.DateGMTString(), 'user', req.user.id, req.user.role,
                    req.user.username, 'attempted to erase instructor records but is not an admin.');
        
        this.requestUtil.errorResponse(res, { key: "user.permit.invalid"});
        return;
    }
    
    if(!(req.body && req.body.userId)){
        
        console.log(Util.DateGMTString(), 'user', req.user.id, req.user.role,
                    req.user.username, 'attempted to erase instructor records but corect information was not supplied.');
        
        this.requestUtil.errorResponse(res, { key: "user.delete.information"});
        return;
    }
    
    console.log(Util.DateGMTString(), 'user', req.user.id, req.user.role,
                req.user.username, 'starting to erase instructor records for',
                req.body.userId, req.body.username);
    
    var deleteUserId = req.body.userId;
    var promise;
    
    this.authStore.findUser("id", deleteUserId)
    .then(function(foundUser){
          
          console.log(' ');
          console.log('               id =', foundUser.id);
          console.log('         username =', foundUser.username);
          console.log('        firstName =', foundUser.firstName);
          console.log('         lastName =', foundUser.lastName);
          console.log('            email =', foundUser.email);
          console.log('             role =', foundUser.role);
          console.log('             type =', foundUser.type);
          console.log('    institutionId =', foundUser.institutionId);
          console.log('          enabled =', foundUser.enabled);
          
          // console.log('        foundUser =', foundUser);
          
          if('instructor' !== foundUser.role){
              console.log(' * * * * Operation Canceled * * * * ');
              console.log('This function only removes instructor records.');
              console.log('The supplied userId is not for an instructor.');
              this.requestUtil.errorResponse(res, { key: "user.delete.information"});
              return;
          }
          
          promise = _deleteInstructorAccount.call(this, deleteUserId, req);
          return promise;
          
    }.bind(this))
    .then(function(status){
          var responseStatus = "ok";
          
          console.log(' status =', status);
          if(status === "license owner"){
                responseStatus = status;
          }
          
          this.requestUtil.jsonResponse(res, { status: responseStatus });
          
    }.bind(this))
    .then(null, function(err){
          console.error(Util.DateGMTString(), 'Delete User Error -',err);
          if(err.error === "user not found"){
            this.requestUtil.errorResponse(res, { key: "user.delete.access"});
            return;
          }
          this.requestUtil.errorResponse(res, { key: "user.delete.general"});
    }.bind(this));
}

// for student use eraseStudentInfo()
// for instructor use eraseInstructorInfo()
//
function deleteUser(req, res){

    this.requestUtil.errorResponse(res, { key: "user.permit.invalid"});
    return;

    ////////////////    ////////////////

    if(req.user.role !== "admin"){
        this.requestUtil.errorResponse(res, { key: "user.permit.invalid"});
        return;
    }
    if(!(req.body && req.body.userId)){
        this.requestUtil.errorResponse(res, { key: "user.delete.information"});
        return;
    }
    var deleteUserId = req.body.userId;
    var promise;

    this.authStore.findUser("id", deleteUserId)
        .then(function(deleteUser){

            // if(deleteUser.role === "student"){
            //     //largely ready and approved, but still good to have one last review before it is live
            //     //promise = _deleteStudentAccount.call(this, deleteUserId);
            // } else if (deleteUser.role === "instructor"){

            if (deleteUser.role === "instructor"){
                //delete instructor method workable, but still needs design attention
                // for example, are we deleting all the info we need to be
                // how are we going to store the hashed emails, should we keep hashed passwords, etc
                // email response also needed
                //promise = _deleteInstructorAccount.call(this, deleteUserId);
            }
            return promise;
        }.bind(this))
        .then(function(status){
            if(status === "license owner"){
                return;
            }
            this.requestUtil.jsonResponse(res, { status: "ok"});
        }.bind(this))
        .then(null, function(err){
            console.error("Delete User Error -",err);
            if(err.error === "user not found"){
                this.requestUtil.errorResponse(res, { key: "user.delete.access"});
                return;
            }
            this.requestUtil.errorResponse(res, { key: "user.delete.general"});
        }.bind(this));
}

function _deleteStudentAccount(studentId){
    return when.promise(function(resolve, reject){
        var lmsService = this.serviceManager.get("lms").service;
        var licService = this.serviceManager.get("lic").service;
        var lConst = this.serviceManager.get("lic").lib.Const;
        var courses;
        var licenses;
        lmsService.myds.getCoursesByStudentId(studentId)
            .then(function(results){
                courses = results;
                var promiseList = [];
                _(courses).forEach(function(course){
                    promiseList.push(licService.myds.getLicenseFromPremiumCourse(course.id));
                });
                return when.all(promiseList);
            })
            .then(function(results){
                var licenseObj = {};
                licenses = [];
                _(results).forEach(function(license){
                    if(license && !licenseObj[license.id]){
                        licenseObj[license.id] = license;
                        licenses.push(license);
                    }
                });
                var promiseList = [];
                _(licenses).forEach(function(license){
                    promiseList.push(licService.cbds.getStudentsByLicense(license.id));
                });
                return when.all(promiseList);
            })
            .then(function(studentMaps){
                var promiseList = [];
                _(studentMaps).forEach(function(map, index){
                    delete map[studentId];
                    var data = { students: map };
                    var licenseId = licenses[index].id;
                    promiseList.push(licService.cbds.updateStudentsByLicense(licenseId, data));
                });
                return when.all(promiseList);
            })
            .then(function(){
                var promiseList = [];
                _(licenses).forEach(function(license){
                    var licenseId = license.id;
                    var seats = license["package_size_tier"];
                    var studentSeats = lConst.seats[seats].studentSeats;
                    promiseList.push(licService.updateStudentSeatsRemaining(licenseId, studentSeats));
                });
                return when.all(promiseList);
            })
            .then(function(){
                return lmsService.myds.removeStudentFromAllCourses(studentId);
            })
            .then(function(){
                var userData = _deleteUserTableInfo(studentId);
                return this.authStore.updateUserDBData(userData);
            }.bind(this))
            .then(function(){
                resolve();
            })
            .then(null, function(err){
                console.error("Delete Student Account Error");
                reject(err);
            }.bind(this));
    }.bind(this));
}

function _deleteInstructorAccount(userId, req){
    //delete instructor plan
    //get courses,
    //getLicenseMap
    //get license
    //unenroll all studesnt from courses
    //archive all courses (also disabling premium games in that process
    //set license map status to null, if in license and if not license owner
    //set subscription id of all licenses instructor was owner of in the past to null
    //call internal route for the internal cancel license method

    return when.promise(function(resolve, reject){
        var courses;
        var license;
        var userEmail;
        var lmsService = this.serviceManager.get("lms").service;
        var licService = this.serviceManager.get("lic").service;
        var promiseList = [];
        promiseList.push(lmsService.myds.getEnrolledCourses(userId));
        promiseList.push(this.authStore.getUserEmail(userId));
        promiseList.push(licService.myds.getLicenseMapByInstructors([userId]));
        when.all(promiseList)
            .then(function(results){
                courses = results[0];
                userEmail = results[1];
                var licenseMap = null;
                if(results[2]){
                    licenseMap = results[2][0];
                }
                if(licenseMap){
                    var licenseId = licenseMap.license_id;
                    return licService.myds.getLicenseById(licenseId);
                }
            })
            .then(function(results){
                _(courses).forEach(function(course){
                    // unenroll all students
                    var promiseList = [];
                    promiseList.push(lmsService.getStudentsOfCourse(course.id));
                    when.all(promiseList)
                        .then(function(results) {
                              var students = results[0];
                              var promiseList = [];
                              _(students).forEach(function(student) {
                                  promiseList.push(lmsService.myds.removeUserFromCourse(student.id, course.id));
                              });
                              return when.all(promiseList);
                        });
                });
                return results; // pass along previous results
            })
            .then(function(results){
                if(results){
                    license = results[0] || null;
                    // an account can only be deleted after a license is cancelled. run cancel license api first
                } else{
                    license = null;
                }
                var courseController = require("../../lms/controller/course.js");
                // non api form of the updateCourseInfo api method
                // need to mimic the fields required by the api
                var updateCourseInfo = courseController._updateCourseInfo.bind(lmsService);
                var promiseList = [];
                // archive and disable courses before teacher is removed
                _(courses).forEach(function(course){
                    var courseData = _.cloneDeep(course);
                    // needed to archive course if not archived
                    courseData.archived = true;
                    // needed to disable course if not disabled
                    courseData.premiumGamesAssigned = false;
                    var userData = {};
                    userData.id = userId;
                    if(course.premiumGamesAssigned){
                        userData.licenseId = license.id;
                    }
                    userData.role = "instructor";
                    promiseList.push(updateCourseInfo(courseData, course, userData));
                });
                return when.all(promiseList);
            })
            .then(function(){
                return _hashEmail.call(this, userEmail);
            }.bind(this))
            .then(function(hashedEmail){
                var userData = _deleteUserTableInfo(userId, hashedEmail);
                return this.authStore.updateUserDBData(userData);
            }.bind(this))
            .then(function(status){
                if(license && license.active === 1){
                    var licenseId = license.id;
                    var promiseList = [];
                    // finds all licenses an instructor was an owner of in the past, and removes the subscription id
                    promiseList.push(licService.myds.removeSubscriptionIdsByUserId(userId));
                    if(license.user_id !== userId){
                        var updateFields = [];
                        var status = "status = NULL";
                        updateFields.push(status);
                        promiseList.push(licService.myds.updateLicenseMapByLicenseInstructor(licenseId, [userId], updateFields));
                    }
                    return when.all(promiseList);
                }
            })
            .then(function(status){
                if(typeof status === "string"){
                    resolve(status);
                }

                if(license && license.active === 1 && license.user_id == userId){
                    var body = { };
                    body.userId = userId;
                    body.licenseId = license.id;
                    body.userEmail = userEmail;
                    body.userDelete = true;
                    req.body = body;
                  
                    var mockRes = {
                        writeHead: function(code, data) { },
                        end: function(json) { }
                    };
                  
                    this.serviceManager.internalRoute('/api/v2/license/end/internal', 'post', [req, mockRes]);
                    resolve('license owner');
                    return;
                }
                resolve();
            }.bind(this))
            .then(null, function(err){
                console.error("Delete Instructor Account Error -",err);
                reject(err);
            });
    }.bind(this));
}

function _deleteUserTableInfo(userId, hashedEmail){
    // if we want to save a hased email pass it in.
    // for students though, no email information is present
    var userData = {};
    userData.username = "";
    userData.firstName = "";
    userData.lastName = "";
    userData.email = hashedEmail || "";
    userData.ssoUserName = "";
    userData.ssoData = "";
    if(!hashedEmail){
        userData.password = "";
    }
    userData.enabled = 0;
    userData.resetCode = "NULL";
    userData.resetCodeExpiration = "NULL";
    userData.resetCodeStatus = "NULL";
    userData.verifyCode = "NULL";
    userData.verifyCodeExpiration = "NULL";
    userData.verifyCodeStatus = "NULL";
    userData.customerId = "NULL";
    userData.id = userId;
    return userData;
}

function _hashEmail(email){
    // hashing email so we could potentially reopen an account if a user came back
    return when.promise(function(resolve, reject){
        this.glassLabStrategy.encryptPassword(email)
            .then(function(hashedEmail){
                resolve(hashedEmail);
            })
            .then(null, function(err){
                console.error("Hash Email Error -",err);
                reject(err);
            });
    }.bind(this));
};
