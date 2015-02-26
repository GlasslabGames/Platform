var path   = require('path');
var _      = require('lodash');
var when   = require('when');
var moment = require('moment');
var Util   = require('../../core/util.js');
var lConst = require('../lic.const.js');

module.exports = {
    getSubscriptionPackages: getSubscriptionPackages,
    getCurrentPlan: getCurrentPlan,
    getStudentsInLicense: getStudentsInLicense,
    getBillingInfo: getBillingInfo,
    updateBillingInfo: updateBillingInfo,
    subscribeToLicense: subscribeToLicense,
    subscribeToTrialLicense: subscribeToTrialLicense,
    upgradeLicense: upgradeLicense,
    upgradeTrialLicense: upgradeTrialLicense,
    cancelLicenseAutoRenew: cancelLicenseAutoRenew,
    enableLicenseAutoRenew: enableLicenseAutoRenew,
    addTeachersToLicense: addTeachersToLicense,
    setInstructorLicenseStatusToActive: setInstructorLicenseStatusToActive,
    removeTeacherFromLicense: removeTeacherFromLicense,
    teacherLeavesLicense: teacherLeavesLicense,
    // vestigial apis
    verifyLicense:   verifyLicense,
    registerLicense: registerLicense,
    getLicenses:     getLicenses
};

function getSubscriptionPackages(req, res){
    try{
        var plans = [];
        var plan;
        _(lConst.plan).forEach(function(value, key){
            if(key !== "trial"){
                plan = _.clone(value);
                delete plan["stripe_planId"];
                plans.push(plan);
            }
        });
        var seats = [];
        _(lConst.seats).forEach(function(value, key){
            if(key !== "trial"){
                seats.push(value);
            }
        });
        var output = {
            plans: plans,
            seats: seats
        };
        this.requestUtil.jsonResponse(res, output);
    } catch(err){
        this.requestUtil.errorResponse(res, err)
    }
}

