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
    updateCourseInfo:       updateCourseInfo,
    updateGamesInCourse:    updateGamesInCourse,
    verifyCode:             verifyCode,
    verifyGameInCourse:     verifyGameInCourse
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

            // preset role to be student
            userData.role = lConst.role.student;
            this.enrollInCourse(userData, courseCode)
                .then(function(status){
                    if(status === "user.enroll.code.invalid"){
                        this.requestUtil.errorResponse(res, { key:"user.enroll.code.invalid"});
                        return;
                    }
                    if(status === "course.locked"){
                        this.requestUtil.errorResponse(res, { key: "course.locked"});
                        return;
                    }
                    if(status === "user.enroll.code.used"){
                        this.requestUtil.errorResponse(res, { key: "user.enroll.code.used"});
                        return;
                    }
                    if(status === "lic.students.full"){
                        this.requestUtil.errorResponse(res, { key: "lic.students.full"});
                        return;
                    }
                    this.requestUtil.jsonResponse(res, {});
                }.bind(this),
                function(err){
                    console.error("Enroll in Course Error -",err);
                    this.requestUtil.errorResponse(res, err);
                }.bind(this))
        } else {
            this.requestUtil.errorResponse(res, {key:"user.enroll.code.missing"}, 404);
        }
    } else {
        //this.requestUtil.errorResponse(res, "not logged in");
        this.requestUtil.errorResponse(res, {key:"user.enroll.general"});
    }
}

exampleOut.unenrollFromCourse =
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
                        //this.requestUtil.errorResponse(res, "not enrolled in course");
                        this.requestUtil.errorResponse(res, {key:"user.unenroll.notEnrolled"});
                    }
                }.bind(this));
        } else {
            //this.requestUtil.errorResponse(res, "missing courseId");
            this.requestUtil.errorResponse(res, {key:"user.unenroll.general"});
        }
    } else {
        //this.requestUtil.errorResponse(res, "not logged in");
        this.requestUtil.errorResponse(res, {key:"user.unenroll.general"});
    }
}


exampleOut.unenrollUserFromCourse =
{
    course: 8,
    showMembers: true,
    user: 176
};
function unenrollUserFromCourse(req, res, next, serviceManager) {
    if( req.session &&
        req.session.passport) {

        if( req.body) {
            if(!req.body.course){
                //this.requestUtil.errorResponse(res, "missing course id");
                this.requestUtil.errorResponse(res, {key:"user.unenroll.general"});
                return;
            }
            if(!req.body.user){
                //this.requestUtil.errorResponse(res, "missing user id");
                this.requestUtil.errorResponse(res, {key:"user.unenroll.general"});
                return;
            }
            var userId   = req.body.user;
            var courseId = req.body.course;

            this.myds.isUserInCourse(userId, courseId)
                .then(function(inCourse) {

                    // only if they are in the class
                    if(inCourse) {
                        this.myds.removeUserFromCourse(userId, courseId)
                            .then(function(){
                                return this.myds.isCoursePremium(courseId);
                            }.bind(this))
                            .then(function(state){
                                if(!state){
                                    return;
                                }
                                var licService = this.serviceManager.get("lic").service;
                                return licService.removeStudentFromPremiumCourse(userId, courseId);
                            }.bind(this))
                            .then(function() {
                                req.query.showMembers = req.body.showMembers;
                                req.params.courseId = courseId;
                                // get and respond with course
                                serviceManager.internalRoute('/api/v2/lms/course/:courseId/info', 'get', [req, res, next]);
                            }.bind(this))
                            .then(null, function(err){
                                console.error("Unenroll User From Course Error -",err);
                                this.requestUtil.errorResponse(res, err);
                            }.bind(this));
                    } else {
                        //this.requestUtil.errorResponse(res, "not enrolled in course");
                        this.requestUtil.errorResponse(res, {key:"user.unenroll.notEnrolled"});
                    }
                }.bind(this));
        } else {
            //this.requestUtil.errorResponse(res, "missing arguments");
            this.requestUtil.errorResponse(res, {key:"user.unenroll.general"});
        }
    } else {
        //this.requestUtil.errorResponse(res, "not logged in");
        this.requestUtil.errorResponse(res, {key:"user.unenroll.general"});
    }
}

/*
 /api/v2/lms/courses
 */
exampleOut.getEnrolledCourses =
    [
        {
            "id": 27,
            "dateCreated": 123456789,
            "title": "Test",
            "grade": "7,8",
            "archived": false,
            "archivedDate": null,
            "institution": 18,
            "code": "18ZBD",
            "studentCount": 1,
            "gameIds": [ "AA-1", "AW-1", "SC" ],
            "lockedRegistration": false
        }
    ];

