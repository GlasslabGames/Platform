/**
 * Module dependencies.
 */
var querystring   = require('querystring'),
    util          = require('util'),
    OAuthStrategy = require('passport-oauth1'),
    InternalOAuthError = require('passport-oauth1').InternalOAuthError;

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
    //console.log("ICivics - token:", token, ", tokenSecret:", tokenSecret, ", params:", params);
    this._getUserProfile(token, tokenSecret, done);
};

Strategy.prototype._getUserProfile = function(token, tokenSecret, done, _url, data) {
    var url = _url || (this._baseURL+ '/services/rest/service_system/connect.json');

    this._oauth.post(url, token, tokenSecret, data, function (err, body, res) {
        if (err) { return done(new InternalOAuthError('failed to fetch user profile', err)); }

        if( res.statusCode == 302 &&
            res.headers &&
            res.headers.location) {
            //console.log("ICivics Strategy: Redirecting to", res.headers.location);
            this._getUserProfile(token, tokenSecret, done, res.headers.location);
        } else {
            try {
                var profile = this._getProfileData(body);
                if(!profile) {
                    return done(new InternalOAuthError('invalid user'));
                }

                // if teacher, create all students in all classes, create classes, add students to class
                if(profile.role === lConst.role.instructor) {
                    this._getGroups(token, tokenSecret, done, profile, profile._json);
                } else {
                    done(null, profile);
                }
            } catch (err) {
                done(err);
            }
        }
    }.bind(this));
};

Strategy.prototype._getProfileData = function(body) {

    //console.log("ICivics - _getUserProfile url:", url);
    //console.log("ICivics - _getUserProfile body:", body);
    var json = {};
    if(_.isString(body)) {
        json = JSON.parse(body);
    }
    else if(_.isObject(body)) {
        json = body;
        body = JSON.stringify(body);
    } else {
        return null;
    }

    if(json.hasOwnProperty('user')) {
        json = json.user;
    }
    //console.log("ICivics - _getUserProfile json:", json);
    //console.log("ICivics - _getUserProfile og_groups json:", json.user.og_groups);

    // invalid user id
    if(parseInt(json.uid) == 0) {
        return null;
    }

    var profile = {
        loginType: aConst.login.type.icivics
    };
    profile._raw      = body;
    profile._json     = json;

    for(var r in json.roles) {
        if(json.roles[r] == "teacher") {
            profile.role = lConst.role.instructor;
            break;
        }
        else if(json.roles[r] == "student") {
            profile.role = lConst.role.student;
            break;
        }
    }
    if(!profile.role) {
        profile.role = lConst.role.student;
    }

    profile.username  = '{'+this.name+'}.'+json.uid;
    if(json.name) {
        profile.username += "."+json.name;
        profile.ssoUsername = json.name;
    }

    if(profile.role === lConst.role.instructor) {
        profile.firstName = json.first_name || "";
        profile.lastName  = json.last_name || "";
        profile.email     = json.mail || "";
    }
    else if(profile.role === lConst.role.student) {
        var nparts = json.real_name.split(' ');
        // remove first name part
        profile.firstName = nparts.shift() || "";
        // put rest as last name
        profile.lastName  = nparts.join(" ") || "";
        profile.email     = "";
    }

    if(profile.role == lConst.role.instructor) {
        profile.ssoData = body;
    } else {
        profile.ssoData = "-"; // prevent PII
    }

    profile.password = "-";

    return profile;
};


Strategy.prototype._getGroups = function(token, tokenSecret, done, profile, userData) {
    var url = this._baseURL+ '/services/rest/service_user/og_members.json';

    profile.courses = {};

    var uid = userData.uid;
    for(var key in userData.og_groups) {
        // only add active classes
        if(userData.og_groups[key].is_active) {
            profile.courses[key] = {
                type: aConst.login.type.icivics,
                title: userData.og_groups[key].title,
                grade: ['7'],
                games: [{id:'AW-1', settings:{}}], // default to include AW game
                users: [],
                archived:     parseInt(userData.og_groups[key].is_active) ? false : true,
                archivedDate: parseInt(userData.og_groups[key].changed),
                lmsType: lConst.course.type.icivics,
                lmsId:   '{'+lConst.course.type.icivics+'}.'+userData.og_groups[key].nid,
                labels:  "",
                meta:    JSON.stringify(userData.og_groups[key])
            };
        }
    }

    var data = { uid: parseInt(uid) };
    //console.error("ICivics - teacher getMembers data:", data);
    this._oauth.post(url, token, tokenSecret, data, function (err, body, res) {
        if (err) {
            return done(new InternalOAuthError('failed to fetch user members', err));
        }

        if(body) {
            var json = null;
            try{
                json = JSON.parse(body);
            } catch(err){
                return done(new InternalOAuthError('failed to fetch user members', err));
            }

            // add users to courses
            //console.log("ICivics - teacher getMembers json:", JSON.stringify(json, null, 2));
            for(var courseId in json){
                for(var userId in json[courseId].members){
                    // valid memeber and userId not teacher
                    if( json[courseId].members[userId] &&
                        parseInt(userId) != parseInt(userData.uid)
                      ) {
                        // normalize input
                        profile.courses[courseId].users.push( this._getProfileData(json[courseId].members[userId]) );
                    }
                }
            }

            done(null, profile);
        } else {
            return done(new InternalOAuthError('failed to fetch user members - no body'));
        }
    }.bind(this));
};

/**
 * Expose `Strategy`.
 */
module.exports = Strategy;