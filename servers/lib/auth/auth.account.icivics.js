/**
 * Authentication Server Module
 *
 * Module dependencies:
 * http://127.0.0.1:8001/auth/icivics/login
 *
 */
// Third-party libs
var _          = require('lodash');
var when       = require('when');
var Strategy   = require('./auth.strategy.icivics.js');

module.exports = ICivicsAccount;

function ICivicsAccount(options, manager, authService){
    try {
        this._id   = "icivics";
        this._name = "ICivics";
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

ICivicsAccount.prototype.getId = function() {
    return this._id;
};

ICivicsAccount.prototype.setupPassport = function(passport) {

    passport.use( new Strategy(
            this.options.auth.accounts.icivics,
            function(token, tokenSecret, profile, done) {
                //console.log(this._name+"Account user - profile:", profile);

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