/*
 GET
 http://localhost:8001/api/v2/lms/courses?showMembers=1
 */
exampleOut.getEnrolledCourses_WithMembers =[
    {
        "id": 8,
        "dateCreated": 123456789,
        "title": "test2",
        "grade": "9,10",
        "lockedRegistration": false,
        "archived": false,
        "archivedDate": null,
        "institution": 10,
        "code": "YD8WV",
        "games": [
            { "id": "SC",   "settings": {"missionProgressLock": true } },
            { "id": "AA-1", "settings": {} }
        ],
        "studentCount": 2,
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
    }
];

/*
 GET
 http://localhost:8001/api/v2/lms/courses?showMembers=1&game=WWF
 */
exampleOut.getEnrolledCourses_WithMembers_ForGame =[
    {
        "id": 8,
        "dateCreated": 123456789,
        "title": "test2",
        "grade": "9,10",
        "lockedRegistration": false,
        "archived": false,
        "archivedDate": null,
        "institution": 10,
        "code": "YD8WV",
        "games": [
            { "id": "SC",   "settings": {"missionProgressLock": true } },
            { "id": "WWF", "settings": {} }
        ],
        "studentCount": 2,
        "users": [
            {
                "id": 175,
                "lastName": "test2_s1",
                "firstName": "test2_s1",
                "username": "test2_s1",
            },
            {
                "id": 176,
                "lastName": "test2_s2",
                "firstName": "test2_s2",
                "username": "test2_s2",
            }
        ]
    }
];
function getEnrolledCourses(req, res, next) {

    if( req.session &&
        req.session.passport) {
        var userData = req.session.passport.user;

        this.myds.getEnrolledCourses(userData.id)
            .then(function(courses){
                var showMembers = false;
                var gameFilter;

                if( req.query.hasOwnProperty("showMembers") ) {
                    showMembers = parseInt(req.query.showMembers);
                    // in case showMembers is a string "true"
                    if(_.isNaN(showMembers)) {
                        showMembers = (req.query.showMembers === "true") ? true : false;
                    }
                }
                if( req.query.hasOwnProperty("game") ) {
                    gameFilter = req.query.game;
                }

                this.getCoursesDetails(courses, userData.role, showMembers, gameFilter)
                    .then(function(courses){
                            this.requestUtil.jsonResponse(res, courses);
                        }.bind(this),
                        function(err){
                            console.error("LMS Service: getCoursesDetails Error -", err);
                            this.requestUtil.errorResponse(res, {key:"course.general"});
                        }.bind(this)
                    );

            }.bind(this))
            .then(null, function(err){
                console.error("LMS Service: getEnrolledCourses Error -", err);
                this.requestUtil.errorResponse(res, {key:"course.general"});
            }.bind(this))
    } else {
        this.requestUtil.errorResponse(res, "not logged in");
    }
}

/*
 http://localhost:8001/api/v2/lms/course/create

 title   - required
 grade   - required
 gameIds - required
 institution - optional
 */
exampleIn.createCourse = {
    "title": "test17",
    "grade": "7",
    "games": [
        { "id": "SC", "assigned": true, "settings": { "missionProgressLock": false } },
        { "id": "AA-1", "assigned": true, "settings": {} }
    ]
};

exampleOut.createCourse = {
    "id": 16,
    "title": "test17",
    "grade": "7, 8, 9",
    "locked": false,
    "archived": false,
    "archivedDate": null,
    "institution": 10,
    "code": "VMZ2P",
    "studentCount": 0,
    "games": [
        { "id": "SC", assigned: true, "settings": { "missionProgressLock": true } },
        { "id": "AA-1", assigned: true, "settings": {} }
    ],
    premiumGamesAssigned: true
};
function createCourse(req, res, next, serviceManager)
{
    if( req.body &&
        req.body.title &&
        req.body.grade ) {
        var userData = req.session.passport.user;

        if(!req.body.games ||
           !_.isArray(req.body.games) ) {
            this.requestUtil.errorResponse(res, {error: "games missing or not array", key:"course.create.missing.gameids"}, 404);
            return;
        }
        var games = req.body.games;
        var licenseId = req.user.licenseId;

        _checkForGameAccess.call(this, licenseId, games)
            .then(function(results){
                var abort = results[0];
                if(abort){
                    return "invalid game access";
                }
                req.body.premiumGamesAssigned = results[1];
                return this.createCourse(userData, req.body);
            }.bind(this))
            .then(function(courseData){
                if(courseData === "invalid game access"){
                    // change to something better
                    this.requestUtil.errorResponse(res, { key: "lms.game.invalid"});
                    return;
                }
                this.requestUtil.jsonResponse(res, courseData);
            }.bind(this))

            // catch all errors
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this));
    } else {
        this.requestUtil.errorResponse(res, {key:"course.general"});
    }
}

