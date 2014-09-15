/**
 * Module dependencies.
 */
var util = require('util')
    , OAuth2Strategy     = require('passport-oauth').OAuth2Strategy
    , InternalOAuthError = require('passport-oauth').InternalOAuthError;

var _ = require('lodash');

// load at runtime
// Glasslab libs
var aConst, lConst;

/**
 * `Strategy` constructor.
 *
 * The Edmodo authentication strategy authenticates requests by delegating to
 * Edmodo using the OAuth 2.0 protocol.
 *
 * Applications must supply a `verify` callback which accepts an `accessToken`,
 * `refreshToken` and service-specific `profile`, and then calls the `done`
 * callback supplying a `user`, which should be set to `false` if the
 * credentials are not valid.  If an exception occured, `err` should be set.
 *
 * Options:
 *   - `clientID`      your Edmodo application's client id
 *   - `clientSecret`  your Edmodo application's client secret
 *   - `callbackURL`   URL to which Edmodo will redirect the user after granting authorization
 *
 * Examples:
 *
 *     passport.use(new EdmodoStrategy({
 *         clientID: '123-456-789',
 *         clientSecret: 'shhh-its-a-secret'
 *         callbackURL: 'https://www.example.net/auth/edmodo/callback'
 *       },
 *       function(accessToken, refreshToken, profile, done) {
 *         User.findOrCreate(..., function (err, user) {
 *           done(err, user);
 *         });
 *       }
 *     ));
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
function Strategy(options, verify) {
    options.authorizationURL = 'https://api.edmodo.com/oauth/authorize';
    options.tokenURL         = 'https://api.edmodo.com/oauth/token';

    lConst = require('../lms/lms.js').Const;
    aConst = require('./auth.js').Const;

    OAuth2Strategy.call(this, options, verify);
    this.name = 'edmodo';
}

/**
 * Inherit from `OAuth2Strategy`.
 */
util.inherits(Strategy, OAuth2Strategy);


/**
 * Retrieve user profile from Edmodo.
 *
 * This function constructs a normalized profile, with the following properties:
 *
 *   - `provider`         always set to `edmodo`
 *   - `id`
 *   - `username`
 *   - `displayName`
 *
 * @param {String} accessToken
 * @param {Function} done
 * @api protected
 */
Strategy.prototype.userProfile = function(accessToken, done) {
    this._getUserProfile('https://api.edmodo.com/users/me', accessToken, done);
};

Strategy.prototype._getUserProfile = function(url, accessToken, done) {
    this._oauth2.get(url, accessToken, function (err, body, res) {
        if (err) { return done(new InternalOAuthError('failed to fetch user profile', err)); }

        if( res.statusCode == 302 &&
            res.headers &&
            res.headers.location) {
            console.log("Edmodo Strategy: Redirecting to", res.headers.location);
            this._getUserProfile(res.headers.location, accessToken, done);
        } else {
            try {
                var json = JSON.parse(body);

                var profile = {
                    loginType: aConst.login.type.edmodo
                };
                profile._raw      = body;
                profile._json     = json;

                if(json.type == "teacher") {
                    profile.role = lConst.role.instructor;
                } else {
                    profile.role = lConst.role.student;
                }

                // TODO: add "edmodo" string to username
                // add to migration
                profile.username  = json.id+"."+json.username;
                profile.firstName = json.first_name;
                profile.lastName  = json.last_name;
                profile.email     = json.email || "";
                profile.password  = body;

                done(null, profile);
            } catch (err) {
                done(err);
            }
        }
    }.bind(this));
};

/**
 * Expose `Strategy`.
 */
module.exports = Strategy;