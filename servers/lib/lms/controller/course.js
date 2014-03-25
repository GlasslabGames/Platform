
var _      = require('lodash');
var when   = require('when');

module.exports = {
    enrolledCourses: enrolledCourses
};

var exampleOut = {};
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

function enrolledCourses(req, res, next){

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