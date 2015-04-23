# Lic Service
========

The license service is built to handle premium, trial, and basic subscription logic.
This includes games access based on plan, student and educators getting defined seat counts,
and creating license role distinctions between educator users and license owners.

Directory Structure
========

* Data Directory
    * Controller
        * license.js
    * email-templates
    * lic.const.js
    * lic.datastore.couchbase.js
    * lic.datastore.mysql.js
    * lic.README.md
    * lic.service.js

Controllers
========

All api methods are accessible through the routes.external.map.js file.

## license.js

**getSubscriptionPackages**

/api/v2/license/packages

Gets plan and seat details for the public facing subscription packages

**getCurrentPlan**

/api/v2/license/plan

Gets an instructor user's license subscription information for the premium manager page

**getStudentsInLicense**

/api/v2/license/students

Provides a list of students who are a part of an instructor user's license.  License owners will see all students on the plan.  Educator users on the license will only see their students.

**getBillingInfo**

/api/v2/license/billing

Retrieves a user's billing information from stripe.

**updateBillingInfo**

/api/v2/license/billing

Updates a user's billing information on stripe.

**subscribeToLicense**

/api/v2/license/subscribe

Subscribes a user to one of our public plans through a credit card purchase.  User goes from basic plan to a premium plan.

**subscribeToTrialLicense**

/api/v2/license/trial

Subscribes a user to a 60 day trial license. This gives 30 students and access to all premium games

**upgradeLicense**

/api/v2/license/upgrade

Upgrades a premium license from one plan to another.  Only available for credit card purchasers.

**upgradeTrialLicense**

/api/v2/license/trial/upgrade

Upgrades a user from a free trial to a year long license based on a plan of their choosing.  Charges credit card on stripe.

**validatePromoCode**

/api/v2/license/promo-code/:code

Checks if a promo code matches a valid coupon on stripe.  If coupon exists, sends coupon details to front end.

**cancelLicenseAutoRenew**

/api/v2/license/cancel

Cancels auto renew on stripe subscriptions. Deprecated feature since we make sure stripe auto renew is always disabled.

**enableLicenseAutoRenew**

/api/v2/license/renew

Enables auto renew on stripe subscriptions.  Deprecated feature since we make sure stripe auto renew is always disabled.

**addTeachersToLicense**

/api/v2/license/invite

Allows license owner to invite educators to his/her license.  Enrolls those teachers into a pending status on the license, unless they are not allowed to join.

**setLicenseMapStatusToActive

/api/v2/license/activate

Sets a user's license map status for a certain license to active, allowing full access to that license

**removeTeacherFromLicense

/api/v2/license/remove

Action by license owner to remove an educator from the license.  Educator loses access to all premium games and becomes a basic user.

**teacherLeavesLicense**

/api/v2/license/leave

Action by educator to leave a license.  Educator loses access to all premium games and becomes a basic user.

**subscribeToLicensePurchaseOrder**

/api/v2/license/subscribe/po

Begins the purchase order subscription process for basic user, creating license db info, but in an inactive state.
User is given a pending status, and lacks license access until Glass Lab receives a purchase order from him/her.

**upgradeTrialLicensePurchaseOrder**

api/v2/license/trial/upgrade/po

Begins the purchase order subscription process for moving from trials to a premium license.  User is put in pending status till purchase order is received, but still has trial access.

**getActivePurchaseOrderInfo**

/api/v2/license/po

Gets information about a purchase order to populate the purchase order status page.

**cancelActivePurchaseOrder**

/api/v2/license/po/cancel

Cancels a purchase order that has a pending status, triggered by a user button click.  Api only works for purchase orders with a pending status.

**setLicenseMapStatusToNull**

/api/v2/license/nullify

Sets a user's license map status for a particular license to null.

**receivePurchaseOrder**

/api/v2/license/po/receive

Internal api to mark that we have received a user's purchase order, upgrading user from pending status.  This gives user full license access.

**rejectPurchaseOrder**

/api/v2/license/po/reject"

Internal api that ends the purchase order process and permanently cancels created purchase order license records.
Can be done for a purchase order of any status except 'approved.'

**invoicePurchaseOrder**

/api/v2/license/po/invoice

Internal api that changes a purchase order from a received to an invoiced status.
This means that accounting has sent an invoice to the school and formally started the billing process.

**approvePurchaseOrder**

/api/v2/license/po/approve

Internal api that marks a purchase order as "approved", signifying Glass Lab has been fully paid for a user's subscription.
User is notified that the purchase order process is complete.

**migrateToTrialLegacy**

/api/v2/license/trial/legacy

One time api that migrated all beta users to a one time, year long license plan called trialLegacy, when we went to Glass Lab 1.0.
Should not be called again.

**cancelLicense**

/api/v2/license/end

Api that allows a license owner to cancel his/her license.
This permanently removes access to the license for the owner, educators, and all students on the plan, and removes premium game access.

**cancelLicenseInternal**

/api/v2/license/end/internal

Internal api that allows an admin to cancel a license owner's license.

**subscribeToLicenseInternal**

/api/v2/license/subscribe/internal

Api that allows a Glass Lab approved role of users to grant license access to a different user.  Designed for use by sales reps.

**inspectLicenses**

/api/v2/license/inspect

Method intended to be run once a night, at midnight.
Grabs all licenses, and checks if any are expiring, renewing, or is due for an expiring soon email.
Expire logic and license/trial ending soon emails are largely done, but the renew process still needs work.

**trialMoveToTeacher**

/api/v2/license/trial/move

Api that allows a user to move from a 60 day trial to an educator role on a license owner's license.  Trial is cancelled.

**verifyLicense**

/api/v2/license/:licenseKey/verify

Api is deprecated (old sim city licenses), and is designed around non existent sql tables.  Do not use.

**getLicenses**

/api/v2/license/current

Api is deprecated (old sim city licenses), and is designed around non existent sql tables.  Do not use.

**registerLicense**

api/v2/license/register

Api is deprecated (old sim city licenses), and is designed around non existent sql tables.  Do not use.
