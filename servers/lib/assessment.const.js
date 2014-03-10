/**
 * WebApp Consts
 *
 */

var api = "/api";

module.exports = {
    api: {
        getEventsByGameSession: api+"/events/:id"
    },

    queue: {
        start:        'start',
        end:          'end'
    },
    keys: {
        meta:          'm',
        in:            'i',
        assessment:    'ae',
        distiller:     'dist',
        distillerData: 'data',
        bayes:         'baye',
        bayesData:     'data'
    }
};
