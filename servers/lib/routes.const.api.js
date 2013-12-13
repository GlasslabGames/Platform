/**
 * API Routes Consts
 *
 */

var api = '/api';

module.exports = {
    login:              api+'/user/login',
    logout:             api+'/user/logout',
    session: {
        validate:       api+'/session/validate/:id'
    },
    startsession:       api+'/:type/startsession',
    sendtelemetrybatch: api+'/:type/sendtelemetrybatch',
    endsession:         api+'/:type/endsession'
};
