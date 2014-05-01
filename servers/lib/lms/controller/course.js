
var _      = require('lodash');
var when   = require('when');
var Util   = require('../../core/util.js');
var lConst = require('../lms.const.js');

module.exports = {
    getEnrolledCourses:     getEnrolledCourses,
    enrollInCourse:         enrollInCourse,
    unenrollFromCourse:     unenrollFromCourse,
    unenrollUserFromCourse: unenrollUserFromCourse,
    createCourse:           createCourse,
    getCourse:              getCourse,
    updateCourse:           updateCourse
};

var exampleOut = {}, exampleIn = {};

exampleOut.enrollInCourse =
{
    courseCode: "COU34"
};
function enrollInCourse(req, res, next) {

    if( req.session &&
        req.session.passport) {

        if( req.body &&
            req.body.courseCode) {
            var userData = req.session.passport.user;
            var courseCode = req.body.courseCode;

            this.myds.getCourseIdFromCourseCode(courseCode)

                .then(function(courseId) {
                    if(courseId) {
                        return this.myds.isUserInCourse(userData.id, courseId)
                            .then(function(inCourse) {
                                // only if they are NOT in the class
                                if(!inCourse) {
                                    this.myds.addUserToCourse(userData.id, courseId, lConst.role.student)
                                        .then(function() {
                                            this.requestUtil.jsonResponse(res, {});
                                        }.bind(this))
                                } else {
                                    this.requestUtil.errorResponse(res, {error:"already enrolled", key:"already.enrolled"}, 400);
                                }
                            }.bind(this))
                    } else {
                        this.requestUtil.errorResponse(res, {error:"invalid courseCode", key:"code.invalid"}, 400);
                    }
                }.bind(this));
        } else {
            this.requestUtil.errorResponse(res, {error:"missing courseCode", key:"code.missing"}, 401);
        }
    } else {
        this.requestUtil.errorResponse(res, "not logged in");
    }
}

exampleOut.getCourses =
{
    courseId: 123
};
function unenrollFromCourse(req, res, next) {
    if( req.session &&
        req.session.passport) {

        if( req.body &&
            req.body.courseId) {
            var userData = req.session.passport.user;
            var courseId = req.body.courseId;

            this.myds.isUserInCourse(userData.id, courseId)
                .then(function(inCourse) {

                    // only if they are in the class
                    if(inCourse) {
                        this.myds.removeUserFromCourse(userData.id, courseId)
                            .then(function() {
                                this.requestUtil.jsonResponse(res, {});
                            }.bind(this))
                    } else {
                        this.requestUtil.errorResponse(res, "not enrolled in course");
                    }
                }.bind(this));
        } else {
            this.requestUtil.errorResponse(res, "missing courseId");
        }
    } else {
        this.requestUtil.errorResponse(res, "not logged in");
    }
}


exampleOut.unenrollUserFromCourse =
{
    course: 8,
    showMembers: 1,
    user: 176
};
function unenrollUserFromCourse(req, res, next, serviceManager) {
    if( req.session &&
        req.session.passport) {

        if( req.body) {
            if(!req.body.course){
                this.requestUtil.errorResponse(res, "missing course id");
                return;
            }
            if(!req.body.user){
                this.requestUtil.errorResponse(res, "missing user id");
                return;
            }
            var userId   = req.body.user;
            var courseId = req.body.course;

            this.myds.isUserInCourse(userId, courseId)
                .then(function(inCourse) {

                    // only if they are in the class
                    if(inCourse) {
                        this.myds.removeUserFromCourse(userId, courseId)
                            .then(function() {

                                req.query.showMembers = req.body.showMembers;
                                req.params.id = courseId;
                                // get and respond with course
                                serviceManager.internalRoute('/api/course/:id', [req, res, next]);

                            }.bind(this))
                    } else {
                        this.requestUtil.errorResponse(res, "not enrolled in course");
                    }
                }.bind(this));
        } else {
            this.requestUtil.errorResponse(res, "missing arguments");
        }
    } else {
        this.requestUtil.errorResponse(res, "not logged in");
    }
}


exampleOut.getEnrolledCourses =
    [
        {
            "id": 27,
            "title": "Test",
            "grade": "7",
            "locked": false,
            "archived": false,
            "archivedDate": null,
            "institution": 18,
            "code": "18ZBD",
            "studentCount": 1,
            "freePlay": false
        }
    ];


