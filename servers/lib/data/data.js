/**
 * Data Module
 *
 *
 */
module.exports = {
    LongName:    "Data",
    ServiceName: "data",
    Controller: {
        config:  require('./controller/config.js'),
        session: require('./controller/session.js'),
        events:  require('./controller/events.js')
    },
    Service: require('./data.service.js'),
    Const:   require('./data.const.js'),

    Datastore: {
        MySQL:     require('./data.datastore.mysql.js'),
        Couchbase: require('./data.datastore.couchbase.js')
    }
}
