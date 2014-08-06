/**
 * Authentication Server Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  express    - https://github.com/visionmedia/express
 *
 * TODO: refactor this file, auth.strategy.glasslab
 *      move mysql functions to auth.datastore.mysql
 */
// Third-party libs
var _          = require('lodash');
var Strategy   = require('./auth.strategy.glasslab.js');

module.exports = GlasslabAccount;

function GlasslabAccount(options){
    try {
        this.options = _.merge(
            {},
            options
        );

        this.strategy = new Strategy(this.options);

    } catch(err) {
        console.trace("GlasslabAccount: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

GlasslabAccount.prototype.setupPassport = function(passport) {
    passport.use(this.strategy);
};


GlasslabAccount.prototype.setupRoutes = function(app) {
    // handled in the service API route (see route.map.js)
};

GlasslabAccount.prototype.registerUser = function(userData) {
    return this.strategy.registerUser(userData);
};

GlasslabAccount.prototype.checkUserPerminsToUserData = function(userData, loginUserSessionData) {
    return this.strategy.checkUserPerminsToUserData(userData, loginUserSessionData);
};

GlasslabAccount.prototype.updateUserData = function(userData, loginUserSessionData) {
    return this.strategy.updateUserData(userData, loginUserSessionData);
};

GlasslabAccount.prototype.getUserByEmail = function(email) {
    return this.strategy.getUserByEmail(email);
};

GlasslabAccount.prototype.findUser = function(type, value) {
    return this.strategy.findUser(type, value);
};

GlasslabAccount.prototype.encryptPassword = function(password, passwordScheme) {
    return this.strategy.encryptPassword(password, passwordScheme);
};
