
var _      = require('lodash');
var when   = require('when');
var lConst = require('../lms.const.js');

module.exports = {
    getEnrolledCourses: getEnrolledCourses,
    enrollInCourse:     enrollInCourse,
    unenrollFromCourse: unenrollFromCourse
};

var exampleOut = {};

exampleOut.getCourses =
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
                                    this.requestUtil.errorResponse(res, "already enrolled");
                                }
                            }.bind(this))
                    } else {
                        this.requestUtil.errorResponse(res, "invalid courseCode");
                    }
                }.bind(this));
        } else {
            this.requestUtil.errorResponse(res, "missing courseId");
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


exampleOut.getCourses =
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


exampleOut.getCoursesWithMembers =[
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