function _checkForGameAccess(licenseId, games){
    return when.promise(function(resolve, reject) {

        var promiseList = [{}];
        var lic = this.serviceManager.get("lic");
        var licService = lic.service;
        if (licenseId) {
            promiseList[0] = licService.myds.getLicenseById(licenseId);
        }
        var dashService = this.serviceManager.get("dash").service;
        games.forEach(function (game){
            if(game.assigned === undefined){
                game.assigned = true;
            }
            if(game.assigned){
                promiseList.push(dashService.getGameBasicInfo(game.id));
            }
        });
        when.all(promiseList)
            .then(function (results) {
                var license = results[0][0];
                var gamesInfo = results.slice(1);
                var availableGames = {};
                var abort = false;
                var premiumGamesAssigned = false;
                var lConst = lic["lib"]["Const"];
                var browserGames;
                var iPadGames;
                var downloadableGames;
                if (license.id) {
                    var plan = license["package_type"];
                    browserGames = lConst.plan[plan].browserGames;
                    browserGames.forEach(function (gameId) {
                        availableGames[gameId] = true;
                    });
                    iPadGames = lConst.plan[plan].iPadGames;
                    iPadGames.forEach(function (gameId) {
                        availableGames[gameId] = true;
                    });
                    downloadableGames = lConst.plan[plan].downloadableGames;
                    downloadableGames.forEach(function (gameId) {
                        availableGames[gameId] = true;
                    });
                }
                var isAvailable;
                _(gamesInfo).some(function (game) {
                    if (game.price === "Premium" || game.price === "TBD" || game.price === "Coming Soon") {
                        premiumGamesAssigned = true;
                        // if user on a license, but the game is not in the user's plan
                        // or if the user is not on a license, throw an error
                        isAvailable = availableGames[game.gameId];
                        if (licenseId && !isAvailable || !licenseId) {
                            abort = true;
                            return true;
                        }
                    }
                }.bind(this));
                resolve([abort, premiumGamesAssigned]);
            }.bind(this))
            .then(null, function(err){
                console.error("Check For Game Access Error -",err);
                reject(err);
            })
    }.bind(this));
}

/*
 GET
 http://localhost:8001/api/v2/lms/course/107/info?showMembers=1
*/
exampleOut.getCourse = {
    "id": 16,
    "title": "test1",
    "grade": "7, 8, 9",
    "locked": false,
    "archived": false,
    "archivedDate": null,
    "institution": 10,
    "code": "VMZ2P",
    "studentCount": 0,
    "games": [
        { "id": "SC",   "settings": {"missionProgressLock": true } },
        { "id": "AA-1", "settings": {} }
    ]
};
function getCourse(req, res, next) {

    if( req.session &&
        req.session.passport) {
        var userData = req.session.passport.user;

        if( req.params &&
            req.params.hasOwnProperty("courseId") ) {
            var courseId = parseInt(req.params.courseId);

            // check if enrolled in course
            var showMembers = false;
            var gameFilter;

            if( req.query.hasOwnProperty("showMembers") ) {
                showMembers = parseInt(req.query.showMembers);
                // in case showMembers is a string "true"
                if(_.isNaN(showMembers)) {
                    showMembers = (req.query.showMembers === "true") ? true : false;
                }
            }

            if( req.query.hasOwnProperty("game") ) {
                gameFilter = req.query.game;
            }

            // check if enrolled
            this.myds.isEnrolledInCourse(userData.id, courseId)
                .then(function(isEnrolled){
                    if(isEnrolled) {
                        return this.myds.getCourse(courseId);
                    } else {
                        return when.reject({key:"course.general"});
                    }
                }.bind(this))
                .then(function(course){

                    if( !course ){
                        //this.requestUtil.errorResponse(res, "invalid course id");
                        this.requestUtil.errorResponse(res, {key:"course.general"});
                        return;
                    }

                    var courses    = [];
                    courses.push(course); // add course

                    this.getCoursesDetails(courses, userData.role, showMembers, gameFilter)
                        .then(function(courses){
                            if( courses &&
                                courses.length > 0) {
                                this.requestUtil.jsonResponse(res, courses[0]);
                            } else {
                                //this.requestUtil.errorResponse(res, "missing course");
                                this.requestUtil.errorResponse(res, {key:"course.general"});
                            }
                        }.bind(this),
                        function(err){
                            this.requestUtil.errorResponse(res, err);
                        }.bind(this)
                    );

                }.bind(this))
                .then(null, function(err){
                    this.requestUtil.errorResponse(res, err);
                }.bind(this))
        } else {
            //this.requestUtil.errorResponse(res, "missing course id");
            this.requestUtil.errorResponse(res, {key:"course.general"});
        }
    } else {
        //this.requestUtil.errorResponse(res, "not logged in");
        this.requestUtil.errorResponse(res, {key:"course.general"});
    }
}


