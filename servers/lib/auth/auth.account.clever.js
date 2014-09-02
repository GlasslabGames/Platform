/**
 * Authentication Server Module
 *
 * Module dependencies:

 *
 */
// Third-party libs
var _          = require('lodash');
var when       = require('when');
var Strategy   = require('./auth.strategy.clever.js');
// load at runtime
// Glasslab libs
var aConst, lConst;

module.exports = CleverAccount;

function CleverAccount(options){
    try {
        var Auth, LMS;
        this.options = _.merge(
            {},
            options
        );

        // Glasslab libs
        Auth = require('./auth.js');
        LMS  = require('../lms/lms.js');
        lConst = LMS.Const;
        aConst = Auth.Const;

        this.ds = new Auth.Datastore.MySQL(this.options.auth.datastore.mysql);

    } catch(err) {
        console.trace("CleverAccount: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

CleverAccount.prototype.setupPassport = function(passport) {

    // add district_id to query params
    passport.use( new Strategy(
            this.options.auth.accounts.clever,
            function(accessToken, refreshToken, profile, done) {
                //console.log("clever user - profile:", profile);

                this._AddOrFindUser(profile)
                    .then( function(profile) {
                        done(null, profile);
                    }.bind(this),
                    function(err) {
                        done(JSON.stringify(err), profile);
                    }.bind(this)
                );
            }.bind(this)
        )
    );
};

CleverAccount.prototype.setupRoutes = function(app, passport) {

    // route to trigger google oauth authorization
    app.get('/auth/clever/login',
        passport.authenticate('clever', this.options.auth.accounts.clever),
        function(req, res) {
            // The request will be redirected to Google for authentication, so this
            // function will not be called.
        }.bind(this)
    );

    // callback route
    app.get('/auth/clever/callback',
        passport.authenticate('clever', this.options.auth.accounts.clever),
        function(req, res) {
            // Successful authentication, redirect home.
            res.redirect('/auth/clever');
        });
};


CleverAccount.prototype.createAccount = function(){
    // client should handle this
};


CleverAccount.prototype._AddOrFindUser = function(userData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // second, no Error on found
    this.ds.checkUserNameUnique(userData.username, true)
        // add user
        .then(function(userId) {
            if(userId) {
                userData.id = userId;
                return this.ds.updateUserData(userData);
            } else {
                userData.newUser = true;
                return this.ds.addUser(userData);
            }
        }.bind(this))

        // all done
        .then(function(userId){
            userData.id = userId;
            resolve(userData);
        }.bind(this))

        // catch all errors
        .then(null, function(err, code){
            console.error("CleverAccount: _AddOrFindUser Error -", err);
            return reject(err, code);
        }.bind(this));
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

