/**
 * Authentication Module
 *
 *
 */

module.exports = {
    Const:    require('./auth.const.js'),
    SessionServer: require('./auth.session.server.js'),
    Strategy: require('./auth.strategy.js'),
    Server:   require('./auth.server.js'),
    Validate: require('./auth.validate.server.js')
};
