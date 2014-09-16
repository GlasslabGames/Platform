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

module.exports = CleverAccount;

function CleverAccount(options, manager, authService){
    try {
        this._id   = "clever";
        this._name = "Clever";
        this.options = _.merge(
            {},
            options
        );
        this._authService = authService;

    } catch(err) {
        console.trace(this._name+"Account: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

CleverAccount.prototype.getId = function() {
    return this._id;
};

CleverAccount.prototype.setupPassport = function(passport) {

    // add district_id to query params
    passport.use( new Strategy(
            this.options.auth.accounts.clever,
            function(accessToken, refreshToken, profile, done) {
                //console.log("clever user - profile:", profile);

                this._authService.addOrUpdate_SSO_UserData(profile)
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

