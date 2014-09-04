/**
 * Authentication Server Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  express    - https://github.com/visionmedia/express
 *  passport-google-oauth - https://github.com/jaredhanson/passport-google-oauth
 *
 * TODO: user two different API end points to switch between student and teacher
 *
 */
// Third-party libs
var _          = require('lodash');
var Strategy   = require('passport-google-oauth').OAuth2Strategy;

module.exports = GoogleAccount;

function GoogleAccount(options){
    try {
        this.id   = "google";
        this._name = "Google";
        this.options = _.merge(
            {},
            options
        );

    } catch(err) {
        console.trace(this._name+"Account: Error -", err);
        this.stats.increment("error", "Generic");
    }
}


GoogleAccount.prototype.getId = function() {
    return this.id;
};

GoogleAccount.prototype.getAuthOptions = function() {
    return {
        scope: ['https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email']
    };
};

GoogleAccount.prototype.setupPassport = function(passport, authService) {
    // http://localhost:8001/auth/google
    // notasecret
    passport.use( new Strategy(
            this.options.auth.accounts.google,
            function(accessToken, refreshToken, profile, done) {
                //console.log("google user - profile:", profile);

                var userData = {};
                // profile.provider
                //userData.userId = profile.id;
                userData.firstName = profile.name.givenName;
                userData.lastName = profile.name.familyName;
                userData.password = accessToken;
                userData.role = "student";

                //
                userData.email = "";
                if(profile.emails.length > 0) {
                    if(profile.emails[0].hasOwnProperty('value')) {
                        userData.email = profile.emails[0].value;
                    }
                }
                userData.screenName = userData.email;

                authService.registerUser(userData)
                    .then(function(userId) {
                        userData.id = userId;
                        done(userData, profile);
                    }.bind(this),
                    function(err) {
                        console.error(this._name+" Auth Error:", error);
                        done(null, profile);
                    }
                );
            }
        )
    );
};
