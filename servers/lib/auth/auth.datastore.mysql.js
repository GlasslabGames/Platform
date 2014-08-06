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

module.exports = Auth_MySQL;

function Auth_MySQL(options){
    var MySQL;

    // Glasslab libs
    MySQL   = require('../core/datastore.mysql.js');

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
                for(var i = 0; i < results.length; i++) {

                    if( (results[i]['Field'] == 'PASSWORD') &&
                        (results[i]['Type'] == 'varchar(255)') &&
                        !results[i].hasOwnProperty('VERIFY_CODE') ) {

                        updating = true;
                        // need to update
                        var Q = "ALTER TABLE `GL_USER` \
                                CHANGE COLUMN `PASSWORD` `PASSWORD` TEXT NOT NULL , \
                                ADD COLUMN `VERIFY_CODE` VARCHAR(255) NULL DEFAULT NULL AFTER `LOGIN_TYPE`, \
                                ADD COLUMN `VERIFY_CODE_EXPIRATION` BIGINT(20) NULL DEFAULT NULL AFTER `VERIFY_CODE`,   \
                                ADD COLUMN `VERIFY_CODE_STATUS` VARCHAR(11) NULL DEFAULT NULL AFTER `VERIFY_CODE_EXPIRATION`";
                        this.ds.query(Q)
                            .then(function(results) {
                                //console.log(results);
                                resolve(true);
                            }.bind(this),
                            function(err) {
                                reject({"error": "failure", "exception": err}, 500);
                            }.bind(this)
                        );
                    }
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
                institution_id as institution, \
                collect_Telemetry as collectTelemetry, \
                reset_Code as resetCode, \
                reset_Code_Expiration as resetCodeExpiration, \
                reset_Code_Status as resetCodeStatus \
            FROM \
                GL_USER \
            WHERE \
                ENABLED=1 AND \
                "+type+"="+this.ds.escape(value);

        this.ds.query(Q)
            .then( function(data){
                // convert to usable userdata
                if(data.length > 0) {
                    var user = data[0];
                    user.collectTelemetry = user.collectTelemetry[0] ? true : false;
                    user.enabled = true;

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
                    reject({key: "user.notUnique.email"});
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

Auth_MySQL.prototype.getUserByEmail = function(email){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var Q = "SELECT " +
            "id, " +
            "username, " +
            "email, " +
            "first_name as firstName, " +
            "last_name as lastName, " +
            "system_role as role, " +
            "institution_id as institutionId " +
            "FROM GL_USER WHERE email="+this.ds.escape(email);
        this.ds.query(Q)
            .then(
            function(data){
                if( !data ||
                    !_.isArray(data) ||
                    data.length < 1) {
                    reject({"error": "user not found"}, 404);
                    return;
                }

                resolve(data[0]);
            }.bind(this),
            function(err) {
                reject({"error": "failure", "exception": err}, 500);
            }.bind(this)
        );
// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};


Auth_MySQL.prototype.getUserById = function(id){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var Q = "SELECT " +
            "id, " +
            "username, " +
            "email, " +
            "first_name as firstName, " +
            "last_name as lastName, " +
            "system_role as role, " +
            "institution_id as institutionId " +
            "FROM GL_USER WHERE id="+this.ds.escape(id);
        this.ds.query(Q)
            .then(
            function(data){
                if( !data ||
                    !_.isArray(data) ||
                    data.length < 1) {
                    reject({"error": "user not found"}, 404);
                    return;
                }

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
            login_type:     this.ds.escape(userData.loginType)
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

Auth_MySQL.prototype.updateUserData = function(userData){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var data = {
            username:       this.ds.escape(userData.username),
            email:          this.ds.escape(userData.email),
            first_name:     this.ds.escape(userData.firstName),
            last_name:      this.ds.escape(userData.lastName),
            last_updated:   "NOW()"
        };

        if(userData.password) {
            data.password = this.ds.escape(userData.password);
        }

        if(userData.reset_code) {
            userData.resetCode = userData.reset_code;
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
                data.reset_Code_Expiration = "NULL";
            } else {
                data.reset_Code_Expiration = this.ds.escape(userData.resetCodeExpiration);
            }
        }
        if(userData.resetCodeStatus) {
            if(userData.resetCodeStatus == "NULL") {
                data.reset_Code_Status = "NULL";
            } else {
                data.reset_Code_Status = this.ds.escape(userData.resetCodeStatus);
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
                resolve(userData.id);
            }.bind(this),
            function(err) {
                reject({"error": "failure", "exception": err}, 500);
            }.bind(this)
        );
// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

Auth_MySQL.prototype.getUserDataFromResetCode = function(code){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        var Q = "SELECT * FROM GL_USER WHERE reset_code="+this.ds.escape(code);
        this.ds.query(Q)
            .then(
            function(data){
                if(data.length > 0) {
                    resolve(data[0]);
                } else {
                    reject({"error": "data validation", "key": "code.not.valid"});
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
