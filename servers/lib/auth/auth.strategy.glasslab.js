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


function Glasslab_Strategy(options, service) {
    this.options = options;

    // Glasslab libs
    Util   = require('../core/util.js');
    MySQL  = require('../core/datastore.mysql.js');
    lConst = require('../lms/lms.js').Const;
    aConst = require('./auth.js').Const;

    this._service       = service;
    this._usernameField = 'username';
    this._passwordField = 'password';
    this._verifyCodeField = 'verifyCode';

    passport.Strategy.call(this);
    this.name = 'glasslab';
}

/**
 * Inherit from `passport.Strategy`.
 */
util.inherits(Glasslab_Strategy, passport.Strategy);

Glasslab_Strategy.prototype.authenticate = function(req) {
    var username = lookup(req.body, this._usernameField) || lookup(req.query, this._usernameField);
    var password = lookup(req.body, this._passwordField) || lookup(req.query, this._passwordField);
    var verifyCode = lookup(req.body, this._verifyCodeField) || lookup(req.query, this._verifyCodeField);

    if ((!username || !password) && !verifyCode) {
        return this.fail({key:"user.login.missing"});
    }
    if (verifyCode) {
        this._verifyOneShotHashCode(verifyCode)
            .then(function(userData) {
                this.success(userData.user, userData.info);
            }.bind(this))
            .then(null, function(err) {
                console.log(err);
                return this.fail({key:"user.login.invalidHashCode"});
            }.bind(this));
    } else {
        this._verify(username, password)
            .then(
            function (userData) {
                this.success(userData.user, userData.info);
            }.bind(this),
            function (err) {
                if (!err.user) {
                    // invalid username or password
                    return this.fail({key:"user.login.invalid"});
                } else {
                    // email not verified
                    return this.fail({key: err.key});
                }
            }.bind(this)
        );
    }


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
Glasslab_Strategy.prototype._verifyOneShotHashCode = function(verifyCode) {
return when.promise(function(resolve, reject) {
    this._service.getAuthStore().findUser('verify_code', verifyCode)
        .then(function (userData) {
            // sets verify code to null after verified
            userData.verifyCode = "NULL";
            resolve({user: userData, error: null});
        })
        .then(null, function (err) {
            reject(err);
        });
}.bind(this));
}

Glasslab_Strategy.prototype._verify = function(username, password, done){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    // try username
    this._service.getAuthStore().findUser("username", username)
        // error, try email
        .then(null, function(err){
            return this._service.getAuthStore().findUser("email", username);
        }.bind(this))
        // valid user
        .then(function(user){
            if(!_.isObject(user)) {
                return resolve({user: null, info: {error: 'Unknown user ' + username} });
            }

            this._verifyPassword(password, user)
                .then(
                    function(){

                        // check if email verified
                        if (user.verifyCodeStatus === 'beta') {
                            reject({user: user, key: "user.login.betaPending"});
                        } else if (user.verifyCodeStatus === 'verified' || process.env.HYDRA_ENV === 'dev') {
                            delete user.password;
                            resolve({user: user, error: null});
                        } else {
                            // email not verified
                            reject({user: user, key: "user.login.notVerified"});
                        }

                    }.bind(this),
                    // errors
                    function(err){
                        // invalid password or user
                        reject({user: null, key:  err});
                }.bind(this));
        }.bind(this))
        // catch all errors
        .then(null, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};




Glasslab_Strategy.prototype.isValidEmail = function(email){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    this._service.getAuthStore().checkUserEmailUnique(email)
        .then(function(){
                resolve(false);
            }.bind(this),
            function(err){
                // not.unique == exists
                if(err.key == "user.notUnique.email") {
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
    if( userData.role == lConst.role.instructor ||
        userData.role == lConst.role.manager ) {
        //console.log("Auth registerUserRoute - institution isEmail:", check(userData.email).isEmail());
        // if no email -> error
        if( !userData.email ||
            !userData.email.length ) {
            reject({"error": "missing email for "+userData.role});
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

    this._service.getAuthStore().checkUserEmailUnique(userData.email)
        // check UserName
        .then(function(){
            return this._service.getAuthStore().checkUserNameUnique(userData.username);
        }.bind(this))
        // encrypt password
        .then(function(){
            return this.encryptPassword(userData.password);
        }.bind(this))
        // add user
        .then(function(password){
            userData.password  = password;
            userData.loginType = aConst.login.type.glassLabV2;

            return this._service.getAuthStore().addUser(userData);
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
            return this._service.getAuthStore().updateUserPassword(user.id, password, aConst.login.type.glassLabV2);
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

// loads of permission checks are done before update the DB data
Glasslab_Strategy.prototype.updateUserData = function(userData, loginUserSessionData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var dbUserData;
    var sessionDataChanged = false;
    // if logged in user session data is nothing then is ALWAYS self
    if(!loginUserSessionData) {
        loginUserSessionData = { id: userData.id };
    }
    var isSelf = (loginUserSessionData.id == userData.id);

    // get/validate user by Id
    this._service.getAuthStore().findUser('id', userData.id)
        .then(function(data){
            dbUserData = data;

            // role can not be changed
            userData.role = dbUserData.role;

            // remove password so it's not added to userData
            var password = dbUserData.password;
            delete dbUserData.password;
            // merge the db userData into userData (fill in missing data)
            userData = _.merge(_.cloneDeep(dbUserData), userData);
            // add password back
            dbUserData.password = password;

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

                return this._service.getAuthStore().checkUserEmailUnique(userData.email);
            } else {
                return Util.PromiseContinue();
            }
        }.bind(this))

        // check UserName, if changed
        .then(function(){
            // If Instructors OR managers, then username is the same as there email
            if( ( (userData.role == lConst.role.instructor) ||
                  (userData.role == lConst.role.manager) ) &&
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

                return this._service.getAuthStore().checkUserNameUnique(userData.username);
            } else {
                return Util.PromiseContinue();
            }
        }.bind(this))

        // verify password if needed
        .then(function(){
            if(userData.password) {
                if (!this._isEncrypted(userData.password)) {
                    // passing old password to salt new password to validate
                    return this._comparePassword(userData.password, dbUserData.password);
                } else {
                    return userData.password;
                }
            } else {
                return dbUserData.password;
            }
        }.bind(this))

        // if password changed update
        // if other changes update, flag for sessions update
        .then(function(password){
            // password changed
            if(password && dbUserData.password != password) {
                userData.resetCode = "NULL";
                userData.resetCodeExpiration = "NULL";
                userData.resetCodeStatus = "NULL";
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

            return this._service.getAuthStore().updateUserDBData(userData);
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

Glasslab_Strategy.prototype._isEncrypted = function(password) {
    var eType      = aConst.encrypt.type.pdkdf2;
    var eAlgo      = aConst.encrypt.algo.hmacsha1;

    var parts = password.split(":");
    if( (parts[0] == eType) ||
        (parts[1] == eAlgo)
      ){
        return true;
    } else {
        return false;
    }
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
    else if(loginUserData.role == lConst.role.admin) {
        resolve(userData);
    }
    // if instructor, then check if student their course
    else if(loginUserData.role == lConst.role.instructor) {
        this._service.getLMSStore().isEnrolledInInstructorCourse(userData.id, loginUserData.id)
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
