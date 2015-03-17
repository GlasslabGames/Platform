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
    validatePromoCode: validatePromoCode,
    cancelLicenseAutoRenew: cancelLicenseAutoRenew,
    enableLicenseAutoRenew: enableLicenseAutoRenew,
    addTeachersToLicense: addTeachersToLicense,
    setLicenseMapStatusToActive: setLicenseMapStatusToActive,
    setLicenseMapStatusToNull: setLicenseMapStatusToNull,
    removeTeacherFromLicense: removeTeacherFromLicense,
    teacherLeavesLicense: teacherLeavesLicense,
    subscribeToLicensePurchaseOrder: subscribeToLicensePurchaseOrder,
    upgradeTrialLicensePurchaseOrder: upgradeTrialLicensePurchaseOrder,
    migrateToTrialLegacy: migrateToTrialLegacy,
    //upgradeLicensePurchaseOrder: upgradeLicensePurchaseOrder,
    getActivePurchaseOrderInfo: getActivePurchaseOrderInfo,
    cancelActivePurchaseOrder: cancelActivePurchaseOrder,
    receivePurchaseOrder: receivePurchaseOrder,
    rejectPurchaseOrder: rejectPurchaseOrder,
    invoicePurchaseOrder: invoicePurchaseOrder,
    approvePurchaseOrder: approvePurchaseOrder,
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
            if(key !== "trial" && key !== "trialLegacy"){
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
        console.error("Get Subscription Packages Error -",err);
        this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
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
            output["promoCode"] = license["promo"];
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
            var ownerName;
            if(owner["LAST_NAME"]){
                ownerName = owner["FIRST_NAME"] + " " + owner["LAST_NAME"];
            } else{
                ownerName = owner["FIRST_NAME"];
            }
            output.ownerName = ownerName;
            output.ownerEmail = owner['EMAIL'];
            output.rejectedTeachers = req.rejectedTeachers || [];
            output.approvedTeachers = req.approvedTeachers || [];
            delete output["packageDetails"]["stripe_planId"];
            this.requestUtil.jsonResponse(res, output, 200);
        }.bind(this))
        .then(null, function(err){
            console.error("Get Current Plan Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
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
            console.error("Get Students in License Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
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
            var billingInfo = {};
            if(cardData){
                billingInfo = _buildBillingInfo(cardData);
            }
            this.requestUtil.jsonResponse(res, billingInfo);
        }.bind(this))
        .then(null, function(err){
            console.error("Get Customer Id Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
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
            var cardData = customer.cards.data[0];
            var billingInfo = {};
            if(cardData){
                billingInfo = _buildBillingInfo(cardData);
            }
            this.requestUtil.jsonResponse(res, billingInfo);
        }.bind(this))
        .then(null, function(err){
            console.error("Update Billing Info Error -",err);
            if(err.code === "card_declined"){
                this.requestUtil.errorResponse(res, { key: "lic.card.declined"});
                return;
            }
            if(err.code === "incorrect_cvc"){
                this.requestUtil.errorResponse(res, { key: "lic.card.cvc.incorrect"});
                return;
            }
            if(err.code === "expired_card"){
                this.requestUtil.errorResponse(res, { key: "lic.card.expired"});
                return;
            }
            if(err.code === "processing_error"){
                this.requestUtil.errorResponse(res, { key: "lic.card.processing.error"});
                return;
            }
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
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
    var expirationDate;

    _createSubscription.call(this, req, userId, stripeInfo, planInfo)
        .then(function(results){
            if(typeof results === "string"){
                return results;
            }
            expirationDate = results.expirationDate;
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
            if(status === "po-pending"){
                this.requestUtil.errorResponse(res, {key:"lic.order.pending"});
                return;
            }
            if(status === "already on a license"){
                this.requestUtil.errorResponse(res, {key: "lic.access.invited"});
                return;
            }
            // get users email address and build below method
            var licenseOwnerEmail = req.user.email;
            var data = {};
            data.firstName = req.user.firstName;
            data.lastName = req.user.lastName;
            data.name = req.user.firstName + " " + req.user.lastName;
            data.subject = "Successful Subscription!";
            data.plan = planInfo.type;
            data.seats = planInfo.seats;
            data.expirationDate = expirationDate;
            var template = "owner-subscribe";
            _sendEmailResponse.call(this, licenseOwnerEmail, data, req.protocol, req.headers.host, template);
            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Subscribe To License Error -",err);
            if(err.code === "card_declined"){
                this.requestUtil.errorResponse(res, { key: "lic.card.declined"});
                return;
            }
            if(err.code === "incorrect_cvc"){
                this.requestUtil.errorResponse(res, { key: "lic.card.cvc.incorrect"});
                return;
            }
            if(err.code === "expired_card"){
                this.requestUtil.errorResponse(res, { key: "lic.card.expired"});
                return;
            }
            if(err.code === "processing_error"){
                this.requestUtil.errorResponse(res, { key: "lic.card.processing.error"});
                return;
            }
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
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
    if(this.options.env === "prod" && req.user.email.indexOf("+") !== -1){
        this.requestUtil.errorResponse(res, {key: "lic.email.invalid"});
        return;
    }
    var userId = req.user.id;
    var stripeInfo = {};
    var planInfo = {
        seats: "trial",
        type: "trial"
    };
    var expirationDate;
    this.myds.userHasLicenseMap(userId)
        .then(function(state){
            if(state){
                return "no trial"
            }
            return _createSubscription.call(this, req, userId, stripeInfo, planInfo);
        }.bind(this))
        .then(function(results){
            if(typeof results === "string"){
                return results;
            }
            expirationDate = results.expirationDate;
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
            if(status === "no trial"){
                this.requestUtil.errorResponse(res, { key: "lic.trial.expired"});
                return;
            }
            if(status === "po-pending"){
                this.requestUtil.errorResponse(res, {key:"lic.order.pending"});
                return;
            }
            if(status === "already on a license"){
                this.requestUtil.errorResponse(res, {key:"lic.access.invited"});
                return;
            }
            // get users email address and build below method
            var licenseOwnerEmail = req.user.email;
            var data = {};
            data.firstName = req.user.firstName;
            data.lastName = req.user.lastName;
            data.name = req.user.firstName + " " + req.user.lastName;
            data.subject = "Your Trial Subscription has Started!";
            //data.seats = lConst.seats['trial'].studentSeats;
            data.expirationDate = expirationDate;
            var template = "owner-trial-create";
            _sendEmailResponse.call(this, licenseOwnerEmail, data, req.protocol, req.headers.host, template);
            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Subscribe To Trial License Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
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
    var stripeInfo = req.body.stripeInfo || {};
    var emailData = {};
    var instructors;
    var promoCode = null;
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
            var license = results[1][0];
            if(license["purchase_order_id"] !== null){
                return "po-id";
            }
            emailData.oldPlan = license["package_type"];
            emailData.oldSeats = license["package_size_tier"];
            emailData.newPlan = planInfo.type;
            emailData.newSeats = planInfo.seats;
            if(!license["promo"] && planInfo.promoCode){
                promoCode = planInfo.promoCode;
            }
            if(lConst.seats[emailData.oldSeats].studentSeats > lConst.seats[emailData.newSeats].studentSeats){
                return "downgrade seats";
            }
            var subscriptionId = license["subscription_id"];
            var autoRenew = license["auto_renew"] > 0;
            var params = _buildStripeParams(planInfo, customerId, stripeInfo);
            var promiseList = [];
            //if(license["payment_type"] === "purchase_order"){
            //    promiseList.push(_switchToCreditCard.call(this, licenseId));
            //}
            if(!params.card){
                delete params.card;
            }
            promiseList.push(_updateStripeSubscription.call(this, customerId, subscriptionId, params, autoRenew));
            return when.all(promiseList);
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
            var promiseList = [{},{},{},{}];
            var updateFields = [];
            var packageType = "package_type = '" +  planInfo.type + "'";
            updateFields.push(packageType);
            var packageSizeTier = "package_size_tier = '" + planInfo.seats + "'";
            updateFields.push(packageSizeTier);
            if(promoCode){
                var promoCodeString = "promo = '" + planInfo.promoCode + "'";
                updateFields.push(promoCodeString);
            }
            promiseList[0] = this.myds.updateLicenseById(licenseId, updateFields);
            var seats = lConst.seats[planInfo.seats];
            var educatorSeats = seats.educatorSeats;
            promiseList[1] = this.updateEducatorSeatsRemaining(licenseId, educatorSeats);
            if(status === "student count"){
                var studentSeats = seats.studentSeats;
                promiseList[2] = this.updateStudentSeatsRemaining(licenseId, studentSeats);
            }
            promiseList[3] = this.myds.getInstructorsByLicense(licenseId);
            return when.all(promiseList);
        }.bind(this))
        .then(function(status){
            if(status === "po-id"){
                this.requestUtil.errorResponse(res, { key: "lic.order.pending"});
                return;
            }
            if(status === "downgrade seats"){
                this.requestUtil.errorResponse(res, { key: "lic.upgrade.invalid"});
                return;
            }
            if(typeof status === "string"){
                _errorLicensingAccess.call(this, res, status);
                return;
            }
            instructors = status[3];
            var licenseOwnerEmail = req.user.email;
            emailData.ownerName = req.user.firstName + " " + req.user.lastName;
            emailData.ownerFirstName = req.user.firstName;
            emailData.ownerLastName = req.user.lastName;
            _upgradeLicenseEmailResponse.call(this, licenseOwnerEmail, instructors, emailData, req.protocol, req.headers.host);
            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Upgrade License Error -",err);
            if(err.code === "card_declined"){
                this.requestUtil.errorResponse(res, { key: "lic.card.declined"});
                return;
            }
            if(err.code === "incorrect_cvc"){
                this.requestUtil.errorResponse(res, { key: "lic.card.cvc.incorrect"});
                return;
            }
            if(err.code === "expired_card"){
                this.requestUtil.errorResponse(res, { key: "lic.card.expired"});
                return;
            }
            if(err.code === "processing_error"){
                this.requestUtil.errorResponse(res, { key: "lic.card.processing.error"});
                return;
            }
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
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
    var expirationDate;
    _validateLicenseUpgradeTrial.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return _endLicense.call(this, userId, licenseId, true);
        }.bind(this))
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return _createSubscription.call(this, req, userId, stripeInfo, planInfo);
        }.bind(this))
        .then(function(results){
            if(typeof results === "string"){
                return results;
            }
            expirationDate = results.expirationDate;
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
            if(status === "email not in license"){
                this.requestUtil.errorResponse(res, { key: "lic.records.inconsistent"});
                return;
            }
            if(status === "po-pending"){
                this.requestUtil.errorResponse(res, {key:"lic.order.pending"});
                return;
            }
            if(typeof status === "string"){
                _errorLicensingAccess.call(this, res, status);
                return;
            }
            var licenseOwnerEmail = req.user.email;
            var data = {};
            data.firstName = req.user.firstName;
            data.lastName = req.user.lastName;
            //data.name = req.user.firstName + ' ' + req.user.lastName;
            data.subject = "Welcome to GlassLab Games Premium!";
            data.plan = lConst.plan[planInfo.type].name;
            data.seats = lConst.seats[planInfo.seats].size;
            data.expirationDate = expirationDate;
            var template = "owner-upgrade-trial";
            _sendEmailResponse.call(this, licenseOwnerEmail, data, req.protocol, req.headers.host, template);
            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Upgrade Trial License Error -",err);
            if(err.code === "card_declined"){
                this.requestUtil.errorResponse(res, { key: "lic.card.declined"});
                return;
            }
            if(err.code === "incorrect_cvc"){
                this.requestUtil.errorResponse(res, { key: "lic.card.cvc.incorrect"});
                return;
            }
            if(err.code === "expired_card"){
                this.requestUtil.errorResponse(res, { key: "lic.card.expired"});
                return;
            }
            if(err.code === "processing_error"){
                this.requestUtil.errorResponse(res, { key: "lic.card.processing.error"});
                return;
            }
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
        }.bind(this));
}

function validatePromoCode(req, res) {
    // Validate the user role as instructor
    if(!(req && req.user && req.user.id && req.user.role === "instructor")) {
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }

    // Verify a promo code was passed in
    var code;
    if( req.params &&
        req.params.code ) {
        code = req.params.code;
    }
    else {
        // no code was supplied
        this.requestUtil.errorResponse(res, {key: "lic.promoCode.missing"});
        return;
    }

    // Attempt to retrieve the associated "coupon" from Stripe
    this.serviceManager.stripe.retrieveCoupon( code )
        .then(function(coupon) {
            // sanitize the coupon and ensure it's valid
            // then only return the amount off and percent off
            var promoCodeInfo = {};
            if( coupon.valid == true ) {
                promoCodeInfo.id = coupon.id;
                promoCodeInfo.percent_off = coupon.percent_off;
                promoCodeInfo.amount_off = coupon.amount_off;
            }
            else {
                this.requestUtil.errorResponse(res, {key: "lic.promoCode.noMoreRedemptions"});
                return;
            }
            this.requestUtil.jsonResponse(res, promoCodeInfo);
        }.bind(this))
        .then(null, function(err) {
            console.error("Validate Promo Code Error -",err);
            this.requestUtil.errorResponse(res, {key: "lic.promoCode.invalid"});
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
    var plan;
    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return _cancelAutoRenew.call(this, userId, licenseId);
        }.bind(this))
        .then(function(results){
            if(results === "already cancelled"){
                this.requestUtil.errorResponse(res, { key: "lic.cancelled.already"});
                return;
            }
            if(typeof results === "string"){
                _errorLicensingAccess.call(this, res, results);
                return;
            }
            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Cancel License Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
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
            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Renew License Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
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
    var users;
    var rejectedTeachers = {};
    var plan;
    var seatsTier;
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
            license = license[0];
            var educatorSeatsRemaining = license["educator_seats_remaining"];
            if(teacherEmails.length > educatorSeatsRemaining){
                return "not enough seats";
            }
            if(license.active === 0 || license.active === false ){
                return "inactive license";
            }
            seatsTier = license["package_size_tier"];
            licenseSeats = lConst.seats[seatsTier].educatorSeats;
            plan = license["package_type"];
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
                if(teacher["SYSTEM_ROLE"] !== 'instructor' && teacher["SYSTEM_ROLE"] !== "manager"){
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
                promiseList[1] = this.myds.multiUpdateLicenseMapStatus(licenseId, teachersToUpdate, "pending");
            }
            return when.all(promiseList);
        }.bind(this))
        .then(function(status) {
            if (typeof status === "string" && status !== "reject all") {
                return status;
            }
            var promiseList = [];
            var rejectedIds = Object.keys(rejectedTeachers);
            promiseList.push(_grabInstructorsByType.call(this, existingTeachers, rejectedIds, createTeachers));
            promiseList.push(this.updateEducatorSeatsRemaining(licenseId, licenseSeats));
            return when.all(promiseList);
        }.bind(this))
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
            users = status[0];
            var approvedUsers = users[0];
            var approvedNonUsers = users[1];
            var rejectedEmails = users[2];

            var approvedTeachersOutput = [];
            approvedUsers.forEach(function(user){
                approvedTeachersOutput.push(user["EMAIL"]);
            });
            approvedNonUsers.forEach(function(user){
                approvedTeachersOutput.push(user["EMAIL"]);
            });
            var rejectedTeachersOutput = [];
            var email;
            _(rejectedTeachers).forEach(function(value, key){
                email = rejectedEmails[key];
                rejectedTeachersOutput.push([email, value]);
            });
            req.approvedTeachers = approvedTeachersOutput;
            req.rejectedTeachers = rejectedTeachersOutput;
            var ownerName = req.user.firstName + " " + req.user.lastName;
            var ownerFirstName = req.user.firstName;
            var ownerLastName = req.user.lastName;
            _addTeachersEmailResponse.call(this, ownerName, ownerFirstName, ownerLastName, approvedUsers, approvedNonUsers, plan, seatsTier, req.protocol, req.headers.host);
            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Add Teachers to License Error - ",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
        }.bind(this));
}

function setLicenseMapStatusToActive(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.user.licenseStatus === "pending" || req.user.licenseStatus === "po-received")){
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
            var userIdList = [userId];
            var statusField = "status = 'active'";
            var updateFields = [statusField];
            return this.myds.updateLicenseMapByLicenseInstructor(licenseId,userIdList,updateFields);
        }.bind(this))
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            req.user.licenseStatus = "active";
            return Util.updateSession(req);
        })
        .then(function(status){
            if(typeof status === "string"){
                _errorLicensingAccess.call(this, res, status);
                return;
            }
            this.requestUtil.jsonResponse(res, { status: "ok" }, 200);
        }.bind(this))
        .then(null, function(err){
            console.error("Set License Map Status to Active Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
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
    var emailData = {};
    if(licenseOwnerId !== userId){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }

    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return _removeInstructorFromLicense.call(this, licenseId, teacherEmail, licenseOwnerId, emailData);
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
            data.ownerName = emailData.ownerName;
            data.ownerFirstName = emailData.ownerFirstName;
            data.ownerLastName = emailData.ownerLastName;
            data.subject = "Your Access has Been Removed";
            data.teacherName = emailData.teacherName;
            data.teacherFirstName = emailData.teacherFirstName;
            data.teacherLastName = emailData.teacherLastName;
            data.plan = emailData.plan;
            var template = "educator-removed";
            _sendEmailResponse.call(this, teacherEmail, data, req.protocol, req.headers.host, template);
            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Remove Teacher From License Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
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
    var emailData = {};
    var emails;
    if(licenseOwnerId === userId){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(state){
            if(typeof state === "string"){
                return state;
            }
            return _removeInstructorFromLicense.call(this, licenseId, teacherEmail, licenseOwnerId, emailData);
        }.bind(this))
        .then(function(results){
            if(typeof results === "string"){
                return results;
            }
            emails = results;
            delete req.user.licenseId;
            delete req.user.licenseOwnerId;
            delete req.user.licenseStatus;
            delete req.user.paymentType;
            return Util.updateSession(req);
        })
        .then(function(status){
            if(status === "status not in license"){
                this.requestUtil.errorResponse(res, { key: "lic.records.inconsistent"});
                return;
            } else if(typeof status === "string"){
                _errorLicensingAccess.call(this, res, status);
                return;
            }
            var licenseOwnerEmail = emails[0];
            var data = {};
            data.ownerName = emailData.ownerName;
            data.ownerFirstName = emailData.ownerFirstName;
            data.ownerLastName = emailData.ownerLastName;
            data.subject = "An Educator Has Left Your License";
            data.teacherName = emailData.teacherName;
            data.teacherFirstName = emailData.teacherFirstName;
            data.teacherLastName = emailData.teacherLastName;
            data.plan = emailData.plan;
            var template = "owner-educator-left";
            _sendEmailResponse.call(this, licenseOwnerEmail, data, req.protocol, req.headers.host, template);
            this.requestUtil.jsonResponse(res, { status: 'success' });
        }.bind(this))
        .then(null, function(err){
            console.error("Teacher Leaves License Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
        }.bind(this));
}

function subscribeToLicensePurchaseOrder(req, res){
    if(!(req && req.user && req.user.id && req.user.role === "instructor")){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.body && req.body.purchaseOrderInfo && req.body.planInfo)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(req.user.licenseId){
        this.requestUtil.errorResponse(res, {key: "lic.create.denied"});
        return;
    }
    var userId = req.user.id;
    var purchaseOrderInfo = req.body.purchaseOrderInfo;
    var planInfo = req.body.planInfo;
    var action = "subscribe";

   _purchaseOrderSubscribe.call(this, userId, planInfo, purchaseOrderInfo, action)
       .then(function(licenseId){
           if(typeof licenseId === "string"){
               return licenseId;
           }
           req.user.licenseId = licenseId;
           req.user.licenseStatus = "po-pending";
           req.user.licenseOwnerId = userId;
           req.user.paymentType = "purchase-order";
           return Util.updateSession(req);
       })
       .then(function(status){
           if(status === "po-pending"){
               this.requestUtil.errorResponse(res, { key: "lic.order.pending"});
               return;
           }
           if(status === "already on license"){
               this.requestUtil.errorResponse(res, { key: "lic.create.denied"});
               return;
           }
           //email + conclusion stuff, go to dashboard
           // email here goes to accounting/mat
           // for now, i will send it to the billing email
           var emails = [];
           if(this.options.env === "prod"){
              emails.push("purchaseOrder@glasslabgames.org");
           } else{
              emails.push("ben@glasslabgames.org");
              emails.push("michael.mulligan@glasslabgames.org");
           }
           var data = {};
           _.merge(data, purchaseOrderInfo, planInfo);
           // template's data pipeline and desired variables needs scoping out
           data.subject = "Subscribe Purchase Order";
           var template = "accounting-order";
           _(emails).forEach(function(email){
                _sendEmailResponse.call(this, email, data, req.protocol, req.headers.host, template);
           }.bind(this));
           this.requestUtil.jsonResponse(res, { status: "ok"});
       }.bind(this))
       .then(null, function(err){
           console.error("Subscribe to License Purchase Order Error -",err);
           this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
       }.bind(this));
}

// if user is not on stripe, set up a customer account on stripe.
// if already on stripe, do nothing
function _createStripeCustomer(userId, params){
    return when.promise(function(resolve, reject){
        this.myds.getUserById(userId)
            .then(function(user){
                var customerId = user.customer_id;
                if(!customerId){
                    return this.serviceManager.stripe.createCustomer(params)
                }
            }.bind(this))
            .then(function(customer){
                if(customer){
                    var customerId = customer.id;
                    return this.myds.setCustomerIdByUserId(userId, customerId);
                }
            }.bind(this))
            .then(function(){
                resolve();
            })
            .then(null, function(err){
                console.error("Create Customer Id Error -",err);
                reject(err);
            });
    }.bind(this));
}

function _purchaseOrderSubscribe(userId, planInfo, purchaseOrderInfo, action){
    return when.promise(function(resolve, reject){
        var licenseId;
        //create stripe customer id
        //customerId = customer.id --> write to user table
        this.myds.getLicenseMapByUser(userId)
            .then(function(licenseMaps){
                var status = false;
                licenseMaps.some(function(license){
                    if(license.status === "po-pending"){
                        status = license.status;
                        return true;
                    }
                    if(action === "trial upgrade" && license.status !== null && license.status !== "active"){
                        status = "already on license";
                    }
                    if(action === "subscribe" && license.status !== null){
                        status = "already on license";
                    }
                });
                if(status){
                    return status;
                }
                var params = {
                    metadata: {
                        purchaseOrder: true
                    },
                    email: purchaseOrderInfo.email
                };
                return _createStripeCustomer.call(this, userId, params);
            }.bind(this))
            .then(function(status){
                if(typeof status === "string"){
                    return status;
                }
                var data = {};
                var date = new Date();

                date.setFullYear(date.getFullYear()+1);
                data.expirationDate = date.toISOString().slice(0, 19).replace('T', ' ');
                data.subscriptionId = null;
                data.purchaseOrder = true;
                return _createLicenseSQL.call(this, userId, planInfo, data);
            }.bind(this))
            .then(function(id){
                if(typeof id === "string"){
                    return id;
                }
                licenseId = id;
                //create entry in purchaseOrder table
                var values = _preparePurchaseOrderInsert(userId, licenseId, purchaseOrderInfo, action);
                //need to formalize table schema
                return this.myds.insertToPurchaseOrderTable(values);

            }.bind(this))
            .then(function(purchaseOrderId){
                if(typeof purchaseOrderId === "string"){
                    return purchaseOrderId;
                }
                //update license table with po id
                purchaseOrderId = "purchase_order_id = " + purchaseOrderId;
                var updateFields = [purchaseOrderId];
                var promiseList = [];
                promiseList.push(this.myds.updateLicenseById(licenseId, updateFields));
                promiseList.push(this.cbds.createLicenseStudentObject(licenseId));
                return when.all(promiseList);
            }.bind(this))
            .then(function(status){
                if(typeof status === "string"){
                    resolve(status);
                    return;
                }
                resolve(licenseId);
            })
            .then(null, function(err){
                console.error("Purchase Order Subscribe Error -",err);
                reject(err);
            });
    }.bind(this));
}

function _preparePurchaseOrderInsert(userId, licenseId, purchaseOrderInfo, action){
    var values = [];
    values.push(userId);
    values.push(licenseId);
    var status = "'pending'";
    values.push(status);
    var purchaseOrderNumber = "NULL";
    values.push(purchaseOrderNumber);
    var purchaseOrderKey = Util.CreateUUID();
    purchaseOrderInfo.key = purchaseOrderKey;
    purchaseOrderKey = "'" + purchaseOrderKey + "'";
    values.push(purchaseOrderKey);
    var phone = "'" + purchaseOrderInfo.phone + "'";
    values.push(phone);
    var email = "'" + purchaseOrderInfo.email + "'";
    values.push(email);
    var name;
    if(purchaseOrderInfo.lastName){
        name = purchaseOrderInfo.firstName + " " + purchaseOrderInfo.lastName;
    } else{
        name = purchaseOrderInfo.firstName;
    }
    purchaseOrderInfo.name = name;
    name = "'" + name + "'";
    values.push(name);
    var payment = "" + purchaseOrderInfo.payment;
    if(payment.indexOf(".") === -1){
        payment = purchaseOrderInfo.payment + ".00";
    }
    purchaseOrderInfo.payment = payment;
    payment = "'" + payment + "'";
    values.push(payment);
    action = "'" + action + "'";
    values.push(action);
    return values;
}

function upgradeTrialLicensePurchaseOrder(req, res){
    // do subscribe purchase order stuff
    if(!(req && req.user && req.user.id && req.user.role === "instructor")){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.body && req.body.purchaseOrderInfo && req.body.planInfo)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    var userId = req.user.id;
    var purchaseOrderInfo = req.body.purchaseOrderInfo;
    var planInfo = req.body.planInfo;
    var action = "trial upgrade";

    _purchaseOrderSubscribe.call(this, userId, planInfo, purchaseOrderInfo, action)
        .then(function(licenseId){
            if(typeof licenseId === "string"){
                return licenseId;
            }
            req.user.licenseId = licenseId;
            req.user.licenseStatus = "po-pending";
            req.user.licenseOwnerId = userId;
            req.user.paymentType = "purchase-order";
            return Util.updateSession(req);
        })
        .then(function(status){
            if(status === "po-pending"){
                this.requestUtil.errorResponse(res, { key: "lic.order.pending" });
                return;
            }
            if(status === "already on license"){
                this.requestUtil.errorResponse(res, { key: "lic.create.denied" });
                return;
            }
            //email + conclusion stuff, go to dashboard
            // email here goes to accounting/mat
            // for now, i will send it to the billing email
            var emails = [];
            if(this.options.env === "prod"){
                emails.push("purchaseOrder@glasslabgames.org");
            } else{
                emails.push("ben@glasslabgames.org");
                emails.push("michael.mulligan@glasslabgames.org");
            }
            var data = {};
            _.merge(data, purchaseOrderInfo, planInfo);
            // template's data pipeline and desired variables needs scoping out
            data.subject = "Upgrade Trial Purchase Order";
            // template's data pipeline and desired variables needs scoping out
            var template = "accounting-order";
            _(emails).forEach(function(email){
                _sendEmailResponse.call(this, email, data, req.protocol, req.headers.host, template);
            }.bind(this));
            this.requestUtil.jsonResponse(res, { status: "ok"});
        }.bind(this))
        .then(null, function(err){
            console.error("Upgrade Trial License Purchase Order Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
        }.bind(this));
    // email response
}

// no longer supporting purchase order upgrades
// also we would need to change this if we decided to use it again, details listed in below comment
function upgradeLicensePurchaseOrder(req, res){
    // do subscribe purchase order stuff
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.user.licenseStatus === "active" && req.user.licenseOwnerId === req.user.id && req.body.planInfo && req.body.purchaseOrderInfo)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    var userId = req.user.id;
    var licenseId = req.user.licenseId;
    var purchaseOrderInfo = req.body.purchaseOrderInfo;
    var planInfo = req.body.planInfo;
    var action = "upgrade";
    // validation stuff. if p.o. id defined, do not let upgrade (do this for cc too)
    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return this.myds.getLicenseById(licenseId);
        }.bind(this))
        .then(function(license){
            license = license[0];
            // we changed purchase order logic to leave the id there until a new one replaces it.
            // if we use this method again, we need to change the check to see if upgrade can occur
            if(license["purchase_order_id"] !== null){
                return "po-id";
            }
            // check if account most recently used cc
            if(license["payment_type"] === "credit-card"){
                return _switchToPurchaseOrder.call(this, userId, licenseId);
            }
        }.bind(this))
        .then(function(results){
            if(typeof results === "string"){
                return results;
            }
            // create purchase order row in sql
            var values = _preparePurchaseOrderInsert(userId, licenseId, purchaseOrderInfo, action);
            return this.myds.insertToPurchaseOrderTable(values);
        }.bind(this))
        .then(function(purchaseOrderId){
            if(typeof purchaseOrderId === "string"){
                return purchaseOrderId;
            }
            // update license table purchaseOrderId column
            purchaseOrderId = "purchase_order_id = " + purchaseOrderId;
            var updateFields = [purchaseOrderId];
            return this.myds.updateLicenseById(licenseId, updateFields);
        }.bind(this))
        .then(function(status){
            if(status === "po-id"){
                this.requestUtil.errorResponse(res, { key:"lic.order.pending"});
                return;
            }
            if(typeof status === "string"){
                _errorLicensingAccess.call(this, status);
                return;
            }
            // email and send current plan stuff
            // email here goes to accounting/mat
            // for now, i will send it to the billing email
            var email = purchaseOrderInfo.email;
            var data = {};
            _.merge(data, purchaseOrderInfo, planInfo);
            // template's data pipeline and desired variables needs scoping out
            data.subject = "Upgrade Purchase Order";
            // template's data pipeline and desired variables needs scoping out
            var template = "invoice-order";
            _sendEmailResponse.call(this, email, data, req.protocol, req.headers.host, template);
            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Upgrade License Purchase Order Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"});
        }.bind(this));
}

function getActivePurchaseOrderInfo(req, res){
    if(!(req && req.user && req.user.id && req.user.role === "instructor")){
        this.requestUtil.errorResponse(res, { key: "lic.access.invalid"});
        return;
    }
    var licenseId = req.user.licenseId;
    // get name, phone, email, and license status from purchase_order table
    this.myds.getLicenseById(licenseId)
        .then(function(results){
            var license = results[0];
            var purchaseOrderId = license["purchase_order_id"];
            if(purchaseOrderId === null){
                return "no purchase order";
            }
            return this.myds.getPurchaseOrderById(purchaseOrderId);
        }.bind(this))
        .then(function(purchaseOrder){
            if(!purchaseOrder || purchaseOrder === "no purchase order"){
                this.requestUtil.errorResponse(res, {key: "lic.order.absent"});
                return;
            }
            var output = {};
            output.name = purchaseOrder.name;
            output.phone = purchaseOrder.phone;
            output.email = purchaseOrder.email;
            if (purchaseOrder.status === 'pending') {
                output.status = 1;
            } else if (purchaseOrder.status === 'received' || purchaseOrder.status === 'rejected'|| purchaseOrder.status === 'invoiced') {
                output.status = 2;
            } else if (purchaseOrder.status === 'approved') {
                output.status = 3;
            }

            // send back up
            this.requestUtil.jsonResponse(res, output);
        }.bind(this))
        .then(null, function(err){
            console.error("Get Active Purchase Order Info Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"});
        }.bind(this));
}

