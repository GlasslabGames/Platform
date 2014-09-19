/**
 * Accounts Manager Module
 *
 *
 */
// Third-party libs
var _          = require('lodash');

module.exports = AccountsManager;

function AccountsManager(options, authService){
    try {
        var Accounts;
        this.options = _.merge(
            {},
            options
        );

        Accounts      = require('./auth.js').Accounts;
        this.accounts = {};
        this._authService = authService;

        // create account objects
        for(var i in Accounts.List) {
            this.accounts[i] = new Accounts.List[i](options, this, authService);
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
    if(this.accounts.hasOwnProperty(name)) {
        return this.accounts[name];
    }
}

AccountsManager.prototype.setupRoutes = function(app, passport) {
    _.forEach(this.accounts, function(account){
        var id = account.getId();
        if( _.isString(id) ) {
            var authOptions = null;
            if(_.isFunction(account.getAuthOptions)) {
                authOptions = account.getAuthOptions();
            }

            // route to trigger google oauth authorization
            app.get('/auth/'+id+'/login',
                passport.authenticate(id, authOptions),
                function(req, res) {
                    // The request will be redirected to Google for authentication, so this
                    // function will not be called.
                }.bind(this)
            );

            // callback route
            app.get('/auth/'+id+'/callback',
                passport.authenticate(id),
                function(req, res) {
                    // Successful authentication, redirect home.
                    res.redirect('/auth/'+id);
                }.bind(this));

            if(_.isFunction(account.setupRoutes)) {
                account.setupRoutes(app, passport);
            }
        }
    }.bind(this))
};
