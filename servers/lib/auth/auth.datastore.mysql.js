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
var lConst;

module.exports = Auth_MySQL;

function Auth_MySQL(options){
    var MySQL;

    // Glasslab libs
    MySQL   = require('../core/datastore.mysql.js');
    lConst  = require('./auth.js').Const;

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
            var hasVerifyCode = false;
            var hasSSOUsername = false;
            var passwordLength255 = false;
            var promiseList = [];
            var Q = "";

            for(var i = 0; i < results.length; i++) {
                if(results[i]['Field'] == 'VERIFY_CODE') {
                    hasVerifyCode = true;
                }
                if(results[i]['Field'] == 'ssoUsername') {
                    hasSSOUsername = true;
                }

                if( (results[i]['Field'] == 'PASSWORD') &&
                    (results[i]['Type'] == 'varchar(255)') ) {
                    passwordLength255 = true;
                }
            }

            if(passwordLength255 && !hasVerifyCode) {
                updating = true;
                Q = "ALTER TABLE `GL_USER` \
                            CHANGE COLUMN `PASSWORD` `PASSWORD` TEXT NOT NULL , \
                            ADD COLUMN `VERIFY_CODE` VARCHAR(255) NULL DEFAULT NULL AFTER `LOGIN_TYPE`, \
                            ADD COLUMN `VERIFY_CODE_EXPIRATION` BIGINT(20) NULL DEFAULT NULL AFTER `VERIFY_CODE`,   \
                            ADD COLUMN `VERIFY_CODE_STATUS` VARCHAR(11) NULL DEFAULT NULL AFTER `VERIFY_CODE_EXPIRATION`";
                promiseList.push( this.ds.query(Q) );
            }

            if(!hasSSOUsername) {
                updating = true;
                Q = "ALTER TABLE `GL_USER` \
                           ADD COLUMN `ssoUsername` VARCHAR(255) NULL AFTER `LOGIN_TYPE`";
                promiseList.push( this.ds.query(Q) );
            }

            if(promiseList.length) {
                when.all(promiseList)
                    .then(function(results) {
                        //console.log(results);
                        resolve(true);
                    }.bind(this),
                    function(err) {
                        reject({"error": "failure", "exception": err}, 500);
                    }.bind(this) );
            }

            if(!updating) {
                resolve(false);
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
            verify_code_status as verifyCodeStatus \
        FROM \
            GL_USER \
        WHERE \
            ENABLED=1 AND ";

    value = this.ds.escape(value);
    if(_.isArray(value)) {
        Q += type+" in ("+value.join(',')+")";
    } else {
        Q += type+"="+this.ds.escape(value);
    }

    this.ds.query(Q)
        .then( function(data){
            // convert to usable userdata
            if(data.length > 0) {
                var user = [];
                for(var i = 0; i < data.length; i++) {
                    user[i] = data[i];
                    user[i].collectTelemetry = user[i].collectTelemetry ? true : false;
                    user[i].enabled = true;

                    // if not glasslab login type then set username to lms username
                    if( (user[i].loginType !== lConst.login.type.glassLabV2) &&
                        user[i].ssoUsername ) {
                        user[i].username = user[i].ssoUsername;
                    }
                }

                // if input not array then return a single user
                if(!_.isArray(value)) {
                    user = user[0];
                }
                resolve(user);
            } else {
                reject({"error": "user not found"});
            }
        }.bind(this), reject);
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

    var Q = "SELECT id FROM GL_USER WHERE LOWER(email)=LOWER("+this.ds.escape(email)+")";
    this.ds.query(Q)
        .then(
        function(data){
            if(data.length != 0) {
                reject({"key": "user.notUnique.email", statusCode: 400});
            } else {
                resolve();
            }
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
    var Q = "SELECT id FROM GL_USER WHERE LOWER(username)=LOWER("+this.ds.escape(username)+")";
    this.ds.query(Q)
        .then(
        function(data){
            if(data.length != 0) {
                if(noErrorOnFound) {
                    resolve(data[0].id);
                } else {
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
        verify_code:    "NULL",
        verify_code_expiration: "NULL",
        verify_code_status: "NULL"
    };

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
