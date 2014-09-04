/**
 * Authentication Server Module
 *
 * Module dependencies:

 *
 */
// Third-party libs
var _          = require('lodash');
var when       = require('when');
var Strategy   = require('./auth.strategy.edmodo.js');

module.exports = EdmodoAccount;

function EdmodoAccount(options, manager, authService){
    try {
        this._id   = "edmodo";
        this._name = "Edmodo";
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

EdmodoAccount.prototype.getId = function() {
    return this._id;
};

EdmodoAccount.prototype.setupPassport = function(passport) {

    passport.use( new Strategy(
            this.options.auth.accounts.edmodo,
            function(accessToken, refreshToken, profile, done) {
                //console.log(this._id+" user - profile:", profile);

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