exampleOut.getEnrolledCourses_WithMembers =[
    {
        "id": 8,
        "title": "test2",
        "grade": "7",
        "locked": false,
        "archived": false,
        "archivedDate": null,
        "institution": 10,
        "code": "YD8WV",
        "studentCount": 2,
        "freePlay": false,
        "users":
            [
                {
                    "id": 175,
                    "lastName": "test2_s1",
                    "firstName": "test2_s1",
                    "username": "test2_s1",
                    "email": "",
                    "role": "student"
                },
                {
                    "id": 176,
                    "lastName": "test2_s2",
                    "firstName": "test2_s2",
                    "username": "test2_s2",
                    "email": "",
                    "role": "student"
                }
            ]
    },
    {
        "id": 9,
        "title": "test3",
        "grade": "7",
        "locked": false,
        "archived": false,
        "archivedDate": null,
        "institution": 10,
        "code": "SK1FC",
        "studentCount": 0,
        "freePlay": false,
        "users":
            [
            ]
    }
];
function getEnrolledCourses(req, res, next) {

    if( req.session &&
        req.session.passport) {
        var userData = req.session.passport.user;

        this.myds.getEnrolledCourses(userData.id)
            .then(function(courses){

                // cousers is not empty
                // showMembers is in query
                // convert showMembers to int and then check it's value
                if( courses &&
                    courses.length &&
                    req.query.hasOwnProperty("showMembers") &&
                    parseInt(req.query.showMembers) ) {

                    // added empty object for reduce to work
                    courses.unshift({});

                    when.reduce(courses, function(data, course, i){
                                if(course.id) {
                                    //console.log("id:", course.id);
                                    // init user
                                    course.users = [];
                                    return this.myds.getStudentsOfCourse(course.id)
                                        .then(function(studentList){
                                            course.users = _.clone(studentList);
                                            // need to return something for reduce to continue
                                            return 1;
                                        }.bind(this));
                                }
                            }.bind(this))
                        .then(null, function(err){
                            this.requestUtil.errorResponse(res, err);
                        }.bind(this))
                        .done(function(){
                            //console.log("done");
                            // added empty object for reduce to work
                            courses.shift();
                            this.requestUtil.jsonResponse(res, courses);
                        }.bind(this))

                } else {
                    this.requestUtil.jsonResponse(res, courses);
                }

            }.bind(this))
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this))
    } else {
        this.requestUtil.errorResponse(res, "not logged in");
    }
}

exampleIn.createCourse = {
    "title": "test",
    "grade": "7",
    "institution": 10
};

exampleOut.createCourse = {
    "id": 16,
    "title": "test1",
    "grade": "7, 8, 9",
    "locked": false,
    "archived": false,
    "archivedDate": null,
    "institution": 10,
    "code": "VMZ2P",
    "studentCount": 0,
    "freePlay": false
};
function createCourse(req, res, next)
{
    if( req.body &&
        req.body.title &&
        req.body.grade ) {
        var userData = req.session.passport.user;

        // check if instructor, manager or admin
        if( userData.systemRole == lConst.role.instructor ||
            userData.systemRole == lConst.role.manager ||
            userData.systemRole == lConst.role.admin ) {

            var courseData = {
                title:       req.body.title,
                grade:       req.body.grade,
                institution: req.body.institution,
                id:    0,
                code: "",
                studentCount: 0,
                freePlay: false,
                locked:   false,
                archived: false,
                archivedDate: null

            };

            this.myds.createCourse(userData.id, courseData.title, courseData.grade, courseData.institution)

                .then(function(courseId){
                    if( userData.systemRole == lConst.role.instructor ||
                        userData.systemRole == lConst.role.manager) {
                        return this.myds.addUserToCourse(userData.id, courseId, lConst.role.instructor)
                            .then(function() {
                                return courseId;
                            }.bind(this))
                    } else {
                        return courseId;
                    }
                }.bind(this))

                .then(function(courseId){
                    courseData.id   = courseId;
                    courseData.code = this._generateCode();
                    return this.myds.addCode(courseData.code, courseId, lConst.code.type.course)
                        .then(function(){
                            this.requestUtil.jsonResponse(res, courseData);
                        }.bind(this));
                }.bind(this))

                // error catchall
                .then(null, function(err){
                    this.requestUtil.errorResponse(res, err, 400);
                }.bind(this));
        } else {
            this.requestUtil.errorResponse(res, "user does not have permission");
        }
    } else {
        this.requestUtil.errorResponse(res, "missing arguments");
    }
}

