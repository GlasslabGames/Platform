/**
 * Authentication Server Module
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  when       - https://github.com/cujojs/when
 *  passport   - https://github.com/jaredhanson/passport
 */
var crypto   = require('crypto');
var util     = require('util');
// Third-party libs
var _        = require('lodash');
var when     = require('when');
var passport = require('passport');
var check    = require('validator').check;

// load at runtime
// Glasslab libs
var Util, aConst, lConst, MySQL;

module.exports = Glasslab_Strategy;


function Glasslab_Strategy(options) {
    this.options = options;

    // Glasslab libs
    Util   = require('../core/util.js');
    MySQL  = require('../core/datastore.mysql.js');
    lConst = require('../lms/lms.js').Const;
    aConst = require('./auth.js').Const;

    this._usernameField = 'username';
    this._passwordField = 'password';

    passport.Strategy.call(this);
    this.name = 'glasslab';

    this.ds = new MySQL(this.options.webapp.datastore.mysql);
}

/**
 * Inherit from `passport.Strategy`.
 */
util.inherits(Glasslab_Strategy, passport.Strategy);

Glasslab_Strategy.prototype.authenticate = function(req) {
    var username = lookup(req.body, this._usernameField) || lookup(req.query, this._usernameField);
    var password = lookup(req.body, this._passwordField) || lookup(req.query, this._passwordField);
    //console.log("authenticate body:", req.body);

    if (!username || !password) {
        return this.fail({error: 'Missing credentials'});
    }

    this._verify(username, password)
        .then(
            function (data) {
                if (!data.user) {
                    return this.fail(data.info);
                }
                this.success(data.user, data.info);
            }.bind(this),
            function (err) {
                // respond with generic answer
                this.fail({error: "invalid username or password", key:"invalid"});
            }.bind(this)
    );

    function lookup(obj, field) {
        if (!obj) { return null; }

        var chain = field.split(']').join('').split('[');
        for (var i = 0, len = chain.length; i < len; i++) {
            var prop = obj[chain[i]];

            if (typeof(prop) === 'undefined') { return null; }
            if (typeof(prop) !== 'object') { return prop; }

            obj = prop;
        }
        return null;
    }
};

