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

WebStore_MySQL.prototype.getUserBadgeListById = function(id) {
    return when.promise(function(resolve, reject) {
        if(!id) {
            reject({"error": "failure", "exception": "invalid userId"}, 500);
            return;
        }

        var Q = "SELECT badge_list FROM GL_USER WHERE id="+ this.ds.escape(id);

        this.ds.query(Q)
            .then(function(results){
                var badge_list = JSON.parse( results[0].badge_list );
                resolve(badge_list);
            })
            .then(function(err){
                reject(err);
            });
    }.bind(this));
};

WebStore_MySQL.prototype.getResellers = function() {
    return when.promise(function(resolve, reject) {
        var Q = "SELECT id, username, first_name as firstName, last_name as lastName, email, system_role as role FROM GL_USER WHERE system_role='" + lConst.role.reseller + "' or system_role='" + lConst.role.reseller_candidate + "'";

        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(function(err){
                reject(err);
            });
    }.bind(this));
}

WebStore_MySQL.prototype.updateUserRole = function( id, role ) {
    if( ! ( id || role ) ) {
        reject({"error": "failure", "exception": "invalid argument"}, 500);
        return;
    }

    return when.promise(function(resolve, reject) {
        var Q = "UPDATE GL_USER SET system_role='" + role + "' WHERE id=" + id;

        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(function(err){
                reject(err);
            });
    }.bind(this));
}

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
                    if (user.role === "instructor" || user.role === "developer" || user.role === "admin" || user.role === "reseller"){
                        user.permits = aConst.permits[user.role];
                    }
                    if(results.role === "instructor"){
                        return this.getLicenseRecordsByInstructor(id);
                    }
                    return [];
                } else {
                    return "none";
                }
            }.bind(this))
            .then(function(results){
                if(!((results === "none")||(results.length===0))){
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
                return this.getLicenseInfoByInstructor(id);
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
        if (user.licenseStatus === "active") {
            user.packageType = packageType;
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
                console.errorExt("DashStore MySql", "Add License Info to User Error -",err);
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

// old licensing system.  these tables do not exist in the same way anymore.
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
        Q += ") AND (role='"+lConst.role.instructor+"'))";

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
        var Q = "SELECT lic.id,lic.user_id,lic.expiration_date,lic.package_type,lic.payment_type,lm.status,lm.date_created FROM GL_LICENSE as lic JOIN\n" +
            "(SELECT license_id,status,date_created FROM GL_LICENSE_MAP\n" +
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
                console.errorExt("DashStore MySql", "Get License Info By Instructor Error -",err);
                reject(err);
            });
    }.bind(this));
};

WebStore_MySQL.prototype.getLicenseRecordsByInstructor = function(userId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT lic.id,lic.user_id,lic.expiration_date,lic.package_type,lic.payment_type,lm.status,lm.date_created FROM GL_LICENSE as lic JOIN\n" +
            "(SELECT license_id,status,date_created FROM GL_LICENSE_MAP\n" +
            "WHERE user_id = " + userId+ ") as lm\n" +
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
                console.errorExt("DashStore MySql", "Get License Record Count By Instructor Error -",err);
                reject(err);
            });
    }.bind(this));
};

WebStore_MySQL.prototype.getReportDataP1 = function(userId){

    return when.promise(function(resolve, reject){

        var results;
        var Q = "SELECT * FROM GL_USER WHERE id = " + 263 + ";";
        this.ds.query(Q).then(function(results){

            // results = [ { id: 263, ...

            var funcOut = [];
            var vals = [];
            var keys = Object.keys(results[0]);
            keys.forEach(function(k) {
                vals.push(results[0][k]);
            });

            funcOut.push( vals.join('\n') );
            if(0 == funcOut.length){ funcOut = []; }
            resolve(funcOut);
        })
        .then(null, function(err){
            // console.log('XXXXXXXXXXXXXXXX  reject  XXXXXXXXXXXXXXXX');
            reject(err);
        });

    }.bind(this));
};


