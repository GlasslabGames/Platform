
var _      = require('lodash');
var when   = require('when');
var moment = require('moment');
var Util   = require('../../core/util.js');
var lConst = require('../lic.const.js');

module.exports = {
    getSubscriptionPackages: getSubscriptionPackages,
    getCurrentPlan: getCurrentPlan,
    getStudentsInLicense: getStudentsInLicense,
    addTeachersToLicense: addTeachersToLicense,
    // vestigial apis
    verifyLicense:   verifyLicense,
    registerLicense: registerLicense,
    getLicenses:     getLicenses
};

function getSubscriptionPackages(req, res){
    try{
        var plans = [];
        _(lConst.plan).forEach(function(value){
            plans.push(value);
        });
        var seats = [];
        _(lConst.seats).forEach(function(value){
            seats.push(value);
        });
        var output = {
            plans: plans,
            seats: seats
        };
        this.requestUtil.jsonResponse(res, output);
    } catch(err){
        this.requestUtil.errorResponse(res, err, 500)
    }
}

function getCurrentPlan(req, res){
    if(!(req && req.user && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"}, 500);
        return;
    }
    var licenseId = req.user.licenseId;
    var licenseOwnerId = req.user.licenseOwnerId;
    var output = {};
    this.myds.getLicenseById(licenseId)
        .then(function(license){
            license = license[0];
            output["studentSeatsRemaining"] = license["student_seats_remaining"];
            output["educatorSeatsRemaining"] = license["educator_seats_remaining"];
            output["expirationDate"] = license["expiration_date"];
            var packageType = license["package_type"];
            var packageSize = license["package_size_tier"];
            var packageDetails = {};
            var plans = lConst.plan[packageType.toLowerCase()];
            var seats = lConst.seats[packageSize.toLowerCase()];
            _(packageDetails).merge(plans,seats);
            output["packageDetails"] = packageDetails;
            return this.myds.getInstructorsByLicense(licenseId);
        }.bind(this))
        .then(function(instructors){
            output['educatorList'] = instructors;
            return this.myds.getUserById(licenseOwnerId);
        }.bind(this))
        .then(function(owner){
            var ownerName = owner["FIRST_NAME"] + " " + owner["LAST_NAME"];
            output.ownerName = ownerName;
            output.teachersToReject = req.teachersToReject || [];
            this.requestUtil.jsonResponse(res, output, 200);
        }.bind(this))
        .then(null, function(err){
            console.error(err);
            this.requestUtil.errorResponse(res, err, 500);
        }.bind(this));
}

function getStudentsInLicense(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"}, 500);
        return;
    }
    var userId = req.user.id;
    var licenseOwnerId = req.user.licenseOwnerId;
    var licenseId = req.user.licenseId;
    var students;
    var studentToTeacher;
    this.cbds.getActiveStudentsByLicense(licenseId)
        .then(function(activeStudents) {
            students = activeStudents;
            return this.myds.getCourseTeacherMapByLicense(licenseId);
        }.bind(this))
        .then(function(courseTeacherMap){
            studentToTeacher = {};
            var teacher;
            var outputStudents = {};
            var teacherName;
            _(students).forEach(function(premiumCourses, student){
                studentToTeacher[student] = {};
                _(premiumCourses).forEach(function(isEnrolled, courseId){
                    if(isEnrolled){
                        teacher = courseTeacherMap[courseId];
                        teacherName = teacher.firstName + " " + teacher.lastName;
                        studentToTeacher[student][teacher.username] = teacherName;
                        if(teacher.userId === userId){
                            outputStudents[student] = true;
                        }
                    }
                });
            });
            var output;
            if(licenseOwnerId === userId){
                output = Object.keys(students);
            } else{
                output = Object.keys(outputStudents);
            }
            if(output.length === 0){
                return [];
            }
            return this.myds.getUsersByIds(output);
        }.bind(this))
        .then(function(studentsInfo){
            var output = [];
            var studentOutput;
            var teachers;
            studentsInfo.forEach(function(student){
                studentOutput = {};
                studentOutput.firstName = student['FIRST_NAME'];
                studentOutput.lastInitial = student['LAST_NAME'][0];
                studentOutput.username = student['USERNAME'];
                teachers = [];
                _(studentToTeacher[student['id']]).forEach(function(teacher){
                    teachers.push(teacher);
                });
                studentOutput.educators = teachers;
                output.push(studentOutput);
            });
            this.requestUtil.jsonResponse(res, output);
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err, 500);
        }.bind(this));
}

