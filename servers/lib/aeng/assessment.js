/**
 * Assessment Module
 *
 *
 */
module.exports = {
    Const:      require('./assessment.const.js'),
    Queue: {
        Redis: require('./assessment.queue.redis.js')
    }
};
