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
// load at runtime
// Glasslab libs
var aConst, lConst;

module.exports = EdmodoAccount;

function EdmodoAccount(options){
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
        this.ds.updateUserTable();

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
                //console.log("edmodo user - profile:", profile);

                this._AddOrFindUser(profile)
                    .then( function(profile) {
                        done(null, profile);
                    }.bind(this),
                    function(err) {
                        done(err, profile);
                    }.bind(this)
                );
            }.bind(this)
        )
    );
};

EdmodoAccount.prototype.setupRoutes = function(app, passport) {

    // route to trigger google oauth authorization
    app.get('/auth/edmodo/login',
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
            res.redirect('/auth/edmodo');
        });
};


EdmodoAccount.prototype.createAccount = function(){
    // client should handle this
};


EdmodoAccount.prototype._AddOrFindUser = function(userData){
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
            return reject(err, code);
        }.bind(this));
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

