var path   = require('path');
var _      = require('lodash');
var when   = require('when');
var moment = require('moment');
var Util   = require('../../core/util.js');
var lConst;

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
    //upgradeLicensePurchaseOrder: upgradeLicensePurchaseOrder,
    getActivePurchaseOrderInfo: getActivePurchaseOrderInfo,
    cancelActivePurchaseOrder: cancelActivePurchaseOrder,
    receivePurchaseOrder: receivePurchaseOrder,
    rejectPurchaseOrder: rejectPurchaseOrder,
    invoicePurchaseOrder: invoicePurchaseOrder,
    approvePurchaseOrder: approvePurchaseOrder,
    migrateToTrialLegacy: migrateToTrialLegacy,
    cancelLicense: cancelLicense,
    cancelLicenseInternal: cancelLicenseInternal,
    subscribeToLicenseInternal: subscribeToLicenseInternal,
    inspectLicenses: inspectLicenses,
    trialMoveToTeacher: trialMoveToTeacher,
    // vestigial apis
    verifyLicense:   verifyLicense,
    registerLicense: registerLicense,
    getLicenses:     getLicenses
};

// provides license package information for the subscription/packages page
function getSubscriptionPackages(req, res){
    try{
        lConst = lConst || this.serviceManager.get("lic").lib.Const;
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
            if(key === "group" || key === "class" || key === "multiClass" || key === "school"){
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

// gets information necessary for the premium manager page
function getCurrentPlan(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    lConst = lConst || this.serviceManager.get("lic").lib.Const;
    var userId = req.user.id;
    var licenseId = req.user.licenseId;
    var licenseOwnerId = req.user.licenseOwnerId;
    var output = {};
    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            if(typeof status === "number"){
                licenseId = status;
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

            // if paid by purchase order or a user is on a trial or trialLegacy plan, the owner should not be able to upgrade
            if(license["payment_type"] === "credit-card" && license["package_type"] !== "trial" && license["package_type"] !== "trialLegacy"){
                var lastUpgraded = license["last_upgraded"];
                // if lastUpgraded is undefined, owner can upgrade at any time
                if(lastUpgraded){
                    var upgradeDate = new Date(lastUpgraded);
                    var currentDate = new Date();
                    // number of milliseconds since last upgrade
                    var timeSinceUpgrade = currentDate - upgradeDate;
                    // 90 days in milliseconds
                    var ninetyDays = 7776000000;
                    // if owner has upgraded within 90 days, owner cannot upgrade
                    if(timeSinceUpgrade <= ninetyDays && (this.options.env === "prod" || this.options.env === "stage")){
                        output["canUpgrade"] = false;
                        var ninetyOneDays = 7862000000;
                        // tell front end when to let owner know when upgrading is allowed
                        output["nextUpgrade"] = new Date(Date.parse(lastUpgraded) + ninetyOneDays);
                    } else{
                        // canUpgrade is true, user can upgrade at any time
                        output["canUpgrade"] = true;
                    }
                } else{
                    output["canUpgrade"] = true;
                }
            } else if(license["package_type"] === "trial"){
                output["canUpgrade"] = true;
            } else{
                output["canUpgrade"] = false;
            }

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
            // only appears after the addTeachersToLicense api is called
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

// for instructors, this api shows there students who are taking up seats in the license
// for the license owner, this api shows all students who are taking up seats in the license
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

// grabs credit card information for the license owner
// also reveals how much credited cash a license owner has on his or her customer account
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
            var promiseList = [];
            promiseList.push(this.serviceManager.stripe.retrieveCustomer(customerId));
            promiseList.push(this.myds.getLicenseById(licenseId));
            return when.all(promiseList);
        }.bind(this))
        .then(function(results){
            if(typeof results === "string"){
                _errorLicensingAccess.call(this, res, results);
                return;
            }
            var customer = results[0];
            var cardData = customer.cards.data[0];
            var license = results[1][0];
            var billingInfo = {};
            if(cardData){
                billingInfo = _buildBillingInfo(cardData);
            }
            // Get the account balance
            billingInfo.accountBalance = customer.account_balance;

            var subscriptionId = license["subscription_id"];
            // Get the start/end times of the current subscription
            _(customer.subscriptions.data).forEach(function(subscription){
                if(subscriptionId === subscription.id){
                    billingInfo.currentPeriodStart = subscription.current_period_start;
                    billingInfo.currentPeriodEnd = subscription.current_period_end;
                }
            });
            if(!(billingInfo.currentPeriodStart && billingInfo.currentPeriodEnd)){
                this.requestUtil.errorResponse(res, { key: "lic.general"});
                return;
            }
            this.requestUtil.jsonResponse(res, billingInfo);
        }.bind(this))
        .then(null, function(err){
            console.error("Get Customer Id Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
        }.bind(this));
}


// updates credit card information
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

// subscribes to license via credit card
// if charge successful, user will get access to license right away
function subscribeToLicense(req, res){
    if(!(req && req.user && req.user.id && req.user.role === "instructor")){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.body && req.body.stripeInfo && req.body.planInfo && req.body.schoolInfo)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.body.planInfo.seats === "group" || req.body.planInfo.seats === "class" ||
        req.body.planInfo.seats === "multiClass" || req.body.planInfo.seats === "school")){
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
    var schoolInfo = req.body.schoolInfo;
    var expirationDate;

    _createSubscription.call(this, req, userId, schoolInfo, stripeInfo, planInfo)
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

// gives instructor user a 30 student, 0 educator, all game access license that lasts for 60 days
// no billing information is required
// instructor can upgrade the trial to premium at any time, via credit card or purchase order
// if a user has ever been part of another active license, the user cannot have a trial
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
            return _createSubscription.call(this, req, userId, "NULL", stripeInfo, planInfo);
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

// transitions a license to a different seat/game package plan.  Seat plans cannot downgrade
// however, game packages can be changed freely, with charges or credits assigned to the account based on prorating in stripe
// upgrade only charges the upgrade till the user's expiration date, does not start new year
// charge is by credit card, there is no way upgrade via purchase orders
function upgradeLicense(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.user.licenseStatus === "active" && req.user.licenseOwnerId === req.user.id && req.body.planInfo)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.body.planInfo.seats === "group" || req.body.planInfo.seats === "class" ||
        req.body.planInfo.seats === "multiClass" || req.body.planInfo.seats === "school")){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    lConst = lConst || this.serviceManager.get("lic").lib.Const;
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
            var lastUpgraded = license["last_upgraded"];
            if(lastUpgraded){
                var upgradeDate = new Date(lastUpgraded);
                var currentDate = new Date();
                // number of milliseconds since last upgrade
                var timeSinceUpgrade = currentDate - upgradeDate;
                // 90 days in milliseconds
                var ninetyDays = 7776000000;
                if(timeSinceUpgrade <= ninetyDays && (this.options.env === "prod" || this.options.env === "stage")){
                    return "recent upgrade";
                }
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
            var lastUpgraded = new Date().toISOString().slice(0, 19).replace('T', ' ');
            var lastUpgradedString = "last_upgraded = '" + lastUpgraded + "'";
            updateFields.push(lastUpgradedString);
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
            if(status === "recent upgrade"){
                this.requestUtil.errorResponse(res, { key: "lic.upgrade.recent"});
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

// ends a trial license, and then creates a new year long subscription based on the user's pick
// in ending the trial license, game access rights may change, so all classes with premium games are closed before the new license is started
// charge by credit card
function upgradeTrialLicense(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.user.licenseStatus === "active" && req.user.licenseOwnerId === req.user.id && req.body.planInfo && req.body.schoolInfo)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.body.planInfo.seats === "group" || req.body.planInfo.seats === "class" ||
        req.body.planInfo.seats === "multiClass" || req.body.planInfo.seats === "school")){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    lConst = lConst || this.serviceManager.get("lic").lib.Const;
    var userId = req.user.id;
    var licenseId = req.user.licenseId;
    var stripeInfo = req.body.stripeInfo;
    var planInfo = req.body.planInfo;
    var schoolInfo = req.body.schoolInfo;
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
            return _createSubscription.call(this, req, userId, schoolInfo, stripeInfo, planInfo);
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

// checks if promo code on stripe is available to be used
// on front end, promo code info used to determine a user's potential plan price
function validatePromoCode(req, res) {
    // Validate the user role as instructor
    if(!(req && req.user && req.user.id && req.user.role === "instructor")) {
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }

    var acceptInvalid = req.query.acceptInvalid || false;
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
            if( coupon.valid === true || acceptInvalid ) {
                promoCodeInfo.id = coupon.id;
                promoCodeInfo.percent_off = coupon.percent_off;
                promoCodeInfo.amount_off = coupon.amount_off;
                promoCodeInfo.duration = coupon.duration;
                promoCodeInfo.valid = coupon.valid;
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

// cancels auto renew on stripe. in our system, autorenew is set to false by default
// at end of year, if auto renew is cancelled, a stripe subscription will end
// autorenew only relevant to stripe/credit cards
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

// enables autorenew on stripe. by default in our system, autorenew is set to false
// if enabled, a user will be charged the new subscription price for the next year on the day their prior year ends
// autorenew is only relevant to stripe/credit cards
function enableLicenseAutoRenew(req, res){
    lConst = lConst || this.serviceManager.get("lic").lib.Const;
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

// adds teachers to a license, if there are enough teacher seats and if the teachers are available to be added to the license
// teacher cannot be added to license if they are on another license
// can add both teachers who have accounts on glasslabgames, as well as teachers who do not yet have accounts
function addTeachersToLicense(req, res){
    if(!(req && req.user && req.user.id && req.user.licenseOwnerId && req.user.licenseId)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    lConst = lConst || this.serviceManager.get("lic").lib.Const;
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
    var invitedTeachers;
    var invitedTeacherCheck;
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
            _(teachers).forEach(function(teacher){
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
            invitedTeacherCheck = [];
            var promiseList = [];
            var otherLicenseId;
            var invitedUserId;
            _(hasLicenseObject).forEach(function(value, key){
                if(value === false){
                    approvedTeachers.push(key);
                } else if(typeof value === "number"){
                    otherLicenseId = value;
                    invitedUserId = parseInt(key);
                    invitedTeacherCheck.push([invitedUserId, otherLicenseId]);
                    promiseList.push(this.myds.getLicenseById(otherLicenseId));
                } else{
                    rejectedTeachers[key] = "user already on another license";
                }
            }.bind(this));
            return when.all(promiseList);
        }.bind(this))
        .then(function(otherLicenses){
            var invitedUserId;
            invitedTeachers = [];
            _(otherLicenses).forEach(function(license, index){
                license = license[0];
                invitedUserId = invitedTeacherCheck[index][0];
                if(license.user_id === invitedUserId){
                    if(license.package_type === "trial"){
                        invitedTeachers.push(invitedUserId);
                    } else{
                        rejectedTeachers[invitedUserId] = "user already on another license";
                    }
                } else{
                    rejectedTeachers[invitedUserId] = "user already on another license";
                }
            });
            var approvedExistingTeachers = [];
            _(existingTeachers).forEach(function(id){
                if(!rejectedTeachers[id]){
                    approvedExistingTeachers.push(id);
                }
            });
            existingTeachers = approvedExistingTeachers;
            // once have all teachers I want to insert, do a multi insert in GL_LICENSE_MAP table
            if(approvedTeachers.length > 0 || invitedTeachers.length > 0){
                return this.myds.multiGetLicenseMap(licenseId, approvedTeachers.concat(invitedTeachers));
            }
            return "reject all";
        }.bind(this))
        .then(function(results){
            if(typeof results === "string"){
                return results;
            }
            var map = {};
            var licenseMap = results;
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
            var teachersToInsertInvite = [];
            var teachersToUpdateInvite = [];
            invitedTeachers.forEach(function(teacherId){
                if(map[teacherId]){
                    teachersToUpdateInvite.push(teacherId);
                } else{
                    teachersToInsertInvite.push(teacherId);
                }
            });
            var promiseList = [{},{},{},{}];
            if(teachersToInsert.length > 0){
                promiseList[0] = this.myds.multiInsertLicenseMap(licenseId, teachersToInsert);
            }
            if(teachersToUpdate.length > 0){
                promiseList[1] = this.myds.multiUpdateLicenseMapStatus(licenseId, teachersToUpdate, "pending");
            }
            if(teachersToInsertInvite.length > 0){
                var shouldInvite = true;
                promiseList[2] = this.myds.multiInsertLicenseMap(licenseId, teachersToInsertInvite, shouldInvite);
            }
            if(teachersToUpdateInvite.length > 0){
                promiseList[3] = this.myds.multiUpdateLicenseMapStatus(licenseId, teachersToUpdateInvite, "invite-pending");
            }
            return when.all(promiseList);
        }.bind(this))
        .then(function(status) {
            if (typeof status === "string" && status !== "reject all") {
                return status;
            }
            var promiseList = [];
            var rejectedIds = Object.keys(rejectedTeachers);
            promiseList.push(_grabInstructorsByType.call(this, existingTeachers, rejectedIds, createTeachers, invitedTeachers));
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
            var invitedUsers = users[3];

            var approvedTeachersOutput = [];
            approvedUsers.forEach(function(user){
                approvedTeachersOutput.push(user["EMAIL"]);
            });
            approvedNonUsers.forEach(function(user){
                approvedTeachersOutput.push(user["EMAIL"]);
            });
            invitedUsers.forEach(function(user){
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
            _addTeachersEmailResponse.call(this, ownerName, ownerFirstName, ownerLastName, approvedUsers, approvedNonUsers, invitedUsers, plan, seatsTier, req.protocol, req.headers.host);
            this.serviceManager.internalRoute('/api/v2/license/plan', 'get',[req,res]);
        }.bind(this))
        .then(null, function(err){
            console.error("Add Teachers to License Error - ",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
        }.bind(this));
}

// called after modal on front end informs a user of their new access to their license
// user now has full access to the license
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

// removes teacher from license and removes access to premium games from teacher's classes
// caused by a license owner deciding to remove a teacher through the premium manager
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

// removes teacher from license and removes access to premium games from teacher's classes
// caused by a teacher's decision to leave a license
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

// begins license subscription process through purchase orders
// this initially marks the purchase order process as pending
// user will not have access to their license until they send us a filled out purchase order and we mark it as received
function subscribeToLicensePurchaseOrder(req, res){
    if(!(req && req.user && req.user.id && req.user.role === "instructor")){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.body && req.body.purchaseOrderInfo && req.body.planInfo && req.body.schoolInfo)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.body.planInfo.seats === "group" || req.body.planInfo.seats === "class" ||
        req.body.planInfo.seats === "multiClass" || req.body.planInfo.seats === "school")){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(req.user.licenseId){
        this.requestUtil.errorResponse(res, {key: "lic.create.denied"});
        return;
    }
    var userId = req.user.id;
    var purchaseOrderInfo = req.body.purchaseOrderInfo;
    if( purchaseOrderInfo.firstName === null ||
        purchaseOrderInfo.lastName === null ||
        purchaseOrderInfo.phone === null ||
        purchaseOrderInfo.email === null){
        this.requestUtil.errorResponse(res, { key: "lic.form.invalid"});
        return;
    }
    var planInfo = req.body.planInfo;
    var schoolInfo = req.body.schoolInfo;
    var action = "subscribe";

    _purchaseOrderSubscribe.call(this, userId, schoolInfo, planInfo, purchaseOrderInfo, action)
        .then(function(licenseId){
            if(typeof licenseId === "string"){
                return licenseId;
            }
            req.user.licenseId = licenseId;
            req.user.licenseStatus = "po-pending";
            req.user.licenseOwnerId = userId;
            req.user.paymentType = "purchase-order";
            req.user.purchaseOrderLicenseStatus = "po-pending";
            req.user.purchaseOrderLicenseId = licenseId;
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
                emails.push("purchase_order@glasslabgames.org");
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

function _purchaseOrderSubscribe(userId, schoolInfo, planInfo, purchaseOrderInfo, action){
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
                        purchaseOrder: true,
                        plan: planInfo.type,
                        seats: planInfo.seats,
                        userId: userId
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
                // if purchase order number present, then user's purchase order status skips straight to received
                data.received = purchaseOrderInfo.number ? true : false;
                return _createLicenseSQL.call(this, userId, schoolInfo, planInfo, data);
            }.bind(this))
            .then(function(id){
                if(typeof id === "string"){
                    return id;
                }
                licenseId = id;
                //create entry in purchaseOrder table
                // if purchase order number present, then user's purchase order status skips straight to received
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
    var status;
    var purchaseOrderNumber;
    if(purchaseOrderInfo.number){
        status = "'received'";
        purchaseOrderNumber = "'" + purchaseOrderInfo.number + "'";
    } else{
        status = "'pending'";
        purchaseOrderNumber = "NULL";
    }
    values.push(status);
    values.push(purchaseOrderNumber);
    // license id added to guarantee uniqueness.  table also requires a unique value
    var purchaseOrderKey = Util.CreateUUID() + licenseId;
    purchaseOrderInfo.key = purchaseOrderKey;
    purchaseOrderKey = "'" + purchaseOrderKey + "'";
    values.push(purchaseOrderKey);
    var phone = "'" + purchaseOrderInfo.phone + "'";
    values.push(phone);
    var email = "'" + purchaseOrderInfo.email.toLowerCase() + "'";
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
    var dateCreated = "NOW()";
    values.push(dateCreated);
    return values;
}

// upgrades a trial to a premium license through purchase orders
// this initially marks the purchase order process as pending
// user will not have access to their license until they send us a filled out purchase order and we mark it as received
// the trial remains active until the purchase order is marked as received, at which point the trial is destroyed
function upgradeTrialLicensePurchaseOrder(req, res){
    // do subscribe purchase order stuff
    if(!(req && req.user && req.user.id && req.user.role === "instructor")){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.body && req.body.purchaseOrderInfo && req.body.planInfo && req.body.schoolInfo)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.body.planInfo.seats === "group" || req.body.planInfo.seats === "class" ||
        req.body.planInfo.seats === "multiClass" || req.body.planInfo.seats === "school")){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    var userId = req.user.id;
    var purchaseOrderInfo = req.body.purchaseOrderInfo;

    if( purchaseOrderInfo.firstName === null ||
        purchaseOrderInfo.lastName === null ||
        purchaseOrderInfo.phone === null ||
        purchaseOrderInfo.email === null){
        this.requestUtil.errorResponse(res, { key: "lic.form.invalid"});
        return;
    }
    var planInfo = req.body.planInfo;
    var schoolInfo = req.body.schoolInfo;
    var action = "trial upgrade";

    _purchaseOrderSubscribe.call(this, userId, schoolInfo, planInfo, purchaseOrderInfo, action)
        .then(function(licenseId){
            if(typeof licenseId === "string"){
                return licenseId;
            }
            req.user.paymentType = "purchase-order";
            req.user.purchaseOrderLicenseStatus = "po-pending";
            req.user.purchaseOrderLicenseId = licenseId;
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
                emails.push("purchase_order@glasslabgames.org");
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

// gets information from a license owner's currently relevant purchase order
// either from a purchase order that is currently in progress, or the last one that finished
function getActivePurchaseOrderInfo(req, res){
    if(!(req && req.user && req.user.id && req.user.role === "instructor")){
        this.requestUtil.errorResponse(res, { key: "lic.access.invalid"});
        return;
    }
    var licenseId;
    if (req.user.purchaseOrderLicenseId) {
        licenseId = req.user.purchaseOrderLicenseId;
    } else {
        licenseId = req.user.licenseId;
    }

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

// cancels a purchase order application process that has the status of pending
// once a purchase order is marked as received, a purchase order license cannot be cancelled through these means
function cancelActivePurchaseOrder(req, res){
    if(!(req && req.user && req.user.id && req.user.role === "instructor" && req.user.purchaseOrderLicenseId)){
        this.requestUtil.errorResponse(res, { key: "lic.access.invalid"});
        return;
    }
    var userId = req.user.id;
    var licenseId = req.user.purchaseOrderLicenseId;
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
            if(req.user.purchaseOrderLicenseId === req.user.licenseId){
                delete req.user.licenseId;
                delete req.user.licenseStatus;
                delete req.user.licenseOwnerId;
                delete req.user.paymentType;
            }
            delete req.user.purchaseOrderLicenseId;
            delete req.user.purchaseOrderLicenseStatus;

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

// called by front end modal. temp state used to inform users that their license access has been closed off
function setLicenseMapStatusToNull(req, res){
    if(!(req.user && req.user.licenseId && ((req.user.inviteLicense) ||
        (req.user.purchaseOrderLicenseStatus && req.user.purchaseOrderLicenseStatus === "po-rejected")))){
        this.requestUtil.errorResponse(res, { key: "lic.access.invalid"});
        return;
    }
    var userId = req.user.id;
    var licenseId;
    if(req.user.purchaseOrderLicenseStatus){
        licenseId = req.user.purchaseOrderLicenseId;
    } else if(req.user.inviteLicense){
        licenseId = req.user.inviteLicense.licenseId;
    } else{
        licenseId = req.user.licenseId;
    }

    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string" && status !== "inconsistent"){
                return status;
            }
            var userIdList = [req.user.id];
            var statusString = "status = NULL";
            var updateFields = [statusString];

            return this.myds.updateLicenseMapByLicenseInstructor(licenseId,userIdList,updateFields);
        }.bind(this))
        .then(function(status){
            if(typeof status === "string" && status !== "inconsistent"){
                return status;
            }
            return this.myds.getLicenseById(licenseId);
        }.bind(this))
        .then(function(license){
            if(typeof license === "string"){
                return license;
            }
            license = license[0];
            lConst = lConst || this.serviceManager.get("lic").lib.Const;
            var packageSize = license["package_size_tier"];
            var educatorSeats = lConst.seats[packageSize].educatorSeats;
            return this.updateEducatorSeatsRemaining(licenseId, educatorSeats);
        }.bind(this))
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            else if(!(req.user.purchaseOrderLicenseId || req.user.inviteLicense) ||
                req.user.purchaseOrderLicenseId === req.user.licenseId ||
                req.user.inviteLicense.licenseId === req.user.licenseId){
                delete req.user.licenseStatus;
                delete req.user.licenseId;
                delete req.user.licenseOwnerId;
                delete req.user.paymentType;
            }
            delete req.user.inviteLicense;
            delete req.user.purchaseOrderLicenseId;
            delete req.user.purchaseOrderLicenseStatus;
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

// admin dashboard rejects a purchase order application process
// can be rejected at the stages of pending, received or invoiced, but not after approved
// the purchase order related license is disabled, and all game access from that purchase order license removed
// admin needs both the glasslab key for that purchase order as well as the purchase order number (if defined in our db) to reject
function rejectPurchaseOrder(req, res){
    // Only admins should be allowed to perform this operation
    lConst = lConst || this.serviceManager.get("lic").lib.Const;
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
    var instructors;

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

            var promiseList = [];
            promiseList.push(_updateTablesUponPurchaseOrderReject.call(this, userId, licenseId, purchaseOrderId, "rejected", purchaseOrderNumber, action));
            promiseList.push(this.myds.getInstructorsByLicense(licenseId));
            return when.all(promiseList);
        }.bind(this))
        .then(function(results){
            if(typeof results === "string"){
                return results;
            }
            instructors = results[1];
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
            var email;
            _sendEmailResponse.call(this, ownerData.email, ownerData, req.protocol, req.headers.host, template);
            _sendEmailResponse.call(this, billerData.email, billerData, req.protocol, req.headers.host, template);
            template = "educator-purchase-order-rejected";
            instructors.forEach(function(user){
                if(userId !== user.id){
                    var data = {};
                    data.subject = "Loss of Access";
                    email = user.email;
                    if(user.firstName === "temp" && user.lastName === "temp"){
                        data.firstName = email;
                    } else{
                        data.firstName = user.firstName;
                        data.lastName = user.lastName;
                    }
                    _sendEmailResponse.call(this, email, data, req.protocol, req.headers.host, template);
                }
            }.bind(this));
            this.requestUtil.jsonResponse(res, { status: "ok"});
        }.bind(this))
        .then(null, function(err){
            console.error("Reject Purchase Order Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"});
        }.bind(this));
}

// marks a purchase order as received, granting full access to the chosen license plan while the payment process continues
// this access is dependent on the progress of the payment process though, access can be removed by glass lab admins
// admin needs glasslab key for that purchase order to mark as received. admin also enters the form's purchase order number into our system here
// if a user was on a trial before being marked as received, that trial is terminated
function receivePurchaseOrder(req, res){
    // Only admins should be allowed to perform this operation
    lConst = lConst || this.serviceManager.get("lic").lib.Const;
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
        lConst = lConst || this.serviceManager.get("lic").lib.Const;
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
        if(planInfo.promoCode){
            var promoString = "promo = '" + planInfo.promoCode + "'";
            updateFields.push(promoString);
        }

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
                var trialLicenseId = license.license_id;
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
        lConst = lConst || this.serviceManager.get("lic").lib.Const;
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

// mark a purchase order as invoiced, to message on our end that we have invoiced the school's billing department
// called by our admin, and needs both the correct glass lab purchase order key and the purchase order number to carry out
// purchase order marked invoiced after it has been received, and before a purchase order is marked as approved
function invoicePurchaseOrder(req, res){
    // Only admins should be allowed to perform this operation
    lConst = lConst || this.serviceManager.get("lic").lib.Const;
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

// marks a purchase order as approved, meaning we have received payment for the plan
// admin marks as approved, and needs purchase order key and purchase order number to carry out action
// can only approve an purchase order after it has been marked received and invoiced
function approvePurchaseOrder(req, res){
    // Only admins should be allowed to perform this operation
    lConst = lConst || this.serviceManager.get("lic").lib.Const;
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

// gives existing instructors 1 year of premium access when we launch licensing
// hybrid of premium and trial account settings, users do not provide billing info like in trials, can access all games, and see the trial banner
// but users instead of 30 students, 0 educators, have access to 500 student seats and can invite 15 teachers
// user cannot update this trial or go premium, until the trial is about to expire at year end
function migrateToTrialLegacy(req, res){
    // Only admins should be allowed to perform this operation
    lConst = lConst || this.serviceManager.get("lic").lib.Const;
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
                    _createSubscription.call(this, input, userId, "NULL", stripeInfo, planInfo)
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
                instructor.email = instructor.EMAIL;
                instructor.firstName = instructor.FIRST_NAME;
                instructor.lastName = instructor.LAST_NAME;
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
                // if some user was not added to trialLegacy, check to see if that should be the case, investigate particular error
                // if a user was already on a license in some way, such as being an invited teacher, they should be in check
                this.requestUtil.jsonResponse(res, { status: "not all legacies", check: failures });
                return;
            }
            this.requestUtil.jsonResponse(res, { status: "ok" });
        }.bind(this))
        .then(null, function(err){
            console.error("Migrate to Trial Legacy Error -",err);
            this.requestUtil.errorResponse(res, err, 500);
        }.bind(this));
}

function cancelLicense(req, res){
    if(!(req.user.id && req.user.licenseId && req.user.licenseOwnerId && req.user.licenseOwnerId === req.user.id)){
        this.requestUtil.errorResponse(res, { key: "lic.access.invalid"} );
        return;
    }
    var userId = req.user.id;
    var licenseId = req.user.licenseId;
    var instructors;
    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return this.myds.getInstructorsByLicense(licenseId);
        }.bind(this))
        .then(function(users){
            if(typeof users === "string"){
                return users;
            }
            instructors = users;
            return _endLicense.call(this, userId, licenseId, false);
        }.bind(this))
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            delete req.user.licenseId;
            delete req.user.licenseStatus;
            delete req.user.paymentType;
            delete req.user.licenseOwnerId;
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
            // maybe add cancel email here, goes to all teachers on plan as well as the owner
            var licenseOwnerEmail = req.user.email;
            var ownerTemplate = "owner-license-cancel";
            var data = {};
            data.subject = "License Cancelled";
            data.firstName = req.user.firstName;
            data.lastName = req.user.lastName;
            _sendEmailResponse.call(this, licenseOwnerEmail, data, req.protocol, req.headers.host, ownerTemplate);
            var teacherEmail;
            var teacherTemplate = "educator-license-cancel";
            instructors.forEach(function(user){
                if(user.id !== userId){
                    teacherEmail = user.email;
                    data = {};
                    data.subject = "License Cancelled";
                    if(user.firstName === "temp" && user.lastName === "temp"){
                        data.firstName = user.email;
                    } else{
                        data.firstName = user.firstName;
                        data.lastName = user.lastName;
                    }
                    _sendEmailResponse.call(this, teacherEmail, data, req.protocol, req.headers.host, teacherTemplate);
                }
            }.bind(this));
            this.requestUtil.jsonResponse(res, { status: "ok"});
        }.bind(this))
        .then(null, function(err){
            console.error("Cancel License Error -", err);
            this.requestUtil.errorResponse(res, { key: "lic.general"});
        }.bind(this));
}

function cancelLicenseInternal(req, res){
    if(!(req.user.role === "admin" && req.body && req.body.userId && req.body.licenseId)){
        this.requestUtil.errorResponse(res, { key: "lic.access.invalid"});
        return;
    }
    var userId = req.body.userId;
    var licenseId = req.body.licenseId;
    var instructors;
    this.myds.getInstructorsByLicense(licenseId)
        .then(function(users){
            if(typeof users === "string"){
                return users;
            }
            instructors = users;
            instructors.forEach(function(user){
                if(user.id === userId && user.email === "" && req.body.userDelete){
                    user.email = userId;
                }
            });
            return _endLicense.call(this, userId, licenseId, false);
        }.bind(this))
        .then(function(status) {
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
            // maybe add cancel email here, goes to all teachers on plan as well as the owner
            var email;
            var ownerTemplate = "owner-license-cancel";
            var teacherTemplate = "educator-license-cancel";
            var template;
            var data;
            _(instructors).forEach(function (user) {
                email = user.email;
                if(typeof user.email === "number"){
                    return;
                }
                data = {};
                if (user.id !== userId) {
                    template = teacherTemplate;
                    data.subject = "License Cancelled";
                    if (user.firstName === "temp" && user.lastName === "temp") {
                        data.firstName = user.email;
                    } else {
                        data.firstName = user.firstName;
                        data.lastName = user.lastName;
                    }
                } else {
                    template = ownerTemplate;
                    data.subject = "License Cancelled";
                    data.firstName = user.firstName;
                    data.lastName = user.lastName;
                }
                _sendEmailResponse.call(this, email, data, req.protocol, req.headers.host, template);
            }.bind(this));
            this.requestUtil.jsonResponse(res, { status: "ok"});
        }.bind(this))
        .then(null, function(err){
            console.error("Cancel License Internal Error -",err);
            this.requestUtil.jsonResponse(res, { key: "lic.general"});
        }.bind(this));
}

// method to be used to create a license for a user without that user needing to be logged in
// used primarily for resellers, but we could use it for whatever reason we want to grant a premium license
// at end of method, that used will have full access to premium license with a po-received map status
function subscribeToLicenseInternal(req, res){
    if(!(req.user && req.user.role === "admin")){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    if(!(req.body && req.body.purchaseOrderInfo && req.body.planInfo && req.body.schoolInfo && req.body.user)){
        this.requestUtil.errorResponse(res, {key: "lic.access.invalid"});
        return;
    }
    var userEmail = req.body.user.email;
    var user;
    var purchaseOrderInfo = req.body.purchaseOrderInfo;
    if( purchaseOrderInfo.firstName === null ||
        purchaseOrderInfo.lastName === null ||
        purchaseOrderInfo.phone === null ||
        purchaseOrderInfo.email === null ||
        purchaseOrderInfo.payment === null){
        this.requestUtil.errorResponse(res, { key: "lic.form.invalid"});
        return;
    }
    purchaseOrderInfo.number = Util.CreateUUID();
    var planInfo = req.body.planInfo;
    var schoolInfo = req.body.schoolInfo;
    var action;

    this.myds.getUserByEmail(userEmail)
        .then(function(results){
            user = results;
            return this.myds.getLicenseMapByUser(user.id)
        }.bind(this))
        .then(function(maps){
            var licenseMaps = [];
            var licenseCount = 0;
            var rejectStatus;
            var licenseId;
            maps.forEach(function(map){
                if(map.status !== null){
                    licenseCount++;
                    licenseId = map.license_id;
                    if(map.status === "active" || map.status === "invite-pending" ||
                        map.status === "po-rejected" || map.status === "pending"){
                        licenseMaps.push(map);
                    } else{
                        rejectStatus = map.status
                    }
                }
            }.bind(this));
            if(licenseCount > 2){
                return "too many licenses";
            }
            // po-pending, po-received, po-invoiced
            if(rejectStatus === "po-pending"){
                return "po-pending";
            } else if(rejectStatus){
                return "already on license";
            }
            var promiseList = [{},{}];
            licenseMaps.forEach(function(map){
                if(map.status === "active"){
                    promiseList[0] = this.myds.getLicenseById(licenseId);
                } else{
                    var statusString = "status = NULL";
                    var updateFields = [statusString];
                    promiseList[1] = this.myds.updateLicenseMapByLicenseInstructor(licenseId, [user.id], updateFields);
                }
            }.bind(this));
            return when.all(promiseList);
        }.bind(this))
        .then(function(results){
            if(typeof results === "string"){
                return results;
            }
            var license = results[0][0] || results[1][0];
            if(!license){
                action = "subscribe";
            } else if(license.package_type === "trial"){
                action = "trial upgrade";
                return _endLicense.call(this, userId, license.id, false);
            } else{
                return "already on license";
            }
        }.bind(this))
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return _purchaseOrderSubscribe.call(this, user.id, schoolInfo, planInfo, purchaseOrderInfo, action);
        }.bind(this))
        .then(function(status){
            if(status === "po-pending"){
                this.requestUtil.errorResponse(res, { key: "lic.order.pending" });
                return;
            }
            if(status === "already on license"){
                this.requestUtil.errorResponse(res, { key: "lic.create.denied" });
                return;
            }
            var emails = [];
            if(this.options.env === "prod"){
                emails.push("purchase_order@glasslabgames.org");
            } else{
                emails.push("ben@glasslabgames.org");
                emails.push("michael.mulligan@glasslabgames.org");
            }
            var data = {};
            _.merge(data, purchaseOrderInfo, planInfo);
            if(action === "trial upgrade"){
                data.subject = "Reseller Upgrade Trial";
            } else{
                data.subject = "Reseller Subscribe";
            }
            var template = "accounting-subscribe-internal";
            _(emails).forEach(function(email){
                _sendEmailResponse.call(this, email, data, req.protocol, req.headers.host, template);
            }.bind(this));

            var resellerEmail = purchaseOrderInfo.email;
            data = {};
            data.subject =  "Successful Subscription!";
            data.firstName = purchaseOrderInfo.firstName;
            data.lastName = purchaseOrderInfo.lastName;
            template = "reseller-subscribe-internal";
            _sendEmailResponse.call(this, resellerEmail, data, req.protocol, req.headers.host, template);

            data = {};
            data.subject = "Successful Subscription!";
            data.firstName = user.FIRST_NAME;
            data.lastName = user.LAST_NAME;
            template = "owner-subscribe-internal";
            _sendEmailResponse.call(this, userEmail, data, req.protocol, req.headers.host, template);

            this.requestUtil.jsonResponse(res, { status: "ok"});
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, { key: "lic.general"}, 500);
            console.error("Subscribe to License Purchase Order Internal Error -",err);
        }.bind(this));
}

function inspectLicenses(req, res){
    if(req.user.role !== "admin"){
        this.requestUtil.errorResponse(res, { key: "lic.access.invalid"});
        return;
    }
    var errors = {};
    var hasErrors = false;
    //job should run at midnight evey day.  eventually handles all time running out emails and does expire/renew operations
    this.myds.getLicensesForInspection()
        .then(function(licenses){
            var today = new Date();
            var protocol = req.protocol;
            var host = req.headers.host;
            var promiseList = [];
            var inspecter = {};
            var ownerId;
            licenses.forEach(function(license){
                ownerId = license.user_id;
                inspecter[ownerId] = inspecter[ownerId] || [];
                inspecter[ownerId].push(license);
            });
            var license;
            var renewLicense;
            var corruptData;
            var sevenDays = 604800000;
            _(inspecter).forEach(function(user, userId){
                if(user.length === 1 && user[0].active === 1){
                    license = user[0];
                    var expDate = new Date(license.expiration_date);
                    if(today - expDate >= 0){
                        promiseList.push(_expireLicense.call(this, license, today, protocol, host));
                    } else if (license.packageType === 'trial'){
                        // add all relevant dates to these checks.  Emails customized to those dates
                        if(expDate - today <= sevenDays){
                            // send out the proper email. make helper for this
                            //promiseList.push(_expiringSoonEmails.call(this, userId, license.id, 7, true, protocol, host));
                        }
                    } else{
                        if(expDate - today <= sevenDays){
                            // send out the proper email. make helper for this
                            //promiseList.push(_expiringSoonEmails.call(this, userId, license.id, 7, false, protocol, host));
                        }
                    }
                    // add more else if conditions to know when to send expiring soon emails
                } else if(user.length === 2){
                    _(user).forEach(function(lic){
                        if(lic.active === 1){
                            license = lic;
                        } else{
                            renewLicense = lic;
                        }
                    });
                    if(license && renewLicense){
                        //need to do more work on renew flow
                        //promiseList.push(_renewLicense.call(this, license, protocol, host));
                    } else{
                        corruptData = true;
                    }
                } else{
                    corruptData = true;
                }
            }.bind(this));
            if(corruptData){
                return "data corrupted";
            }
            return when.reduce(promiseList, function(results, status, index){
                if(status){
                    hasErrors = true;
                    var licenseId = licenses[index].id;
                    errors[licenseId] = status
                }
                return results;
            }, []);
        }.bind(this))
        .then(function(status){
            if(status === "data corrupted"){
                this.requestUtil.errorResponse(res, { key: "lic.records.inconsistent"});
                return;
            }
            if(hasErrors){
                this.requestUtil.jsonResponse(res, {status: "not all handled", errors: errors});
                return;
            }
            this.requestUtil.jsonResponse(res, { status: "ok"});
        }.bind(this))
        .then(null, function(err){
            console.error("Inspect Licenses Error -",err);
            this.requestUtil.errorResponse(res, { key: "lic.general"});
        }.bind(this));
}

function _expireLicense(license, today, protocol, host){
    return when.promise(function(resolve, reject) {
        var userId = license.user_id;
        var licenseId = license.id;
        var isTrial = false;
        if(license.package_type === "trial"){
            isTrial = true;
        }
        var expDate = new Date(license.expiration_date);
        // today is a date object as well
        if(today - expDate < 0){
            resolve("no expire");
            return;
        }
        var instructors;
        var promise;
        if(isTrial){
            promise = this.myds.getUserById(userId);
        } else{
            promise = this.myds.getInstructorsByLicense(licenseId);
        }
        promise
            .then(function (users) {
                if(isTrial){
                    var user = {};
                    user.email = users["EMAIL"];
                    user.firstName = users["FIRST_NAME"];
                    user.lastName = users["LAST_NAME"];
                    user.id = users.id;
                    instructors = [user];
                } else{
                    instructors = users;
                }
                return _endLicense.call(this, userId, licenseId, false);
            }.bind(this))
            .then(function (status) {
                if (typeof status === "string") {
                    return status;
                }
                var data;
                var email;
                var template;
                var promiseList = [];
                instructors.forEach(function (user) {
                    email = user.email;
                    data = {};
                    data.subject = "It's Time to Renew!";
                    if (user.id === userId) {
                        //license owner email
                        template = "owner-subscription-expires";
                        if(isTrial){
                            data.subject = "Your Trial has Expired!";
                            template = "owner-trial-expires";
                        }
                        data.firstName = user.firstName;
                        data.lastName = user.lastName;
                    } else{
                        // DANGER! in 1 year, thousands of expiration or renew emails will go out
                        // end of trial legacy.  how would we send all that?
                        // educator email
                        template = "educator-subscription-expires";
                        if (user.firstName === "temp" && user.lastName === "temp") {
                            data.firstName = user.email;
                        } else {
                            data.firstName = user.firstName;
                            data.lastName = user.lastName;
                        }
                    }
                    promiseList.push(_sendEmailResponse.call(this, email, data, protocol, host, template));
                }.bind(this));
                return when.all(promiseList);
            }.bind(this))
            .then(function(status){
                if (typeof status === "string") {
                    resolve(status);
                }
                resolve();
            }.bind(this))
            .then(null, function(err){
                console.error("Expire License Error -",err);
                reject(err);
            }.bind(this));
    }.bind(this));
}

function _renewLicense(oldLicense, newLicenseId, protocol, host){
    return when.promise(function(resolve, reject){
        var userId = oldLicense.user_id;
        var oldLicenseId = oldLicense.id;
        var user;

        var expDate = new Date(oldLicense.expiration_date);
        expDate.setFullYear(expDate.getFullYear() + 1);
        expDate = date.toISOString().slice(0, 19).replace('T', ' ');

        this.myds.getUserById(userId)
            .then(function (results) {
                user = results;
                return _endLicense.call(this, userId, oldLicenseId, false);
            }.bind(this))
            .then(function(){
                var updateFields = [];
                var active = "active = 1";
                updateFields.push(active);
                var expirationDate = "expiration_date = '" + expDate + "'";
                updateFields.push(expirationDate);
                var promiseList = [];
                promiseList.push(this.myds.getLicenseMapByLicenseId(newLicenseId));
                promiseList.push(this.myds.updateLicenseById(newLicenseId, updateFields));
                return when.all(promiseList);
            }.bind(this))
            .then(function(results){
                var licenseMaps = results[0];
                var userIds = _.pluck(licenseMaps, "user_id");
                var updateFields = [];
                var status = "status = 'active'";
                updateFields.push('active');
                return this.updateLicenseMapByLicenseInstructor(newLicenseId, userIds, updateFields);
            }.bind(this))
            .then(function(status){
                if (typeof status === "string") {
                    return status;
                }
                var data = {};
                var email = user["EMAIL"];
                data.subject = "Your Account has Been Renewed!";
                data.firstName = user["FIRST_NAME"];
                data.lastName = user["LAST_NAME"];
                var template = "owner-renew";
                return _sendEmailResponse.call(this, email, data, protocol, host, template);
            }.bind(this))
            .then(function(status){
                if(typeof status === "string"){
                    resolve(status);
                    return;
                }
                resolve();
            })
            .then(null, function(err){
                console.error("Renew License Error -",err);
                reject(err);
            });
    }.bind(this));
}

function _expiringSoonEmails(userId, licenseId, daysToGo, isTrial, protocol, host){
    return when.promise(function(resolve, reject){
        this.myds.getUserById(userId)
            .then(function(user){
                var email = user["EMAIL"];
                var data = {};
                data.firstName = user["FIRST_NAME"];
                data.lastName = user["LAST_NAME"];
                data.daysToGo = daysToGo;
                var template;
                if(isTrial){
                    data.subject = "You’re Almost Done with Your Trial!";
                    template = "owner-trial-expires-soon";
                } else{
                    data.subject = "It’s Almost Time to Renew!";
                    template = "owner-subscription-expires-soon";
                }
                return _sendEmailResponse.call(this, email, data, protocol, host, template);
            }.bind(this))
            .then(function(){
                // modify license to notify it has sent out relevant email, new column
            }.bind(this))
            .then(function(){
                resolve();
            })
            .then(null, function(err){
                console.error("Expiring Soon Emails Error -", err);
                reject(err);
            }.bind(this));
    }.bind(this));
}

function trialMoveToTeacher(req, res){
    // new from trial added to license api
    // pass in new license id to switch from trial to license api
    // cancel trial license
    // get license you want to join
    // check if there are enough teacher seats open
    // grab license map for that teacher and that license —update license map entry
    // update educator seats remaining
    if(!(req.user.id && req.user.licenseId && req.user.licenseOwnerId &&
        req.user.licenseOwnerId === req.user.id && req.user.inviteLicense)){
        this.requestUtil.errorResponse(res, { key: "lic.access.invalid"} );
        return;
    }
    var userId =req.user.id;
    var email = req.user.email;
    var licenseId = req.user.licenseId;
    var inviteLicense = req.user.inviteLicense;
    var inviteLicenseId = inviteLicense.licenseId;
    _validateLicenseInstructorAccess.call(this, userId, licenseId)
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            return _endLicense.call(this, userId, licenseId, false);
        }.bind(this))
        .then(function(status){
            if(typeof status === "string"){
                return status;
            }
            var updateFields = [];
            var statusString = "status = 'active'";
            updateFields.push(statusString);
            return this.myds.updateLicenseMapByLicenseInstructor(inviteLicenseId,[userId], updateFields);
        }.bind(this))
        .then(function(){
            if(typeof status === "string"){
                return status;
            }
            delete req.user.inviteLicense;
            req.user.licenseId = inviteLicenseId;
            req.user.licenseStatus = 'active';
            req.user.paymentType = inviteLicense.paymentType;
            req.user.licenseOwnerId = inviteLicense.owner.id;
            return Util.updateSession(req);
        })
        .then(function(status){
            if(typeof status === "string"){
                _errorLicensingAccess.call(this, res, status);
                return;
            }
            this.requestUtil.jsonResponse(res, { status: "ok"});
        }.bind(this))
        .then(null, function(err){
            this.requestUtil.errorResponse(res, { key: "lic.general"});
            console.error("Trial Move To Teacher Error -",err);
        }.bind(this));
}

function _storeSchoolInformation(schoolInfo){
    return when.promise(function(resolve, reject){
        var title = "'" + schoolInfo.name + "'";
        var city = "'" + schoolInfo.city + "'";
        var state = "'" + schoolInfo.state + "'";

        var institutionId;

        var keys = [];
        keys.push("TITLE = " + title);
        keys.push("CITY = "+ city);
        keys.push("STATE = " + state);
        this.myds.getInstitutionIdByKeys(keys)
            .then(function(results){
                if(typeof results === "number"){
                    institutionId = results;
                    return "exists";
                }
                var version = 3;
                var code = "NULL";
                var enabled = 1;
                var secret = "NULL";
                var shared = "NULL";
                var zip = "'" + schoolInfo.zipCode + "'";
                var address = "'" + schoolInfo.address + "'";
                var dateCreated = "NOW()";
                var lastUpdated = "NOW()";

                var values = [];
                values.push(version);
                values.push(city);
                values.push(code);
                values.push(enabled);
                values.push(secret);
                values.push(shared);
                values.push(state);
                values.push(title);
                values.push(zip);
                values.push(address);
                values.push(dateCreated);
                values.push(lastUpdated);

                return this.myds.insertToInstitutionTable(values);
            }.bind(this))
            .then(function(id){
                if(typeof id === "number"){
                    institutionId = id;
                }
                resolve(institutionId);
            })
            .then(null, function(err){
                console.error("Store School Information Error -", err);
                reject(err);
            });
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

function _createSubscription(req, userId, schoolInfo, stripeInfo, planInfo){
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
                return _createLicenseSQL.call(this, userId, schoolInfo, planInfo, stripeData);
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
                var params = _buildStripeParams.call(this, planInfo, customerId, stripeInfo, email, name);
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
    lConst = lConst || this.serviceManager.get("lic").lib.Const;
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

function _createLicenseSQL(userId, schoolInfo, planInfo, data){
    return when.promise(function(resolve, reject){
        lConst = lConst || this.serviceManager.get("lic").lib.Const;
        var licenseId;
        var values;
        var promise;
        if(schoolInfo === "NULL"){
            promise = Util.PromiseContinue("NULL");
        } else{
            promise = _storeSchoolInformation.call(this, schoolInfo);
        }
        promise
            .then(function(institutionId){
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
                var active = 1;
                var autoRenew = 0;
                var paymentType;
                if(data.purchaseOrder){
                    paymentType = "'purchase-order'";
                    if(!data.received){
                        active = 0;
                    }
                } else{
                    paymentType = "'credit-card'";
                }
                var dateCreated = "NOW()";
                var lastUpgraded = "NULL";
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
                values.push(institutionId);
                values.push(dateCreated);
                values.push(lastUpgraded);

                return this.myds.insertToLicenseTable(values);
            }.bind(this))
            .then(function(insertId){
                licenseId = insertId;
                values = [];
                values.push(userId);
                values.push(licenseId);
                if(data.purchaseOrder){
                    if(data.received){
                        values.push("'po-received'");
                    } else{
                        values.push("'po-pending'");
                    }
                } else{
                    values.push("'active'");
                }
                var dateCreated = "NOW()";
                values.push(dateCreated);
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
        lConst = lConst || this.serviceManager.get("lic").lib.Const;
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
                var email;
                users.forEach(function(educator){
                    if(educator["email"] === ""){
                        educator["email"] = userId;
                    }
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
                _(userIds).forEach(function(id){
                    output[id] = false;
                });
                var userId;
                var userMapStatus = {};
                _(licenseMaps).forEach(function(map){
                    userId = map["user_id"];
                    if(!userMapStatus[userId]){
                        userMapStatus[userId] = [];
                    }
                    userMapStatus[userId].push(map);
                });
                _(userMapStatus).forEach(function(maps, userId){
                    if(maps.length === 0){
                        output[userId] = true;
                    } else if(maps.length > 1){
                        output[userId] = false
                    } else{
                        var map = maps[0];
                        if(map.status === "active") {
                            // possible invite sent, need to check if eligible first
                            output[userId] = map.license_id;
                        } else{
                            output[userId] = false;
                        }
                    }
                });
                resolve(output);
            })
            .then(null, function(err){
                reject(err);
            })
    }.bind(this));
}

function _grabInstructorsByType(approvedUserIds, rejectedUserIds, approvedNonUserEmails, invitedUserIds){
    return when.promise(function(resolve, reject){
        var promiseList = [[],[], [], []];
        if(approvedUserIds.length > 0){
            promiseList[0] = this.myds.getUsersByIds(approvedUserIds);
        }
        if(approvedNonUserEmails.length > 0){
            promiseList[1] = this.myds.getUsersByEmail(approvedNonUserEmails);
        }
        if(rejectedUserIds.length > 0){
            promiseList[2] = this.myds.getUsersByIds(rejectedUserIds);
        }
        if(invitedUserIds.length > 0){
            promiseList[3] = this.myds.getUsersByIds(invitedUserIds);
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
                var invitedUsers = results[3];
                output.push(invitedUsers);

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
        lConst = lConst || this.serviceManager.get("lic").lib.Const;
        var promiseList = [];
        // poPendingStatus variable used to check for edge case where we are ending a pending purchase order license, but a trial is still active
        // in that case, we do not want to disable premium classes, because the educator's premium classes would belong to the trial
        var poPendingStatus = false;
        var license;
        promiseList.push(this.myds.getLicenseById(licenseId));
        var teacherId;
        if(typeof teacherEmail[0] === "number"){
            teacherId = teacherEmail[0];
            promiseList.push(teacherId);
        } else{
            promiseList.push(this.myds.getUsersByEmail(teacherEmail));
        }
        // if licenseMap not already computed, find it. else, use existing value
        if(!instructors){
            promiseList.push(this.myds.getInstructorsByLicense(licenseId));
        } else{
            promiseList.push(instructors);
        }
        // if user account deleted, pass in an id instead of an email
        when.all(promiseList)
            .then(function(results){
                license = results[0][0];
                // user account deleted, skip this part
                if(typeof results[1] === "number"){
                    return;
                }
                var licenseMap = results[2];
                var state = false;
                licenseMap.some(function(instructor){
                    if(instructor.email === teacherEmail[0]){
                        if(instructor.status === "po-pending"){
                            poPendingStatus = true;
                        }
                        state = true;
                        return true;
                    }
                });
                if(!state){
                    return "email not in license";
                }
                var teacher = results[1][0];
                teacherId = teacher.id;
                emailData.plan = license["package_type"];
                return this.myds.getCoursesByInstructor(teacherId);
                //find out which premium courses that instructor is a part of
                //lock each of those premium courses (with utility method)
            }.bind(this))
            .then(function(courseIds){
                if(courseIds === "email not in license"){
                    return courseIds;
                }
                if(Array.isArray(courseIds) && courseIds.length > 0 && !poPendingStatus){
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
                } else if (results.length > 1 &&
                    !(results.length === 2 && (results[1].status === "po-pending" || results[1].status === "po-rejected" ||
                    (results[0].status === "invite-pending" || results[1].status === "invite-pending")))) {
                    state = "invalid records";
                } else if ((results[0]['license_id'] !== licenseId && results[1]['license_id'] !== licenseId) && results[0].status !== "po-received") {
                    state = "inconsistent";
                } else if(results[0]['license_id'] !== licenseId && results[0].status === "po-received"){
                    state = results[0]['license_id'];
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
    lConst = lConst || this.serviceManager.get("lic").lib.Const;
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
        emailData.subject = "Your Account has Been Updated!";
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

function _addTeachersEmailResponse(ownerName, ownerFirstName, ownerLastName, approvedUsers, approvedNonUsers, invitedUsers, plan, seatsTier, protocol, host){
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
    // make new email for invited users
    // just has messaging from educator-user-invited template for now
    var invitedUserTemplate = "educator-invited-optional";
    invitedUsers.forEach(function(user){
        email = user["EMAIL"];
        data = {};
        data.subject = "You’ve Been Invited!";
        data.ownerName = ownerName;
        data.ownerFirstName = ownerFirstName;
        data.ownerLastName = ownerLastName;
        data.teacherName = user["FIRST_NAME"] + " " + user["LAST_NAME"];
        data.teacherFirstName = user["FIRST_NAME"];
        data.teacherLastName = user["LAST_NAME"];
        data.plan = plan;
        data.seats = seatsTier;

        _sendEmailResponse.call(this, email, data, protocol, host, usersTemplate);
    }.bind(this));
}

function _sendEmailResponse(email, data, protocol, host, template){
    // to remove testing email spam, i've added a return. remove to test
    data._emailStored = email;
    return when.promise(function(resolve, reject){
        email = data._emailStored;
        delete data._emailStored;
        if(data.expirationDate){
            data.expirationDate = new Date(data.expirationDate);
        }
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
                        lConst = lConst || this.serviceManager.get("lic").lib.Const;
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
    res.end('api no longer used');
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
