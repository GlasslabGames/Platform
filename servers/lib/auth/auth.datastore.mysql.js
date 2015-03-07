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
        var Q = "SELECT course_id FROM GL_MEMBERSHIP WHERE user_id = " + id + ";";
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
                        Q = preQ + courseId + ";";
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
                Q = "UPDATE GL_USER SET ftue_checklist = " + value + " WHERE id = " + id + ";";
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

Auth_MySQL.prototype.findUser = function(type, value) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    //console.log("_findUser type:", type, ", value:", value);

    var Q =
        "SELECT \
            id, \
            username as username,    \
            last_Name as lastName,   \
            first_Name as firstName, \
            email as email,          \
            password as password,    \
            system_Role as role, \
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
            ENABLED=1 AND ";

    value = this.ds.escape(value);
    if(_.isArray(value)) {
        Q += type+" in ("+value.join(',')+")";
    } else {
        // already escaped
        Q += type+"="+value;
    }

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
                        return this.getLicenseInfoByInstructor(user.id);
                    }
                }
                return [];
            } else {
                reject({"error": "user not found"});
            }
        }.bind(this))
        .then(function(license){
            if(typeof license === "string"){
                reject({"error": "user not found"});
            }
            if(!Array.isArray(license)){
                user.licenseId = license["id"];
                user.licenseOwnerId = license["user_id"];
                user.licenseStatus = license["status"];
                var packageType = license["package_type"];
                if (packageType === "trial") {
                    user.isTrial = true;
                } else {
                    user.isTrial = false;
                }
                if( user.licenseStatus === "active" ||
                    user.licenseStatus === "pending" ||
                    user.licenseStatus === "po-received" ||
                    user.licenseStatus === "po-rejected") {
                    user.expirationDate = license["expiration_date"];
                }
            }
            resolve(user);
        });
// ------------------------------------------------
}.bind(this));
// end promise wrapper
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
                    reject({key:"user.notUnique.screenName"});
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


Auth_MySQL.prototype.addUser = function(userData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var data = {
        id:             "NULL",
        version:        0,
        date_created:   "NOW()",
        enabled:        1,
        email:          this.ds.escape(userData.email),
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
        username:       this.ds.escape(userData.username),
        collect_telemetry:      0,
        login_type:     this.ds.escape(userData.loginType),
        ssoUsername:    this.ds.escape(userData.ssoUsername || ""),
        ssoData:        this.ds.escape(userData.ssoData || ""),
        verify_code:    "NULL",
        verify_code_expiration: "NULL",
        verify_code_status: "NULL",
        state:          this.ds.escape(userData.state),
        school:         this.ds.escape(userData.school),
        standards_view: this.ds.escape(userData.standards),
        ftue_checklist: "NULL"
    };

    if(userData.role === "instructor" || userData.role === "manager"){
        data.ftue_checklist = 0;
    }

    var keys   = _.keys(data);
    var values = _.values(data);
    values     = values.join(',');
    var Q      = "INSERT INTO GL_USER ("+keys+") VALUES("+values+")";

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

        var Q = "UPDATE GL_USER SET " + updateFieldsString + " WHERE id = " + existingId + ";";
        this.ds.query(Q)
            .then(function(data){
                resolve(data.insertId);
            }.bind(this))
            .then(null, function(err) {
                console.error("Update Temp User Error -",err);
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
        email:          this.ds.escape(userData.email),
        first_name:     this.ds.escape(userData.firstName),
        last_name:      this.ds.escape(userData.lastName),
        ssoUsername:    this.ds.escape(userData.ssoUsername || ""),
        ssoData:        this.ds.escape(userData.ssoData || ""),
        last_updated:   "NOW()"
    };

    if(userData.password) {
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
        var Q = "SELECT email FROM GL_USER WHERE id = " + userId;

        this.ds.query(Q)
            .then(function(results){
                resolve(results[0].email);
            })
            .then(function(err){
                reject(err);
            });
    }.bind(this));
};

Auth_MySQL.prototype.getLicenseInfoByInstructor = function(userId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT lic.id,lic.user_id,lic.expiration_date,lm.status FROM GL_LICENSE as lic JOIN\n" +
            "(SELECT license_id,status FROM GL_LICENSE_MAP\n" +
            "WHERE status in ('active','pending','po-received','po-rejected', 'po-pending') and user_id = " + userId+ ") as lm\n" +
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
                licenseInfo = results[0];
                resolve(licenseInfo);
            }.bind(this))
            .then(null, function(err){
                console.error("Get License Info By Instructor Error -",err);
                reject(err);
            });
    }.bind(this));
};
