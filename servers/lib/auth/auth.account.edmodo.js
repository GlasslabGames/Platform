/**
 * Authentication Server Module
 *
 * Module dependencies:

 *
 */
// Third-party libs
var _          = require('lodash');
var Strategy   = require('./auth.strategy.edmodo.js');

module.exports = EdmodoAccount;

function EdmodoAccount(options){
    try {
        this.options = _.merge(
            {},
            options
        );

    } catch(err) {
        console.trace("EdmodoAccount: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

EdmodoAccount.prototype.setupPassport = function(passport, authService) {

    passport.use(new Strategy({
                clientID:     this.options.auth.accounts.edmodo.clientID,
                clientSecret: this.options.auth.accounts.edmodo.clientSecret,
                callbackURL:  this.options.auth.accounts.edmodo.callbackURL
            },
            function(accessToken, refreshToken, profile, done) {
                console.log("edmodo user - profile:", profile);

                /*
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
                        console.error("Google Auth Error:", error);
                        done(null, profile);
                    }
                );
                */
            }
        )
    );
};

EdmodoAccount.prototype.setupRoutes = function(app, passport) {

    // route to trigger google oauth authorization
    app.get('/auth/edmodo',
        passport.authenticate('edmodo'),
        function(req, res) {
            // The request will be redirected to Google for authentication, so this
            // function will not be called.
        }.bind(this)
    );

    // callback route
    app.get('/auth/edmodo/callback',
        passport.authenticate('edmodo'),
        function(req, res) {
            // Successful authentication, redirect home.
            res.redirect('/');
        });
};


EdmodoAccount.prototype.createAccount = function(){

};
