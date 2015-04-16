/**
 * WebStore Module
 * Module dependencies:
 *  lodash - https://github.com/lodash/lodash
 *  when   - https://github.com/cujojs/when
 *
 */
// Third-party libs
var _     = require('lodash');
var when  = require('when');
// load at runtime
var MySQL, waConst, lConst, aConst;

module.exports = WebStore_MySQL;

var exampleIn = {}, exampleOut = {};

function WebStore_MySQL(options){
    // Glasslab libs
    MySQL   = require('../core/datastore.mysql.js');
    lConst  = require('../lms/lms.const.js');
    waConst = require('./dash.const.js');
    aConst  = require('../auth/auth.const.js');

    this.options = _.merge(
        {
            host    : "localhost",
            user    : "glasslab",
            password: "glasslab",
            database: "glasslab_dev"
        },
        options
    );

    this.ds = new MySQL(this.options);
}


WebStore_MySQL.prototype.connect = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    resolve();
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

// TODO: move this to auth
var exampleOutput = {};
exampleOutput.getUserInfo = {
    "id": 175,
    "username": "test2_s1",
    "lastName": "test2_s1",
    "firstName": "test2_s1",
    "email": "",
    "role": "student",
    "type": null,
    "institution": 10,
    "collectTelemetry": false,
    "enabled": true,
    "courses":
        [
            {
                "id": 8,
                "title": "test2",
                "role": "student",
                "studentCount": 0
            }
        ]
};

WebStore_MySQL.prototype.getUserInfoById = function(id) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        if(!id) {
            reject({"error": "failure", "exception": "invalid userId"}, 500);
            return;
        }

        var Q =
            "SELECT     \
                id,   \
                username,                  \
                first_name as firstName,   \
                last_name as lastName,     \
                email,                     \
                system_role as role, \
                user_type as type,         \
                institution_id as institution, \
                collect_Telemetry > 0 as collectTelemetry, \
                enabled > 0 as enabled, \
                login_Type as loginType, \
                ftue_checklist as ftue, \
                standards_view as standards \
            FROM GL_USER  \
            WHERE id="+ this.ds.escape(id);

        var user;
        this.ds.query(Q)
            .then(function(results) {
                if(results.length > 0) {
                    results = results[0];
                    results.collectTelemetry = results.collectTelemetry ? true : false;
                    results.enabled = results.enabled ? true : false;
                    // Returning default standards to display in the front-end
                    // TODO: remove this when we have clarity on the multi-standards design
                    results.standards = results.standards ? results.standards : "CCSS";
                    user = results;
                    if (user.role === "instructor" || user.role === "developer" || user.role === "admin"){
                        user.permits = aConst.permits[user.role];
                    }
                    if(results.role === "instructor"){
                        return this.getLicenseInfoByInstructor(id);
                    }
                    return [];
                } else {
                    return "none";
                }
            }.bind(this))
            .then(function(results){
                if(results === "none"){
                    return "none";
                } else if(results.length > 0){
                    return _addLicenseInfoToUser.call(this, user, results);
                }
            }.bind(this))
            .then(function(results){
                if(results === "none"){
                    reject({"error": "none found"}, 500);
                    return;
                }
                resolve(user);
            })
            .then(null, function(err) {
                    reject({"error": "failure", "exception": err}, 500);
            }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

function _addLicenseInfoToUser(user, results){
    return when.promise(function(resolve, reject){
        var license;
        var futureLicense;
        if(results.length === 1){
            license = results[0];
        } else if(results.length === 2){
            if(results[0].status === "active" || results[0].status === "po-received"){
                license = results[0];
                futureLicense = results[1];
            } else{
                license = results[1];
                futureLicense = results[0];
            }
        }
        var inviteLicense;
        user.licenseId = license["id"];
        user.licenseOwnerId = license["user_id"];
        user.licenseStatus = license["status"];
        user.paymentType = license["payment_type"];
        var packageType = license["package_type"];
        if(packageType === "trial" || packageType === "trialLegacy"){
            user.isTrial = true;
        } else{
            user.isTrial = false;
        }
        if(license["status"] === "po-pending" || license["status"] === "po-received" || license["status"] === "po-rejected"){
            user.purchaseOrderLicenseStatus = license["status"];
            user.purchaseOrderLicenseId = license.id;
        }
        if(license["status"] === "invite-pending"){
            inviteLicense = user.inviteLicense = {};
            inviteLicense.licenseId = futureLicense.id;
            inviteLicense.packageType = futureLicense.package_type;
            inviteLicense.owner = {};
            inviteLicense.owner.id = futureLicense.user_id;
        }
        if(results.length === 2){
            if(futureLicense["status"] === "po-pending" || futureLicense["status"] === "po-rejected"){
                user.purchaseOrderLicenseStatus = futureLicense["status"];
                user.purchaseOrderLicenseId = futureLicense.id;
            }
            if(futureLicense["status"] === "invite-pending") {
                inviteLicense = user.inviteLicense = {};
                inviteLicense.licenseId = futureLicense.id;
                inviteLicense.packageType = futureLicense.package_type;
                inviteLicense.owner = {};
                inviteLicense.owner.id = futureLicense.user_id;
            }
        }
        if( user.licenseStatus === "active" ||
            user.licenseStatus === "pending" ||
            user.licenseStatus === "po-received" ||
            user.licenseStatus === "po-rejected") {
            user.expirationDate = license["expiration_date"];
        }
        if(!inviteLicense){
            resolve();
            return;
        }
        // if an instructor is invited to another license and the instructor is already on a license
        // then we need to display information about the license owner who invited the teacher
        this.getUserById(inviteLicense.owner.id)
            .then(function(results){
                if(results){
                    var inviteLicenseOwner = user.inviteLicense.owner;
                    inviteLicenseOwner.email = results.EMAIL;
                    inviteLicenseOwner.firstName = results.FIRST_NAME;
                    inviteLicenseOwner.lastName = results.LAST_NAME;
                }
                resolve();
            })
            .then(null, function(err){
                console.error("Add License Info to User Error -",err);
                reject(err);
            });
    }.bind(this));
}

WebStore_MySQL.prototype.getUserById = function(userId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT * FROM GL_USER WHERE id = " + userId + ";";
        this.ds.query(Q)
            .then(function(results){
                resolve(results[0]);
            })
            .then(function(err){
                reject(err);
            });
    }.bind(this));
};

