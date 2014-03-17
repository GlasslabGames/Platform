/**
 * API Routes Consts
 *
 */

var api = '/api';

module.exports = {
    user: {
        login:           api+'/user/login',
        logout:          api+'/user/logout',
        regUser:         api+'/user/register',
        regManager:      api+'/user/register/manager',     // TODO
        resetPassUpdate: api+'/user/resetpassword/update', // TODO
        updateUser:      api+'/user/:id'
    },
    wa_session: {
        validate:        api+'/wa-session/validate/:id'
    },
    session: {
        validateWithId:  api+'/session/validate/:id',
        validateNoId:    api+'/session/validate'
    },

    v1: {
        startsession:        api+'/:type/startsession',
        sendtelemetrybatch:  api+'/:type/sendtelemetrybatch',
        endsession:          api+'/:type/endsession'
    },
    v2: {
        sessionStart:  api+'/v2/data/session/start',
        sessionEnd:    api+'/v2/data/session/end',
        sendEvents:    api+'/v2/data/events'
    }
};
