/**
 * LMS Service Module
 *
 */

var http       = require('http');
// Third-party libs
var _          = require('lodash');
var when       = require('when');
// load at runtime
var Util, lConst;

module.exports = LicService;

function LicService(options, serviceManager) {
    try{
        var LicStore, Errors;

        this.options = _.merge(
            {
            },
            options
        );

        // Glasslab libs
        LicStore     = require('./lic.js').Datastore.MySQL;
        LicDataStore = require('./lic.js').Datastore.Couchbase;
        Util         = require('../core/util.js');
        lConst       = require('./lic.js').Const;
        Errors       = require('../errors.js');

        this.requestUtil = new Util.Request(this.options, Errors);
        this.myds        = new LicStore(this.options.lic.datastore.mysql);
        this.cbds        = new LicDataStore(this.options.lic.datastore.couchbase);
        this.stats       = new Util.Stats(this.options, "LMS");
        this.serviceManager = serviceManager;

    } catch(err){
        console.trace("LicService: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

LicService.prototype.start = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // test connection to LMS MySQL
    this.myds.connect()
        .then(function(){
                console.log("LicService: MySQL DS Connected");
                this.stats.increment("info", "MySQL.Connect");
            }.bind(this),
            function(err){
                console.trace("LicService: MySQL Error -", err);
                this.stats.increment("error", "MySQL.Connect");
            }.bind(this))
        .then(function(){
            return this.cbds.connect();
        }.bind(this))
            .then(function(){
                console.log("LicService: Couchbase DS Connected");
                this.stats.increment("info", "Couchbase.Connect");
            }.bind(this),
            function(err){
                console.trace("LicService: Couchbase Error -", err);
                this.stats.increment("error", "Couchbase.Connect");
            }.bind(this))
        .then(resolve, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

LicService.prototype.unassignPremiumCourses = function(courseIds, licenseId){
    return when.promise(function(resolve, reject){
        var studentSeats;
        var studentList;
        if(!Array.isArray(courseIds)){
            courseIds = [courseIds];
        }
        var promiseList = [];
        promiseList.push(this.myds.getLicenseById(licenseId));
        promiseList.push(this.cbds.getStudentsByLicense(licenseId));
        when.all(promiseList)
            .then(function(results){
                var courseObj = {};
                courseIds.forEach(function(id){
                    courseObj[id] = true;
                });
                var license = results[0][0];
                var packageSize = license["package_size_tier"];
                studentSeats = lConst.seats[packageSize].studentSeats;
                studentList = results[1];
                _(studentList).forEach(function(student){
                    _(student).forEach(function(premiumCourse, courseId, courseList){
                        if(premiumCourse && courseObj[courseId]){
                            courseList[courseId] = false;
                        }
                    });
                });

                return this.myds.unassignPremiumCourses(courseIds);
            }.bind(this))
            .then(function(){
                promiseList = [];
                courseIds.forEach(function(id){
                    promiseList.push(_unassignPremiumGames.call(this, id));
                }.bind(this));
                return when.all(promiseList);
            }.bind(this))
            .then(function(){
                var licenseStudentList = { students: studentList};
                return this.cbds.updateStudentsByLicense(licenseId, licenseStudentList);
            }.bind(this))
            .then(function(){
                return this.updateStudentSeatsRemaining(licenseId, studentSeats);
            }.bind(this))
            .then(function(){
                resolve();
            })
            .then(null, function(err){
                console.error("Unassign Instructor Premium Courses Error -",err);
                reject(err);
            })
    }.bind(this));
};

function _unassignPremiumGames(courseId){
    return when.promise(function(resolve, reject){
        var lmsService = this.serviceManager.get("lms").service;
        var games;
        lmsService.telmStore.getGamesForCourse(courseId)
            .then(function(output){
                games = output;
                var dashService = this.serviceManager.get("dash").service;
                var promiseList = [];
                _(games).forEach(function(game, gameId){
                    promiseList.push(dashService.getGameBasicInfo(gameId));
                });
                return when.all(promiseList);
            }.bind(this))
            .then(function(results){
                var infoObj = {};
                results.forEach(function(info){
                   infoObj[info.gameId] = info;
                });
                var basicInfo;
                var index = 0;
                _(games).forEach(function(game, key){
                    basicInfo = infoObj[key];
                    if(basicInfo.price === "Premium" || basicInfo.price === "TBD" || basicInfo.price === "Coming Soon"){
                        game.assigned = false;
                    }
                });
                return lmsService.telmStore.updateGamesForCourse(courseId, games);
            })
            .then(function(){
                resolve()
            })
            .then(null,function(err){
                console.error("Unassign Premium Games Error -",err);
                reject(err);
            });
    }.bind(this));
}

LicService.prototype.assignPremiumCourse = function(courseId, licenseId){
    return when.promise(function(resolve, reject){
        var license;
        var studentMap;
        var promiseList = [];
        var lmsService = this.serviceManager.get("lms").service;
        promiseList.push(lmsService.myds.getStudentIdsForCourse(courseId));
        promiseList.push(this.cbds.getStudentsByLicense(licenseId));
        promiseList.push(this.myds.getLicenseById(licenseId));
        when.all(promiseList)
            .then(function(results){
                // get an id list of all students in a course and all students in license
                var students = results[0];
                var studentIds = _.pluck(students, "id");
                studentMap = results[1];
                // from studentMap, determine which students would newly be added to the license, and count them
                var newPremiumStudents = [];
                studentIds.forEach(function(id){
                    var student = studentMap[id];
                    if(!student){
                        newPremiumStudents.push(id);
                        // add any students not already in the license to the activeStudentMap in couchbase
                        student = studentMap[id] = {};
                    } else{
                        var inLicense = false;
                        _(student).some(function(value){
                            // value is true if student is currently in a premium course
                            if(value){
                                inLicense = true;
                                return true;
                            }
                        });
                        if(!inLicense){
                            newPremiumStudents.push(id);
                        }
                    }
                    student[courseId] = true;
                });

                // check number of student seats remaining in license
                license = results[2][0];
                var studentSeatsRemaining = license["student_seats_remaining"];
                // if not enough seats
                // return proper error message, informing teacher that there are not enough license seats left
                if(newPremiumStudents.length > studentSeatsRemaining){
                    return "not enough seats";
                }
                // if math adds up correctly, then assign the students
                return this.myds.assignPremiumCourse(courseId, licenseId);
            }.bind(this))
            .then(function(status){
                if(typeof status === "string"){
                    return status;
                }
                var plan = license["package_type"];
                return _assignPremiumGames.call(this, courseId, plan);
            }.bind(this))
            .then(function(status){
                if(typeof status === "string"){
                    return status;
                }
                var licenseStudentList = { students: studentMap};
                return this.cbds.updateStudentsByLicense(licenseId, licenseStudentList);
            }.bind(this))
            .then(function(status){
                if(typeof status === "string"){
                    return status;
                }
                var size = license["package_size_tier"];
                var studentSeats = lConst.seats[size].studentSeats;
                // change the student_count_remaining field in the license table
                return this.updateStudentSeatsRemaining(licenseId, studentSeats);
            }.bind(this))
            .then(function(status){
                if(typeof status === "string"){
                    resolve(status);
                }
                resolve();
            })
            .then(null, function(err){
                console.error("Assign Premium Course Error -",err);
                reject(err);
            });
    }.bind(this));
};

function _assignPremiumGames(courseId, plan){
    return when.promise(function(resolve, reject){
        var lmsService = this.serviceManager.get("lms").service;
        var games;
        lmsService.telmStore.getGamesForCourse(courseId)
            .then(function(output){
                games = output;
                var promiseList = [];
                var dashService = this.serviceManager.get("dash").service;
                _(games).forEach(function(game){
                    promiseList.push(dashService.getGameBasicInfo(game.id));
                });
                return when.all(promiseList);
            }.bind(this))
            .then(function(results){
                var infoObj = {};
                results.forEach(function(info){
                    infoObj[info.gameId] = info;
                });
                var availableGames = {};
                var browserGames = lConst.plan[plan].browserGames;
                browserGames.forEach(function(gameId){
                    availableGames[gameId] = true;
                });
                var downloadGames = lConst.plan[plan].downloadableGames;
                downloadGames.forEach(function(gameId){
                    availableGames[gameId] = true;
                });
                var iPadGames = lConst.plan[plan].iPadGames;
                iPadGames.forEach(function(gameId){
                    availableGames[gameId] = true;
                });
                var basicInfo;
                _(games).forEach(function(game, key){
                    basicInfo = infoObj[key];
                    if(basicInfo.price === "Premium" || basicInfo.price === "TBD" || basicInfo.price === "Coming Soon"){
                        if(availableGames[game.id]){
                            game.assigned = true;
                        }
                    }
                });
                return lmsService.telmStore.updateGamesForCourse(courseId, games);
            })
            .then(function(){
                resolve();
            })
            .then(null, function(err){
                console.error("Assign Premium Games Error -",err);
                reject(err);
            });
    }.bind(this));
}

LicService.prototype.removeStudentFromPremiumCourse = function(userId, courseId){
    return when.promise(function(resolve, reject){
        // get teacher, and from teacher find license id
        var licenseId;
        var seats;
        var inLicense;
        this.myds.getLicenseFromPremiumCourse(courseId)
            .then(function(license){
                if(!license){
                    return "lms.course.not.premium";
                }
                licenseId = license.id;
                seats = license["package_size_tier"];
                // get student map
                return this.cbds.getStudentsByLicense(licenseId);
            }.bind(this))
            .then(function(studentMap){
                if(typeof studentMap === "string"){
                    return studentMap;
                }
                var student = studentMap[userId];
                student[courseId] = false;
                inLicense = false;
                _(student).some(function(value){
                    if(value){
                        inLicense = true;
                        return true;
                    }
                });
                // set student's course reference to false in studentMap
                var data = {};
                data.students = studentMap;
                return this.cbds.updateStudentsByLicense(licenseId, data);
            }.bind(this))
            .then(function(status){
                if(typeof status === "string"){
                    return status;
                }
                if(inLicense){
                    return;
                }
                // if student is no longer a premium student, update the seat count
                var studentSeats = lConst.seats[seats].studentSeats;
                this.updateStudentSeatsRemaining(licenseId, studentSeats);
            }.bind(this))
            .then(function(status){
                if(typeof status === "string"){
                    resolve(status);
                    return;
                }
                resolve();
            }.bind(this))
            .then(null, function(err){
                console.error("Remove Student From Premium Course Error -", err);
                reject(err);
            });
    }.bind(this));
};

LicService.prototype.enrollStudentInPremiumCourse = function(userId, courseId){
    return when.promise(function(resolve, reject){
        var license;
        var licenseId;
        var seats;
        this.myds.getLicenseFromPremiumCourse(courseId)
            .then(function (results) {
                if(!results){
                    return "lms.course.not.premium";
                }
                license = results;
                licenseId = license.id;
                seats = license["package_size_tier"];
                // get active student list
                return this.cbds.getStudentsByLicense(licenseId);
            }.bind(this))
            .then(function (studentMap) {
                if(typeof studentMap === "string"){
                    return studentMap;
                }
                var studentSeatsRemaining = license["student_seats_remaining"];
                if (studentSeatsRemaining === 0 && !studentMap[userId]) {
                    return "lic.students.full";
                }
                if (studentMap[userId] === undefined) {
                    studentMap[userId] = {};
                }
                var student = studentMap[userId];
                student[courseId] = true;
                var data = {};
                data.students = studentMap;
                return this.cbds.updateStudentsByLicense(licenseId, data);
            }.bind(this))
            .then(function (status) {
                if (typeof status === "string") {
                    return status;
                }
                var studentSeats = lConst.seats[seats].studentSeats;
                return this.updateStudentSeatsRemaining(licenseId, studentSeats);
            }.bind(this))
            .then(function (status) {
                if (typeof status === "string") {
                    resolve(status);
                    return;
                }
                resolve();
            }.bind(this))
            .then(null, function (err) {
                console.error("Enroll Student In Premium Course Error -", err);
                reject(err);
            });
    }.bind(this));
};

LicService.prototype.updateEducatorSeatsRemaining = function(licenseId, seats){
    return when.promise(function(resolve, reject){
        this.myds.countEducatorSeatsByLicense(licenseId)
            .then(function(count){
                var seatsRemaining = seats - count +1;
                var seatsRemainingString = "educator_seats_remaining = " + seatsRemaining;
                var updateFields = [seatsRemainingString];
                return this.myds.updateLicenseById(licenseId, updateFields);
            }.bind(this))
            .then(function(){
                resolve();
            })
            .then(null, function(err){
                console.error("Update Educator Seats Remaining Error -",err);
                reject(err);
            });
    }.bind(this));
};

LicService.prototype.updateStudentSeatsRemaining = function(licenseId, seats){
    return when.promise(function(resolve, reject){
        this.cbds.countActiveStudentsByLicense(licenseId)
            .then(function(count){
                var seatsRemaining = seats - count;
                var seatsRemainingString = "student_seats_remaining = " + seatsRemaining;
                var updateFields = [seatsRemainingString];
                return this.myds.updateLicenseById(licenseId, updateFields);
            }.bind(this))
            .then(function(){
                resolve();
            })
            .then(null,function(err){
                console.error("Update Student Seats Remaining Error -",err);
                reject(err);
            });
    }.bind(this));
};
