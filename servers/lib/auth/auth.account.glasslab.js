/**
 * Authentication Server Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  express    - https://github.com/visionmedia/express
 *
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
