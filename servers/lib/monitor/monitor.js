/**
 * Monitor Module
 *
 *
 */
module.exports = {
    LongName: "Monitor",
    ServiceName: "monitor",
    Controller: {
        inspector: require('./controller/inspector.js')
    },
    Service: require('./monitor.service.js'),
    Datastore: {
        Couchbase: require('./monitor.datastore.couchbase.js')
    }
};
