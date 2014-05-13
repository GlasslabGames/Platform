/**
 * Accounts Manager Module
 *
 *
 */
// Third-party libs
var _          = require('lodash');

module.exports = AccountsManager;

function AccountsManager(options){
    try {
        var Accounts;
        this.options = _.merge(
            {},
            options
        );

        Accounts      = require('./auth.js').Accounts;
        this.accounts = {};

        // create account objects
        for(var i in Accounts.List) {
            this.accounts[i] = new Accounts.List[i](options);
        }

    } catch(err){
        console.trace("GlasslabAccount: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

AccountsManager.prototype.setupPassport = function(passport, authService) {
    for(var i in this.accounts) {
        console.log("AccountManager: Setting up "+i+" Strategy...");

        if( _.isFunction(this.accounts[i].setupPassport) ) {
            this.accounts[i].setupPassport(passport, authService);
        }
    }
};

AccountsManager.prototype.get = function(name) {

}

AccountsManager.prototype.setupRoutes = function(app, passport) {
    for(var i in this.accounts) {
        if( _.isFunction(this.accounts[i].setupRoutes) ) {
            this.accounts[i].setupRoutes(app, passport);
        }
    }
};
