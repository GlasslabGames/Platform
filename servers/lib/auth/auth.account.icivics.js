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
// load at runtime
// Glasslab libs
var aConst, lConst;

module.exports = ICivicsAccount;

function ICivicsAccount(options){
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
        console.trace("ICivicsAccount: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

ICivicsAccount.prototype.setupPassport = function(passport) {

    passport.use( new Strategy(
            this.options.auth.accounts.icivics,
            function(token, tokenSecret, profile, done) {
                console.log("ICivicsAccount user - profile:", profile);

                /*
                this._AddOrFindUser(profile)
                    .then( function(profile) {
                        done(null, profile);
                    }.bind(this),
                    function(err) {
                        done(JSON.stringify(err), profile);
                    }.bind(this)
                );
                */
            }.bind(this)
        )
    );
};

ICivicsAccount.prototype.setupRoutes = function(app, passport) {

    // route to trigger google oauth authorization
    app.get('/auth/icivics/login',
        passport.authenticate('icivics'),
        function(req, res) {
            // The request will be redirected to Google for authentication, so this
            // function will not be called.
        }.bind(this)
    );

    // callback route
    app.get('/auth/icivics/callback',
        passport.authenticate('icivics'),
        function(req, res) {
            // Successful authentication, redirect home.
            res.redirect('/auth/icivics');
        });
};


ICivicsAccount.prototype.createAccount = function(){
    // client should handle this
};


ICivicsAccount.prototype._AddOrFindUser = function(userData){
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
            console.error("ICivicsAccount: _AddOrFindUser Error -", err);
            return reject(err, code);
        }.bind(this));
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

