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
var Util, aConst, lConst;

module.exports = AuthService;

function AuthService(options, serviceManager){
    try {
        var Auth, Accounts, WebStore, LMSStore, AuthStore, Errors;
        this.options = _.merge(
            {
                auth: { port: 8082 }
            },
            options
        );

        // Glasslab libs
        Util          = require('../core/util.js');
        Auth          = require('./auth.js');
        Errors        = require('../errors.js');
        aConst        = Auth.Const;
        Accounts      = Auth.Accounts;
        AuthStore     = Auth.Datastore.MySQL;

        this.stats            = new Util.Stats(this.options, "Auth");
        this.requestUtil      = new Util.Request(this.options, Errors);
        this.authStore        = new AuthStore(this.options.auth.datastore.mysql);
        this.accountsManager  = new Accounts.Manager(this.options, this);
        this.glassLabStrategy = this.accountsManager.get("Glasslab");
        this.serviceManager   = serviceManager;

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

    this.accountsManager.setupRoutes(app, this.passport);
};


AuthService.prototype.start = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // connect to auth store
    this.authStore.connect()
        .then(function(){
            console.log("AuthService: MySQL Auth DS Connected");
            this.stats.increment("info", "MySQL.Connect");

            return this.authStore.updateUserTable();
        }.bind(this),
            function(err){
                console.trace("AuthService: MySQL Auth Error -", err);
                this.stats.increment("error", "MySQL.Connect");
            }.bind(this))

        // connect to webstore
        .then(function(updated){
            if(updated) {
                console.log("AuthService: MySQL User Auth Table Updated!");
            }

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


AuthService.prototype.registerUser = function(userData){
    return this.glassLabStrategy.registerUser(userData);
};

AuthService.prototype.getAuthStore = function() {
    return this.authStore;
};

AuthService.prototype.getLMSStore = function() {
    return this.lmsStore;
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

AuthService.prototype.addOrUpdate_SSO_UserData = function(userData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    // no Error on found
    this.authStore.checkUserNameUnique(userData.username, true)
        // add user
        .then(function(userId) {
            if(userId) {
                userData.id = userId;
                return this.authStore.updateUserDBData(userData);
            } else {
                userData.newUser = true;
                return this.authStore.addUser(userData);
            }
        }.bind(this))

        // all done
        .then(function(userId){
            // update id, if set
            if(userId) {
                userData.id = userId;
            }

            if(userData.hasOwnProperty('courses')) {
                var courses = userData.courses;
                // 1a) create list all users, add them
                var users = _.flatten(_.pluck(courses, 'users'));

                // 1b) create promise list of adding all users
                var addUserPromiseList = [];
                for(var i = 0; i < users.length; i++) {
                    addUserPromiseList.push( this.addOrUpdate_SSO_UserData(users[i]) );
                }

                var addUserPromise = when.reduce(addUserPromiseList, function (allUsers, user) {
                    allUsers[user.id] = user;
                    return allUsers;
                }, {});

                // will need to use reduce here
                addUserPromise
                    // 2) create promise list of adding/updating all courses
                    .then(function(allUsers){
                        var addCoursePromiseList = [];

                        _.forEach(courses, function(course, c){
                            // updates users in courses
                            for(var i = 0; i < courses[c].users.length; i++) {
                                if( allUsers.hasOwnProperty( courses[c].users[i].id) ){
                                    courses[c].users[i] = allUsers[courses[c].users[i].id];
                                }
                            }

                            var p = this.addOrUpdate_SSO_Course(userData, courses[c])
                                .then(function(updatedCourseData){
                                    // update course info
                                    userData.courses[c] = updatedCourseData;
                                }.bind(this));

                            addCoursePromiseList.push( p );
                        }.bind(this))

                        if(addCoursePromiseList.length) {
                            return when.all(addCoursePromiseList);
                        } else {
                            return;
                        }
                    }.bind(this))
                    // 3) create promise list of adding all users to courses if they already are not in courses
                    .then(function(){

                        // every course
                        var addUserToCoursePromiseList = [];
                        for(var c in courses) {
                            //console.log("addUserToCoursePromiseList courses:", courses[c]);
                            addUserToCoursePromiseList.push( this.addOrUpdate_SSO_EnrollInCourse(courses[c]) );
                        }

                        if(addUserToCoursePromiseList.length) {
                            //console.log("addUserToCoursePromiseList.length:", addUserToCoursePromiseList.length);
                            return when.all(addUserToCoursePromiseList);
                        } else {
                            return;
                        }
                    }.bind(this))
                    .then(function(){
                        resolve(userData);
                    }.bind(this))

                    // catch all
                    .then(null, function(err){
                        reject(err);
                    }.bind(this))
            } else {
                resolve(userData);
            }
        }.bind(this))

        // catch all errors
        .then(null, function(err, code){
            console.error("AuthAccount: AddOrFindUser Error -", err);
            return reject(err, code);
        }.bind(this));
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

AuthService.prototype.addOrUpdate_SSO_Course = function(userData, courseData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var lmsService = this.serviceManager.get("lms").service;

    // check if can create course
    lmsService.createCourse(userData, courseData)
        .then(function(updatedCourseData){
            // created
            resolve(updatedCourseData);
            return null;
        }.bind(this),
        function(err){
            if(err.key === "course.notUnique.name"){
                return this.lmsStore.getCourseInfoFromKey('lmsId', courseData.lmsId);
            } else {
                console.error("addOrUpdate_SSO_Course Error:", err);
                reject(err);
            }
        }.bind(this))

        // results from getting course id
        .then(function(courseDBInfo){
            if(!courseDBInfo) return;

            // update courseData, by merging in courseInfo from DB
            courseData = _.merge(courseDBInfo, courseData);
            // course not unique for this user so need up update
            return lmsService.updateCourse(userData, courseData);
        }.bind(this))

        // results from updated course data
        .then(function(updatedCourseData){
            if(!updatedCourseData) return;

            // updated
            resolve(courseData);
        }.bind(this))

        // catch all errors
        .then(null, function(err){
            reject(err);
        }.bind(this));
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


AuthService.prototype.addOrUpdate_SSO_EnrollInCourse = function(courseData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var lmsService = this.serviceManager.get("lms").service;

    var promiseList = [];
    // all users in course
    for(var i = 0; i < courseData.users.length; i++) {
        promiseList.push( lmsService.enrollInCourse(courseData.users[i], courseData.code) );
    }

    if(promiseList.length) {
        when.all(promiseList)
            .then(resolve)
            .then(null, function(err){
                if( (err.key === "user.enroll.code.used") ||
                    (err.key === "course.locked") ) {
                    // this is ok
                    resolve();
                } else {
                    reject(err);
                }
            }.bind(this));
    } else {
        resolve();
    }

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

// TODO make single request instead of X
AuthService.prototype.getUsersData = function(studentIds){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    if(studentIds.length) {
        this.authStore.findUser('id', studentIds)
            .then(resolve, reject);
    } else {
        resolve([]);
    }

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};