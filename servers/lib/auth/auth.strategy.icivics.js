/**
 * Module dependencies.
 */
var querystring   = require('querystring'),
    util          = require('util'),
    OAuthStrategy = require('passport-oauth1');

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

    this._baseURL = options.baseURL || 'https://www.icivics.com';
    options = options || {};
    options.requestTokenURL = options.requestTokenURL || this._baseURL+'/oauth/request_token';
    options.accessTokenURL  = options.accessTokenURL  || this._baseURL+'/oauth/access_token';

    if(options.callbackURL) {
        var params = {
            oauth_callback: options.callbackURL
        };

        options.userAuthorizationURL = this._baseURL+"/oauth/authorize?" + querystring.stringify(params);
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

Strategy.prototype.userProfile = function(token, tokenSecret, params, done) {
    console.log("ICivics - token:", token, ", tokenSecret:", tokenSecret, ", params:", params);

    var url = this._baseURL+ '/services/rest/service_system/connect.json';
    this._getUserProfile(url, token, tokenSecret, null, done);
};

Strategy.prototype._getUserProfile = function(url, token, tokenSecret, data, done) {
    this._oauth.post(url, token, tokenSecret, data, function (err, body, res) {
        if (err) { return done(new InternalOAuthError('failed to fetch user profile', err)); }

        if( res.statusCode == 302 &&
            res.headers &&
            res.headers.location) {
            console.log("ICivics Strategy: Redirecting to", res.headers.location);
            this._getUserProfile(res.headers.location, token, tokenSecret, done);
        } else {
            try {
                //console.log("ICivics - _getUserProfile url:", url);
                //console.log("ICivics - _getUserProfile body:", body);
                var json = JSON.parse(body);
                //console.log("ICivics - _getUserProfile json:", json);

                var profile = {
                    loginType: aConst.login.type.icivics
                };
                profile._raw      = body;
                profile._json     = json;

                for(var r in json.user.roles) {
                    if(json.user.roles[r] == "teacher") {
                        profile.role = lConst.role.instructor;
                        break;
                    }
                    else if(json.user.roles[r] == "student") {
                        profile.role = lConst.role.student;
                        break;
                    }
                }
                if(!profile.role) {
                    profile.role = lConst.role.student;
                }

                profile.username  = '{'+this.name+'}.'+json.user.uid;
                if(json.user.name) {
                    profile.username += "."+json.user.name;
                }
                profile.firstName = json.user.first_name || "";
                profile.lastName  = json.user.last_name || "";
                profile.email     = json.user.mail || "";
                profile.password  = body;

                // if teacher, create all students in all classes, create classes, add students to class

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