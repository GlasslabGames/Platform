/**
 * LMS Module
 * Module dependencies:
 *  lodash - https://github.com/lodash/lodash
 *  when   - https://github.com/cujojs/when
 *
 */
// Third-party libs
var _      = require('lodash');
var when   = require('when');
//
var aConst;

module.exports = Auth_MySQL;

function Auth_MySQL(options){
    var MySQL;

    // Glasslab libs
    MySQL   = require('../core/datastore.mysql.js');
    aConst  = require('./auth.js').Const;

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

Auth_MySQL.prototype.connect = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    resolve();
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


Auth_MySQL.prototype.updateUserTable = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "DESCRIBE GL_USER";
    this.ds.query(Q)
        .then(function(results) {
            var updating = false;

            var passwordLength255 = false;
            var hasVerifyCode = false;
            var hasSSOData = false;
            var hasState = false;
            var hasSchool = false;
            var hasFtueChecklist = false;
            var hasLastLogin = false;
            var hasBadgeList = false;

            var promiseList = [];
            var Q = "";

            for (var i = 0; i < results.length; i++) {
                if (results[i]['Field'] == 'ssoData') {
                    hasSSOData = true;
                }

                if ((results[i]['Field'] == 'PASSWORD') &&
                    (results[i]['Type'] == 'varchar(255)')) {
                    passwordLength255 = true;
                }

                if (results[i]['Field'] == 'VERIFY_CODE') {
                    hasVerifyCode = true;
                }

                if (results[i]['Field'] == 'STATE') {
                    hasState = true;
                }
                if (results[i]['Field'] == 'PHONE_NUMBER') {
                    hasPhoneNumber = true;
                }
                if (results[i]['Field'] == 'SCHOOL') {
                    hasSchool = true;
                }

                if (results[i]['Field'] == "ftue_checklist") {
                    hasFtueChecklist = true;
                }

                if (results[i]['Field'] == "last_login") {
                    hasLastLogin = true;
                }

                if (results[i]['Field'] == "badge_list") {
                    hasBadgeList = true;
                }
            }

            if (passwordLength255 && !hasVerifyCode) {
                updating = true;
                Q = "ALTER TABLE `GL_USER` \
                            CHANGE COLUMN `PASSWORD` `PASSWORD` TEXT NOT NULL , \
                            ADD COLUMN `VERIFY_CODE` VARCHAR(255) NULL DEFAULT NULL AFTER `LOGIN_TYPE`, \
                            ADD COLUMN `VERIFY_CODE_EXPIRATION` BIGINT(20) NULL DEFAULT NULL AFTER `VERIFY_CODE`,   \
                            ADD COLUMN `VERIFY_CODE_STATUS` VARCHAR(11) NULL DEFAULT NULL AFTER `VERIFY_CODE_EXPIRATION`";
                promiseList.push(this.ds.query(Q));
            }

            if (!hasSSOData) {
                updating = true;
                Q = "ALTER TABLE `GL_USER` \
                           ADD COLUMN `ssoUsername` VARCHAR(255) NULL AFTER `LOGIN_TYPE`, \
                           ADD COLUMN `ssoData` TEXT NULL AFTER `ssoUsername` ";
                promiseList.push(this.ds.query(Q));
            }

            if (!hasState) {
                updating = true;
                Q = "ALTER TABLE `GL_USER` \
                           ADD COLUMN `STATE` VARCHAR(225) NULL DEFAULT NULL AFTER      `VERIFY_CODE_STATUS`";
                promiseList.push(this.ds.query(Q));
            }

            if (!hasSchool) {
                updating = true;
                Q = "ALTER TABLE `GL_USER` \
                           ADD COLUMN `SCHOOL` VARCHAR(255) NULL DEFAULT NULL AFTER `STATE`";
                promiseList.push(this.ds.query(Q));
            }

            if (!hasFtueChecklist) {
                updating = true;
                Q = "ALTER TABLE GL_USER \
                           ADD COLUMN ftue_checklist TINYINT(1) DEFAULT NULL AFTER SCHOOL";
                promiseList.push(this.ds.query(Q));
            }

            if (!hasLastLogin) {
                console.log('                ALTER TABLE GL_USER ADD COLUMN last_login DATETIME NULL DEFAULT NULL AFTER last_updated ');
                updating = true;
                Q = "ALTER TABLE GL_USER ADD COLUMN last_login DATETIME NULL DEFAULT NULL AFTER last_updated ";
                promiseList.push(this.ds.query(Q));
            }

            if (!hasBadgeList) {
                console.log('                ALTER TABLE GL_USER ADD COLUMN badge_list TEXT NULL DEFAULT NULL AFTER standards_view ');
                updating = true;
                Q = "ALTER TABLE GL_USER ADD COLUMN badge_list TEXT NULL DEFAULT NULL AFTER standards_view ";
                promiseList.push(this.ds.query(Q));
            }

            // if (hasLastLogin) {
            //     console.log('                ALTER TABLE GL_USER DROP COLUMN last_login ');
            //     updating = true;
            //     Q = "ALTER TABLE GL_USER DROP COLUMN last_login";
            //     promiseList.push(this.ds.query(Q));
            // }

            if (promiseList.length) {
                when.all(promiseList)
                    .then(function(results) {
                        if (!hasFtueChecklist) {
                            return this.setInstructorsFtueStatuses();
                        }
                    }.bind(this))
                    .then(function(){
                        resolve(true);
                    })
                    .then(null, function(err) {
                        reject({"error": "failure", "exception": err}, 500);
                    }.bind(this));
            }
            if (!updating) {
                resolve(false);
            }
        }.bind(this),
        function (err) {
            reject({"error": "failure", "exception": err}, 500);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Auth_MySQL.prototype.setInstructorsFtueStatuses = function(){
    return when.promise(function(resolve, reject){
        var Q = "SELECT id FROM GL_USER WHERE SYSTEM_ROLE = 'instructor';";
        return this.ds.query(Q)
            .then(function(results){
                var id;
                var instructorFtues = [];
                results.forEach(function(result){
                    id = result.id;
                    instructorFtues.push(this.setInstructorFtue(id));
                }.bind(this));
                return when.all(instructorFtues);
            }.bind(this))
            .then(function(){
                resolve();
            })
            .then(null, function(err){
                reject(err);
            });
    }.bind(this));
};

Auth_MySQL.prototype.setInstructorFtue = function(id){
    return when.promise(function(resolve, reject){
        var Q = "SELECT course_id FROM GL_MEMBERSHIP WHERE user_id = " + this.ds.escape(id) + ";";
        this.ds.query(Q)
            .then(function(results){
                if(results.length === 0){
                    return 0
                } else{
                    var courses = [];
                    var courseId;
                    var preQ = "SELECT user_id FROM GL_MEMBERSHIP WHERE course_id = ";
                    results.forEach(function(course){
                        courseId = course.course_id;
                        Q = preQ + this.ds.escape(courseId) + ";";
                        courses.push(this.ds.query(Q));
                    }.bind(this));
                    return when.all(courses);
                }
            }.bind(this))
            .then(function(courses){
                var value;
                if(courses === 0){
                    value = 0;
                } else{
                    var hasStudent = courses.some(function(course){
                        if(course.length > 1){
                            return true;
                        }
                    });
                    if(hasStudent){
                        value = 4;
                    } else{
                        value = 2;
                    }
                }
                Q = "UPDATE GL_USER SET ftue_checklist = " + this.ds.escape(value)
                    + " WHERE id = " + this.ds.escape(id) + ";";
                return this.ds.query(Q);
            }.bind(this))
            .then(function(){
                resolve();
            })
            .then(null, function(err){
                reject(err);
            });
    }.bind(this));
};

Auth_MySQL.prototype.findUser = function(type, value, includePassword) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    //console.log("_findUser type:", type, ", value:", value, ", includePassword:", includePassword);

    var Q =
        "SELECT \
            id, \
            username as username,    \
            last_Name as lastName,   \
            first_Name as firstName, \
            email as email," +
            (includePassword === true ? "password as password," : "") +
            "system_Role as role, \
            USER_TYPE as type,       \
            login_Type as loginType, \
            ssoUsername, \
            institution_id as institutionId, \
            collect_Telemetry > 0 as collectTelemetry, \
            reset_Code as resetCode, \
            reset_Code_Expiration as resetCodeExpiration, \
            reset_Code_Status as resetCodeStatus, \
            verify_code as verifyCode, \
            verify_code_expiration as verifyCodeExpiration, \
            verify_code_status as verifyCodeStatus, \
            standards_view as standards \
        FROM \
            GL_USER \
        WHERE \
            ENABLED=1 AND " + this.ds.escapeId(type) + " IN ("+this.ds.escape(value)+")";

    //console.log("Q:", Q);
    var user;
    this.ds.query(Q)
        .then( function(data){
            // convert to usable userdata
            if(data.length > 0) {
                user = [];
                for(var i = 0; i < data.length; i++) {
                    user[i] = data[i];
                    user[i].collectTelemetry = user[i].collectTelemetry ? true : false;
                    user[i].enabled = true;

                    // if not glasslab login type then set username to lms username
                    if( (user[i].loginType !== aConst.login.type.glassLabV2) &&
                        user[i].ssoUsername ) {
                        user[i].username = user[i].ssoUsername;
                    }
                    // add user permissions object
                    user[i].permits = aConst.permits[user[i].role];

                    // Returning default standards to display in the front-end
                    // TODO: remove this when we have clarity on the multi-standards design
                    user[i].standards = user[i].standards ? user[i].standards : "CCSS";
                }

                // if input not array then return a single user
                if(!_.isArray(value)) {
                    user = user[0];
                    if(user["verifyCodeStatus"] === "invited"){
                        return "tempUser";
                    } else if(user.role === "instructor"){
                         return this.getLicenseRecordsByInstructor(user.id);
                    }
                }
                return [];
            } else {
                reject({"error": "user not found"});
            }
        }.bind(this))
        .then(function(results){
            if (_.isArray(value)) {
                return [];
            }
            if(!((results === "none") || (results.length===0))){
                // any license results are sufficient for "hadTrial" (I believe if they paid and expired, they cannot get a trial.  IF this is not true, we'll might need to add a column to track trial usage after all.)
                user.hadTrial = true;
                user.hadSubscribe = false;
				for (i=0;i<results.length;i++) {
					if (results[i].package_type !== 'trial') {
						user.hadSubscribe = true;
						break;
					}
				}
            }
            return this.getLicenseInfoByInstructor(user.id);
        }.bind(this))
        .then(function(results){
            if(typeof results === "string"){
                reject({"error": "user not found"});
                return;
            }
            // if gained results, add all relevant license information
            if(results.length > 0) {
                return _addLicenseInfoToUser.call(this, user, results);
            }
        }.bind(this))
        .then(function(){
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
        if (packageType === "trial" || packageType === "trialLegacy") {
            user.isTrial = true;
        } else {
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
            inviteLicense.dateInvited = futureLicense.date_created;
            inviteLicense.paymentType = futureLicense.payment_type;
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
                inviteLicense.dateInvited = futureLicense.date_created;
                inviteLicense.paymentType = futureLicense.payment_type;
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
            }.bind(this))
            .then(null,function(err){
                console.errorExt("AuthService MySQL", "Add License Info to User Error -",err);
                reject(err);
            });
    }.bind(this));
}

Auth_MySQL.prototype.updateUserBadgeList = function(userId, badgeList) {
    return when.promise(function(resolve, reject) {
        var badgeListStr = JSON.stringify( badgeList );

        var Q = "UPDATE GL_USER " +
            "SET last_updated=NOW(), " +
            "badge_list=" + this.ds.escape(badgeListStr) + " " +
            "WHERE id=" + this.ds.escape(userId);

        this.ds.query(Q).then( resolve, reject );
    }.bind(this));
};

Auth_MySQL.prototype.updateUserPassword = function(id, password, loginType) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var Q = "UPDATE GL_USER " +
        "SET last_updated=NOW(), " +
        "password="+this.ds.escape(password)+", " +
        "login_type="+this.ds.escape(loginType)+" " +
        "WHERE id="+this.ds.escape(id);

    this.ds.query(Q).then( resolve, reject );
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Auth_MySQL.prototype.checkUserEmailUnique = function(email){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    // if email blank, then return ok
    if(!email || !email.length ) resolve();

    var Q = "SELECT id,verify_code_status FROM GL_USER WHERE LOWER(email)=LOWER("+this.ds.escape(email)+")";
    this.ds.query(Q)
        .then(
        function(data){
            if(data.length !== 0) {
                if(data[0]["verify_code_status"] === "invited"){
                    resolve(data[0].id);
                } else{
                    reject({"key": "user.notUnique.email", statusCode: 400});
                }
            }
            resolve();
        }.bind(this),
        function(err) {
            reject({"error": "failure", "exception": err, statusCode: 500});
        }.bind(this)
    );
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Auth_MySQL.prototype.checkUserNameUnique = function(username, noErrorOnFound){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var Q = "SELECT id,verify_code_status FROM GL_USER WHERE LOWER(username)=LOWER("+this.ds.escape(username)+")";
    this.ds.query(Q)
        .then(
        function(data){
            if(data.length !== 0) {
                if(noErrorOnFound) {
                    resolve(data[0].id);
                } else if(data[0]["verify_code_status"] === "invited") {
                    resolve(data[0].id);
                } else{
                    reject({key:"user.notUnique.screenName", statusCode: 400});
                }
            } else {
                resolve();
            }
        }.bind(this),
        function(err) {
            reject({"error": "failure", "exception": err}, 500);
        }.bind(this)
    );
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Auth_MySQL.prototype.checkUserNamesUnique = function(usernames){
// add promise wrapper
	return when.promise(function(resolve, reject) {
// ------------------------------------------------
        var usernameString = "";
        for (var i=0; i<usernames.length; i++) {
	        usernameString += "LOWER("+this.ds.escape(usernames[i])+")";
	        if (i<usernames.length-1) {
	            usernameString += ", ";
            }
        }
		var Q = "SELECT LOWER(username) FROM GL_USER WHERE LOWER(username) in ("+usernameString+")";
		this.ds.query(Q)
			.then(
				function(data){
				    resolve(data);
				}.bind(this),
				function(err) {
					reject({"error": "failure", "exception": err}, 500);
				}.bind(this)
			);
// ------------------------------------------------
	}.bind(this));
// end promise wrapper
};

Auth_MySQL.prototype.addUser = function(userData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var data = {
        id:             "NULL",
        version:        0,
        date_created:   "NOW()",
        enabled:        1,
        email:          this.ds.escape(userData.email.toLowerCase()),
        first_name:     this.ds.escape(userData.firstName),
        last_name:      this.ds.escape(userData.lastName),
        institution_id: userData.institutionId ? this.ds.escape(userData.institutionId) : "NULL",
        last_updated:   "NOW()",
        password:       this.ds.escape(userData.password),
        reset_code:     "NULL",
        reset_code_expiration:  "NULL",
        reset_code_status:      "NULL",
        system_role:    this.ds.escape(userData.role),
        user_type:      "NULL",
        username:       this.ds.escape(userData.username.toLowerCase()),
        collect_telemetry:      0,
        login_type:     this.ds.escape(userData.loginType),
        ssoUsername:    this.ds.escape(userData.ssoUsername || ""),
        ssoData:        this.ds.escape(userData.ssoData || ""),
        verify_code:    userData.verifyCode ? this.ds.escape(userData.verifyCode) : "NULL",
        verify_code_expiration: "NULL",
        verify_code_status: userData.verifyCodeStatus ? this.ds.escape(userData.verifyCodeStatus) : "NULL",
        state:          this.ds.escape(userData.state),
        school:         this.ds.escape(userData.school),
        standards_view: this.ds.escape(userData.standards),
        ftue_checklist: "NULL"
    };

    if(userData.role === "instructor"){
        data.ftue_checklist = 0;
    }

    var keys   = _.keys(data);
    var values = _.values(data);
    values     = values.join(',');
    var Q      = "INSERT INTO GL_USER ("+keys+") VALUES("+values+")";

    this.ds.query(Q)
        .then(
        function(data){
            // console.log(Util.DateGMTString(), 'Auth_MySQL.prototype.addUser() -- success ');
            resolve(data.insertId);
        }.bind(this),
        function(err) {
            reject({"error": "failure", "exception": err}, 500);
        }.bind(this)
    );
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Auth_MySQL.prototype.updateTempUser = function(userData, existingId){
    return when.promise(function(resolve, reject){
        var updateFields = [
            'version = 0',
            'date_created = NOW()',
            'enabled = 1',
            'first_name = ' + this.ds.escape(userData.firstName),
            'last_name = ' + this.ds.escape(userData.lastName),
            'institution_id = ' + (userData.institutionId ? this.ds.escape(userData.institutionId) : "NULL"),
            'last_updated = NOW()',
            'password = ' + this.ds.escape(userData.password),
            'reset_code = NULL',
            'reset_code_expiration = NULL',
            'reset_code_status = NULL',
            'system_role = ' + this.ds.escape(userData.role),
            'user_type = NULL',
            'collect_telemetry = 0',
            'login_type = ' + this.ds.escape(userData.loginType),
            'ssoUsername = ' + this.ds.escape(userData.ssoUsername || ""),
            'ssoData = ' + this.ds.escape(userData.ssoData || ""),
            'verify_code = NULL',
            'verify_code_expiration = NULL',
            'verify_code_status = NULL',
            'state = ' + this.ds.escape(userData.state),
            'school = ' + this.ds.escape(userData.school),
            'ftue_checklist = 0'
        ];

        var updateFieldsString = updateFields.join(", ");

        var Q = "UPDATE GL_USER SET " + updateFieldsString + " WHERE id = " + this.ds.escape(existingId) + ";";
        this.ds.query(Q)
            .then(function(data){
                resolve(data.insertId);
            }.bind(this))
            .then(null, function(err) {
                console.errorExt("AuthService MySQL", "Update Temp User Error -",err);
                reject({"error": "failure", "exception": err}, 500);
            }.bind(this));
    }.bind(this));
};

Auth_MySQL.prototype.updateUserDBData = function(userData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var data = {
        username:       this.ds.escape(userData.username),
        email:          this.ds.escape(userData.email.toLowerCase()),
        first_name:     this.ds.escape(userData.firstName),
        last_name:      this.ds.escape(userData.lastName),
        ssoUsername:    this.ds.escape(userData.ssoUsername || ""),
        ssoData:        this.ds.escape(userData.ssoData || ""),
        last_updated:   "NOW()"
    };

    if(userData.password !== undefined) {
        data.password = this.ds.escape(userData.password);
    }
    if(userData.resetCode) {
        if(userData.resetCode == "NULL") {
            data.reset_code = "NULL";
        } else {
            data.reset_code = this.ds.escape(userData.resetCode);
        }
    }
    if(userData.resetCodeExpiration) {
        if(userData.resetCodeExpiration == "NULL") {
            data.reset_code_expiration = "NULL";
        } else {
            data.reset_code_expiration = this.ds.escape(userData.resetCodeExpiration);
        }
    }
    if(userData.resetCodeStatus) {
        if(userData.resetCodeStatus == "NULL") {
            data.reset_code_status = "NULL";
        } else {
            data.reset_code_status = this.ds.escape(userData.resetCodeStatus);
        }
    }
    if(userData.verifyCode) {
        if(userData.verifyCode == "NULL") {
            data.verify_code = "NULL";
        } else {
            data.verify_code = this.ds.escape(userData.verifyCode);
        }
    }
    if(userData.verifyCodeExpiration) {
        if(userData.verifyCodeExpiration == "NULL") {
            data.verify_code_expiration = "NULL";
        } else {
            data.verify_code_expiration = this.ds.escape(userData.verifyCodeExpiration);
        }
    }
    if(userData.verifyCodeStatus) {
        if(userData.verifyCodeStatus == "NULL") {
            data.verify_code_status = "NULL";
        } else {
            data.verify_code_status = this.ds.escape(userData.verifyCodeStatus);
        }
    }
    if(userData.ftue) {
        if (userData.ftue == "NULL") {
            data.ftue_checklist = "NULL";
        } else {
            data.ftue_checklist = this.ds.escape(userData.ftue);
        }
    }
    if(userData.standards) {
        if (userData.standards == "NULL") {
            data.standards_view = "NULL";
        } else {
            data.standards_view = this.ds.escape(userData.standards);
        }
    }
    if(userData.enabled !== undefined){
        if(userData.enabled === 1){
            data.enabled = 1;
        } else if(userData.enabled === 0){
            data.enabled = 0;
        }
    }
    if(userData.institutionId){
        if(userData.institutionId === "NULL"){
            data.institution_id = "NULL";
        } else{
            data.institution_id = this.ds.escape(userData.institutionId);
        }
    }
    if(userData.customerId){
        if(userData.customerId === "NULL"){
            data.customer_id = "NULL";
        } else{
            data.customer_id = this.ds.escape(userData.customerId);
        }
    }

    // build set list
    var values = _.map(data, function(value, key){
        return key+"="+value;
    });
    values     = values.join(',');
    var Q      = "UPDATE GL_USER SET "+values+" WHERE id="+this.ds.escape(userData.id);

    this.ds.query(Q)
        .then(
        function(data){
            resolve(data.insertId);
        }.bind(this),
        function(err) {
            reject({"error": "failure", "exception": err}, 500);
        }.bind(this)
    );
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Auth_MySQL.prototype.getUserEmail = function(userId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT email FROM GL_USER WHERE id = " + this.ds.escape(userId);

        this.ds.query(Q)
            .then(function(results){
                resolve(results[0].email);
            })
            .then(function(err){
                reject(err);
            });
    }.bind(this));
};

Auth_MySQL.prototype.getUserById = function(userId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT * FROM GL_USER WHERE id = " + this.ds.escape(userId);

        this.ds.query(Q)
            .then(function(results){
                resolve(results[0]);
            })
            .then(function(err){
                reject(err);
            });
    }.bind(this));
};

Auth_MySQL.prototype.getLicenseInfoByInstructor = function(userId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT lic.id,lic.user_id,lic.expiration_date,lic.package_type,lic.payment_type,lm.status,lm.date_created FROM GL_LICENSE as lic JOIN\n" +
            "(SELECT license_id,status,date_created FROM GL_LICENSE_MAP\n" +
            "WHERE status in ('active','pending','po-received','po-rejected', 'po-pending', 'invite-pending') and user_id = " + this.ds.escape(userId)+ ") as lm\n" +
            "ON lic.id = lm.license_id;";
        var licenseInfo;
        this.ds.query(Q)
            .then(function(results){
                if(results.length === 0){
                    resolve([]);
                    return;
                }
                // if a user is on a trial and has a pending purchase order subscription
                // I cannot show that user's po-pending license map status, because i have to show the trial status
                resolve(results);
            }.bind(this))
            .then(null, function(err){
                console.errorExt("AuthService MySQL", "Get License Info By Instructor Error -",err);
                reject(err);
            });
    }.bind(this));
};

