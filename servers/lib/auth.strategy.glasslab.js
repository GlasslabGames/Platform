/**
 * Authentication Server Module
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  passport   - https://github.com/jaredhanson/passport
 */
var crypto   = require('crypto');
var util     = require('util');
// Third-party libs
var _        = require('lodash');
var passport = require('passport')
// Glasslab libs
var MySQL    = require('./datastore.mysql.js');


module.exports = Glasslab_Strategy;


function Glasslab_Strategy(options) {
    this.options = options;

    this._usernameField = 'username';
    this._passwordField = 'password';

    passport.Strategy.call(this);
    this.name = 'glasslab';

    this.ds = new MySQL(this.options.datastore.mysql);
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

    this._verify(username, password,
        function verified(err, user, info) {
            if (err) { return this.error(err); }
            if (!user) { return this.fail(info); }
            this.success(user, info);
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
    console.log("Auth: check user/pass");

    this._findUser("username", username, function(err, user) {
            if(err) {
                return done(err);
            }

            if(!_.isObject(user)) {
                return done(null, false, { message: 'Unknown user ' + username });
            }

            var sha256 = crypto.createHash('sha256');
            sha256.update(password, 'utf8');
            hpass = sha256.digest('base64');

            if(hpass != user.password) {
                return done(null, false, { message: 'Invalid password' });
            }

            //console.log("Login OK");
            // clear password so it's not saved in the session
            delete user.password;

            done(err, user);
        }.bind(this)
    );
};

Glasslab_Strategy.prototype._findUser = function(type, value, cb) {
    //console.log("_findUser type:", type, ", value:", value);

    var findBy_Q =
        "SELECT \
            id, \
            USERNAME as username,    \
            LAST_NAME as lastName,   \
            FIRST_NAME as firstName, \
            EMAIL as email,          \
            PASSWORD as password,    \
            SYSTEM_ROLE as role,     \
            USER_TYPE as type,       \
            institution_id as institution,        \
            COLLECT_TELEMETRY as collectTelemetry \
        FROM \
            GL_USER \
        WHERE \
            ENABLED=1 AND \
            "+type+"="+this.ds.escape(value);

    this.ds.query(findBy_Q, function(err, data){

        // convert to usable userdata
        var user = data[0];
        user.collectTelemetry = user.collectTelemetry[0] ? true : false;
        user.enabled = true;

        cb(err, user);
    });
};
