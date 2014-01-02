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
var aConst, MySQL;

module.exports = Glasslab_Strategy;


function Glasslab_Strategy(options) {
    this.options = options;

    // Glasslab libs
    MySQL  = require('./datastore.mysql.js');
    aConst = require('./auth.js').Const;

    this._usernameField = 'username';
    this._passwordField = 'password';

    passport.Strategy.call(this);
    this.name = 'glasslab';

    this.ds = new MySQL(this.options.webapp.datastore.mysql);
    // Connect to data store
    this.ds.testConnection();
}

/**
 * Inherit from `passport.Strategy`.
 */
util.inherits(Glasslab_Strategy, passport.Strategy);

Glasslab_Strategy.prototype.authenticate = function(req) {
    var username = lookup(req.body, this._usernameField) || lookup(req.query, this._usernameField);
    var password = lookup(req.body, this._passwordField) || lookup(req.query, this._passwordField);

    if (!username || !password) {
        return this.fail('Missing credentials');
        //return this.fail(new BadRequestError(options.badRequestMessage || 'Missing credentials'));
    }

    this._verify(username, password)
        .then(
            function (user, info) {
                if (!user) {
                    return this.fail(info);
                }
                this.success(user, info);
            }.bind(this),
            function (err) {
                this.error(err);
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
    console.log("Auth: check user/pass");

    // try username
    this._findUser("username", username)
        // error, try email
        .then(null, function(user){
            return this._findUser("email", username);
        }.bind(this))
        // valid user
        .then(function(user){
            if(!_.isObject(user)) {
                return resolve(false, { message: 'Unknown user ' + username });
            }

            this.verifyPassword(password, user)
                .then(function(){
                    //console.log("Login OK");
                    // clear password so it's not saved in the session
                    delete user.password;
                    resolve(user);
                }.bind(this))
                // errors
                .then(null, function(err){
                    resolve(false, { message: err.message });
                }.bind(this));
        }.bind(this))
        // catch all errors
        .then(null, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Glasslab_Strategy.prototype._findUser = function(type, value, cb) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    //console.log("_findUser type:", type, ", value:", value);

    var Q =
        "SELECT \
            id, \
            USERNAME as username,    \
            LAST_NAME as lastName,   \
            FIRST_NAME as firstName, \
            EMAIL as email,          \
            PASSWORD as password,    \
            SYSTEM_ROLE as role,     \
            USER_TYPE as type,       \
            LOGIN_TYPE as loginType, \
            institution_id as institution, \
            COLLECT_TELEMETRY as collectTelemetry \
        FROM \
            GL_USER \
        WHERE \
            ENABLED=1 AND \
            "+type+"="+this.ds.escape(value);

    this.ds.query(Q, function(err, data){
        if(err) {
            reject(err);
        }

        // convert to usable userdata
        if(data.length > 0) {
            var user = data[0];
            user.collectTelemetry = user.collectTelemetry[0] ? true : false;
            user.enabled = true;

            resolve(user);
        } else {
            reject(null);
        }
    });
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
    this.ds.query(Q, function(err, data){
        if(err) {
            reject({"error": "failure", "exception": err}, 500);
            return;
        }
        resolve();
    });
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Glasslab_Strategy.prototype.checkUserEmailUnique = function(email){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    // if email blank, then return ok
    if(!email || !email.length ) resolve();

    var Q = "SELECT id FROM GL_USER WHERE email="+this.ds.escape(email);
    this.ds.query(Q, function(err, data){
        if(err) {
            reject({"error": "failure", "exception": err}, 500);
            return;
        }

        if(data.length != 0) {
            reject({"error": "data validation", "key": "email.not.unique"});
        } else {
            resolve();
        }

    });
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Glasslab_Strategy.prototype.checkUserNameUnique = function(username){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var Q = "SELECT id FROM GL_USER WHERE username="+this.ds.escape(username);
    this.ds.query(Q, function(err, data){
        if(err) {
            reject({"error": "failure", "exception": err}, 500);
            return;
        }

        if(data.length != 0) {
            reject({"error": "data validation", "key": "username.not.unique"});
        } else {
            resolve();
        }
    });
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Glasslab_Strategy.prototype.registerUser = function(userData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // if instructor or manager check email
    if( userData.systemRole == aConst.role.instructor ||
        userData.systemRole == aConst.role.manager ) {
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

    this.checkUserEmailUnique(userData.email)
        // check UserName
        .then(function(){
            return this.checkUserNameUnique(userData.username)
        }.bind(this))
        // encrypt password
        .then(function(){
            return this.encryptPassword(userData.password)
        }.bind(this))
        //
        .then(function(password){
            userData.password  = password;
            userData.loginType = aConst.login.type.glassLabV2;

            var values = [
                "NULL",  // id
                0,       // version
                "NOW()", // date created
                1,       // enabled
                this.ds.escape(userData.email),
                this.ds.escape(userData.firstName),
                this.ds.escape(userData.lastName),
                this.ds.escape(userData.institutionId),
                "NOW()", // last updated
                this.ds.escape(userData.password),
                "NULL",  // reset code
                "NULL",  // reset code expiration
                "NULL",  // reset code status
                this.ds.escape(userData.systemRole),
                "NULL",  // user type
                this.ds.escape(userData.username),
                0,       // collect telemetry
                this.ds.escape(userData.loginType)
            ];
            values = values.join(',');

            var Q = "INSERT INTO GL_USER (" +
                "id," +
                "version," +
                "date_created," +
                "enabled," +
                "email," +
                "first_name," +
                "last_name," +
                "institution_id," +
                "last_updated," +
                "password," +
                "reset_code," +
                "reset_code_expiration," +
                "reset_code_status," +
                "system_role," +
                "user_type," +
                "username," +
                "collect_telemetry," +
                "login_type" +
                ") VALUES("+values+")";

            this.ds.query(Q, function(err, data){
                if(err) {
                    reject({"error": "failure", "exception": err}, 500);
                    return;
                }
                resolve(data.insertId);
            });
        }.bind(this))
        // catch all errors
        .then(null, function(err, code){
            return reject(err, code);
        }.bind(this));
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Glasslab_Strategy.prototype.encryptPassword = function(password){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var iterations = 10000;
    var keyLength  = 64;

    var salt = crypto.randomBytes(64).toString('base64');
    crypto.pbkdf2(password, salt, iterations, keyLength, function(err, derivedKey) {
        if(err) {
            reject({"error": "failure", "exception": err}, 500);
            return;
        }

        var password = aConst.encrypt.type.pdkdf2 +
            ":" + aConst.encrypt.algo.hmacsha1 +
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

Glasslab_Strategy.prototype.verifyPassword = function(givenPassword, user){
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
                this.migratePasswordToPDKDF2(givenPassword, user, resolve, reject);
            } else {
                reject({"error": "invalid password"});
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
                            reject({"error": "invalid password"});
                        }
                    });
                } else {
                    reject({"error": "invalid password type or algorithum"});
                }
            } else {
                reject({"error": "invalid password type"});
            }
        } else {
            reject({"error": "invalid login type"});
        }
// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

Glasslab_Strategy.prototype.migratePasswordToPDKDF2 = function(givenPassword, user, resolve, reject){
    this.encryptPassword(givenPassword)
        .then(function(password){
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

