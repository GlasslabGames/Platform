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

        // check if contains a "url" property
        if( res.statusCode == 200 ) {
            try {
                var tmp = JSON.parse(body);
                // contains url and url is NOT the same as the one just tried
                if( tmp.hasOwnProperty('url') &&
                    (url != tmp.url) ) {
                    console.log("Edmodo Strategy: Redirecting to", tmp.url);
                    this._getUserProfile(tmp.url, accessToken, done);
                    return;
                }
            } catch(err) {
                // this is ok
            }
        }

        if( res.statusCode == 302 &&
            res.headers &&
            res.headers.location) {
            console.log("Edmodo Strategy: Redirecting to", res.headers.location);
            this._getUserProfile(res.headers.location, accessToken, done);
            return;
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

                // add to migration
                profile.username     = '{'+this.name+'}.'+json.id;
                profile.firstName    = json.first_name || "";
                profile.ssoUsername  = json.username || "";

                if(profile.role === lConst.role.student) {
                    // prevent PII
                    profile.lastName = json.last_name.substring(0, 1) || "";
                    profile.email    = "";
                } else {
                    profile.lastName = json.last_name || "";
                    profile.email    = json.email || "";
                }

                if(profile.role === lConst.role.student) {
                    // prevent PII
                    profile.ssoData = "-";
                } else {
                    profile.ssoData = body;
                }
                profile.password = "-";

                // if teacher, create all students in all classes, create classes, add students to class
                if(false) {//profile.role === lConst.role.instructor) {
                    this._getGroups("https://api.edmodo.com/groups", accessToken, profile, done);
                } else {
                    done(null, profile);
                }
            } catch (err) {
                done(err);
            }
        }
    }.bind(this));
};

Strategy.prototype._getGroups = function(url, accessToken, profile, done) {
    this._oauth2.get(url, accessToken, function (err, body, res) {
        if (err) { return done(new InternalOAuthError('failed to fetch group info', err)); }

        // check if contains a "url" property
        if( res.statusCode == 200 ) {
            try {
                var tmp = JSON.parse(body);
                // contains url and url is NOT the same as the one just tried
                if( tmp.hasOwnProperty('url') &&
                    (url != tmp.url) ) {
                    console.log("Edmodo Strategy: Redirecting to", tmp.url);
                    this._getGroups(tmp.url, accessToken, done);
                    return;
                }
            } catch(err) {
                // this is ok
            }
        }

        // check for redirects
        if( res.statusCode == 302 &&
            res.headers &&
            res.headers.location) {
            console.log("Edmodo Strategy: Redirecting to", res.headers.location);
            this._getGroups(res.headers.location, accessToken, done);
            return;
        } else {
            try {
                var json = JSON.parse(body);

                profile.courses = {};

                for( var group in json ) {
                    profile.course[group] = {
                        type: aConst.login.type.edmodo,
                        title: group.title,
                        grade: ['start_level_interp', 'end_level_interp'],
                        games: [],
                        users: [],
                        archived: false,
                        archivedDate: null,
                        lmsType: lConst.course.type.edmodo,
                        lmsId: '{' + lConst.course.type.edmodo + '}.' + group.id,
                        labels: "",
                        meta: JSON.stringify( group )
                    };
                }

                done( null, profile );
            } catch (err) {
                done(err);
            }
        }
    }.bind(this));

    /*var data = { uid: parseInt(uid) };
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
    }.bind(this));*/
};

/**
 * Expose `Strategy`.
 */
module.exports = Strategy;