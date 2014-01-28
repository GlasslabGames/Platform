/**
 * Telemetry Module
 *
 *
 */
module.exports = {
    Const:      require('./telemetry.const.js'),
    Collector:  require('./telemetry.collector.js'),
    Dispatcher: require('./telemetry.dispatcher.js'),
    Datastore: {
        MySQL:     require('./telemetry.datastore.mysql.js'),
        Couchbase: require('./telemetry.datastore.couchbase.js')
    },
    Queue: {
        Redis: require('./telemetry.queue.redis.js')
    }
}