/*
 POST http://localhost:8001/api/v2/lms/course/107/info

 title - required
 grade - required
 institutionId - optional
 archived - optional
 */
exampleIn.updateCourse = {
    "title": "test61",
    "grade": "7"
};
function updateCourseInfo(req, res, next, serviceManager)
{
    if( req.body &&
        req.body.title &&
        req.body.grade ) {
        var userData = req.session.passport.user;

        if( !req.params ||
            !req.params.hasOwnProperty("courseId") ) {
            //this.requestUtil.errorResponse(res, "missing course id");
            this.requestUtil.errorResponse(res, {key:"course.general"});
            return;
        }
        var courseData = req.body;
        var courseId = courseData.id = req.params.courseId;
        var premiumGamesAssignedChanged = courseData.premiumGamesAssigned !== undefined;

        // check if enrolled
        this.myds.isEnrolledInCourse(userData.id, courseId)
            .then(function(isEnrolled){
                if(isEnrolled && premiumGamesAssignedChanged) {
                    //add class type method here
                    var licService = this.serviceManager.get("lic").service;
                    var licenseId = req.user.licenseId;
                    if(courseData.premiumGamesAssigned){
                        return licService.assignPremiumCourse(courseId, licenseId);
                    } else {
                        return licService.unassignPremiumCourses(courseId, licenseId);
                    }
                } else if(isEnrolled){
                    return;
                } else{
                    return when.reject({key:"course.general"});
                }
            }.bind(this))
            .then(function(status){
                if(status === "not enough seats"){
                    return status;
                }
                return this.updateCourse(userData, courseData);
            }.bind(this))
            .then(function(status){
                if(status === "not enough seats"){
                    this.requestUtil.errorResponse(res, { key: "lic.students.full"});
                    return;
                }
                serviceManager.internalRoute('/api/v2/lms/course/:courseId/info', 'get', [req, res, next, serviceManager]);
            }.bind(this))

            // catch all errors
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this));
    } else {
        //this.requestUtil.errorResponse(res, "missing arguments or invalid");
        this.requestUtil.errorResponse(res, {key:"course.general"});
    }
}

/*
 POST http://localhost:8001/api/v2/lms/course/107/games
 */
exampleIn.updateGamesInCourse = [
    { "id": "SC", "assigned": true, "settings": {"missionProgressLock": true } },
    { "id": "AA-1", "assigned": true, "settings": {} },
    { "id": "PRIMA", "assigned": false, "settings": {} }
];
function updateGamesInCourse(req, res, next, serviceManager)
{
    if( req.body &&
        _.isArray(req.body) ) {
        var userData = req.session.passport.user;
        var courseData = {};

        if( !req.params ||
            !req.params.hasOwnProperty("courseId") ) {
            //this.requestUtil.errorResponse(res, "missing course id");
            this.requestUtil.errorResponse(res, {key:"course.general"});
            return;
        }
        courseData.id = req.params.courseId;
        var games = courseData.games = req.body;
        var licenseId = req.user.licenseId;

        _changePremiumGamesAssignedStatus.call(this, courseData.id, games, licenseId)
            .then(function(status){
                if(typeof status === "string"){
                    return status;
                }
                // check if enrolled
                return this.myds.isEnrolledInCourse(userData.id, courseData.id);
            }.bind(this))
            .then(function(isEnrolled){
                if(typeof isEnrolled === "string"){
                    return isEnrolled;
                }
                else if (isEnrolled){
                    return this.updateGamesInCourse(userData, courseData);
                } else {
                    return when.reject({key:"course.general"});
                }
            }.bind(this))
            .then(function(status){
                if(status === "invalid game access"){
                    this.requestUtil.errorResponse(res, { key: "lms.game.invalid"});
                    return;
                }
                if(status === "not enough seats"){
                    this.requestUtil.errorResponse(res, { key: "lic.students.full"});
                    return;
                }
                serviceManager.internalRoute('/api/v2/lms/course/:courseId/info', 'get', [req, res, next, serviceManager]);
            }.bind(this))

            // catch all errors
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this));
    } else {
        //this.requestUtil.errorResponse(res, "missing arguments or invalid");
        this.requestUtil.errorResponse(res, {key:"course.general"});
    }
}

