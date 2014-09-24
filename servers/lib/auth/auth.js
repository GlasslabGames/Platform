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
        login: require('./controller/login.js'),
        newsletter:  require('./controller/newsletter.js'),

        _user:  require('./controller/_user.js')
    },
    Const:     require('./auth.const.js'),
    Service:    require('./auth.service.js'),
    Accounts:  require('./auth.accounts.js'),

    Datastore: {
        Couchbase: require('./auth.datastore.couchbase.js'),
        MySQL:     require('./auth.datastore.mysql.js')
    }
};