Glasslab_Strategy.prototype._verify = function(username, password, done){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    //console.log("Auth: check user/pass");

    // try username
    this.findUser("username", username)
        // error, try email
        .then(null, function(user){
            return this.findUser("email", username);
        }.bind(this))
        // valid user
        .then(function(user){
            if(!_.isObject(user)) {
                return resolve({user: null, info: {error: 'Unknown user ' + username} });
            }

            this._verifyPassword(password, user)
                .then(
                    function(){
                        //console.log("Login OK");
                        // clear password so it's not saved in the session
                        delete user.password;
                        resolve({user: user, info: null});
                    }.bind(this),
                    // errors
                    function(err){
                        resolve({user: null, info: err});
                }.bind(this));
        }.bind(this))
        // catch all errors
        .then(null, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Glasslab_Strategy.prototype.findUser = function(type, value) {
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
            system_Role as systemRole, \
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

Glasslab_Strategy.prototype._updateUserPassword = function(id, password, loginType) {
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

Glasslab_Strategy.prototype._checkUserEmailUnique = function(email){
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
                    reject({"error": "data validation", "key": "email.not.unique"});
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

Glasslab_Strategy.prototype._checkUserNameUnique = function(username){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var Q = "SELECT id FROM GL_USER WHERE LOWER(username)=LOWER("+this.ds.escape(username)+")";
    this.ds.query(Q)
        .then(
            function(data){
                if(data.length != 0) {
                    reject({"error": "data validation", "key": "username.not.unique"});
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

Glasslab_Strategy.prototype.getUserByEmail = function(email){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "SELECT " +
        "id, " +
        "username, " +
        "email, " +
        "first_name as firstName, " +
        "last_name as lastName, " +
        "system_role as systemRole, " +
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


Glasslab_Strategy.prototype.getUserById = function(id){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "SELECT " +
        "id, " +
        "username, " +
        "email, " +
        "first_name as firstName, " +
        "last_name as lastName, " +
        "system_role as systemRole, " +
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


Glasslab_Strategy.prototype.addUser = function(userData){
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
        system_role:    this.ds.escape(userData.systemRole),
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


Glasslab_Strategy.prototype.updateUserDataInDS = function(userData){
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

Glasslab_Strategy.prototype.getUserDataFromResetCode = function(code){
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
}


Glasslab_Strategy.prototype.isValidEmail = function(email){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    this._checkUserEmailUnique(email)
        .then(function(){
                resolve(false);
            }.bind(this),
            function(err){
                // not.unique == exists
                if(err.key == "email.not.unique") {
                    resolve(true);
                } else {
                    reject(err);
                }

            }.bind(this));
// ------------------------------------------------
}.bind(this));
// end promise wrapper
}

Glasslab_Strategy.prototype.registerUser = function(userData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // if instructor or manager check email
    if( userData.systemRole == lConst.role.instructor ||
        userData.systemRole == lConst.role.manager ) {
        //console.log("Auth registerUserRoute - institution isEmail:", check(userData.email).isEmail());
        // if no email -> error
        if( !userData.email ||
            !userData.email.length ) {
            reject({"error": "missing email for "+userData.systemRole});
            return;
        }
    }

    // if email exists then check it's validity
    if( userData.email && userData.email.length ) {
        try{
            check(userData.email).isEmail();
        } catch (err) {
            reject({"error": "invalid email"});
            return;
        }
    }

    this._checkUserEmailUnique(userData.email)
        // check UserName
        .then(function(){
            return this._checkUserNameUnique(userData.username);
        }.bind(this))
        // encrypt password
        .then(function(){
            return this.encryptPassword(userData.password);
        }.bind(this))
        // add user
        .then(function(password){
            userData.password  = password;
            userData.loginType = aConst.login.type.glassLabV2;

            return this.addUser(userData);
        }.bind(this))
        // added user
        .then(function(userId){
            resolve(userId);
        }.bind(this))
        // catch all errors
        .then(null, function(err, code){
            return reject(err, code);
        }.bind(this));
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Glasslab_Strategy.prototype.encryptPassword = function(password, passwordScheme){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var eType      = aConst.encrypt.type.pdkdf2;
    var eAlgo      = aConst.encrypt.algo.hmacsha1;
    var iterations = 10000;
    var keyLength  = 64;
    var salt       = crypto.randomBytes(64).toString('base64');

    // is password scheme passed in then use settings
    if(passwordScheme) {
        var parts = passwordScheme.split(":");
        iterations = parseInt(parts[2]);
        keyLength  = parseInt(parts[3]);
        salt       = parts[4];
    }

    crypto.pbkdf2(password, salt, iterations, keyLength, function(err, derivedKey) {
        if(err) {
            reject({"error": "failure", "exception": err}, 500);
            return;
        }

        var password = eType +
            ":" + eAlgo +
            ":" + iterations +
            ":" + keyLength +
            ":" + salt +
            ":" + derivedKey.toString('base64');

        resolve(password);
    });
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Glasslab_Strategy.prototype._verifyPassword = function(givenPassword, user){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
        if(user.loginType == aConst.login.type.glassLabV1) {
            // fallback to old password type
            var sha256 = crypto.createHash('sha256');
            sha256.update(givenPassword, 'utf8');
            var hpass = sha256.digest('base64');

            if(hpass == user.password) {
                // update password to use new password strength
                this._migratePasswordToPDKDF2(givenPassword, user, resolve, reject);
            } else {
                reject({"error": "invalid username or password"});
            }
        }
        else if(user.loginType == aConst.login.type.glassLabV2) {
            var sp = user.password.split(":");

            if(sp.length) {
                var p = {
                    type: sp[0],
                    algo: sp[1],
                    iter: parseInt(sp[2]),
                    kLen: parseInt(sp[3]),
                    salt: sp[4],
                    key:  sp[5]
                };

                if( p.type == aConst.encrypt.type.pdkdf2 &&
                    p.algo == aConst.encrypt.algo.hmacsha1)
                {
                    crypto.pbkdf2(givenPassword, p.salt, p.iter, p.kLen, function(err, derivedKey) {
                        if(err) {
                            reject({"error": "failure", "exception": err}, 500);
                            return;
                        }

                        if(derivedKey.toString('base64') == p.key) {
                            resolve();
                        } else {
                            reject({"error": "invalid username or password"});
                        }
                    });
                } else {
                    // invalid password type or algorithum
                    reject({"error": "invalid username or password", code: 101});
                }
            } else {
                // invalid password type
                reject({"error": "invalid password type", code: 102});
            }
        } else {
            // invalid login type
            reject({"error": "invalid login type", code: 103});
        }
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Glasslab_Strategy.prototype._migratePasswordToPDKDF2 = function(givenPassword, user, resolve, reject){
    this.encryptPassword(givenPassword)
        .then(function(password){
            user.password = password;
            return this._updateUserPassword(user.id, password, aConst.login.type.glassLabV2);
        }.bind(this))
        // all ok
        .then(function(){
            resolve();
        }.bind(this))
        // catch all errors
        .then(null, function(err, code){
            reject(err, code);
        }.bind(this));
};


Glasslab_Strategy.prototype._comparePassword = function(givenPassword, storedPassword){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    // encrypt password using stored password scheme
    this.encryptPassword(givenPassword, storedPassword)
        // if encrypted Given Password
        // encrypt password using new salt and default format
        .then(function(encryptedGivenPassword){
            if( encryptedGivenPassword &&
                storedPassword != encryptedGivenPassword) {
                return this.encryptPassword(givenPassword);
            } else {
                resolve(storedPassword);
            }
        }.bind(this))
        // sent new password back
        .then(function(password){
            resolve(password);
        }.bind(this))
        .then(null, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


Glasslab_Strategy.prototype.updateUserData = function(userData, loginUserSessionData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var dbUserData;
    var sessionDataChanged = false;
    var isSelf = (loginUserSessionData.id == userData.id);

    // get/validate user by Id
    this.getUserById(userData.id)
        .then(function(data){
            dbUserData = data[0];
            return this.checkUserPerminsToUserData(userData, loginUserSessionData);
        }.bind(this))

        // check email, if changed
        .then(function(){
            if(userData.email.toLowerCase() != dbUserData.email.toLowerCase()) {
                // if self, update session data
                if(isSelf) {
                    loginUserSessionData.email = userData.email;
                    sessionDataChanged = true;
                }

                return this._checkUserEmailUnique(userData.email);
            } else {
                return Util.PromiseContinue();
            }
        }.bind(this))

        // check UserName, if changed
        .then(function(){
            // If Instructors OR managers, then username is the same as there email
            if( ( (userData.systemRole == lConst.role.instructor) ||
                  (userData.systemRole == lConst.role.manager) ) &&
                  userData.email
              ) {
                userData.username = userData.email;
            }

            // only if same user
            if(userData.username.toLowerCase() != dbUserData.username.toLowerCase()) {

                // if self, update session data
                if(isSelf) {
                    // update session data
                    loginUserSessionData.email = userData.email;
                    sessionDataChanged = true;
                }

                return this._checkUserNameUnique(userData.username);
            } else {
                return Util.PromiseContinue();
            }
        }.bind(this))

        // verify password if needed
        .then(function(){
            if(userData.password) {
                // passing old password to salt new password to validate
                return this._comparePassword(userData.password, dbUserData.PASSWORD);
            }
        }.bind(this))

        // if password changed update
        .then(function(password){
            // password changed
            if(password && dbUserData.PASSWORD != password) {
                userData.resetCode = "NULL";
            }
            // set password to encrypted version
            userData.password = password;

            if(userData.firstName != dbUserData.firstName) {
                // if self, update session data
                if(isSelf) {
                    // update session data
                    loginUserSessionData.firstName = userData.firstName;
                    sessionDataChanged = true;
                }
            }
            if(userData.lastName != dbUserData.lastName) {
                // if self, update session data
                if(isSelf) {
                    // update session data
                    loginUserSessionData.lastName = userData.lastName;
                    sessionDataChanged = true;
                }
            }

            return this.updateUserDataInDS(userData);
        }.bind(this))

        // all ok
        .then(function(){
            // remove resetCode, password before sending back
            delete userData.resetCode;
            delete userData.password;
            resolve({changed: sessionDataChanged, user: userData});
        }.bind(this))

        // catch all errors
        .then(null, function(err, code){
            reject(err, code);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


Glasslab_Strategy.prototype.checkUserPerminsToUserData = function(userData, loginUserData){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        // check if you are the same as the Id to change
        if(loginUserData.id == userData.id) {
            resolve(userData);
        }
        // are admin
        else if(loginUserData.systemRole == lConst.role.admin) {
            resolve(userData);
        }
        // if instructor, then check if student their course
        else if(loginUserData.systemRole == lConst.role.instructor) {
            this._isEnrolledInInstructorCourse(userData.id, loginUserData.id)
                .then(
                    // all ok
                    function(){
                        resolve(userData);
                    }.bind(this),

                    // error
                    function(err, code){
                        if(code != 500) {
                            reject({"error": "user does not have permission"}, 403);
                        } else {
                            reject(err, code);
                        }
                    }.bind(this)
                );
        }
        else {
            reject({"error": "user does not have permission"}, 403);
        }

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};


// TODO move to LMS
Glasslab_Strategy.prototype._isEnrolledInInstructorCourse = function(studentId, instructorId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q =
        "SELECT " +
            "m1.* " +
        "FROM " +
            "GL_MEMBERSHIP m1 " +
        "JOIN " +
            "(SELECT course_id FROM GL_MEMBERSHIP WHERE user_id="+this.ds.escape(instructorId)+") m2 on m1.course_id=m2.course_id " +
        "WHERE " +
            "m1.role='student' AND " +
            "m1.user_id="+this.ds.escape(studentId);

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
}