function cancelActivePurchaseOrder(req, res){
    if(!(req && req.user && req.user.id && req.user.role === "instructor")){
        this.requestUtil.errorResponse(res, { key: "lic.access.invalid"});
        return;
    }
    var userId = req.user.id;
    var licenseId = req.user.licenseId;
    this.myds.getActivePurchaseOrderByUserId(userId)
        .then(function(purchaseOrder){
            if(purchaseOrder === "no active order"){
                return purchaseOrder;
            }
            if(purchaseOrder.status !== "pending"){
                return "invalid cancel";
            }
            var purchaseOrderId = purchaseOrder.id;

            return _updateTablesUponPurchaseOrderReject.call(this, userId, licenseId, purchaseOrderId, "cancelled", false, "cancel");
        }.bind(this))
        .then(function (status) {
            if (typeof status === "string") {
                return status;
            }
            delete req.user.licenseId;
            delete req.user.licenseStatus;
            delete req.user.licenseOwnerId;
            delete req.user.paymentType;
            return Util.updateSession(req);
        })
        .then(function(status){
            if(status === "no active order"){
                this.requestUtil.errorResponse(res, { key: "lic.order.absent"});
                return;
            }
            if(status === "invalid cancel"){
                this.requestUtil.errorResponse(res, { key: "lic.order.processing"});
                return;
            }
            this.requestUtil.jsonResponse(res, { status: "ok"});
        }.bind(this))
        .then(null, function(err){
            console.error("Cancel Active Purchase Order Error -",err);
            this.requestUtil.errorResponse(res, { key:"lic.general"});
        }.bind(this));
}

