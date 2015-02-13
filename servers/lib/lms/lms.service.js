/**
 * LMS Service Module
 *
 */

var http       = require('http');
// Third-party libs
var _          = require('lodash');
var when       = require('when');
// load at runtime
var Util, lConst, exampleOut;
exampleOut = {};

module.exports = LMSService;

function LMSService(options, serviceManager){
    try{
        var TelmStore, WebStore, LMSStore, Errors;

        this.options = _.merge(
            {
            },
            options
        );

        // Glasslab libs
        LMSStore   = require('./lms.js').Datastore.MySQL;
        WebStore   = require('../dash/dash.js').Datastore.MySQL;
        TelmStore  = require('../data/data.js').Datastore.Couchbase;
        Util       = require('../core/util.js');
        lConst     = require('./lms.js').Const;
        Errors     = require('../errors.js');

        this.requestUtil = new Util.Request(this.options, Errors);
        this.telmStore   = new TelmStore(this.options.telemetry.datastore.couchbase);
        this.webstore    = new WebStore(this.options.webapp.datastore.mysql);
        this.myds        = new LMSStore(this.options.lms.datastore.mysql);
        this.stats       = new Util.Stats(this.options, "LMS");
        this.serviceManager = serviceManager;

    } catch(err){
        console.trace("LMSService: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

LMSService.prototype.start = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // test connection to LMS MySQL
    this.myds.connect(this.serviceManager)
        .then(function(){
                console.log("LMSService: MySQL DS Connected");
                this.stats.increment("info", "MySQL.Connect");
            }.bind(this),
            function(err){
                console.trace("LMSService: MySQL Error -", err);
                this.stats.increment("error", "MySQL.Connect");
            }.bind(this))

        // test connection to WebApp MySQL
        .then(function(){
            return this.webstore.connect();
        }.bind(this))
        .then(function(){
            console.log("WebApp: MySQL DS Connected");
            this.stats.increment("info", "MySQL.Connect");
        }.bind(this),
            function(err){
                console.trace("WebApp: MySQL Error -", err);
                this.stats.increment("error", "MySQL.Connect");
            }.bind(this))

        // test connection to TelmStore Couchbase
        .then(function(){
            return this.telmStore.connect();
        }.bind(this))
        .then(function(){
            console.log("TelmStore: Couchbase DS Connected");
            this.stats.increment("info", "Couchbase.Connect");
        }.bind(this),
        function(err){
            console.trace("TelmStore: Couchbase Error -", err);
            this.stats.increment("error", "Couchbase.Connect");
        }.bind(this))

        .then(resolve, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


LMSService.prototype._generateCode = function() {

    var code = "";
    for( var i = 0; i < lConst.code.length; i++) {
        code += lConst.code.charSet.charAt(Math.floor(Math.random() * lConst.code.charSet.length));
    }

    return code;
};


exampleOut.getCoursesDetails = {
    "id": 9,
    "dateCreated": 123456789,
    "title": "test3",
    "grade": "7",
    "lockedRegistration": false,
    "archived": false,
    "archivedDate": null,
    "institution": 10,
    "games": [
        { "id": "SC",   "settings": {"missionProgressLock": true } },
        { "id": "AA-1", "settings": {} }
    ],
    "code": "SK1FC",
    "studentCount": 0,
    "users": []
};
LMSService.prototype.getCoursesDetails = function(courses, requestingRole, showMembers, gameFilter){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    if( courses &&
        courses.length) {

        when.reduce(courses, function(data, course, i){
            if(course.id) {
                //console.log("id:", course.id);

                // convert showMembers to int and then check it's value
                var p;
                if( requestingRole == lConst.role.student ) {
                    if( showMembers ) {
                        // init user
                        course.users = [];

                        p = this.getStudentsOfCourse(course.id)
                            .then(function(studentList){
                                course.users = _.clone(studentList);
                                course.users = _.map(course.users, function(user) {
                                    return _.pick(user, 'id', 'username', 'firstName', 'lastName');
                                });
                                return this.myds.getTeacherOfCourse(course.id);
                            }.bind(this))
                            .then(function(teacherInfo) {
                                course.teacher = _.clone(teacherInfo);
                                return this.telmStore.getGamesForCourse(course.id);
                            }.bind(this));
                    }
                    else {
                        p = this.myds.getTeacherOfCourse(course.id)
                            .then(function(teacherInfo) {
                                course.teacher = _.clone(teacherInfo);
                                return this.telmStore.getGamesForCourse(course.id);
                            }.bind(this));
                    }
                }
                else {
                    if( showMembers ) {
                        // init user
                        course.users = [];

                        p = this.getStudentsOfCourse(course.id)
                            .then(function(studentList){
                                course.users = _.clone(studentList);

                                return this.telmStore.getGamesForCourse(course.id);
                            }.bind(this))
                    }
                    else {
                        p = this.telmStore.getGamesForCourse(course.id);
                    }
                }

                p.then(function(games) {
                    // If we are filtering for games, filter this course out at the end
                    if( gameFilter ) {
                        course.filterOut = true;
                    }

                    // create games object if one does not exist
                    if(!_.isArray(course.games)) {
                        course.games = [];
                    }

                    // fill in settings
                    for(var g in games) {
                        // if not settings default to empty object
                        course.games.push( {
                            id:       g,
                            settings: games[g].settings || {}
                        } );

                        // Don't filter this game if it matches the filter
                        if( g == gameFilter ) {
                            course.filterOut = false;
                        }
                    }

                    // need to return something for reduce to continue
                    return 1;
                }.bind(this));

                return p;
            }
        }.bind(this), {})
            .then(null, function(err){
                reject(err);
            }.bind(this))

            .done(function(){
                //console.log("done");
                // Filter out courses for certain games
                if( gameFilter ) {
                    courses = _.filter(courses, function(course) {
                        if( !course.filterOut ) {
                            return course;
                        }
                    });
                }

                resolve(courses);
            }.bind(this))
    } else {
        resolve(courses);
    }
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


LMSService.prototype.createCourse = function(userData, _courseData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // check if instructor, manager or admin
    if( userData.role == lConst.role.instructor ||
        userData.role == lConst.role.manager ||
        userData.role == lConst.role.admin ) {

        var courseData = {
            title:         _courseData.title,
            grade:         _courseData.grade,
            institutionId: _courseData.institution || _courseData.institutionId,
            games:         _courseData.games,
            id:            0,
            code:          "",
            studentCount:  0,
            freePlay:      false,
            locked:        false,
            archived:      _courseData.archived || false,
            archivedDate:  null,
            lmsType:       _courseData.lmsType || 'glasslab',
            lmsId:         _courseData.lmsId,
            labels:        _courseData.labels || "",
            meta:          _courseData.meta || ""
        };

        // validate gameId's
        // TODO: replace using internal route, but needs callback when route is done
        var dash = this.serviceManager.get("dash").service;
        var gameIds = _.pluck(courseData.games, "id");

        dash.isValidGameId(gameIds)
            .then(function(state){
                if(!state){
                    return reject({error: "Some game id is not valid", key:"course.create.invalid.gameid", statusCode:404});
                }

                if(courseData.archived) {
                    courseData.archivedDate = Util.GetTimeStamp();
                }

                this.myds.createCourse(userData.id, courseData)
                    .then(function(courseId){
                        courseData.id = courseId;

                        if( userData.role == lConst.role.instructor ||
                            userData.role == lConst.role.manager) {
                            // create games map
                            var games = {};
                            for(var i = 0; i < courseData.games.length; i++) {
                                games[ courseData.games[i].id ] = courseData.games[i].settings || {};
                            }

                            return this.telmStore.updateGamesForCourse(courseId, games)
                                .then(function() {
                                    return this.myds.addUserToCourse(userData.id, courseId, lConst.role.instructor);
                                }.bind(this));
                        }
                    }.bind(this) )

                    .then(function(){
                        courseData.code = this._generateCode();
                        return this.myds.addCode(courseData.code, courseData.id, lConst.code.type.course)
                            .then(function(){
                                resolve(courseData);
                            }.bind(this));
                    }.bind(this) )

                    // error catchall
                    .then(null, function(err){
                        reject(err);
                    }.bind(this) );
            }.bind(this) );

    } else {
        //reject(res, "user does not have permission");
        reject({key:"course.general"});
    }

// ------------------------------------------------
}.bind(this) );
// end promise wrapper
};


LMSService.prototype.updateCourse = function(userData, _courseData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    // check if instructor, manager or admin
    if( userData.role == lConst.role.instructor ||
        userData.role == lConst.role.manager ||
        userData.role == lConst.role.admin ) {

        var courseData = {
            id:            _courseData.id,
            title:         _courseData.title,
            grade:         _courseData.grade,
            institutionId: _courseData.institutionId || _courseData.institution,
            archived:      _courseData.archived,
            locked:        _courseData.lockedRegistration || _courseData.locked,
            games:         _courseData.games,
            lmsType:       _courseData.lmsType || 'glasslab',
            lmsId:         _courseData.lmsId,
            labels:        _courseData.labels || "",
            meta:          _courseData.meta || ""
        };

        if(courseData.archived) {
            courseData.archivedDate = Util.GetTimeStamp();
        }

        this.myds.updateCourseInfo(userData.id, courseData)
            .then(function() {
                if( _.isArray(courseData.games) &&
                    courseData.games.length) {
                    return this.updateGamesInCourse(userData, courseData).then(resolve, reject);
                } else {
                    resolve(courseData);
                    return null;
                }
            }.bind(this))

            .then(function(data) {
                if(data === null) return;

                resolve(courseData);
            }.bind(this))

            // error catchall
            .then(null, function(err) {
                reject(err);
            }.bind(this));
    } else {
        //reject("user does not have permission");
        reject({key:"course.general"});
    }
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

LMSService.prototype.updateGamesInCourse = function(userData, courseData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // check if instructor, manager or admin
    if( userData.role == lConst.role.instructor ||
        userData.role == lConst.role.manager ||
        userData.role == lConst.role.admin ) {

        // validate gameId's
        // TODO: replace using internal route, but needs callback when route is done
        var dash = this.serviceManager.get("dash").service;

        // TODO: replace this with DB lookup, return promise
        var gameIds = _.pluck(courseData.games, "id");
        dash.isValidGameId(gameIds)
            .then(function(state){
                if(!state){
                    return reject({error: "Some game id is not valid", key:"course.create.invalid.gameid", statusCode:404});
                }

                return this.telmStore.getGamesForCourse(courseData.id);
            }.bind(this) )
            .then(function (currentGames) {

                // find if game removed
                var updateGames = {};
                var gameId;
                for (var i = 0; i < courseData.games.length; i++) {
                    gameId = courseData.games[i].id;
                    updateGames[ gameId ] = _.merge(courseData.games[i], currentGames[gameId]) || {};
                }

                return this.telmStore.updateGamesForCourse(courseData.id, updateGames);
            }.bind(this) )

            .then(function () {
                resolve(courseData);
            }.bind(this) )

            // error catchall
            .then(null, function (err) {
                reject(err);
            }.bind(this) );
    }

// ------------------------------------------------
}.bind(this) );
// end promise wrapper
};


LMSService.prototype.enrollInCourse = function(userData, courseCode){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var courseInfo = {};
    this.myds.getCourseInfoFromCourseCode(courseCode)
    //
    .then(function(_courseInfo) {
        if(!_courseInfo) {
            reject({key:"user.enroll.code.invalid", statusCode:404});
            return null;
        }

        courseInfo = _courseInfo;
        if(!courseInfo.locked) {
            return this.myds.isUserInCourse(userData.id, courseInfo.id);
        } else {
            reject({key:"course.locked", statusCode:400});
            return null;
        }
    }.bind(this))
    //
    .then(function(inCourse) {
        // skip if no inCourse
        if(inCourse === null) return;

        // only if they are NOT in the class
        if(inCourse === false) {
            this.myds.addUserToCourse(userData.id, courseInfo.id, userData.role)
                .then(resolve, reject);
        } else {
            reject({key:"user.enroll.code.used", statusCode:400});
        }
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

LMSService.prototype.getStudentsOfCourse = function(courseId) {
    return this.myds.getStudentIdsForCourse(courseId)
        .then(function(studentIds) {
            studentIds = _.pluck(studentIds, 'id');
            var authService = this.serviceManager.get("auth").service;
            return authService.getUsersData(studentIds);
        }.bind(this));
};