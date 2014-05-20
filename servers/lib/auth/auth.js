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

    Datastore: {
        Couchbase:  require('./auth.datastore.couchbase.js')
    }
};
