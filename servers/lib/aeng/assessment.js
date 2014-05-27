/**
 * Assessment Module
 *
 *
 */
module.exports = {
    LongName:    "Assessment-Engine",
    ServiceName: "aeng",
    Controller: {

    },
    Service:     require('./assessment.service.js'),
    Const:      require('./assessment.const.js'),

    Datastore: {
        Couchbase: require('./assessment.datastore.couchbase.js')
    },
    Queue: {
        Redis: require('./assessment.queue.redis.js')
    },

    DistillerFunc: {
        SC: require('./distiller/SC.js')
    }
}