function _changePremiumGamesAssignedStatus(courseId, games, licenseId){
    return when.promise(function(resolve, reject){
        if(!licenseId){
            resolve();
            return;
        }
        var promiseList = [];
        promiseList.push(this.myds.getCourse(courseId));
        promiseList.push(_checkForGameAccess.call(this, licenseId, games));
        when.all(promiseList)
            .then(function(results){
                var licService = this.serviceManager.get("lic").service;
                var course = results[0];
                var abort = results[1][0];
                if(abort){
                    return "invalid game access";
                }
                var isPremium = results[1][1];
                if(course.premiumGamesAssigned && !isPremium){
                    // if database says premium course, but no premium games, unassign course
                    return licService.unassignPremiumCourses(courseId, licenseId);
                } else if(!course.premiumGamesAssigned && isPremium){
                    // if database says not premium course, but there are premium games, assign course
                    return licService.assignPremiumCourse(courseId, licenseId);
                }
            }.bind(this))
            .then(function(status){
                if(typeof status === "string"){
                    resolve(status);
                    return;
                }
                resolve();
            })
            .then(null, function(err){
                console.error("Change Course Assignment Status Error -", err);
                reject(err);
            });
    }.bind(this));
}

/*
 GET http://localhost:8001/api/v2/lms/course/code/ZDYJU/verify
 */
exampleIn.verifyCode = {
    codeId: "ZDYJU"
};
exampleOut.verifyCode = {
    status: "code valid",
    key: "code.valid",
    title: "test7",
    grade: "7",
    locked: false,
    archived: false,
    archivedDate: null,
    institution: 1
};
function verifyCode(req, res, next) {

    if (!req.params ||
        !req.params.hasOwnProperty("code")) {
        //this.requestUtil.errorResponse(res, "missing code");
        this.requestUtil.errorResponse(res, {key:"course.general"});
        return;
    }
    var code = req.params.code;
    var courseInfo;

    this.myds.getCourseInfoFromCourseCode(code)
        .then(function(info) {
            courseInfo = info;
            var isPremium = courseInfo.premiumGamesAssigned;
            if(isPremium){
                var licService = this.serviceManager.get("lic").service;
                return licService.myds.getLicenseFromPremiumCourse(courseInfo.id);
            }
            return "not premium";
        }.bind(this))
        .then(function(license){
            if(typeof license === "string") {
                return license;
            }
            var studentSeatsRemaining = license["student_seats_remaining"];
            if(studentSeatsRemaining < 1){
                return "denied";
            }
        }.bind(this))
        .then(function(status){
            if(status === "denied"){
                this.requestUtil.errorResponse(res, {key:"lic.students.full"});
            }
            if( courseInfo &&
                courseInfo.locked) {
                this.requestUtil.errorResponse(res, {key:"course.locked", statusCode:400});
            }
            else if(courseInfo) {
                courseInfo = _.merge(
                    {status: "code valid", key:"code.valid"},
                    courseInfo
                );
                this.requestUtil.jsonResponse(res, courseInfo);
            }
            else {
                this.requestUtil.errorResponse(res, {key:"user.enroll.code.invalid", statusCode:404});
            }
        }.bind(this))
}

function verifyGameInCourse(req, res, next) {

    if (!req.params || !req.params.hasOwnProperty("courseId")) {
        this.requestUtil.errorResponse(res, {key: "user.enroll.sdk.course.missing"});
        return;
    }
    if (!req.params || !req.params.hasOwnProperty("gameId")) {
        this.requestUtil.errorResponse(res, {key: "user.enroll.sdk.game.missing"});
        return;
    }

    this.telmStore.getGamesForCourse(req.params.courseId)
        .then(function(games) {
            var hasGameInCourse = false;
            var gameList = Object.keys(games);
            for (var i = 0; i < gameList.length; i++) {
                if (gameList[i] === req.params.gameId) {
                    hasGameInCourse = true;
                    break;
                }
            }
            if (hasGameInCourse) {
                var courseInfo = {status: "game found in course", games: gameList};
                this.requestUtil.jsonResponse(res, courseInfo);
            } else {
                this.requestUtil.errorResponse(res, {key: "user.enroll.sdk.course.invalid", statusCode:404});
            }
        }.bind(this));
}