function getCurrentPlan(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    var userId = req.user.id;
    var licenseId = req.user.licenseId;
    var licenseOwnerId = req.user.licenseOwnerId;
    var output = {};
    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return this.myds.getLicenseById(licenseId);
        }.bind(this))
        .then(function(license){
            if(typeof license === "string"){
                return license;
            }
            license = license[0];
            output["autoRenew"] = license["auto_renew"];
            output["studentSeatsRemaining"] = license["student_seats_remaining"];
            output["educatorSeatsRemaining"] = license["educator_seats_remaining"];
            output["expirationDate"] = license["expiration_date"];
            output["autoRenew"] = license["auto_renew"] === 1 ? true : false;
            var packageType = license["package_type"];
            var packageSize = license["package_size_tier"];
            var packageDetails = {};
            var plans = lConst.plan[packageType];
            var seats = lConst.seats[packageSize];
            _(packageDetails).merge(plans,seats);
            output["packageDetails"] = packageDetails;
            return this.myds.getInstructorsByLicense(licenseId);
        }.bind(this))
        .then(function(instructors){
            if(typeof instructors === "license"){
                return instructors;
            }
            delete instructors.id;
            output['educatorList'] = instructors;
            return this.myds.getUserById(licenseOwnerId);
        }.bind(this))
        .then(function(owner){
            if(typeof owner === "string"){
                _errorLicensingAccess.call(this, res, owner);
                return;
            }
            var ownerName = owner["FIRST_NAME"] + " " + owner["LAST_NAME"];
            output.ownerName = ownerName;
            output.ownerEmail = owner['EMAIL'];
            output.rejectedTeachers = req.rejectedTeachers || [];
            output.approvedTeachers = req.approvedTeachers || [];
            delete output["packageDetails"]["stripe_planId"];
            this.requestUtil.jsonResponse(res, output, 200);
        }.bind(this))
        .then(null, function(err){
            console.error(err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function getStudentsInLicense(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    var userId = req.user.id;
    var licenseOwnerId = req.user.licenseOwnerId;
    var licenseId = req.user.licenseId;
    var students;
    var studentToTeacher;
    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return this.cbds.getActiveStudentsByLicense(licenseId);
        }.bind(this))
        .then(function(activeStudents) {
            if(typeof activeStudents === "string"){
                return activeStudents;
            }
            students = activeStudents;
            return this.myds.getCourseTeacherMapByLicense(licenseId);
        }.bind(this))
        .then(function(courseTeacherMap){
            if(typeof courseTeacherMap === "string"){
                return courseTeacherMap;
            }
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
            if(typeof studentsInfo === "string"){
                _errorLicensingAccess.call(this, res, studentsInfo);
                return;
            }
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
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function getBillingInfo(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.user.licenseStatus === "active" && req.user.licenseOwnerId === req.user.id)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }

    var userId = req.user.id;
    var licenseId = req.user.licenseId;
    var customerId;
    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return this.myds.getUserById(userId);
        }.bind(this))
        .then(function(user){
            if(typeof user === "string"){
                return user;
            }
            customerId = user["customer_id"];
            return this.serviceManager.stripe.retrieveCustomer(customerId);
        }.bind(this))
        .then(function(customer){
            if(typeof cardData === "string"){
                _errorLicensingAccess.call(this, res, cardData);
                return;
            }
            var cardData = customer.cards.data[0];
            var billingInfo = _buildBillingInfo(cardData);
            this.requestUtil.jsonResponse(res, billingInfo);
        }.bind(this))
        .then(null, function(err){
            console.error("Get Customer Id Error -",err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this))
}

function updateBillingInfo(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.user.licenseStatus === "active" && req.user.licenseOwnerId === req.user.id && req.body.stripeInfo)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    var params = {};
    // stripe token from new credit card
    params.card = req.body.stripeInfo.id;
    var userId = req.user.id;
    var licenseId = req.user.licenseId;
    var customerId;
    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return this.myds.getUserById(userId);
        }.bind(this))
        .then(function(user){
            if(typeof user === "string"){
                return user;
            }
            customerId = user["customer_id"];
            return this.serviceManager.stripe.updateCustomer(customerId, params);
        }.bind(this))
        .then(function(customer){
            if(typeof customer === "string"){
                this.requestUtil.errorResponse(res, customer);
                return;
            }
            //var data = {};
            //data.firstName = req.user["FIRST_NAME"];
            //data.lastName = req.user["LAST_NAME"];
            //data.subject = "Billing Info Successfull Updated"
            //var licenseOwnerEmail = req.user.email;
            //var template = "owner-billing-update";
            //_sendEmailResponse.call(this, licenseOwnerEmail, data, req.protocol, req.headers.host, template);
            var cardData = customer.cards.data[0];
            var billingInfo = _buildBillingInfo(cardData);
            this.requestUtil.jsonResponse(res, billingInfo);
        }.bind(this))
        .then(null, function(err){
            console.error("Update Billing Info Error -",err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function subscribeToLicense(req, res){
    if(!(req && req.user && req.user.id && req.user.role === "instructor")){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.body && req.body.stripeInfo && req.body.planInfo)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(req.user.licenseId){
        this.requestUtil.errorResponse(res, {key: "lic.create.denied"});
        return;
    }
    var userId = req.user.id;
    var stripeInfo = req.body.stripeInfo;
    var planInfo = req.body.planInfo;
    var emailData = {};
    _createSubscription.call(this, req, userId, stripeInfo, planInfo, emailData)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return Util.updateSession(req);
        })
        .then(function(status){
            if(status === "duplicate customer account"){
                this.requestUtil.errorResponse(res,{key:"lic.records.invalid"});
                return;
            }
            if(status === "account inactive"){
                this.requestUtil.errorResponse(res,{key:"lic.account.inactive"});
                return;
            }

            // get users email address and build below method
            var licenseOwnerEmail = req.user.email;
            var data = {};
            data.firstName = req.user["FIRST_NAME"];
            data.lastName = req.user["LAST_NAME"];
            data.subject = "Welcome to GlassLab Games Premium!";
            var template = "owner-subscribe";
            _sendEmailResponse.call(this, licenseOwnerEmail, data, req.protocol, req.headers.host, template);
            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Subscribe To License Error -",err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function subscribeToTrialLicense(req, res){
    if(!(req && req.user && req.user.id && req.user.role === "instructor")){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(req.user.licenseId){
        this.requestUtil.errorResponse(res, {key: "lic.create.denied"});
        return;
    }
    if(req.user.email.indexOf("+") !== -1){
        this.requestUtil.errorResponse(res, {key: "lic.email.invalid"});
        return;
    }
    var userId = req.user.id;
    var stripeInfo = {};
    var planInfo = {
        seats: "trial",
        type: "trial"
    };
    this.myds.userHasLicenseMap(userId)
        .then(function(state){
            if(state){
                return "no trial"
            }
            return _createSubscription.call(this, req, userId, stripeInfo, planInfo);
        }.bind(this))
        .then(function(status){
            if(status === "duplicate customer account"){
                this.requestUtil.errorResponse(res,{key:"lic.records.invalid"});
                return;
            }
            if(status === "account inactive"){
                this.requestUtil.errorResponse(res,{key:"lic.account.inactive"});
                return;
            }
            if(status === "no trial"){
                this.requestUtil.errorResponse(res, { key: "lic.trial.expired"});
                return;
            }
            // get users email address and build below method
            var licenseOwnerEmail = req.user.email;
            var data = {};
            data.firstName = req.user["FIRST_NAME"];
            data.lastName = req.user["LAST_NAME"];
            data.subject = "Enjoy your Trial";
            var template = "owner-trial-create";
            _sendEmailResponse.call(this, licenseOwnerEmail, data, req.protocol, req.headers.host, template);
            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Subscribe To Trial License Error -",err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function upgradeLicense(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.user.licenseStatus === "active" && req.user.licenseOwnerId === req.user.id && req.body.planInfo)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }

    var userId = req.user.id;
    var licenseId = req.user.licenseId;
    var planInfo = req.body.planInfo;
    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            var promiseList = [];
            promiseList.push(this.myds.getUserById(userId));
            promiseList.push(this.myds.getLicenseById(licenseId));
            return when.all(promiseList);
        }.bind(this))
        .then(function(results){
            if(typeof results === "string"){
                return results;
            }
            var user = results[0];
            var customerId = user["customer_id"];
            var license = results[1];
            var subscriptionId = license[0]["subscription_id"];
            var params = _buildStripeParams(planInfo, customerId, {});
            delete params.card;
            return this.serviceManager.stripe.updateSubscription(customerId, subscriptionId, params);
        }.bind(this))
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            var plan = planInfo.type;
            return _unassignCoursesWhenUpgrading.call(this, licenseId, plan);
        }.bind(this))
        .then(function(status){
            if(typeof status === "string" && status !== "student count"){
                return status;
            }
            var promiseList = [];
            var packageType = "package_type = '" +  planInfo.type + "'";
            var packageSizeTier = "package_size_tier = '" + planInfo.seats + "'";
            var updateFields = [packageType, packageSizeTier];
            promiseList.push(this.myds.updateLicenseById(licenseId, updateFields));
            var seats = lConst.seats[planInfo.seats];
            var educatorSeats = seats.educatorSeats;
            promiseList.push(this.updateEducatorSeatsRemaining(licenseId, educatorSeats));
            if(status === "student count"){
                var studentSeats = seats.studentSeats;
                promiseList.push(this.updateStudentSeatsRemaining(licenseId, studentSeats));
            }
            return when.all(promiseList);
        }.bind(this))
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return Util.updateSession(req);
        }.bind(this))
        .then(function(status){
            if(typeof status === "string"){
                _errorLicensingAccess.call(this, res, status);
                return;
            }
            var licenseOwnerEmail = req.user.email;
            var data = {};
            data.firstName = req.user["FIRST_NAME"];
            data.lastName = req.user["LAST_NAME"];
            data.subject = "Premium Plan Upgraded!";
            var template = "owner-upgrade";
            _sendEmailResponse.call(this, licenseOwnerEmail, data, req.protocol, req.headers.host, template);
            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Upgrade License Error -",err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function upgradeTrialLicense(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.user.licenseStatus === "active" && req.user.licenseOwnerId === req.user.id && req.body.planInfo)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    var userId = req.user.id;
    var licenseId = req.user.licenseId;
    var stripeInfo = req.body.stripeInfo;
    var planInfo = req.body.planInfo;

    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return _endLicense.call(this, userId, licenseId);
        }.bind(this))
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return _createSubscription.call(this, req, userId, stripeInfo, planInfo);
        }.bind(this))
        .then(function(status){
            if(status === "duplicate customer account"){
                this.requestUtil.errorResponse(res,{key:"lic.records.invalid"});
                return;
            }
            if(status === "account inactive"){
                this.requestUtil.errorResponse(res,{key:"lic.account.inactive"});
                return;
            }
            if(status === "email not in license"){
                this.requestUtil.errorResponse(res, { key: "lic.records.inconsistent"});
                return;
            }
            if(typeof status === "string"){
                _errorLicensingAccess.call(this, res, status);
                return;
            }
            var licenseOwnerEmail = req.user.email;
            var data = {};
            data.firstName = req.user["FIRST_NAME"];
            data.lastName = req.user["LAST_NAME"];
            data.subject = "Welcome to GlassLab Games Premium!";
            var template = "owner-upgrade-trial";
            _sendEmailResponse.call(this, licenseOwnerEmail, data, req.protocol, req.headers.host, template);
            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Upgrade Trial License Error -",err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function cancelLicenseAutoRenew(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.user.licenseStatus === "active" && req.user.licenseOwnerId === req.user.id)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    var userId = req.user.id;
    var licenseId = req.user.licenseId;
    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return _cancelAutoRenew.call(this, userId, licenseId);
        }.bind(this))
        .then(function(status){
            if(status === "already cancelled"){
                this.requestUtil.errorResponse(res, { key: "lic.cancelled.already"});
                return;
            }
            if(typeof status === "string"){
                _errorLicensingAccess.call(this, res, status);
                return;
            }
            var licenseOwnerEmail = req.user.email;
            var data = {};
            data.firstName = req.user["FIRST_NAME"];
            data.lastName = req.user["LAST_NAME"];
            data.subject = "Autorenew Disabled";
            var template = "owner-autorenew-disable";
            _sendEmailResponse.call(this, licenseOwnerEmail, data, req.protocol, req.headers.host, template);
            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Cancel License Error -",err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function enableLicenseAutoRenew(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.user.licenseStatus === "active" && req.user.licenseOwnerId === req.user.id)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    var userId = req.user.id;
    var licenseId = req.user.licenseId;
    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            var promiseList = [];
            promiseList.push(this.myds.getLicenseById(licenseId));
            promiseList.push(this.myds.getUserById(userId));
            return when.all(promiseList);
        }.bind(this))
        .then(function(results){
            if(typeof results === "string"){
                return results;
            }
            var license = results[0][0];
            var autoRenew = license["auto_renew"];
            if(autoRenew){
                return "already renewing";
            }
            var subscriptionId = license["subscription_id"];
            var plan = license["package_type"];
            var stripePlan = lConst.plan[plan].stripe_planId;
            var params = { plan: stripePlan };
            var user = results[1];
            var customerId = user["customer_id"];
            return this.serviceManager.stripe.renewSubscription(customerId, subscriptionId, params);
        }.bind(this))
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            var autoRenew = "auto_renew = TRUE";
            var updateFields = [autoRenew];
            return this.myds.updateLicenseById(licenseId, updateFields);
        }.bind(this))
        .then(function(status){
            if(status === "already renewing"){
                this.requestUtil.errorResponse(res, { key: "lic.renewing.already"});
                return;
            }
            if(typeof status === "string"){
                _errorLicensingAccess.call(this, res, status);
                return;
            }
            var licenseOwnerEmail = req.user.email;
            var data = {};
            data.firstName = req.user["FIRST_NAME"];
            data.lastName = req.user["LAST_NAME"];
            data.subject = "Autorenew Enabled";
            var template = "owner-autorenew-enable";
            _sendEmailResponse.call(this, licenseOwnerEmail, data, req.protocol, req.headers.host, template);
            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Renew License Error -",err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function addTeachersToLicense(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    var userId = req.user.id;
    var licenseId = req.user.licenseId;
    var licenseOwnerId = req.user.licenseOwnerId;
    var teacherEmails = req.body.teacherEmails;
    if(licenseOwnerId !== userId){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    var hasLicenseObject;
    var createTeachers;
    var existingTeachers;
    var licenseSeats;
    var approvedTeachers;
    var emails;
    var rejectedTeachers = {};
    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(state){
            if(typeof state === "string"){
                return state;
            }
            return this.myds.getLicenseById(licenseId);
        }.bind(this))
        .then(function(license){
            if(typeof license === "string"){
                return license;
            }
            var educatorSeatsRemaining = license[0]["educator_seats_remaining"];
            if(teacherEmails.length > educatorSeatsRemaining){
                return "not enough seats";
            }
            if(license.active === 0 || license.active === false ){
                return "inactive license";
            }
            var seatsTier = license[0]["package_size_tier"];
            licenseSeats = lConst.seats[seatsTier].educatorSeats;
            return this.myds.getUsersByEmail(teacherEmails);
        }.bind(this))
        .then(function(teachers){
            if(typeof teachers === "string"){
                return teachers;
            }
            createTeachers = [];
            var newInstructors = {};
            teacherEmails.forEach(function(email){
                newInstructors[email] = true;
            });
            existingTeachers = [];
            teachers.forEach(function(teacher){
                if(teacher["SYSTEM_ROLE"] !== 'instructor'){
                    delete newInstructors[teacher["EMAIL"]];
                    rejectedTeachers[teacher.id] = "user role not instructor";
                    return;
                }
                newInstructors[teacher["EMAIL"]] = false;
                existingTeachers.push(teacher.id);
            });
            _(newInstructors).forEach(function(state, instructor){
                if(state){
                    createTeachers.push(instructor)
                }
            });
            // how should we deal with teachers who are invited to a license but do not have an account?
            // change login procedure to reflect users in table who are not actually registered |tested and passed
            // change user registration process so that a temp user account can have info updated based on registration flow |tested and passed
            // add field such that invited teachers who are not real users do not screw up other portions of the app | verify_code_status of invited
            var promiseList = [{},{}];
            if(existingTeachers.length > 0){
                promiseList[0] = _multiHasLicense.call(this, existingTeachers);
            }
            if(createTeachers.length > 0){
                promiseList[1] = this.myds.multiInsertTempUsersByEmail(createTeachers);
            }
            return when.all(promiseList);
        }.bind(this))
        .then(function(results){
            if(typeof results === "string"){
                return results;
            }
            hasLicenseObject = results[0];
            var newUsers = results[1];
            var id;
            var affectedRows = newUsers.affectedRows || 0;
            var firstInsertId = newUsers.insertId;
            for(var i = 0; i < affectedRows; i++){
                id = firstInsertId + i;
                hasLicenseObject[id] = false;
            }
            approvedTeachers = [];
            _(hasLicenseObject).forEach(function(value, key){
                if(value === false){
                    approvedTeachers.push(key);
                } else{
                    rejectedTeachers[key] = "user already on another license";
                }
            });
            var approvedExistingTeachers = [];
            existingTeachers.forEach(function(id){
                if(!rejectedTeachers[id]){
                    approvedExistingTeachers.push(id);
                }
            });
            existingTeachers = approvedExistingTeachers;
            // once have all teachers I want to insert, do a multi insert in GL_LICENSE_MAP table
            if(approvedTeachers.length > 0){
                return this.myds.multiGetLicenseMap(licenseId, approvedTeachers);
            }
            return "reject all";
        }.bind(this))
        .then(function(licenseMap){
            if(typeof licenseMap === "string"){
                return licenseMap;
            }
            var map = {};
            licenseMap.forEach(function(teacher){
                map[teacher.user_id] = true;
            });
            var teachersToInsert = [];
            var teachersToUpdate = [];
            approvedTeachers.forEach(function(teacherId){
                if(map[teacherId]){
                    teachersToUpdate.push(teacherId);
                } else{
                    teachersToInsert.push(teacherId);
                }
            });
            var promiseList = [{},{}];
            if(teachersToInsert.length > 0){
                promiseList[0] = this.myds.multiInsertLicenseMap(licenseId, teachersToInsert);
            }
            if(teachersToUpdate.length > 0){
                promiseList[1] = this.myds.multiUpdateLicenseMap(licenseId, teachersToUpdate);
            }
            return when.all(promiseList);
        }.bind(this))
        .then(function(status) {
            if (typeof status === "string" && status !== "reject all") {
                return status;
            }
            var promiseList = [];
            var rejectedIds = Object.keys(rejectedTeachers);
            promiseList.push(_grabInstructorEmailsByType.call(this, existingTeachers, rejectedIds, createTeachers));
            promiseList.push(this.updateEducatorSeatsRemaining(licenseId, licenseSeats));
            return when.all(promiseList);
        }.bind(this))
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            emails = status[0];
            return Util.updateSession(req);
        })
        .then(function(status){
            if(status === "not enough seats"){
                this.requestUtil.errorResponse(res, {key:"lic.educators.full"});
                return;
            }
            if(status === "inactive license"){
                this.requestUtil.errorResponse(res, {key:"lic.access.invalid"});
                return;
            }
            if(typeof status === "string"){
                _errorLicensingAccess.call(this, res, status);
                return;
            }
            // design emails language, methods, and templates
            // method currently is empty
            var usersEmails = emails[0];
            var nonUsersEmails = emails[1];
            var rejectedEmails = emails[2];

            var approvedTeachersOutput = usersEmails.concat(nonUsersEmails);
            var rejectedTeachersOutput = [];
            var email;
            _(rejectedTeachers).forEach(function(value, key){
                email = rejectedEmails[key];
                rejectedTeachersOutput.push([email, value]);
            });
            req.approvedTeachers = approvedTeachersOutput;
            req.rejectedTeachers = rejectedTeachersOutput;

            var usersData = {};
            var usersTemplate = "educator-user-invited";
            usersData.firstName = "hello";
            usersData.lastName = "world";
            usersData.subject = "Added to License!";

            usersEmails.forEach(function(email){
                _sendEmailResponse.call(this, email, usersData, req.protocol, req.headers.host, usersTemplate);
            }.bind(this));

            var nonUsersData = {};
            var nonUsersTemplate = "educator-nonuser-invited";
            nonUsersData.firstName = "hello";
            nonUsersData.lastName = "world";
            nonUsersData.subject = "Added to License!";

            nonUsersEmails.forEach(function(email){
                _sendEmailResponse.call(this, email, usersData, req.protocol, req.headers.host, nonUsersTemplate);
            }.bind(this));

            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Add Teachers to License Error - ",err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function setInstructorLicenseStatusToActive(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(req.user.licenseStatus === "active"){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    var userId = req.user.id;
    var userIdList = [req.user.id];
    var licenseId = req.user.licenseId;
    var status = "status = 'active'";
    var updateFields = [status];

    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return this.myds.updateLicenseMapByLicenseInstructor(licenseId,userIdList,updateFields);
        }.bind(this))
        .then(function(status){
            if(typeof status === "string"){
                _errorLicensingAccess.call(this, res, status);
                return;
            }
            this.requestUtil.jsonResponse(res, { status: "ok" }, 200);
        }.bind(this))
        .then(null, function(err){
            console.error("Set License Map Status to Active Error -",err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function removeTeacherFromLicense(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    var userId = req.user.id;
    var licenseId = req.user.licenseId;
    var licenseOwnerId = req.user.licenseOwnerId;
    var teacherEmail = [req.body.teacherEmail];
    if(licenseOwnerId !== userId){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }

    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return _removeInstructorFromLicense.call(this, licenseId, teacherEmail, licenseOwnerId);
        }.bind(this))
        .then(function(emails){
            if(emails === "email not in license"){
                this.requestUtil.errorResponse(res, { key: "lic.records.inconsistent"});
                return;
            } else if(typeof emails === "string"){
                _errorLicensingAccess.call(this, res, emails);
                return;
            }
            var teacherEmail = emails[1];
            var data = {};
            data.firstName = req.user["FIRST_NAME"];
            data.lastName = req.user["LAST_NAME"];
            data.subject = "Removed from License";
            var template = "educator-removed";
            _sendEmailResponse.call(this, teacherEmail, data, req.protocol, req.headers.host, template);            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
            console.error("Remove Teacher From License Error -",err);
        }.bind(this));
}

function teacherLeavesLicense(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    var userId = req.user.id;
    var licenseId = req.user.licenseId;
    var licenseOwnerId = req.user.licenseOwnerId;
    var teacherEmail = [req.user.email];
    if(licenseOwnerId === userId){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(state){
            if(typeof state === "string"){
                return state;
            }
            return _removeInstructorFromLicense.call(this, licenseId, teacherEmail, licenseOwnerId);
        }.bind(this))
        .then(function(emails){
            if(email === "email not in license"){
                this.requestUtil.errorResponse(res, { key: "lic.records.inconsistent"});
                return;
            } else if(typeof email === "string"){
                _errorLicensingAccess.call(this, res, email);
                return;
            }
            var licenseOwnerEmail = emails[0];
            var data = {};
            data.firstName = req.user["FIRST_NAME"];
            data.lastName = req.user["LAST_NAME"];
            data.subject = "Teacher Left License";
            var template = "owner-educator-left";
            _sendEmailResponse.call(this, teacherEmail, data, req.protocol, req.headers.host, template);              this.requestUtil.jsonResponse(res, { status: 'success' });
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
            console.error("Teacher Leaves License Error -",err);
        }.bind(this));
}

function _buildBillingInfo(cardData){
    var output = {};
    output.last4 = cardData.last4;
    output.brand = cardData.brand;
    output.expMonth = cardData.exp_month;
    output.expYear = cardData.exp_year;
    output.country = cardData.country;
    output.name = cardData.name;
    output.addressLine1 = cardData.address_line1;
    output.addressLine2 = cardData.address_line2;
    output.addressCity = cardData.address_city;
    output.addressState = cardData.address_state;
    output.addressZip = cardData.address_zip;
    output.addressCountry = cardData.address_country;
    return output;
}

function _createSubscription(req, userId, stripeInfo, planInfo, emailData){
    return when.promise(function(resolve, reject){
        var email = req.user.email;
        var name = req.user.firstName + " " + req.user.lastName;
        emailData.name = name;
        _carryOutStripeTransaction.call(this, userId, email, name, stripeInfo, planInfo, emailData)
            .then(function(stripeData){
                if(typeof stripeData === "string"){
                    return stripeData;
                }
                return _createLicenseSQL.call(this, userId, planInfo, stripeData);
            }.bind(this))
            .then(function(licenseId){
                if(typeof licenseId === "string"){
                    return licenseId;
                }
                req.user.licenseId = licenseId;
                req.user.licenseOwnerId = userId;
                req.user.licenseStatus = "active";
                return this.cbds.createLicenseStudentObject(licenseId);
            }.bind(this))
            .then(function(state){
                resolve(state);
            })
            .then(null, function(err){
                console.error("Create Subscription Error -",err);
                reject(err);
            });
    }.bind(this));
}

function _carryOutStripeTransaction(userId, email, name, stripeInfo, planInfo){
    return when.promise(function(resolve, reject){
        var customerId;
        var output;
        this.myds.getCustomerIdByUserId(userId)
            .then(function(id){
                customerId = id;
                var params = _buildStripeParams(planInfo, customerId, stripeInfo, email, name);
                var condition = !stripeInfo.id;
                if(condition){
                    delete params.card;
                }
                if(customerId){
                    return this.serviceManager.stripe.createSubscription(customerId, params);
                }
                return this.serviceManager.stripe.createCustomer(params);
            }.bind(this))
            .then(function(results) {
                // results could be either a new customer object, or a new subscription object. deal with both.
                var subscription;
                var customer;
                output = {};
                if(!customerId) {
                    customer = results;
                    customerId = customer.id;
                    subscription = customer.subscriptions.data[0];
                } else {
                    subscription = results;
                }
                output.customerId = customerId;
                if(subscription && (subscription.status === "active" || subscription.status === "trialing")){
                    output.subscriptionId = subscription.id;
                    var msDate = subscription["current_period_end"] * 1000;
                    output.expirationDate = new Date(msDate).toISOString().slice(0, 19).replace('T', ' ');
                } else{
                    output = "account inactive";
                }
                if(customer){
                    return this.myds.setCustomerIdByUserId(userId, customerId);
                }
            }.bind(this))
            .then(function(){
                resolve(output);
            })
            .then(null, function(err){
                console.error("Carry Out Stripe Transaction Error -",err);
                reject(err);
            });
    }.bind(this));
}

function _buildStripeParams(planInfo, customerId, stripeInfo, email, name){
    var card = stripeInfo.id;
    var plan = planInfo.type;
    var seats = planInfo.seats;
    var stripePlan = lConst.plan[plan]["stripe_planId"];
    var stripeQuantity = lConst.plan[plan].pricePerSeat * lConst.seats[seats].studentSeats;
    var params = {};
    params.card = card;
    params.plan = stripePlan;
    params.quantity = stripeQuantity;

    if(!customerId){
        var description = "Customer for " + name;
        params.email = email;
        params.description = description;
    }
    return params;
}

function _createLicenseSQL(userId, planInfo, stripeData){
    return when.promise(function(resolve, reject){
        var seatsTier = planInfo.seats;
        var type = "'" + planInfo.type + "'";
        var licenseKey;
        if(planInfo.licenseKey){
            licenseKey = "'" + planInfo.licenseKey + "'";
        } else{
            licenseKey = 'NULL';
        }
        var promo;
        if(planInfo.promo){
            promo = "'" + planInfo.promo + "'";
        } else{
            promo = 'NULL';
        }
        var expirationDate = "'" + stripeData.expirationDate + "'";
        var educatorSeatsRemaining = lConst.seats[seatsTier].educatorSeats;
        var studentSeatsRemaining = lConst.seats[seatsTier].studentSeats;
        seatsTier = "'" + seatsTier + "'";
        var subscriptionId = "'" + stripeData.subscriptionId + "'";
        var values = [];
        values.push(userId);
        values.push(licenseKey);
        values.push(type);
        values.push(seatsTier);
        values.push(expirationDate);
        values.push(1);
        values.push(educatorSeatsRemaining);
        values.push(studentSeatsRemaining);
        values.push(promo);
        values.push(subscriptionId);
        var licenseId;
        this.myds.insertToLicenseTable(values)
            .then(function(insertId){
                licenseId = insertId;
                values = [];
                values.push(userId);
                values.push(licenseId);
                values.push("'active'");
                return this.myds.insertToLicenseMapTable(values);
            }.bind(this))
            .then(function(state){
                if(typeof state === "string"){
                    resolve(state);
                    return;
                }
                resolve(licenseId);
            })
            .then(null, function(err){
                console.error("Create License Error -",err);
                reject(err);
            });
    }.bind(this));
}

function _unassignCoursesWhenUpgrading(licenseId, plan){
    return when.promise(function(resolve, reject){
        var availableGames = {};
        var courseIds;
        var browserGames = lConst.plan[plan].browserGames;
        browserGames.forEach(function(gameId){
            availableGames[gameId] = true;
        });
        var iPadGames = lConst.plan[plan].iPadGames;
        iPadGames.forEach(function(gameId){
            availableGames[gameId] = true;
        });
        var downloadableGames = lConst.plan[plan].downloadableGames;
        downloadableGames.forEach(function(gameId){
            availableGames[gameId] = true;
        });
        this.myds.getCourseTeacherMapByLicense(licenseId)
            .then(function(courseMap){
                courseIds = Object.keys(courseMap);
                var promiseList = [];
                var dataService = this.serviceManager.get("data").service;
                courseIds.forEach(function(courseId){
                    promiseList.push(dataService.cbds.getGamesForCourse(courseId));
                });
                return when.all(promiseList);
            }.bind(this))
            .then(function(courseGames){
                var unassignCourseIds = [];
                var unassignCourse;
                courseGames.forEach(function(course, index){
                    unassignCourse = false;
                    _(course).some(function(value, key){
                        if(!availableGames[key] && value.assigned){
                            unassignCourse = true;
                            return;
                        }
                    });
                    if(unassignCourse){
                        unassignCourseIds.push(courseIds[index]);
                    }
                });
                if(unassignCourseIds.length === 0){
                    return "student count";
                }
                return this.unassignPremiumCourses(unassignCourseIds, licenseId);
            }.bind(this))
            .then(function(status){
                resolve(status);
            })
            .then(null, function(err){
                console.error("Unassign Premium Courses When Upgrading Error -",err);
                reject(err)
            })
    }.bind(this));
}

function _cancelAutoRenew(userId, licenseId){
    return when.promise(function(resolve, reject){
        var promiseList = [];
        promiseList.push(this.myds.getLicenseById(licenseId));
        promiseList.push(this.myds.getUserById(userId));
        return when.all(promiseList)
            .then(function(results){
                var license = results[0][0];
                var autoRenew = license["auto_renew"];
                if(!autoRenew){
                    return "already cancelled";
                }
                var subscriptionId = license["subscription_id"];
                var user = results[1];
                var customerId = user["customer_id"];
                return this.serviceManager.stripe.cancelSubscription(customerId, subscriptionId);
            }.bind(this))
            .then(function(status){
                if(typeof status === "string"){
                    return status;
                }
                var autoRenew = "auto_renew = FALSE";
                var updateFields = [autoRenew];
                return this.myds.updateLicenseById(licenseId, updateFields);
            }.bind(this))
            .then(function(status){
                if(typeof status === "string"){
                    resolve(status);
                    return;
                }
                resolve();
            })
            .then(null, function(err){
                console.error("Cancel Auto Renew Error -", err);
                reject(err);
            });
    }.bind(this));
}

function _endLicense(userId, licenseId){
    return when.promise(function(resolve, reject){
        var emailList;
        _cancelAutoRenew.call(this, userId, licenseId)
            .then(function(status){
                if(typeof status === "string" && status !== "already cancelled"){
                    return status;
                }
                return this.myds.getInstructorsByLicense(licenseId);
            }.bind(this))
            .then(function(users){
                if(typeof users === "string"){
                    return users;
                }
                var promiseList = [];
                users.forEach(function(educator){
                    promiseList.push(_removeInstructorFromLicense.call(this, licenseId, [educator["email"]], userId, users));
                }.bind(this));

                return when.reduce(promiseList, function(results, emails, index){
                    results.push(emails);
                    return results;
                }, []);
            }.bind(this))
            .then(function(emails){
                if(typeof emails === "string"){
                    return emails;
                }
                emailList = [emails[0][0]];
                emails.forEach(function(email){
                    emailList.push(email[1]);
                });
                var active = "active = 0";
                var updateFields = [active];
                return this.myds.updateLicenseById(licenseId, updateFields)
            }.bind(this))
            .then(function(status){
                if(typeof status === "string"){
                    resolve(status);
                    return;
                }
                resolve(emailList);
            }.bind(this))
            .then(null, function(err){
                console.error("End License Error -",err);
                reject(err);
            });
    }.bind(this))
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

function _grabInstructorEmailsByType(approvedUserIds, rejectedUserIds, approvedNonUserEmails){
    return when.promise(function(resolve, reject){
        var promiseList = [[],[]];
        if(approvedUserIds.length > 0){
            promiseList[0] = this.myds.getUsersByIds(approvedUserIds);
        }
        if(rejectedUserIds.length > 0){
            promiseList[1] = this.myds.getUsersByIds(rejectedUserIds);
        }
        return when.all(promiseList)
            .then(function(results){
                var output = [];
                var emails = [];
                var email;
                var approvedUsers = results[0];
                approvedUsers.forEach(function(user){
                    email = user["EMAIL"];
                    emails.push(email);
                });
                output.push(emails);
                output.push(approvedNonUserEmails);

                var rejectedUsers = results[1];
                emails = {};
                rejectedUsers.forEach(function(user){
                    emails[user.id] = user["EMAIL"];
                });
                output.push(emails);

                resolve(output);
            })
            .then(null, function(err){
                console.log("Grab Instruct Emails By Type Error -",err);
                reject(err);
            });
    }.bind(this));
}

function _removeInstructorFromLicense(licenseId, teacherEmail, licenseOwnerId, instructors){
    return when.promise(function(resolve, reject){
        var promiseList = [];
        // if licenseMap not already computed, find it. else, use existing value
        if(!instructors){
            promiseList.push(this.myds.getInstructorsByLicense(licenseId));
        } else{
            promiseList.push(instructors);
        }
        promiseList.push(this.myds.getUsersByEmail(teacherEmail));
        promiseList.push(this.myds.getLicenseById(licenseId));
        var teacherId;
        var license;
        when.all(promiseList)
            .then(function(results){
                var licenseMap = results[0];
                var state = false;
                licenseMap.some(function(instructor){
                    if(instructor.email === teacherEmail[0]){
                        state = true;
                        return true;
                    }
                });
                if(!state){
                    return "email not in license";
                }
                var teacher = results[1][0];
                teacherId = teacher.id;
                license = results[2][0];
                return this.myds.getCoursesByInstructor(teacherId);
                //find out which premium courses that instructor is a part of
                //lock each of those premium courses (with utility method)
            }.bind(this))
            .then(function(results){
                if(results === "email not in license"){
                    return results;
                }
                var courseIds = results[0];
                if(Array.isArray(courseIds)){
                    return this.unassignPremiumCourses(courseIds, licenseId);
                }
            }.bind(this))
            .then(function(state){
                if(state === "email not in license"){
                    return state;
                }
                //remove instructor from premium license
                var updateFields = ["status = NULL"];
                return this.myds.updateLicenseMapByLicenseInstructor(licenseId, [teacherId], updateFields);
            }.bind(this))
            .then(function(state){
                if(state === "email not in license"){
                    return state;
                }
                // update educator count
                var packageSize = license["package_size_tier"];
                var educatorSeats = lConst.seats[packageSize].educatorSeats;
                return this.updateEducatorSeatsRemaining(licenseId, educatorSeats);
            }.bind(this))
            .then(function(state){
                if(state === "email not in license"){
                    return state;
                }
                var ids = [licenseOwnerId,teacherId];
                return this.myds.getUsersByIds(ids);
            }.bind(this))
            .then(function(users){
                if(users === "email not in license"){
                    resolve(users);
                    return;
                }
                var licenseOwnerEmail;
                var teacherEmail;
                users.forEach(function(user){
                    if(licenseOwnerId === user.id){
                        licenseOwnerEmail = user["EMAIL"];
                    } else{
                        teacherEmail = user["EMAIL"];
                    }
                });
                var emails = [licenseOwnerEmail,teacherEmail];
                resolve(emails);
            })
            .then(null, function(err){
                console.error("Remove Instructor From License Error -",err);
                reject(err);
            }.bind(this));
    }.bind(this));
}

function _validateLicenseInstructorAccess(userId, licenseId) {
    return when.promise(function (resolve, reject) {
        this.myds.getLicenseMapByInstructors([userId])
            .then(function (results) {
                var state;
                if (results.length === 0) {
                    state = "access absent";
                } else if (results.length > 1) {
                    state = "invalid records";
                } else if (results[0]['license_id'] !== licenseId) {
                    state = "inconsistent";
                }
                resolve(state);
            })
            .then(null, function (err) {
                console.error('Validate License Instructor Access Error - ', err);
                reject(err);
            });
    }.bind(this));
}

function _errorLicensingAccess(res, status){
    if(status === "access absent"){
        this.requestUtil.errorResponse(res, {key: "lic.access.absent"},500);
    } else if(status === "invalid records"){
        this.requestUtil.errorResponse(res, {key: "lic.records.invalid"}, 500);
    } else if (status === "inconsistent"){
        this.requestUtil.errorResponse(res, {key: "lic.records.inconsistent"}, 500);
    } else{
        console.trace('unexpected error status:' + status);
        this.requestUtil.errorResponse(res, {key: "lic.acces.invalid"}, 500);
    }
}

//function _createLicenseEmailResponse(licenseOwnerEmail, data, protocol, host, template){
//    // early prototype, needs development
//    data.firstName = "hello";
//    data.lastName = "world";
//    var emailData = {
//        subject: "Welcome to GlassLab Games Premium!",
//        to: licenseOwnerEmail,
//        data: data,
//        host: protocol + "://" + host
//    };
//    var pathway = path.join(__dirname,"../email-templates");
//    var options = this.options.auth.email;
//    var email = new Util.Email(
//        this.options.auth.email,
//        path.join( __dirname, "../email-templates" ),
//        this.stats );
//    email.send( template, emailData )
//        .then(null, function(err){
//            console.error("Create License Email Response Error -",err);
//        });
//}

function _sendEmailResponse(email, data, protocol, host, template){
    // to remove testing email spam, i've added a return. remove to test
    //return;
    var emailData = {
        subject: data.subject,
        to: email,
        data: data,
        host: protocol + "://" + host
    };
    var pathway = path.join(__dirname,"../email-templates");
    var options = this.options.auth.email;
    var email = new Util.Email(
        this.options.auth.email,
        path.join( __dirname, "../email-templates" ),
        this.stats );
    email.send( template, emailData )
        .then(null, function(err){
            console.error("Send Email Response Error -",err);
        });
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
