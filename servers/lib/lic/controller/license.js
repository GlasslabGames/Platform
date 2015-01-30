
var _      = require('lodash');
var when   = require('when');
var moment = require('moment');
var Util   = require('../../core/util.js');
var lConst = require('../lic.const.js');

module.exports = {
    getSubscriptionPackages: getSubscriptionPackages,
    getStudentsInLicense: getStudentsInLicense,
    // vestigial apis
    verifyLicense:   verifyLicense,
    registerLicense: registerLicense,
    getLicenses:     getLicenses
};

// must build
function getStudentsInLicense(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseRole && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"}, 500);
        return;
    }
    var userId = req.user.id;
    var licenseRole = req.user.licenseRole;
    var licenseId = req.user.licenseId;
    var students;
    var studentToTeacher;
    this.myds.getLicenseByInstructor(userId)
        .then(function(results){
            if(results.length === 0){
                return "access absent";
            }
            else if(results.length > 1){
                return "invalid records";
            } else if(results[0]['license_id'] !== licenseId){
                return "inconsistent";
            }

            return this.cbds.getStudentList(licenseId);
        }.bind(this))
        .then(function(activeStudents) {
            students = activeStudents;
            if (typeof students === 'string') {
                return students;
            }
            return this.myds.getCourseTeacherJoinByLicense(licenseId);
        }.bind(this))
        .then(function(courseTeacherMap){
            if(typeof courseTeacherMap === "string"){
                return courseTeacherMap;
            }
            studentToTeacher = {};
            var teacher;
            var outputStudents = {};
            _(students).forEach(function(premiumCourses, student){
                _(premiumCourses).forEach(function(isEnrolled, courseId){
                    if(isEnrolled){
                        teacher = courseTeacherMap[courseId];
                        studentToTeacher[student][teacher.username] = true;
                        if(teacher.id === userId){
                            outputStudents[student] = true;
                        }
                    }
                });
            });
            this.myds.getUsersByIds(outputStudents);
        }.bind(this))
        .then(function(studentsInfo){
            if(studentsInfo === "access absent"){
                this.requestUtil.errorResponse(res, {key: "lic.access.absent"},500);
                return;
            } else if(studentsInfo === "invalid records"){
                this.requestUtil.errorResponse(res, {key: "lic.records.invalid"}, 500);
                return;
            } else if (studentsInfo === "inconsistent"){
                this.requestUtil.errorResponse(res, {key: "lic.records.inconsistent"}, 500);
            }
            var output = [];
            var studentOutput;
            var teachers;
            studentsInfo.forEach(function(student){
                studentOutput = {};
                studentOutput.firstName = student['firstName'];
                studentOutput.lastInitial = student['lastName'][0];
                studentOutput.username = student['username'];
                teachers = Object.keys(studentToTeacher[student['id']]);
                studentOutput.educators = teachers;
                output.push(studentOutput);
            });
            this.requestUtil.jsonResponse(res, output);
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err, 500);
        }.bind(this));
}

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