function addTeachersToLicense(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"}, 500);
        return;
    }
    var userId = req.user.id;
    var licenseId = req.user.licenseId;
    var licenseOwnerId = req.user.licenseOwnerId;
    var teacherEmails = req.body.teacherEmails;
    if(licenseOwnerId !== userId){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"}, 500);
        return;
    }
    var hasLicenseObject;
    var createTeachers;
    var licenseSeats;
    this.myds.getLicenseById(licenseId)
        .then(function(license){
            var educatorSeatsRemaining = license[0]["educator_seats_remaining"];
            if(teacherEmails.length > educatorSeatsRemaining){
                return "not enough seats";
            }
            var seatsTier = license[0]["package_size_tier"].toLowerCase();
            licenseSeats = lConst.seats[seatsTier].educatorSeats;
            return this.myds.getUsersByEmail(teacherEmails);
        }.bind(this))
        .then(function(teachers){
            if(teachers === "not enough seats"){
                return teachers;
            }
            createTeachers = [];
            var newInstructors = {};
            teacherEmails.forEach(function(email){
                newInstructors[email] = true;
            });
            var teacherUserIds = [];
            teachers.forEach(function(teacher){
                newInstructors[teacher["EMAIL"]] = false;
                teacherUserIds.push(teacher.id);
            });
            _(newInstructors).forEach(function(state, instructor){
                if(state){
                    createTeachers.push(instructor)
                }
            });
            // how should we deal with teachers who are invited to a license but do not have an account?
            // also, how do we deal with rejections?
            // when i make this change, what do?
            // change login procedure to reflect users in table who are not actually registered |tested and passed
            // change user registration process so that a temp user account can have info updated based on registration flow |tested and passed
            // add field such that invited teachers who are not real users do not screw up other portions of the app | verify_code_status of invited
            if(teacherUserIds.length > 0){
                return _multiHasLicense.call(this, teacherUserIds);
            }
            return {};
        }.bind(this))
        .then(function(licenseObject){
            if(licenseObject === "not enough seats"){
                return licenseObject;
            }
            hasLicenseObject = licenseObject;
            if(createTeachers.length > 0) {
                return this.myds.multiInsertTempUsersByEmail(createTeachers);
            }
            return {};
        }.bind(this))
        .then(function(results){
            if(results === "not enough seats"){
                return results;
            }
            var newUsers = results;
            var id;
            var affectedRows = newUsers.affectedRows || 0;
            var firstInsertId = newUsers.insertId;
            for(var i = 0; i < affectedRows; i++){
                id = firstInsertId + i;
                hasLicenseObject[id] = false;
            }
            var teachersToApprove = [];
            var teachersToReject = [];
            _(hasLicenseObject).forEach(function(value, key){
                if(value === false){
                    teachersToApprove.push(key);
                } else{
                    teachersToReject.push(key);
                }
            });
            req.teachersToReject = teachersToReject;
            // once have all teachers I want to insert, do a multi insert in GL_LICENSE_MAP table
            if(teachersToApprove.length > 0){
                return this.myds.multiInsertLicenseMap(licenseId, teachersToApprove);
            }
        }.bind(this))
        .then(function(status) {
            if (status === "not enough seats") {
                return status;
            }
            return _updateEducatorSeatsRemaining.call(this,licenseId, licenseSeats);
        }.bind(this))
        .then(function(status){
            if (status === "not enough seats") {
                return status;
            }
            // design emails language, methods, and templates
            // method currently is empty
            var ownerEmail = [];
            var usersEmail = [];
            var nonUsersEmail = [];
            return _inviteEmailsForOwnerInstructors.call(this,ownerEmail,usersEmail,nonUsersEmail);
        }.bind(this))
        .then(function(status){
            if(status === "not enough seats"){
                this.requestUtil.errorResponse(res, {key:"lic.educators.full"}, 500);
            }
            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Add Teachers to License Error - ",err);
            this.requestUtil.errorResponse(res, err, 500);
        }.bind(this));
}

function _multiHasLicense(userIds){
    return when.promise(function(resolve, reject){
        this.myds.getLicenseMapByInstructors(userIds)
            .then(function(licenseMaps){
                var output = {};
                userIds.forEach(function(id){
                    output[id] = false;
                });
                licenseMaps.forEach(function(map){
                    output[map["user_id"]] = true;
                });
                resolve(output);
            })
            .then(null, function(err){
                reject(err);
            })
    }.bind(this));
}

function _inviteEmailsForOwnerInstructors(owner, users, nonUsers){
    return when.promise(function(resolve, reject){
        resolve();
    }.bind(this));
}