Auth_MySQL.prototype.getLicenseRecordsByInstructor = function(userId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT lic.id,lic.user_id,lic.expiration_date,lic.package_type,lic.payment_type,lm.status,lm.date_created FROM GL_LICENSE as lic JOIN\n" +
            "(SELECT license_id,status,date_created FROM GL_LICENSE_MAP\n" +
            "WHERE user_id = " + this.ds.escape(userId)+ ") as lm\n" +
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
                console.errorExt("AuthService MySQL", "Get License Record Count By Instructor Error -",err);
                reject(err);
            });
    }.bind(this));
};

Auth_MySQL.prototype.getDevelopersByVerifyCode = function(verifyCode){
    return when.promise(function(resolve, reject){
        var Q = "SELECT id, FIRST_NAME, LAST_NAME, EMAIL, date_created, DATE_FORMAT(date_created, '%m/%d/%Y') AS pretty_date FROM GL_USER WHERE SYSTEM_ROLE = 'developer' AND VERIFY_CODE_STATUS IN (" + this.ds.escape(verifyCode) + ");";
        return this.ds.query(Q)
            .then(function(results){
                var developers = [];
                results.forEach(function(result){
                    developers.push({ id: result.id, name: result.FIRST_NAME + ' ' + result.LAST_NAME, email: result.EMAIL, date: result.pretty_date, fulldate: result.date_created });
                }.bind(this));
                return when.all(developers);
            }.bind(this))
            .then(function(results){ 
                resolve(results);
            }.bind(this))
            .then(null, function(err){
                reject(err);
            });
    }.bind(this));
};

Auth_MySQL.prototype.deleteShadowUser = function(username) {
    return when.promise(function(resolve, reject){
        //var Q = 'DELETE FROM GL_USER WHERE username='" + username + "' AND VERIFY_CODE_STATUS='shadow';";
        var Q = "UPDATE GL_USER SET username="+this.ds.escape("failmultireg{" + username + "}")+", VERIFY_CODE_STATUS=NULL WHERE username=" + this.ds.escape(username) + " AND VERIFY_CODE_STATUS='shadow';";
        return this.ds.query(Q)
            .then(function(results){ 
                resolve(results);
            }.bind(this))
            .then(null, function(err){
                reject(err);
            });
    }.bind(this));
}
