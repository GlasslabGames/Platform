/**
 * Authentication Module
 *
 *
 */

module.exports = {
    LongName:    "Authentication",
    ServiceName: "auth",
    Controller: {
        user:  require('./controller/user.js'),
        login: require('./controller/login.js')
    },
    Const:     require('./auth.const.js'),
    Service:    require('./auth.service.js'),

    Accounts:  require('./auth.accounts.js'),
    Validate:  require('./auth.validate.server.js'),
    SessionServer: require('./auth.session.server.js'),

    Datastore: {
        Couchbase:  require('./auth.datastore.couchbase.js')
    }
};
