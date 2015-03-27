/**
 * LMS Module
 *
 *
 */
module.exports = {
    LongName:    "License Management System",
    ServiceName: "lic",
    Controller: {
        license:  require('./controller/license.js')
    },
    Service: require('./lic.service.js'),
    Const:   require('./lic.const.js'),

    Datastore: {
        MySQL:  require('./lic.datastore.mysql.js'),
        Couchbase: require('./lic.datastore.couchbase.js')
    }
};