function _updateEducatorSeatsRemaining(licenseId, seats){
    return when.promise(function(resolve, reject){
        this.myds.countEducatorSeatsByLicense(licenseId)
            .then(function(count){
                var seatsRemaining = seats - count;
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
}

function _updateStudentSeatsRemaining(licenseId, seats){
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
}

var exampleOut = {}, exampleIn = {};


/*
 http://localhost:8001/api/v2/license/validate/ZQRD-NC7F4-W7LR
 */
exampleOut.verifyLicense =
{
    licenseKey: "ABCD-12345-EF67"
};
function verifyLicense(req, res, next) {
    res.end('api no longer used');
    return;
    if( req.params &&
        req.params.licenseKey) {
        var licenseKey = req.params.licenseKey;

        this.myds.verifyLicense(licenseKey)

            .then(function(validLicense) {
                if(validLicense.length > 0) {
                    this.requestUtil.jsonResponse(res, {status:"valid license", key:"license.valid"});
                } else {
                    this.requestUtil.errorResponse(res, {error:"invalid license", key:"license.invalid"}, 404);
                }
            }.bind(this))

            .then(null, function(err) {
                console.error("LicService - verifyLicense:", err);
                this.requestUtil.errorResponse(res, {error:"server error", key:"server.error"}, 500);
            }.bind(this));

    } else {
        this.requestUtil.errorResponse(res, {error:"missing license", key:"license.missing"}, 404);
    }
}

/*
 http://localhost:8001/api/v2/license/current

        lic details:
            game_id: SC
            type: simcity lab pack
            lic code: XXXX
            purchased from: SMS...
            activation date:
            renewal date

        get # of users using license
        get # of teachers using license
        status (still valid or expired?) (need to cron job to expire old lic)
 */
exampleOut.getLicenses =
[
    {
        gameId: "SC",
        type: "SimCityEDU Single License",
        key:  "ABCD-12345-EFGH",
        purchasedFrom: "HMH",
        activationDate: 123456789, // epoch seconds
        expirationDate: 123456789, // epoch seconds
        usage: {
            studentsActive:  100, // TODO, need to add some promise Map for this
            studentsMax:     120
        }
    }
];

function getLicenses(req, res, next) {
    res.end('api no longer used');
    return;
    if( req.session &&
        req.session.passport) {
        var userData = req.session.passport.user;

        this.myds.getLicenses(userData.id)

            .then(function(licenses) {
                if(licenses) {
                    var out = [];

                    for(var i = 0; i < licenses.length; i++) {
                        var outItem = {
                            gameId:         licenses[i].game_id,
                            key:            licenses[i].license_key,
                            purchasedFrom:  "",
                            activationDate: 0,
                            expirationDate: 0,
                            expired: true,
                            usage: {
                                studentsMax: licenses[i].seats
                            }
                        };

                        var licenseCodeType   = licenses[i].partner_id.split('-');
                        outItem.purchasedFrom = licenseCodeType.shift();

                        licenseCodeType = licenseCodeType.join('-');
                        if(lConst.licenseCodeTypes.hasOwnProperty(licenseCodeType)) {
                            outItem.type = lConst.licenseCodeTypes[licenseCodeType];
                        }

                        outItem.activationDate = Util.GetTimeStamp(licenses[i].activition_date);
                        outItem.expirationDate = Util.GetTimeStamp(licenses[i].expiration_date);
                        if(outItem.expirationDate > Util.GetTimeStamp()) {
                            outItem.expired = false;
                        }

                        out.push(outItem);
                    }

                    this.requestUtil.jsonResponse(res, out);
                } else {
                    this.requestUtil.errorResponse(res, {error:"no license", key:"license.invalid"}, 404);
                }
            }.bind(this));
    } else {
        this.requestUtil.errorResponse(res, "not logged in");
    }
}

// register a license to the signed in user
/*
 POST
 http://localhost:8001/api/v2/license/register
 */
exampleIn.registerLicense = {
    "key": "ZQRD-NC7F4-W7LR"
};
function registerLicense(req, res, next) {
    res.end('api no longer user');
    return;
    if( req.body &&
        req.body.key &&
        _.isString(req.body.key)) {
        var licenseKey = req.body.key;
        var userData = req.session.passport.user;

        this.myds.verifyLicense(licenseKey)

            .then(function(validLicense) {
                if(validLicense.length > 0) {
                    // valid license then register user

                    // TODO: change this to use license logic
                    var expirationDate = Util.GetTimeStamp( moment().add('years', 1) );

                    return this.myds.registerLicense(validLicense[0].id, userData.id)
                        .then(function(result) {
                            if(result) {
                                return this.myds.redeemLicense(validLicense[0].id, expirationDate);
                            }
                        }.bind(this));
                } else {
                    this.requestUtil.errorResponse(res, {error:"invalid license", key:"license.invalid"}, 404);
                }
            }.bind(this))

            .then(function(results) {
                if(results) {
                    this.requestUtil.jsonResponse(res, {status: "ok"});
                }
            }.bind(this))

            // catch all errors
            .then(null, function(err) {
                console.error("LicService - registerLicense:", err);
                this.requestUtil.errorResponse(res, {error:"server error", key:"server.error"}, 500);
            }.bind(this));

    } else {
        this.requestUtil.errorResponse(res, {error:"missing license", key:"license.missing"}, 404);
    }
}
