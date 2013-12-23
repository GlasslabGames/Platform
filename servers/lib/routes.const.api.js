/**
 * API Routes Consts
 *
 */

var api = '/api';

module.exports = {
    login:              api+'/user/login',
    logout:             api+'/user/logout',
    wa_session: {
        validate:       api+'/wa-session/validate/:id'
    },
    session: {
        validateWithId: api+'/session/validate/:id',
        validateNoId:   api+'/session/validate'
    },
    startsession:       api+'/:type/startsession',
    sendtelemetrybatch: api+'/:type/sendtelemetrybatch',
    endsession:         api+'/:type/endsession'
};
