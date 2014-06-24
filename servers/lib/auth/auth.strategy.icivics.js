/**
 * Module dependencies.
 */
var querystring   = require('querystring'),
    util          = require('util'),
    OAuthStrategy = require('passport-oauth').OAuthStrategy;

var _ = require('lodash');

// load at runtime
// Glasslab libs
var aConst, lConst;

/**
 * `Strategy` constructor.
 *
 * The ICivics authentication strategy authenticates requests by delegating to
 * ICivics using the OAuth 2.0 protocol.
 *
 * Applications must supply a `verify` callback which accepts an `accessToken`,
 * `refreshToken` and service-specific `profile`, and then calls the `done`
 * callback supplying a `user`, which should be set to `false` if the
 * credentials are not valid.  If an exception occured, `err` should be set.
 *
 * Options:
 *   - `clientID`      your ICivics application's client id
 *   - `clientSecret`  your ICivics application's client secret
 *   - `callbackURL`   URL to which ICivics will redirect the user after granting authorization
 *
 * Examples:
 *
 *     passport.use(new ICivicsStrategy({
 *         clientID: '123-456-789',
 *         clientSecret: 'shhh-its-a-secret'
 *         callbackURL: 'https://www.example.net/auth/icivics/callback'
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
    // need to disable auth check because there ssl cert is invalid
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    var baseURL = options.baseURL || 'https://www.icivics.com';
    options = options || {};
    options.requestTokenURL = options.requestTokenURL || baseURL+'/oauth/request_token';
    options.accessTokenURL  = options.accessTokenURL  || baseURL+'/oauth/access_token';

    if(options.callbackURL) {
        var params = {
            oauth_callback: options.callbackURL
        };

        options.userAuthorizationURL = baseURL+"/oauth/authorize?" + querystring.stringify(params);
    }
    options.sessionKey = options.sessionKey || 'oauth:icivics';

    lConst = require('../lms/lms.js').Const;
    aConst = require('./auth.js').Const;

    OAuthStrategy.call(this, options, verify);
    this.name = 'icivics';
}

/**
 * Inherit from `OAuthStrategy`.
 */
util.inherits(Strategy, OAuthStrategy);


/**
 * Retrieve user profile from ICivics.
 *
 * This function constructs a normalized profile, with the following properties:
 *
 *   - `provider`         always set to `icivics`
 *   - `id`
 *   - `username`
 *   - `displayName`
 *
 * @param {String} accessToken
 * @param {Function} done
 * @api protected
 */

Strategy.prototype.userProfile = function(accessToken, tokenSecret, params, done) {
    console.log("ICivics - accessToken:", accessToken, ", tokenSecret:", tokenSecret, ", params:", params);
    this._getUserProfile('https://staging.icivics.org/services/rest/service_system/connect.json', accessToken, done);
};

Strategy.prototype._getUserProfile = function(url, accessToken, done) {
    this._oauth2.post(url, accessToken, function (err, body, res) {
        if (err) { return done(new InternalOAuthError('failed to fetch user profile', err)); }

        if( res.statusCode == 302 &&
            res.headers &&
            res.headers.location) {
            console.log("ICivics Strategy: Redirecting to", res.headers.location);
            this._getUserProfile(res.headers.location, accessToken, done);
        } else {
            try {
                console.log("ICivics - body:", body);
                /*
                var json = JSON.parse(body);

                var profile = {
                    loginType: aConst.login.type.icivics
                };
                profile._raw      = body;
                profile._json     = json;

                if(json.type == "teacher") {
                    profile.role = lConst.role.instructor;
                } else {
                    profile.role = lConst.role.student;
                }

                profile.username  = json.id+"."+json.username;
                profile.firstName = json.first_name;
                profile.lastName  = json.last_name;
                profile.email     = json.email || "";
                profile.password  = body;
                done(null, profile);
                */
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