WebStore_MySQL.prototype.createChallengeSubmission = function(data) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    if(!data.challengeId) {
        resolve();
        return;
    }

    try{
        data.assessment  = data.assessment  ? JSON.stringify(data.assessment)  : "";
        data.connections = data.connections ? JSON.stringify(data.connections) : "";
        data.objects     = data.objects     ? JSON.stringify(data.objects)     : "";
    } catch (err) {
        reject(err);
        return;
    }

    // insert into DB
    var values = [
        "NULL",
        0,
        this.ds.escape(data.assessment),
        this.ds.escape(data.challengeId),
        this.ds.escape(data.connections),
        "NOW()",
        this.ds.escape(data.gameSessionId),
        "NOW()",
        this.ds.escape(data.objects),
        this.ds.escape(data.type)
    ];
    values = values.join(",");
    var Q = "INSERT INTO GL_CHALLENGE_SUBMISSION (" +
        "id," +
        "version," +
        "assessment," +
        "challenge_id," +
        "connections," +
        "date_created," +
        "game_session_id," +
        "last_updated," +
        "objects," +
        "type" +
        ") VALUES("+values+")";

    this.ds.query(Q).then(resolve, reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


exampleOut.getLicensedGameIdsFromUserId = {
    "SC": true
};
WebStore_MySQL.prototype.getLicensedGameIdsFromUserId = function(userId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    resolve( {} );
    return;
    var Q = "SELECT DISTINCT(game_id) as gameId \
             FROM GL_LICENSE l  \
             JOIN GL_LICENSE_MAP lm on lm.license_id=l.id \
             WHERE user_id \
               IN (SELECT DISTINCT(user_id) as userId \
                  FROM GL_MEMBERSHIP \
                  WHERE course_id \
                    IN (SELECT course_id \
                        FROM GL_MEMBERSHIP \
                        WHERE user_id="+this.ds.escape(userId);
        Q += ") AND (role='"+lConst.role.instructor+"' OR role='"+lConst.role.manager+"'))";

    //console.log("Q:", Q);
    this.ds.query(Q).then(function(results) {
            if(results.length > 0) {
                var gameIds = {};
                for(var i = 0; i < results.length; i++) {
                    // gameId is not case sensitive, always lowercase
                    gameIds[ results[i].gameId.toUpperCase() ] = true;
                }

                resolve( gameIds );
            } else {
                resolve({});
            }
        }.bind(this)
        , reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

WebStore_MySQL.prototype.getLicenseInfoByInstructor = function(userId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT lic.id,lic.user_id,lic.expiration_date,lic.package_type,lic.payment_type,lm.status FROM GL_LICENSE as lic JOIN\n" +
            "(SELECT license_id,status FROM GL_LICENSE_MAP\n" +
            "WHERE status in ('active','pending', 'po-received', 'po-rejected', 'po-pending', 'invite-pending') and user_id = " + userId+ ") as lm\n" +
            "ON lic.id = lm.license_id;";
        var licenseInfo;
        this.ds.query(Q)
            .then(function(results){
                if(results.length === 0){
                    resolve([]);
                    return;
                }
                resolve(results);
            }.bind(this))
            .then(null, function(err){
                console.error("Get License Info By Instructor Error -",err);
                reject(err);
            });
    }.bind(this));
};
