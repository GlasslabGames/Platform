/**
 * Telemetry Module
 *
 *
 */
module.exports = {
    Const:      require('./telemetry.const.js'),
    Collector:  require('./telemetry.collector.js'),
    Datastore: {
        MySQL:     require('./telemetry.datastore.mysql.js'),
        Couchbase: require('./telemetry.datastore.couchbase.js')
    }
}