function setLicenseMapStatusToNull(req, res){
    if(!(req.user && req.user.licenseId && req.user.licenseStatus && req.user.licenseStatus === "po-rejected")){
        this.requestUtil.errorResponse(res, { key: "lic.access.invalid"});
        return;
    }
    var userId = req.user.id;
    var licenseId = req.user.licenseId;

    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            var userIdList = [req.user.id];
            var statusString = "status = NULL";
            var updateFields = [statusString];

            return this.myds.updateLicenseMapByLicenseInstructor(licenseId,userIdList,updateFields);
        }.bind(this))
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            delete req.user.licenseStatus;
            delete req.user.licenseId;
            delete req.user.licenseOwnerId;
            delete req.user.paymentType;
            return Util.updateSession(req);
        })
        .then(function(status){
            if(typeof status === "string"){
                _errorLicensingAccess.call(this, res, status);
            }
            this.requestUtil.jsonResponse(res, { status: "ok"});
        }.bind(this))
        .then(null, function(err){
            console.error("Set Instructor License Map Status To Null Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"});
        }.bind(this));
}

function rejectPurchaseOrder(req, res){
    // Only admins should be allowed to perform this operation
    if( req.user.role !== lConst.role.admin ) {
        this.requestUtil.errorResponse(res, "lic.access.invalid");
        return;
    }

    // validate inputs from matt, perhaps with code
    if(!(req.body && req.body.purchaseOrderInfo && req.body.planInfo)){
        this.requestUtil.errorResponse(res, "lic.access.invalid");
        return;
    }
    var purchaseOrderInfo = req.body.purchaseOrderInfo;
    var purchaseOrderNumber = purchaseOrderInfo.number;
    var purchaseOrderKey = purchaseOrderInfo.key;
    // an action could be upgrade, trial upgrade, subscribe, renew.
    var planInfo = req.body.planInfo;
    // two emails, license owner and billing email
    var licenseId;
    var userId;
    var action;
    var billingEmail;
    var billingName;

    // if legit, update license table, license map, and purchase order table
    this.myds.getPurchaseOrderByPurchaseOrderKey(purchaseOrderKey)
        .then(function(purchaseOrder){
            if(purchaseOrder === "no active order"){
                return purchaseOrder;
            }
            if(purchaseOrder.status !== "pending" && purchaseOrder.status !== "received" && purchaseOrder.status !== "invoiced"){
                return "cannot reject";
            }
            if((purchaseOrder.status === "received" || purchaseOrder.status === "invoiced") && purchaseOrder["purchase_order_number"] !== purchaseOrderNumber){
                return "key number mismatch";
            }
            var purchaseOrderId = purchaseOrder.id;
            licenseId = purchaseOrder["license_id"];
            userId = purchaseOrder["user_id"];
            action = purchaseOrder["action"];
            purchaseOrderInfo.action = action;
            billingEmail = purchaseOrder.email;
            billingName = purchaseOrder.name;

            return _updateTablesUponPurchaseOrderReject.call(this, userId, licenseId, purchaseOrderId, "rejected", purchaseOrderNumber, action);
        }.bind(this))
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            var subject = "Please Check Your Purchase Order";
            return _gatherPurchaseOrderEmailData.call(this, userId, licenseId, subject, billingName, billingEmail, planInfo, purchaseOrderInfo);
        }.bind(this))
        .then(function(results){
            if(results === "no active order"){
                this.requestUtil.errorResponse(res, { key: "lic.general"});
                return;
            }
            if(results === "cannot approve"){
                this.requestUtil.errorResponse(res, { key: "lic.order.action.denied"});
                return;
            }
            if(results === "key number mismatch"){
                this.requestUtil.errorResponse(res, { key: "lic.order.mismatch"});
                return;
            }
            // proper email response, depending on circumstance
            var ownerData = results[0];
            var billerData = results[1];
            // two emails, license owner and billing email
            var template = "owner-purchase-order-rejected";
            _sendEmailResponse.call(this, ownerData.email, ownerData, req.protocol, req.headers.host, template);
            _sendEmailResponse.call(this, billerData.email, billerData, req.protocol, req.headers.host, template);
            this.requestUtil.jsonResponse(res, { status: "ok"});
        }.bind(this))
        .then(null, function(err){
            console.error("Reject Purchase Order Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"});
        }.bind(this));
}