WebStore_MySQL.prototype.getReportDataP2 = function(argRole){

    return when.promise(function(resolve, reject){
        // do stuff including calling resolve() and reject()

        var Q;
        var roleSlang = 'users';
        var results;
        var dayx = 0;
        var imax = 60;
        var outlist = [];
        var i = 1000;
        var promiseArray =[];
        var funcOut = [];
        funcOut[0] = '';
        funcOut[1] = '';

        if(argRole == 'student') {
            roleSlang = 'students';
        }

        if(argRole == 'instructor') {
            roleSlang = 'teachers';
        }

        for(dayx = 0; dayx < imax; dayx++){

            promiseArray.push( when.promise( function(resolve, reject){

                // new users by  date (descending)
                Q = "SELECT DATE(date_created) as dt, COUNT(id) as num FROM GL_USER " +
                "WHERE ENABLED = 1 AND date_created IS NOT NULL " +
                "AND DATE(date_created) = DATE(DATE_SUB(NOW(), INTERVAL " + dayx + " DAY)) " +
                "AND (system_Role = 'instructor' OR system_Role = 'student') " +
                 ";";

    if(argRole == 'student') {
                // new students by  date (descending)
                Q = "SELECT DATE(date_created) as dt, COUNT(id) as num FROM GL_USER " +
                "WHERE ENABLED = 1 AND date_created IS NOT NULL " +
                "AND DATE(date_created) = DATE(DATE_SUB(NOW(), INTERVAL " + dayx + " DAY)) " +
                "AND system_Role = 'student' " +
                 ";";
    }

    if(argRole == 'instructor') {
                // new teachers by  date (descending)
                Q = "SELECT DATE(date_created) as dt, COUNT(id) as num FROM GL_USER " +
                "WHERE ENABLED = 1 AND date_created IS NOT NULL " +
                "AND DATE(date_created) = DATE(DATE_SUB(NOW(), INTERVAL " + dayx + " DAY)) " +
                "AND system_Role = 'instructor' " +
                 ";";
    }

                this.ds.query(Q).then(function(results){
                    ++i;
                    if( results[0].num > 0){
                        var countStr = ' '+ i + '   ' + results[0].dt + '  ' +
                            results[0].num + ' ' + roleSlang;
                        outlist.push( countStr );  // order not guarenteed
                        resolve( countStr );
                    }else{
                        resolve( ' ' + i );
                    }
                }.bind(this) )
                .then(null, function(err){
                    console.log('XXXXXXXXXXXXXXXX    getReportDataP2() reject ds.query ');
                    reject(err);
                }.bind(this));
            }.bind(this))   );
        }

        return when.all( promiseArray ).then(function(stuffArray){
            funcOut[0] = outlist.join('\n');
            // console.log('>>>>>>>> funcOut[0] \n' + funcOut[0]);
            // console.log('XXXXXXXXXXXXXXXX    when.all() resolve \n', stuffArray);
            resolve(funcOut);
        }.bind(this) ).then(null, function(err){
            console.log('XXXXXXXXXXXXXXXX    when.all() reject \n', err);
            reject(err);
        }.bind(this));

    }.bind(this));
};


WebStore_MySQL.prototype.getReportDataP3 = function(userId){

    return when.promise(function(resolve, reject){

        var results;
        var Q = "SELECT * FROM GL_USER WHERE id = " + 263 + ";";
        Q = "SELECT EMAIL FROM GL_USER;"
        this.ds.query(Q).then(function(results){

            // results = [ { id: 263, ...

            // console.log('XXXXXXXXXXXXXXXX  resolve  XXXX XXXX XXXX XXXX', results);

            var funcOut = [];
            var vals = [];

            results.forEach(function(el){
                // console.log('>>>>>>>>'+el[fileld]);
                console.log('>>>>>>>>'+el.EMAIL);
                console.log('    fff'+el.key);
            });

            // var keys = Object.keys(results[0]);
            // keys.forEach(function(k) {
            //     vals.push(results[0][k]);
            // });
            // funcOut.push( vals.join('\n') );

            // console.log('====++++ ', keys);
            // console.log('====++++ ', vals);

            funcOut = ["func out man."];

            if(0 == funcOut.length){ funcOut = []; }
            resolve(funcOut);

        })
        .then(null, function(err){
            // console.log('XXXXXXXXXXXXXXXX  reject  XXXXXXXXXXXXXXXX');
            reject(err);
        });

    }.bind(this));
};
