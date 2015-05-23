var _      = require('lodash');
var when   = require('when');
var Util   = require('../../core/util.js');
var lConst = require('../lms.const.js');

module.exports = {
    getEnrolledCourses:     getEnrolledCourses,
    enrollInCourse:         enrollInCourse,
    //unenrollFromCourse:     unenrollFromCourse,
    unenrollUserFromCourse: unenrollUserFromCourse,
    createCourse:           createCourse,
    getCourse:              getCourse,
    updateCourseInfo:       updateCourseInfo,
    updateGamesInCourse:    updateGamesInCourse,
    blockPremiumGamesBasicCourses: blockPremiumGamesBasicCourses,
    verifyCode:             verifyCode,
    verifyGameInCourse:     verifyGameInCourse,
    verifyAccessToGameInCourse: verifyAccessToGameInCourse,
    _updateCourseInfo:      _updateCourseInfo,
    getGamesCourseMap:      getGamesCourseMap
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
                    if(status === "lms.course.not.premium"){
                        this.requestUtil.errorResponse(res, { key: "lms.course.not.premium"});
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
                            .then(function(status) {
                                if(status === "lms.course.not.premium"){
                                    this.requestUtil.errorResponse(res, { key: "lms.course.not.premium"});
                                    return;
                                }
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
                "username": "test2_s1"
            },
            {
                "id": 176,
                "lastName": "test2_s2",
                "firstName": "test2_s2",
                "username": "test2_s2"
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
        var userId = req.user.id;
        _checkForGameAccess.call(this, licenseId, games, [])
            .then(function(results){
                var abort = results[0];
                if(abort){
                    return "invalid game access";
                }
                var licService = this.serviceManager.get("lic").service;
                req.body.premiumGamesAssigned = results[1];
                if(req.body.premiumGamesAssigned){
                    return licService.myds.multiGetLicenseMap(licenseId, [userId]);
                }
            }.bind(this))
            .then(function(results){
                if(results === "invalid game access"){
                    return results;
                }
                if(req.body.premiumGamesAssigned){
                    var licenseMap = results[0];
                    if(licenseMap.status === null){
                        return "not in license";
                    }
                }
                return this.createCourse(userData, req.body);
            }.bind(this))
            .then(function(courseData){
                if(courseData === "invalid game access"){
                    // change to something better
                    this.requestUtil.errorResponse(res, { key: "lms.game.invalid"});
                    return;
                }
                if(courseData === "not in license"){
                    this.requestUtil.errorResponse(res, { key: "lic.access.removed"});
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

function _checkForGameAccess(licenseId, games, newGameIds){
    return when.promise(function(resolve, reject) {
        var promiseList = [{}];
        var lic = this.serviceManager.get("lic");
        var licService = lic.service;
        var dashService = this.serviceManager.get("dash").service;
        if (licenseId) {
            promiseList[0] = licService.myds.getLicenseById(licenseId);
        }
        games.forEach(function (game){
            if(game.assigned === undefined){
                newGameIds.push(game.id);
                game.assigned = true;
            }
            if(game.assigned){
                promiseList.push(dashService.getGameBasicInfo(game.id));
            }
        });
        when.all(promiseList)
            .then(function (results) {
                var availableGames = {};
                var abort = false;
                var premiumGamesAssigned = false;
                var gamesInfo = results.slice(1);
                // check if part of active license
                if(licenseId && results[0][0].active > 0){
                    var license = results[0][0] || {};
                    if(license.id){
                        var lConst = lic["lib"]["Const"];
                        var browserGames;
                        var iPadGames;
                        var downloadableGames;
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
                }
                var isAvailable;
                _(gamesInfo).some(function (game) {
                    if (game.price === "Premium" || game.price === "Coming Soon") {
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

        // check if enrolled
        this.myds.isEnrolledInCourse(userData.id, courseId)
            .then(function(isEnrolled){
                if(isEnrolled) {
                    return this.myds.getCourseInfoFromKey('id', courseId);
                } else{
                    return "course.general";
                }
            }.bind(this))
            .then(function(oldCourseData){
                if(typeof oldCourseData === "string"){
                    return oldCourseData;
                }
                var licenseId = req.user.licenseId;
                var userId = req.user.id;
                //return _updateCourseInfo.call(this, courseData, oldCourseData, userId, licenseId);
                // delete between comments if above commented out helper method works well
                var licService = this.serviceManager.get("lic").service;
                if(courseData.premiumGamesAssigned && !oldCourseData.premiumGamesAssigned){
                    if(licenseId){
                        return licService.myds.multiGetLicenseMap(licenseId, [userId])
                            .then(function(results){
                                var licenseMap = results[0];
                                if(licenseMap.status === null){
                                    return "not in license";
                                }
                                return _canClassEnable.call(this, licenseId, courseData.games);
                            }.bind(this))
                            .then(function(state){
                                if(state === "not in license"){
                                    return "not in license";
                                }
                                if(state){
                                    return licService.assignPremiumCourse(courseId, licenseId);
                                }
                                return "no game to enable";
                            })
                            .then(null, function(err){
                                return when.reject(err);
                            });
                    } else{
                        return "not in license";
                    }
                }
                if(!courseData.premiumGamesAssigned && oldCourseData.premiumGamesAssigned) {
                    return licService.unassignPremiumCourses(courseId, licenseId);
                }
            }.bind(this))
            .then(function(status){
                if(typeof status === "string"){
                    return status;
                }
                return this.updateCourse(userData, courseData);
            }.bind(this))
            // delete above these comments if helper method works well
            .then(function(status){
                if(status === "course.general"){
                    this.requestUtil.errorResponse(res, { key: "course.general"});
                    return;
                }
                if(status === "not enough seats"){
                    this.requestUtil.errorResponse(res, { key: "lic.students.full.enable.premium"});
                    return;
                }
                if(status === "no game to enable"){
                    this.requestUtil.errorResponse(res, { key: "course.cannot.enable"});
                    return;
                }
                if(status === "not in license"){
                    this.requestUtil.errorResponse(res, { key: "lic.access.removed"});
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

// not tested yet. needed tool for deleting instructor accounts (plan to archive deleted instructor classes)
function _updateCourseInfo(courseData, oldCourseData, userData){
    return when.promise(function(resolve, reject){
        var promise;
        var userId = userData.id;
        var licenseId = userData.licenseId;
        var courseId = oldCourseData.id;
        var licService = this.serviceManager.get("lic").service;
        if(courseData.premiumGamesAssigned && !oldCourseData.premiumGamesAssigned){
            if(licenseId){
                promise = licService.myds.multiGetLicenseMap(licenseId, [userId])
                    .then(function(results){
                        var licenseMap = results[0];
                        if(licenseMap.status === null){
                            return "not in license";
                        }
                        return _canClassEnable.call(this, licenseId, courseData.games);
                    }.bind(this))
                    .then(function(state){
                        if(state === "not in license"){
                            return "not in license";
                        }
                        if(state){
                            return licService.assignPremiumCourse(courseId, licenseId);
                        }
                        return "no game to enable";
                    })
                    .then(null, function(err){
                        console.error("Enable Course Error -",err);
                        return reject(err);
                    });
            } else{
                resolve("not in license");
                return;
            }
        }
        if(!courseData.premiumGamesAssigned && oldCourseData.premiumGamesAssigned) {
            promise = licService.unassignPremiumCourses(courseId, licenseId);
        } else{
            promise = Util.PromiseContinue();
        }
        promise
            .then(function(status){
                if(typeof status === "string"){
                    return status;
                }
                return this.updateCourse(userData, courseData);
            }.bind(this))
            .then(function(status){
                if(typeof status === "string"){
                    resolve(status);
                    return;
                }
                resolve();
            })
            .then(null, function(err){
                console.error("Update Course Info Error -",err);
                reject(err);
            });
    }.bind(this));
}

function _canClassEnable(licenseId, games){
    return when.promise(function(resolve, reject){
        var licService = this.serviceManager.get('lic').service;
        var dashService = this.serviceManager.get('dash').service;
        var promiseList = [];
        promiseList.push(licService.myds.getLicenseById(licenseId));
        promiseList.push(dashService.getListOfAllFreeGameIds());
        when.all(promiseList)
            .then(function(results){
                var license = results[0][0];
                var freeGameIds = results[1];
                var plan = license["package_type"];
                var lConst = require("../../lic/lic.const.js");
                var availablePremiumGames = {};
                lConst.plan[plan].browserGames.forEach(function(game){
                    availablePremiumGames[game] = true;
                });
                lConst.plan[plan].iPadGames.forEach(function(game){
                    availablePremiumGames[game] = true;
                });
                lConst.plan[plan].downloadableGames.forEach(function(game){
                    availablePremiumGames[game] = true;
                });
                freeGameIds.forEach(function(game){
                    availablePremiumGames[game] = false;
                });

                var canEnable = false;
                games.some(function(game){
                    if(availablePremiumGames[game.id]){
                        canEnable = true;
                        return true;
                    }
                });
                resolve(canEnable);
            }.bind(this))
            .then(null, function(err){
                console.error("Check If Calss Can Enable Error -",err);
                reject(err);
            });
    }.bind(this));
}

/*
 POST http://localhost:8001/api/v2/lms/course/107/games
 */
exampleIn.updateGamesInCourse = [
    { "id": "SC", "assigned": true, "settings": {"missionProgressLock": true } },
    { "id": "AA-1", "assigned": true, "settings": {} },
    { "id": "PRIMA", "assigned": false, "settings": {} }
];
function updateGamesInCourse(req, res, next, serviceManager){
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
        var userId = req.user.id;

        _changePremiumGamesAssignedStatus.call(this, courseData.id, games, licenseId, userId)
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
                if(status === "not in license"){
                    this.requestUtil.errorResponse(res, { key: "lic.access.removed"});
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

function _changePremiumGamesAssignedStatus(courseId, games, licenseId, userId){
    return when.promise(function(resolve, reject){
        var promiseList = [];
        promiseList.push(this.myds.getCourse(courseId));
        var newGameIds = [];
        var licService = this.serviceManager.get("lic").service;
        if(licenseId){
            promiseList.push(_checkForGameAccess.call(this, licenseId, games, newGameIds));
            promiseList.push(licService.myds.multiGetLicenseMap(licenseId, [userId]));
        } else{
            // basic user does not have license, so check games against free game list
            var dashService = this.serviceManager.get("dash").service;
            promiseList.push(dashService.getListOfAllFreeGameIds());
        }
        var course;
        var isPremium;
        when.all(promiseList)
            .then(function(results){
                course = results[0];

                // for basic user
                if(!licenseId){
                    var freeGames = results[1];
                    var freeGamesObj = {};
                    freeGames.forEach(function(gameId){
                        freeGamesObj[gameId] = true;
                    });
                    games.forEach(function(game){
                        if(freeGamesObj[game.id]){
                            game.assigned = true;
                        }
                    });

                    return;
                }

                var abort = results[1][0];
                if(abort){
                    return "invalid game access";
                }
                isPremium = results[1][1];
                if(course.premiumGamesAssigned && !isPremium){
                    // if database says premium course, but no premium games, unassign course
                    return licService.unassignPremiumCourses(courseId, licenseId);
                } else if(!course.premiumGamesAssigned && isPremium){
                    var licenseMap = results[2][0];
                    // if database says not premium course, but there are premium games, assign course
                    if(licenseMap.status === null){
                        return "not in license";
                    }
                    return licService.assignPremiumCourse(courseId, licenseId);
                }
            }.bind(this))
            .then(function(status){
                if(status === "not in license"){
                    resolve(status);
                    return;
                }
                if(status === "not enough seats"){
                    var index = 0;
                    newGameIds.forEach(function(gameId){
                        while(index < games.length){
                            if(gameId === games[index].id){
                                games[index].assigned = false;
                                index++;
                                return;
                            }
                            index++;
                        }
                    });
                }
                resolve();
            })
            .then(null, function(err){
                console.error("Change Course Assignment Status Error -", err);
                reject(err);
            });
    }.bind(this));
}

// blocks all premium games in all basic courses
function blockPremiumGamesBasicCourses(req, res){
    if(req.params.code !== lConst.accessCode.block){
        this.requestUtil.errorResponse(res, { key: "lms.access.invalid"});
        return;
    }
    var dashService = this.serviceManager.get("dash").service;
    var freeGameIds = {};
    dashService.getListOfAllFreeGameIds()
        .then(function(freeGamesList){
            freeGamesList.forEach(function(gameId){
                freeGameIds[gameId] = true;
            });
            return this.telmStore.getAllCourseGameProfiles()
        }.bind(this))
        .then(function(courses){
            var updatedCourses = {};
            var basicCourses = {};
            var basic;
            _(courses).forEach(function(course, key){
                basic = true;
                _(course).some(function(game, gameId){
                    if(!freeGameIds[gameId] && game.assigned === true){
                        basic = false;
                        return true;
                    }
                });
                if(basic){
                    basicCourses[key] = course;
                }
            });
            _(basicCourses).forEach(function(course, key){
                _(course).forEach(function(game, gameId){
                    game.id = gameId;
                    if(game.assigned === undefined){
                        if(freeGameIds[gameId]){
                            game.assigned = true;
                        } else{
                            game.assigned = false;
                        }
                    }
                });
                updatedCourses[key] = { value: course };
            });
            return this.telmStore.multiSetCourseGameProfiles(updatedCourses);
        }.bind(this))
        .then(function(){
            this.requestUtil.jsonResponse(res, { status: "ok"});
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
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
    var licService;
    var license;
    this.myds.getCourseInfoFromCourseCode(code)
        .then(function(info) {
            courseInfo = info;
            if (courseInfo) {
                var isPremium = courseInfo.premiumGamesAssigned;
                if (isPremium) {
                    licService = this.serviceManager.get("lic").service;
                    return licService.myds.getLicenseFromPremiumCourse(courseInfo.id);
                }
                return "not premium";
            } else {
                return "no course found";
            }
        }.bind(this))
        .then(function(results){
            if(typeof results === "string"){
                return results;
            }
            if(!results){
                return "lms.course.not.premium";
            }
            license = results;
            var licenseId = license.id;
            return licService.cbds.getStudentsByLicense(licenseId);
        }.bind(this))
        .then(function(studentMap){
            if(typeof studentMap === "string") {
                return studentMap;
            }
            var studentSeatsRemaining = license["student_seats_remaining"];
            if(studentSeatsRemaining < 1){
                if(!(req.user && req.user.id && studentMap[req.user.id])){
                    return "denied";
                }
            }
        }.bind(this))
        .then(function(status){
            if(status === "denied") {
                this.requestUtil.errorResponse(res, {key:"lic.students.full"});
                return;
            }
            if (status === "no course found") {
                this.requestUtil.errorResponse(res, {key: "user.enroll.code.invalid", statusCode: 404});
                return;
            }
            if(status === "lms.course.not.premium"){
                this.requestUtil.errorResponse(res, { key: "lms.course.not.premium"});
                return;
            }
            if( courseInfo &&
                courseInfo.locked) {
                this.requestUtil.errorResponse(res, {key:"course.locked", statusCode:400});
                return;
            }
            else if(courseInfo) {
                courseInfo = _.merge(
                    {status: "code valid", key:"code.valid"}, courseInfo
                );
                this.requestUtil.jsonResponse(res, courseInfo);
            }
        }.bind(this));
}

// check course
// premium
// check students remaining
// check course locked

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

function verifyAccessToGameInCourse(req, res, next) {

    if (req.user && req.user.role !== "student"){
        this.requestUtil.jsonResponse(res, { status: "ok"});
        return;
    }
    if (!req.params || !req.params.hasOwnProperty("courseId")) {
        this.requestUtil.errorResponse(res, {key: "user.enroll.sdk.course.missing"});
        return;
    }
    if (!req.params || !req.params.hasOwnProperty("gameId")) {
        this.requestUtil.errorResponse(res, {key: "user.enroll.sdk.game.missing"});
        return;
    }
    var userId = req.user.id;
    var courseId = req.params.courseId;
    var gameId = req.params.gameId;
    this.myds.isUserInCourse(userId, courseId)
        .then(function(state){
            if(!state){
                return "not in class";
            }
            return this.telmStore.getGamesForCourse(req.params.courseId);
        }.bind(this))
        .then(function(games) {
            if(games === "not in class"){
                this.requestUtil.errorResponse(res, { key: "lms.access.invalid"});
                return;
            }
            var gameInCourse = games[gameId];
            // if game is in the course and game is assigned, things are good.
            if(gameInCourse && gameInCourse.assigned){
                this.requestUtil.jsonResponse(res, { status: "ok"});
                return;
            }
            this.requestUtil.errorResponse(res, { key: "lms.access.invalid"});
        }.bind(this))
        .then(null, function(err){
            console.error("Verify Access to Game In Course Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"});
        }.bind(this));
}

function getGamesCourseMap(req, res){
    if(!(req.user && req.user.role === "admin" && req.body && req.body.gameIds)){
        this.requestUtil.errorResponse(res, { key: "lms.access.invalid"});
        return;
    }
    var gameIds = req.body.gameIds;

    this.telmStore.getGamesCourseMap(gameIds)
        .then(function(gameCourseMap){
            this.requestUtil.jsonResponse(res, { status: "ok", data: gameCourseMap});
        }.bind(this))
        .then(null, function(err){
            console.error("Get Game Course Map Error", err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}