/*
     "/api/course/37?showMembers=1"
*/
function getCourse(req, res, next) {

    if( req.session &&
        req.session.passport) {
        var userData = req.session.passport.user;

        if( req.params &&
            req.params.hasOwnProperty("id") ) {
            var courseId = req.params.id;

            // check if enrolled in course
            var promise;
            if( userData.systemRole == lConst.role.instructor ||
                userData.systemRole == lConst.role.manager ||
                userData.systemRole == lConst.role.admin ) {
                // do nothing promise
                promise = when.promise(function(resolve){resolve(1)}.bind(this));
            } else {
                // check if enrolled
                promise = this.myds.isEnrolledInCourse(userData.id, courseId);
            }

            promise
                .then(function(){
                    return this.myds.getCourse(courseId);
                }.bind(this))
                .then(function(course){

                    if( !course ){
                        this.requestUtil.errorResponse(res, "invalid course id");
                        return;
                    }

                    // cousers is not empty
                    // showMembers is in query
                    // convert showMembers to int and then check it's value
                    if( req.query.hasOwnProperty("showMembers") &&
                        parseInt(req.query.showMembers) ) {

                        if(course.id) {
                            //console.log("id:", course.id);
                            // init user
                            course.users = [];

                            // only get students if instructor, manager or admin
                            if( userData.systemRole == lConst.role.instructor ||
                                userData.systemRole == lConst.role.manager ||
                                userData.systemRole == lConst.role.admin ) {
                                this.myds.getStudentsOfCourse(course.id)
                                    .then(function(studentList){
                                        course.users = _.clone(studentList);
                                        // need to return something for reduce to continue
                                        this.requestUtil.jsonResponse(res, course);
                                    }.bind(this))

                                    .then(null, function(err){
                                        this.requestUtil.errorResponse(res, err);
                                    }.bind(this))
                            } else {
                                this.requestUtil.jsonResponse(res, course);
                            }

                        } else {
                            this.requestUtil.errorResponse(res, "invalid course id");
                        }
                    } else {
                        this.requestUtil.jsonResponse(res, course);
                    }

                }.bind(this))
                .then(null, function(err){
                    this.requestUtil.errorResponse(res, err);
                }.bind(this))
        } else {
            this.requestUtil.errorResponse(res, "missing course id");
        }
    } else {
        this.requestUtil.errorResponse(res, "not logged in");
    }
}


exampleIn.updateCourse = {
    "id": 8,
    "title": "test61",
    "grade": "7",
    "locked": false,
    "archived": false,
    "freePlay": false,
    "code": "YD8WV",
    "studentCount": 2,
    "archivedDate": null,
    "institution": 10,
    "users": [
        {"id": 175, "firstName": "test2_s0", "lastName": "test2_s1", "username": "test2_s1", "email": "test2_s1@test.com", "systemRole": "student"},
        {"id": 176, "firstName": "test2_s2", "lastName": "test2_s2", "username": "test2_s2", "email": "", "systemRole": "student"}
    ],
    "showMembers": 1,
    "cb": 1395992841665
};
function updateCourse(req, res, next)
{
    if( req.body &&
        req.body.title &&
        req.body.grade &&
        req.body.id &&
        _.isNumber(req.body.id)) {
        var userData = req.session.passport.user;

        // check if instructor, manager or admin
        if( userData.systemRole == lConst.role.instructor ||
            userData.systemRole == lConst.role.manager ||
            userData.systemRole == lConst.role.admin ) {

            var courseData = {
                id:            req.body.id,
                title:         req.body.title,
                grade:         req.body.grade,
                institutionId: req.body.institution,
                archived:      req.body.archived
            };

            if(courseData.archived) {
                courseData.archivedDate = Util.GetTimeStamp();
            }

            this.myds.updateCourse(courseData)

                .then(function() {
                    // respond with all data passed in plus an changes (example archived date)
                    this.requestUtil.jsonResponse(res, _.merge(req.body, courseData));
                }.bind(this))

                // error catchall
                .then(null, function(err) {
                    this.requestUtil.errorResponse(res, err, 400);
                }.bind(this));
        } else {
            this.requestUtil.errorResponse(res, "user does not have permission");
        }
    } else {
        this.requestUtil.errorResponse(res, "missing arguments or invalid");
    }
}