function receivePurchaseOrder(req, res){
    // Only admins should be allowed to perform this operation
    if( req.user.role !== lConst.role.admin ) {
        this.requestUtil.errorResponse(res, "lic.access.invalid");
        return;
    }

    // validate inputs from matt, perhaps with code
    if(!(req.body && req.body.purchaseOrderInfo && req.body.planInfo)){
        this.requestUtil.errorResponse(res, "lic.access.invalid");
        return;
    }
    var purchaseOrderInfo = req.body.purchaseOrderInfo;
    var purchaseOrderNumber = purchaseOrderInfo.number;
    var purchaseOrderKey = purchaseOrderInfo.key;
    var payment = purchaseOrderInfo.amount;
    var planInfo = req.body.planInfo;

    var licenseId;
    var userId;
    var action;
    var billingEmail;
    var billingName;
    var expirationDate;

    var purchaseOrderId;

    this.myds.getPurchaseOrderByPurchaseOrderKey(purchaseOrderKey)
        .then(function(purchaseOrder){
            if(purchaseOrder === "no active order"){
                return purchaseOrder;
            }
            if(purchaseOrder.status === "received"){
                return "already received";
            }
            if(purchaseOrder.status !== "pending"){
                return "cannot receive";
            }
            purchaseOrderId = purchaseOrder.id;
            billingEmail = purchaseOrder.email;
            userId = purchaseOrder["user_id"];
            licenseId = purchaseOrder["license_id"];
            billingName = purchaseOrder["name"];
            action = purchaseOrder["action"];
            purchaseOrderInfo.action = action;
            if(action !== "upgrade"){
                var date = new Date(Date.now());
                date.setFullYear(date.getFullYear()+1);
                expirationDate = date.toISOString().slice(0, 19).replace('T', ' ');
            }
            var updateFields = [];
            var status = "status = 'received'";
            updateFields.push(status);
            var number = "purchase_order_number = '" + purchaseOrderNumber + "'";
            updateFields.push(number);
            var paymentAmount = "payment = '" + payment + "'";
            updateFields.push(paymentAmount);
            return this.myds.updatePurchaseOrderById(purchaseOrderId, updateFields);
        }.bind(this))
        .then(function(state){
            if(typeof state === "string"){
                return state;
            }
            if(action === "subscribe"){
                return _receivedSubscribePurchaseOrder.call(this, userId, licenseId, planInfo, expirationDate);
            }
            if(action === "trial upgrade"){
                return _receivedTrialUpgradePurchaseOrder.call(this, userId, licenseId, planInfo, expirationDate);
            }
            // not currently supported
            //if(action === "upgrade"){
            //    // problem: if we let them upgrade, but then payment does not go through, how do we know what their old plan was?
            //    //put info in purchase order table
            //    return _receivedUpgradePurchaseOrder.call(this, userId, licenseId, planInfo, purchaseOrderId);
            //}
            // need to make renew eventually
            //if(action === "renew"){
            //    return _receivedRenewPurchaseOrder.call(this);
            //}
            return "invalid action";
        }.bind(this))
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            var subject = "Your Purchase Order has Been Received";
            return _gatherPurchaseOrderEmailData.call(this, userId, licenseId, subject, billingName, billingEmail, planInfo, purchaseOrderInfo);
        }.bind(this))
        .then(function(results){
            if(results === "no active order"){
                this.requestUtil.errorResponse(res, { key: "lic.order.absent"});
                return;
            }
            if(results === "invalid action"){
                this.requestUtil.errorResponse(res, { key: "lic.action.invalid"});
                return;
            }
            if(results === "invalid records"){
                this.requestUtil.errorResponse(res, { key: "lic.records.inconsistent"});
                return;
            }
            if(results === "already received"){
                this.requestUtil.errorResponse(res, { key: "lic.order.received.already"});
                return;
            }
            if(results === "cannot receive"){
                this.requestUtil.errorResponse(res, { key: "lic.order.action.denied"});
                return;
            }
            var ownerData = results[0];
            var billerData = results[1];
            // two emails, license owner and billing email
            var template = "owner-purchase-order-received";
            _sendEmailResponse.call(this, ownerData.email, ownerData, req.protocol, req.headers.host, template);
            _sendEmailResponse.call(this, billerData.email, billerData, req.protocol, req.headers.host, template);
            if(this.options.env === "prod"){
                var email = "meghan@glasslabgames.org";
                var data = {};
                data.key = purchaseOrderKey;
                data.number = purchaseOrderNumber;
                template = "accounting-received";
                _sendEmailResponse.call(this, email, data, req.protocol, req.headers.host, template);
            }
            this.requestUtil.jsonResponse(res, { status: "ok "});
        }.bind(this))
        .then(null, function(err){
            console.error("Received Purchase Order Error -",err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function _receivedSubscribePurchaseOrder(userId, licenseId, planInfo, expirationDate){
    return when.promise(function(resolve, reject) {
        var updateFields = [];
        var active = "active = 1";
        updateFields.push(active);
        var seats = "package_size_tier = '" + planInfo.seats + "'";
        updateFields.push(seats);
        var educatorSeatsRemaining = "educator_seats_remaining = " + lConst.seats[planInfo.seats].educatorSeats;
        updateFields.push(educatorSeatsRemaining);
        var studentSeatsRemaining = "student_seats_remaining = " + lConst.seats[planInfo.seats].studentSeats;
        updateFields.push(studentSeatsRemaining);
        var plan = "package_type = '" + planInfo.type + "'";
        updateFields.push(plan);
        var expirationDateString = "expiration_date = '" + expirationDate + "'";
        updateFields.push(expirationDateString);

        this.myds.updateLicenseById(licenseId, updateFields)
            .then(function () {
                var updateFields = [];
                var status = "status = 'po-received'";
                updateFields.push(status);
                return this.myds.updateLicenseMapByLicenseInstructor(licenseId, [userId], updateFields);
            }.bind(this))
            .then(function(){
                resolve();
            })
            .then(null, function(err){
                console.error("Received Subscribe Purchase Order Error -",err);
                reject(err);
            });
    }.bind(this));
}

function _receivedTrialUpgradePurchaseOrder(userId, licenseId, planInfo, expirationDate){
    return when.promise(function(resolve, reject){
        this.myds.getLicenseMapByUser(userId)
            .then(function(results){
                var license = results[0];
                var trialLicenseId = license.id;
                if(trialLicenseId >= licenseId){
                    return "invalid records";
                }
                if(license.status === "active"){
                    return _endLicense.call(this, userId, trialLicenseId);
                }
            }.bind(this))
            .then(function(status){
                if(status === "invalid records"){
                    return status;
                }
                return _receivedSubscribePurchaseOrder.call(this, userId, licenseId, planInfo, expirationDate);
            }.bind(this))
            .then(function(status){
                if(status === "invalid records"){
                    resolve(status);
                }
                resolve();
            }.bind(this))
            .then(null, function(err){
                console.error("Received Trial Upgrade Purchase Order -",err);
                reject(err);
            });
    }.bind(this));
}

// upgrade email seems fairly different.  how do?
function _receivedUpgradePurchaseOrder(userId, licenseId, planInfo, purchaseOrderId){
    return when.promise(function(resolve, reject){
        var plan = planInfo.type;
        var status;
        _unassignCoursesWhenUpgrading.call(this, licenseId, plan)
            .then(function(results){
                if(results === "student count"){
                    status = results;
                }
                return this.myds.getLicenseById(licenseId);
            }.bind(this))
            .then(function(license){
                license = license[0];
                var oldPlan = "current_package_type = '" + license["package_type"] + "'";
                var oldSeats = "current_package_size_tier = '" + license["package_size_tier"] + "'";
                var updateFields = [oldPlan, oldSeats];
                return this.myds.updatePurchaseOrderById(purchaseOrderId, updateFields);
            }.bind(this))
            .then(function(){
                var promiseList = [{},{},{},{}];
                var updateFields = [];
                var packageSize = "package_size_tier = '" + planInfo.seats + "'";
                updateFields.push(packageSize);
                var packageType = "package_type = '" + plan + "'";
                updateFields.push(packageType);
                promiseList[0] = this.myds.updateLicenseById(licenseId, updateFields);

                var seats = lConst.seats[planInfo.seats];
                var educatorSeats = seats.educatorSeats;
                promiseList[1] = this.updateEducatorSeatsRemaining(licenseId, educatorSeats);

                if(status === "student count"){
                    var studentSeats = seats.studentSeats;
                    promiseList[2] = this.updateStudentSeatsRemaining(licenseId, studentSeats);
                }
                var lmUpdateFields = ["status = 'po-received'"];
                promiseList[3] = this.myds.updateLicenseMapByLicenseInstructor(licenseId, [userId], lmUpdateFields);
                //promiseList[4] = this.myds.getInstructorsByLicense(licenseId);
                return when.all(promiseList);
            }.bind(this))
            .then(function(){
                resolve();
            }.bind(this))
            .then(null, function(err){
                console.error("Received Upgrade Purchase Order -",err);
                reject(err);
            });
    }.bind(this));
}

function invoicePurchaseOrder(req, res){
    // Only admins should be allowed to perform this operation
    if( req.user.role !== lConst.role.admin ) {
        this.requestUtil.errorResponse(res, "lic.access.invalid");
        return;
    }

    // validate with code
    if(!(req.body && req.body.purchaseOrderInfo && req.body.planInfo)){
        this.requestUtil.errorResponse(res, "lic.access.invalid");
        return;
    }
    var purchaseOrderInfo = req.body.purchaseOrderInfo;
    var purchaseOrderKey = purchaseOrderInfo.key;
    var purchaseOrderNumber = purchaseOrderInfo.number;
    var planInfo = req.body.planInfo;

    var licenseId;
    var userId;
    var billingEmail;
    var billingName;

    this.myds.getPurchaseOrderByPurchaseOrderKey(purchaseOrderKey)
        .then(function(purchaseOrder){
            if(purchaseOrder === "no active order"){
                return purchaseOrder;
            }
            if(purchaseOrder.status !== "received"){
                return "cannot approve";
            }
            if(purchaseOrder["purchase_order_number"] !== purchaseOrderNumber){
                return "key number mismatch";
            }
            var purchaseOrderId = purchaseOrder.id;

            var updateFields = [];
            var status = "status = 'invoiced'";
            updateFields.push(status);
            return this.myds.updatePurchaseOrderById(purchaseOrderId, updateFields);
        }.bind(this))
        .then(function(status){
            if(status === "no active order"){
                this.requestUtil.errorResponse(res, { key: "lic.order.absent"});
                return;
            }
            if(status === "cannot approve"){
                this.requestUtil.errorResponse(res, { key: "lic.order.action.denied"});
                return;
            }
            if(status === "key number mismatch"){
                this.requestUtil.errorResponse(res, { key: "lic.order.mismatch"});
                return;
            }
            this.requestUtil.jsonResponse(res, { status: "ok"});
        }.bind(this))
        .then(null, function(err){
            console.error("Invoice Purchase Order Error -",err);
            this.requestUtil.errorReponse(res, err);
        }.bind(this));
}

function approvePurchaseOrder(req, res){
    // Only admins should be allowed to perform this operation
    if( req.user.role !== lConst.role.admin ) {
        this.requestUtil.errorResponse(res, "lic.access.invalid");
        return;
    }

    // validate with code
    if(!(req.body && req.body.purchaseOrderInfo && req.body.planInfo)){
        this.requestUtil.errorResponse(res, "lic.access.invalid");
        return;
    }
    var purchaseOrderInfo = req.body.purchaseOrderInfo;
    var purchaseOrderKey = purchaseOrderInfo.key;
    var purchaseOrderNumber = purchaseOrderInfo.number;
    var planInfo = req.body.planInfo;

    var licenseId;
    var userId;
    var billingEmail;
    var billingName;

    this.myds.getPurchaseOrderByPurchaseOrderKey(purchaseOrderKey)
        .then(function(purchaseOrder){
            if(purchaseOrder === "no active order"){
                return purchaseOrder;
            }
            if(purchaseOrder.status !== "invoiced"){
                return "cannot approve";
            }
            if(purchaseOrder["purchase_order_number"] !== purchaseOrderNumber){
                return "key number mismatch";
            }
            var purchaseOrderId = purchaseOrder.id;
            billingEmail = purchaseOrder.email;
            billingName = purchaseOrder.name;
            userId = purchaseOrder.user_id;
            purchaseOrderInfo.action = purchaseOrder.action;

            licenseId = purchaseOrder.license_id;
            var updateFields = [];
            var status = "status = 'approved'";
            updateFields.push(status);
            return this.myds.updatePurchaseOrderById(purchaseOrderId, updateFields);
        }.bind(this))
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            var subject = "Your Purchase Order has Been Approved";
            return _gatherPurchaseOrderEmailData.call(this, userId, licenseId, subject, billingName, billingEmail, planInfo, purchaseOrderInfo);
        }.bind(this))
        .then(function(results){
            if(results === "no active order"){
                this.requestUtil.errorResponse(res, { key: "lic.order.absent"});
                return;
            }
            if(results === "cannot approve"){
                this.requestUtil.errorResponse(res, { key: "lic.order.action.denied"});
                return;
            }
            if(results === "key number mismatch"){
                this.requestUtil.errorResponse(res, { key: "lic.order.mismatch"});
                return;
            }
            var ownerData = results[0];
            var billerData = results[1];
            // two emails, license owner and billing email
            var template = "owner-purchase-order-approved";
            _sendEmailResponse.call(this, ownerData.email, ownerData, req.protocol, req.headers.host, template);
            _sendEmailResponse.call(this, billerData.email, billerData, req.protocol, req.headers.host, template);
            this.requestUtil.jsonResponse(res, { status: "ok"});
        }.bind(this))
        .then(null, function(err){
            console.error("Approve Purchase Order Error -",err);
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}

function _buildPurchaseOrderEmailData(subject, name, firstName, lastName, expirationDate, planInfo, purchaseOrderInfo){
    var data = {};
    data.subject = subject;
    data.name = name;
    data.firstName = firstName;
    data.lastName = lastName;
    data.expirationDate = expirationDate;
    data.seats = planInfo.seats;
    data.plan = planInfo.type;
    data.purchaseOrderNumber = purchaseOrderInfo.number;
    data.payment = purchaseOrderInfo.payment;
    return data;
}

function _gatherPurchaseOrderEmailData(userId, licenseId, subject, billingName, billingEmail, planInfo, purchaseOrderInfo){
    return when.promise(function(resolve, reject) {
        var promiseList = [];
        promiseList.push(this.myds.getUserById(userId));
        promiseList.push(this.myds.getLicenseById(licenseId));
        when.all(promiseList)
            .then(function(results){
                var user = results[0];
                var ownerFirstName = user["FIRST_NAME"];
                var ownerLastName = user["LAST_NAME"];
                var ownerName = user["FIRST_NAME"] + " " + user["LAST_NAME"];
                var ownerEmail = user["EMAIL"];
                var license = results[1][0];
                var expirationDate = license["expiration_date"];
                var ownerData = _buildPurchaseOrderEmailData(subject, ownerName, ownerFirstName, ownerLastName, expirationDate, planInfo, purchaseOrderInfo);
                var billerData = _buildPurchaseOrderEmailData(subject, billingName, billingName, false, expirationDate, planInfo, purchaseOrderInfo);
                ownerData.email = ownerEmail;
                billerData.email = billingEmail;
                resolve([ownerData, billerData]);
            })
            .then(null, function(err){
                console.error("Gather Purchase Order Email Data Error -",err);
                reject(err);
            });
    }.bind(this));
}

function _updateTablesUponPurchaseOrderReject(userId, licenseId, purchaseOrderId, status, purchaseOrderNumber, action){
    return when.promise(function(resolve, reject){
        var updateFields = [];
        var statusUpdate = "status = '" + status + "'";
        updateFields.push(statusUpdate);
        if(purchaseOrderNumber){
            purchaseOrderNumber = "purchase_order_number = '" + purchaseOrderNumber + "'";
            updateFields.push(purchaseOrderNumber);
        }
        this.myds.updatePurchaseOrderById(purchaseOrderId, updateFields)
            .then(function(){
                return _endLicense.call(this, userId, licenseId);
                //var active = "active = 0";
                //var purchaseOrderIdString = "purchase_order_id = NULL";
                //var licenseUpdateFields = [active, purchaseOrderIdString];
                //var licenseMapStatus;
                //if(status === "rejected"){
                //    licenseMapStatus = "status = 'po-rejected'";
                //} else{
                //    licenseMapStatus = "status = NULL";
                //}
                //var licenseMapUpdateFields = [licenseMapStatus];
                //var promiseList = [];
                //promiseList.push(this.myds.updateLicenseByPurchaseOrderId(purchaseOrderId, licenseUpdateFields));
                //if(action === "subscribe" || action === "trial upgrade" || action === "cancel"){
                //    //var statuses = ["'po-pending'", "'po-received'", "'active'"];
                //    promiseList.push(this.myds.updateRecentLicenseMapByUserId(userId, licenseMapUpdateFields));
                //}
                //return when.all(promiseList);
            }.bind(this))
            .then(function(){
                if(status === "rejected"){
                    var licenseMapStatus = "status = 'po-rejected'";
                    var updateFields = [licenseMapStatus];
                    return this.myds.updateRecentLicenseMapByUserId(userId, updateFields);
                }
            }.bind(this))
            .then(function(){
                resolve();
            })
            .then(null, function(err){
                console.error("Reject Purchase Order Request Error -",err);
                reject(err);
            }.bind(this));
    }.bind(this));
}

function _switchToPurchaseOrder(userId, licenseId){
    return when.promise(function(resolve, reject){
    // cancel auto renew
    _cancelAutoRenew.call(this, userId, licenseId)
        .then(function(){
            var paymentType = "payment_type = 'purchase-order'";
            var autoRenew = "auto_renew = 0";
            var updateFields = [paymentType, autoRenew];
            // update license table
            return this.myds.updateLicenseById(licenseId, updateFields);
        }.bind(this))
        .then(function(){
            req.user.paymentType = "purchase-order";
            return Util.updateSession(req);
        })
        .then(function(){
            resolve();
        })
        .then(null, function(err){
            console.error("Switch to Purchase Order Error -",err);
            reject(err);
        });
    }.bind(this));
}

function _switchToCreditCard(licenseId){
    return when.promise(function(resolve, reject){
        var paymentType = "payment_type = 'credit-card'";
        var autoRenew = "auto_renew = 1";
        var updateFields = [paymentType, autoRenew];
        // update license table
        this.myds.updateLicenseById(licenseId, updateFields)
            .then(function(){
                req.user.paymentType = "credit-card";
                return Util.updateSession(req);
            })
            .then(function(){
                resolve();
            }.bind(this))
            .then(null, function(err){
                console.error("Switch to Credit Card Error -",err);
                reject(err);
            });
    }.bind(this));
}

// to give existing instructors 1 year of premium access when we launch licensing
function migrateToTrialLegacy(req, res){
    // Only admins should be allowed to perform this operation
    if( req.user.role !== lConst.role.admin ) {
        this.requestUtil.errorResponse(res, "lic.access.invalid");
        return;
    }
    var planInfo = {
        type: "trialLegacy",
        seats: "school"
    };
    var stripeInfo = {};
    var instructors;
    var failures;
    var index = 0;
    failures = {};
    this.myds.getAllInstructorsNonCustomers()
        .then(function(results){
            instructors = results;
            function _subscribeInstructor(input, userId, stripeInfo, planInfo){
                return when.promise(function(resolve, reject){
                    _createSubscription.call(this, input, userId, stripeInfo, planInfo)
                        .then(function(status){
                            if(status === "duplicate customer account"){
                                failures[input.user.id] = "lic.records.invalid";
                                return;
                            }
                            if(status === "account inactive"){
                                failures[input.user.id] = "lic.account.inactive";
                                return;
                            }
                            if(status === "po-pending"){
                                failures[input.user.id] = "lic.order.pending";
                                return;
                            }
                            if(status === "already on a license"){
                                failures[input.user.id] = "lic.access.invited";
                                return;
                            }
                            var email = input.user["EMAIL"];
                            var template = "owner-legacy-trial";
                            var data = {};
                            data.firstName = input.user["FIRST_NAME"];
                            data.lastName = input.user["LAST_NAME"];
                            data.subject = "Welcome to Glass Lab Premium!";
                            return _sendEmailResponse.call(this, email, data, req.protocol, req.headers.host, template);
                        }.bind(this))
                        .then(function(){
                            resolve()
                        })
                        .then(null, function(err){
                            console.error("Create Trial Legacy User Error -", err);
                            err.errorUserId = userId;
                            err.instructors = instructors;
                            err.index = index;
                            reject(err);
                        });
                }.bind(this));
            }
            var _subscribeInstructor = _subscribeInstructor.bind(this);
            var promiseList = [];
            instructors.forEach(function(instructor){
                var input = {};
                input.user = instructor;
                var userId = instructor.id;
                promiseList.push(_subscribeInstructor(input, userId, stripeInfo, planInfo));
            }.bind(this));
            return when.reduce(promiseList, function(index, result){
                index++;
                return index;
            }, index);
        }.bind(this))
        .then(function(){
            var keys = Object.keys(failures);
            if(keys.length > 0){
                this.requestUtil.jsonResponse(res, { status: "failed", failures: failures });
                return;
            }
            this.requestUtil.jsonResponse(res, { status: "ok" });
        }.bind(this))
        .then(null, function(err){
            console.error("Migrate to Trial Legacy Error -",err);
            this.requestUtil.errorResponse(res, err, 500);
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

function _createSubscription(req, userId, stripeInfo, planInfo){
    return when.promise(function(resolve, reject){
        var email = req.user.email;
        var name = req.user.firstName + " " + req.user.lastName;
        var expirationDate;
        this.myds.getLicenseMapByUser(userId)
            .then(function(licenseMaps){
                var status = false;
                licenseMaps.some(function(map){
                    if(map.status !== null){
                        if(map.status === "po-pending"){
                            status = map.status;
                            return true;
                        }
                        status = "already on a license";
                        return true;
                    }

                });
                if(!!status){
                    return status;
                }
                return _carryOutStripeTransaction.call(this, userId, email, name, stripeInfo, planInfo);
            }.bind(this))
            .then(function(stripeData){
                if(typeof stripeData === "string"){
                    return stripeData;
                }
                expirationDate = stripeData.expirationDate;
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
                if(typeof state === "string"){
                    resolve(state);
                }
                resolve({"expirationDate": expirationDate});
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
        var existingCustomer;
        var output;
        var stripeOutput;
        var subscription;
        var subscriptionId;
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
            .then(function(results){
                stripeOutput = results;
                if(!customerId){
                    existingCustomer = false;
                    customerId = stripeOutput.id;
                    subscription = stripeOutput.subscriptions.data[0];
                } else{
                    existingCustomer = true;
                    subscription = stripeOutput;
                }
                subscriptionId = subscription.id;
                return this.serviceManager.stripe.cancelSubscription(customerId, subscriptionId);
            }.bind(this))
            .then(function(results) {
                // results could be either a new customer object, or a new subscription object. deal with both.
                output = {};
                output.customerId = customerId;
                if(subscription && (subscription.status === "active" || subscription.status === "trialing")){
                    output.subscriptionId = subscriptionId;
                    var msDate = subscription["current_period_end"] * 1000;
                    output.expirationDate = new Date(msDate).toISOString().slice(0, 19).replace('T', ' ');
                } else{
                    output = "account inactive";
                }
                if(!existingCustomer){
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
    var baseStripeQuantity = lConst.plan[plan].pricePerSeat * lConst.seats[seats].studentSeats;
    var discountRate = lConst.seats[seats].discount;
    var stripeQuantity = Math.round(baseStripeQuantity - baseStripeQuantity*discountRate/100);
    var params = {};
    params.card = card;
    params.plan = stripePlan;
    params.quantity = stripeQuantity;

    // Attach the coupon if it exists
    if( stripeInfo.coupon ) {
        params.coupon = stripeInfo.coupon;
    }

    if(!customerId){
        var description = "Customer for " + name;
        params.email = email;
        params.description = description;
    }
    return params;
}

function _createLicenseSQL(userId, planInfo, data){
    return when.promise(function(resolve, reject){
        var seatsTier = planInfo.seats;
        var type = "'" + planInfo.type + "'";
        var licenseKey;
        if(planInfo.licenseKey){
            licenseKey = "'" + planInfo.licenseKey + "'";
        } else{
            licenseKey = "NULL";
        }
        var promo;
        if(planInfo.promoCode){
            promo = "'" + planInfo.promoCode + "'";
        } else{
            promo = "NULL";
        }
        var expirationDate = "'" + data.expirationDate + "'";
        var educatorSeatsRemaining = lConst.seats[seatsTier].educatorSeats;
        var studentSeatsRemaining = lConst.seats[seatsTier].studentSeats;
        seatsTier = "'" + seatsTier + "'";
        var subscriptionId;
        if(!data.subscriptionId){
            subscriptionId = "NULL";
        } else{
            subscriptionId = "'" + data.subscriptionId + "'";
        }
        var active;
        var autoRenew = 0;
        var paymentType;
        if(data.purchaseOrder){
            active = 0;
            paymentType = "'purchase-order'";
        } else{
            active = 1;
            paymentType = "'credit-card'";
        }
        var values = [];
        values.push(userId);
        values.push(licenseKey);
        values.push(type);
        values.push(seatsTier);
        values.push(expirationDate);
        values.push(active);
        values.push(educatorSeatsRemaining);
        values.push(studentSeatsRemaining);
        values.push(promo);
        values.push(subscriptionId);
        values.push(autoRenew);
        values.push(paymentType);
        var licenseId;
        this.myds.insertToLicenseTable(values)
            .then(function(insertId){
                licenseId = insertId;
                values = [];
                values.push(userId);
                values.push(licenseId);
                if(data.purchaseOrder){
                    values.push("'po-pending'");
                } else{
                    values.push("'active'");
                }
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

function _updateStripeSubscription(customerId, subscriptionId, params, autoRenew){
    return when.promise(function(resolve, reject){
        var invoice;
        this.serviceManager.stripe.updateSubscription(customerId, subscriptionId, params)
            .then(function(){
                return this.serviceManager.stripe.chargeInvoice(customerId);
            }.bind(this))
            .then(function(result){
                invoice = result;
                // do we store this invoice data anywhere?
                if(!autoRenew){
                    return this.serviceManager.stripe.cancelSubscription(customerId, subscriptionId);
                }
            }.bind(this))
            .then(function(){
                resolve()
            })
            .then(null, function(err){
                console.error("Upgrade Stripe Subscription Error -",err);
                reject(err);
            }.bind(this));
    }.bind(this));
}

function _unassignCoursesWhenUpgrading(licenseId, plan){
    return when.promise(function(resolve, reject){
        var status;
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
                var dashService = this.serviceManager.get("dash").service;
                promiseList.push(dashService.getListOfAllFreeGameIds());
                var dataService = this.serviceManager.get("data").service;
                courseIds.forEach(function(courseId){
                    promiseList.push(dataService.cbds.getGamesForCourse(courseId));
                });
                return when.all(promiseList);
            }.bind(this))
            .then(function(results){
                var freeGames = {};
                var freeGameIds = results[0];
                freeGameIds.forEach(function(gameId){
                    freeGames[gameId] = true;
                });
                var courseGames = results.slice(1);
                courseGames.forEach(function(course){
                    _(course).some(function(gameId){
                        if(!freeGames[gameId]){
                            course.premiumCourse = true;
                            return true;
                        }
                    });
                });
                var assignCourseGames = {};
                var assignGames;
                var unassignCourseIds = [];
                var unassignCourse;
                courseGames.forEach(function(course, index){
                    if(course.premiumCourse){
                        delete course.premiumCourse;
                        unassignCourse = false;
                        assignGames = false;
                        _(course).some(function(value, key){
                            if(!availableGames[key] && value.assigned){
                                unassignCourse = true;
                                return true;
                            }
                            if(availableGames[key] && !value.assigned){
                                value.assigned = true;
                                assignGames = true;
                            }
                        });
                        if(unassignCourse){
                            unassignCourseIds.push(courseIds[index]);
                        } else if(assignGames){
                            assignCourseGames[courseIds[index]] = course;
                        }
                    }
                });
                var promiseList = [{}];
                if(unassignCourseIds.length === 0){
                    status = "student count";
                } else{
                    promiseList[0] = this.unassignPremiumCourses(unassignCourseIds, licenseId);
                }
                var lmsService = this.serviceManager.get("lms").service;
                _(assignCourseGames).forEach(function(course, courseId){
                    promiseList.push(lmsService.updateCBLMSInEnabledCourse(courseId, course));
                });
                return when.all(promiseList);
            }.bind(this))
            .then(function(){
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

function _endLicense(userId, licenseId, autoRenew){
    return when.promise(function(resolve, reject){
        var emailList;
        var promise;
        if(autoRenew){
            promise = _cancelAutoRenew.call(this, userId, licenseId);
        } else{
            promise = Util.PromiseContinue();
        }
        promise
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
                    promiseList.push(_removeInstructorFromLicense.call(this, licenseId, [educator["email"]], userId, {}, users));
                }.bind(this));

                return when.reduce(promiseList, function(results, emails){
                    results.push(emails);
                    return results;
                }, []);
            }.bind(this))
            .then(function(emails){
                if(typeof emails === "string"){
                    return emails;
                }
                if(emails.length === 0){

                }
                emailList = [emails[0][0]];
                emails.forEach(function(email){
                    if(email[1]){
                        emailList.push(email[1]);
                    }
                });
                var active = "active = 0";
                var purchaseOrderId = "purchase_order_id = NULL";
                var updateFields = [active, purchaseOrderId];
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

function _grabInstructorsByType(approvedUserIds, rejectedUserIds, approvedNonUserEmails){
    return when.promise(function(resolve, reject){
        var promiseList = [[],[], []];
        if(approvedUserIds.length > 0){
            promiseList[0] = this.myds.getUsersByIds(approvedUserIds);
        }
        if(approvedNonUserEmails.length > 0){
            promiseList[1] = this.myds.getUsersByEmail(approvedNonUserEmails);
        }
        if(rejectedUserIds.length > 0){
            promiseList[2] = this.myds.getUsersByIds(rejectedUserIds);
        }
        return when.all(promiseList)
            .then(function(results){
                var output = [];
                var emails = [];
                var approvedUsers = results[0];
                output.push(approvedUsers);
                var approvedNonUsers= results[1];
                output.push(approvedNonUsers);
                var rejectedUsers = results[2];
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

function _removeInstructorFromLicense(licenseId, teacherEmail, licenseOwnerId, emailData, instructors){
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
                emailData.plan = license["package_type"];
                return this.myds.getCoursesByInstructor(teacherId);
                //find out which premium courses that instructor is a part of
                //lock each of those premium courses (with utility method)
            }.bind(this))
            .then(function(courseIds){
                if(courseIds === "email not in license"){
                    return courseIds;
                }
                if(Array.isArray(courseIds) && courseIds.length > 0){
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
                        emailData.ownerName = user["FIRST_NAME"] + " " + user["LAST_NAME"];
                        emailData.ownerFirstName = user["FIRST_NAME"];
                        emailData.ownerLastName = user["LAST_NAME"];
                    } else{
                        teacherEmail = user["EMAIL"];
                        emailData.teacherName = user["FIRST_NAME"] + " " + user["LAST_NAME"];
                        emailData.teacherFirstName = user["FIRST_NAME"];
                        emailData.teacherLastName = user["LAST_NAME"];
                        if(emailData.teacherFirstName === "temp" && emailData.teacherLastName === "temp"){
                            emailData.teacherFirstName = user["EMAIL"];
                            delete emailData.teacherLastName;
                        }
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

function _validateLicenseUpgradeTrial(userId, licenseId) {
    return when.promise(function (resolve, reject) {
        this.myds.getLicenseMapByUser(userId)
            .then(function (results) {
                var state;
                var activePendingResults = [];
                results.some(function(map){
                    if(map.status === "active" || map.status === "pending"){
                        activePendingResults.push(map);
                    } else if(map.status === "po-pending"){
                        state = "po-pending";
                        return true;
                    }
                }.bind(this));
                if(state === "po-pending"){
                    resolve(state);
                    return;
                }
                if (activePendingResults.length === 0) {
                    state = "access absent";
                } else if (activePendingResults.length > 1) {
                    state = "invalid records";
                } else if (activePendingResults[0]['license_id'] !== licenseId) {
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
        this.requestUtil.errorResponse(res, {key: "lic.access.absent"});
    } else if(status === "invalid records"){
        this.requestUtil.errorResponse(res, {key: "lic.records.invalid"});
    } else if (status === "inconsistent"){
        this.requestUtil.errorResponse(res, {key: "lic.records.inconsistent"});
    } else{
        console.trace('unexpected error status:' + status);
        this.requestUtil.errorResponse(res, {key: "lic.general"}, 500);
    }
}

function _upgradeLicenseEmailResponse(licenseOwnerEmail, instructors, data, protocol, host){
    var ownerTemplate = "owner-upgrade";
    var educatorTemplate = "educator-upgrade";
    var emailData;
    var email;
    var template;
    instructors.forEach(function(user){
        emailData = {};
        email = user["email"];
        if(email === licenseOwnerEmail){
            template = ownerTemplate;
        } else{
            template = educatorTemplate;
            //var name;
            var firstName;
            var lastName;
            // if user is a temporary user who has not yet registered, set name to email
            if(user.firstName === "temp" && user.lastName === "temp"){
                //name = email;
                firstName = email;
            } else{
                //name = user.firstName + " " + user.firstName;
                firstName = user.firstName;
                lastName = user.lastName;
            }
            //emailData.teacherName = name;
            emailData.teacherFirstName = firstName;
            emailData.teacherLastName = lastName;
        }
        emailData.subject = "Your Account has Been Upgraded!";
        //emailData.ownerName = data.ownerName;
        emailData.ownerFirstName = data.ownerFirstName;
        emailData.ownerLastName = data.ownerLastName;
        //emailData.oldPlan = data.oldPlan;
        //emailData.oldSeats = data.oldSeats;
        emailData.newPlan = lConst.plan[data.newPlan].name;
        emailData.newSeats = lConst.seats[data.newSeats].size;
        _sendEmailResponse.call(this, email, emailData, protocol, host, template);
    }.bind(this));
}

function _addTeachersEmailResponse(ownerName, ownerFirstName, ownerLastName, approvedUsers, approvedNonUsers, plan, seatsTier, protocol, host){
    var data;
    var email;
    var usersTemplate = "educator-user-invited";
    approvedUsers.forEach(function(user){
        email = user["EMAIL"];
        data = {};
        data.subject = "You’ve Been Invited!";
        data.ownerName = ownerName;
        data.ownerFirstName = ownerFirstName;
        data.ownerLastName = ownerLastName;
        data.teacherName = user["FIRST_NAME"] + " " + user["LAST_NAME"];
        data.teacherFirstName = user["FIRST_NAME"];
        data.teacherLastName = user["LAST_NAME"];
        if(data.teacherFirstName === "temp" && data.teacherLastName === "temp"){
            data.teacherFirstName = user["EMAIL"];
            delete data.teacherLastName;
        }
        data.plan = plan;
        data.seats = seatsTier;

        _sendEmailResponse.call(this, email, data, protocol, host, usersTemplate);
    }.bind(this));

    var data;
    var nonUsersTemplate = "educator-nonuser-invited";
    approvedNonUsers.forEach(function(user){
        email = user["EMAIL"];
        data = {};
        data.subject = "You’ve Been Invited!";
        //data.ownerName = ownerName;
        data.ownerFirstName = ownerFirstName;
        data.ownerLastName = ownerLastName;
        // temporary users do not have a name yet, so use email
        data.teacherEmail = email;
        data.plan = plan;
        data.seats = seatsTier;
        _sendEmailResponse.call(this, email, data, protocol, host, nonUsersTemplate);
    }.bind(this));
}

function _sendEmailResponse(email, data, protocol, host, template){
    // to remove testing email spam, i've added a return. remove to test
    //return;
    data.toEmail = email;
    return when.promise(function(resolve, reject){
        if(data.expirationDate){
            data.expirationDate = new Date(data.expirationDate);
        }
        var emailData = {
            subject: data.subject,
            to: data.toEmail,
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
            .then(function(){
                resolve();
            })
            .then(null, function(err){
                console.error("Send Email Response Error -",err);
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
