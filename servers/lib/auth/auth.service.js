/**
 * Authentication Server Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  when       - https://github.com/cujojs/when
 *  express    - https://github.com/visionmedia/express
 *  passport   - https://github.com/jaredhanson/passport
 *  validator  - https://github.com/chriso/node-validator
 *  google oauth - https://github.com/jaredhanson/passport-google-oauth
 *
 *  node-edmodo-api - https://github.com/gabceb/node-edmodo-api
 *
 *
 */
var http       = require('http');
var path       = require('path');
// Third-party libs
var _          = require('lodash');
var when       = require('when');
var express    = require('express');
var passport   = require('passport');
var couchbase  = require('couchbase');
var check      = require('validator').check;

// load at runtime
var Util, aConst, lConst;

module.exports = AuthService;

function AuthService(options){
    try {
        var Accounts, WebStore, LMSStore, AuthStore;
        this.options = _.merge(
            {
                auth: { port: 8082 }
            },
            options
        );

        // Glasslab libs
        Util          = require('../core/util.js');
        aConst        = require('./auth.js').Const;
        Accounts      = require('./auth.js').Accounts;
        AuthStore     = require('./auth.js').Datastore.Couchbase;

        this.stats            = new Util.Stats(this.options, "Auth");
        this.requestUtil      = new Util.Request(this.options);
        this.authStore        = new AuthStore(this.options.auth.datastore.couchbase);
        this.accountsManager  = new Accounts.Manager(this.options);
        this.glassLabStrategy = this.accountsManager.get("Glasslab");

        // TODO: find all webstore, lmsStore dependancies and move to using service APIs
        WebStore      = require('../dash/dash.js').Datastore.MySQL;
        lConst        = require('../lms/lms.js').Const;
        LMSStore      = require('../lms/lms.js').Datastore.MySQL;
        this.webstore = new WebStore(this.options.webapp.datastore.mysql);
        this.lmsStore = new LMSStore(this.options.lms.datastore.mysql);

    } catch(err){
        console.trace("Auth: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

AuthService.prototype.appConfig = function(app) {
    this.passport = passport;

    // setup passport for all account types
    this.accountsManager.setupPassport(this.passport, this);

    // session de/serialize
    this.passport.serializeUser(function serializeUser(user, done) {
        done(null, user);
    });
    this.passport.deserializeUser(function deserializeUser(user, done) {
        done(null, user);
    });

    app.use(this.passport.initialize());
    app.use(this.passport.session());
}


AuthService.prototype.start = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // connect to auth store
    this.authStore.connect()
        .then(function(){
            console.log("AuthService: Couchbase Auth DS Connected");
            this.stats.increment("info", "Couchbase.Connect");
        }.bind(this),
            function(err){
                console.trace("AuthService: Couchbase Auth Error -", err);
                this.stats.increment("error", "Couchbase.Connect");
            }.bind(this))

        // connect to webstore
        .then(function(){
            return this.webstore.connect();
        }.bind(this))
        .then(function(){
            console.log("AuthService: MySQL Web DS Connected");
            this.stats.increment("info", "MySQL.Connect");
        }.bind(this),
            function(err){
                console.trace("AuthService: MySQL Web DS Error -", err);
                this.stats.increment("error", "MySQL.Connect");
            }.bind(this))

        // connect to lmsStore
        .then(function(){
            return this.lmsStore.connect();
        }.bind(this))
        .then(function(){
            console.log("AuthService: MySQL LMS DS Connected");
            this.stats.increment("info", "MySQL.Connect");
        }.bind(this),
            function(err){
                console.trace("AuthService: MySQL LMS DS Error -", err);
                this.stats.increment("error", "MySQL.Connect");
            }.bind(this))

        .then(resolve, reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


AuthService.prototype.registerUser = function(userData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    this.glassLabStrategy.registerUser(userData)
        .then(resolve, reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

AuthService.prototype.checkUserPerminsToUserData = function(userData, loginUserSessionData){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // TODO: switch based on user (from userId) login type
    if( (userData.loginType == aConst.login.type.glassLabV1) ||
        (userData.loginType == aConst.login.type.glassLabV2) ){
        this.glassLabStrategy.checkUserPerminsToUserData(userData, loginUserSessionData)
            .then(resolve, reject);
    } else {
            this.stats.increment("error", "RegisterUser.InvalidLoginType");
            reject({error: "invalid login type"});
    }
// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};



AuthService.prototype._updateUserData = function(userData, loginUserSessionData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
        if( (userData.loginType == aConst.login.type.glassLabV1) ||
            (userData.loginType == aConst.login.type.glassLabV2) ){
            this.glassLabStrategy.updateUserData(userData, loginUserSessionData)
                .then(resolve, reject);
        } else {
            this.stats.increment("error", "RegisterUser.InvalidLoginType");
            reject({error: "invalid login type"});
        }
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};
