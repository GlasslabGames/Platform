/**
 * Module dependencies.
 */
var util = require('util')
    , OAuth2Strategy     = require('passport-oauth2')
    , InternalOAuthError = require('passport-oauth2').InternalOAuthError;

var _ = require('lodash');

// load at runtime
// Glasslab libs
var aConst, lConst;

/**
 * `Strategy` constructor.
 *
 * The Clever authentication strategy authenticates requests by delegating to
 * Clever using the OAuth 2.0 protocol.
 *
 * Applications must supply a `verify` callback which accepts an `accessToken`,
 * `refreshToken` and service-specific `profile`, and then calls the `done`
 * callback supplying a `user`, which should be set to `false` if the
 * credentials are not valid.  If an exception occurred, `err` should be set.
 *
 * Options:
 *   - `clientID`      your Clever application's client id
 *   - `clientSecret`  your Clever application's client secret
 *   - `callbackURL`   URL to which Clever will redirect the user after granting authorization
 *
 * Examples:
 *
 *     passport.use(new CleverStrategy({
 *         clientID: '123-456-789',
 *         clientSecret: 'shhh-its-a-secret'
 *         callbackURL: 'https://www.example.net/auth/Clever/callback'
 *       },
 *       function(accessToken, refreshToken, profile, done) {
 *         User.findOrCreate(..., function (err, user) {
 *           done(err, user);
 *         });
 *       }
 *     ));
 *
 * Doc URL:
 * https://clever.com/developers/docs#identity-api-sso-oauth2-flow-section
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
function Strategy(options, verify) {
    this._baseURL = options.baseURL || 'https://clever.com';

    options.authorizationURL = this._baseURL + "/oauth/authorize";
    options.tokenURL = this._baseURL + "/oauth/tokens";

    // NOTE: Clever uses Authorization header for oAuth, the custom header is used to set add the Auth
    // header with base64 encoded "<client id>:<client secret>"
    var auth = new Buffer(options.clientID+":"+options.clientSecret).toString('base64');
    options.customHeaders = {
        "Authorization": "Basic "+auth
    };

    lConst = require('../lms/lms.js').Const;
    aConst = require('./auth.js').Const;

    OAuth2Strategy.call(this, options, verify);
    this.name = 'clever';
}

/**
 * Inherit from `OAuth2Strategy`.
 */
util.inherits(Strategy, OAuth2Strategy);


/**
 * Retrieve user profile from Clever.
 *
 * This function constructs a normalized profile, with the following properties:
 *
 *   - `provider`         always set to `Clever`
 *   - `id`
 *   - `username`
 *   - `displayName`
 *
 * @param {String} accessToken
 * @param {Function} done
 * @api protected
 */
Strategy.prototype.userProfile = function(accessToken, done) {
    this._getUserProfile('https://api.clever.com/me', accessToken, done);
};

Strategy.prototype._getUserProfile = function(url, accessToken, done) {

    // NOTE: Clever uses Authorization header for oAuth, so this MUST be set to true
    this._oauth2.useAuthorizationHeaderforGET(true);

    this._oauth2.get(url, accessToken, function (err, body, res) {
        if (err) { return done(new InternalOAuthError('failed to fetch user profile', err)); }

        if( res.statusCode == 302 &&
            res.headers &&
            res.headers.location) {
            console.log("Clever Strategy: Redirecting to", res.headers.location);
            this._getUserProfile(res.headers.location, accessToken, done);
        } else {
            try {
                var json = JSON.parse(body);
                console.log("Clever UserProfile:", json);

                var profile = {
                    loginType: aConst.login.type.clever
                };
                profile._raw      = body;
                profile._json     = json;

                // 'student', 'teacher' or 'district'
                if(json.data.type == "teacher") {
                    profile.role = lConst.role.instructor;
                } else if(json.data.type == "district") {
                    profile.role = lConst.role.manager;
                } else {
                    profile.role = lConst.role.student;
                }

                // add to migration
                profile.username  = '{'+this.name+'}.'+json.data.id;
                profile.firstName = json.data.name.first;
                profile.lastName  = json.data.name.last;
                profile.email     = json.data.email || "";
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