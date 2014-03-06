/**
 * Assessment Module
 *
 *
 */
module.exports = {
    Const:      require('./assessment.const.js'),
    Server:     require('./assessment.server.js'),
    Datastore: {
        Couchbase: require('./assessment.datastore.couchbase.js')
    },
    Queue: {
        Redis: require('./assessment.queue.redis.js')
    }
}
