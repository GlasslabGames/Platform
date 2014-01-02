/**
 * API Routes Consts
 *
 */

var api = '/api';

module.exports = {
    user: {
        login:           api+'/user/login',
        logout:          api+'/user/logout',
        create:          api+'/user/create', // TODO
        regUser:         api+'/user/register', // TODO
        regManager:      api+'/user/register/manager', // TODO
        resetPassUpdate: api+'/user/resetpassword/update', // TODO
        updateUser:      { post: api+'/user/:id' }  // TODO: only for post
    },
    wa_session: {
        validate:        api+'/wa-session/validate/:id'
    },
    session: {
        validateWithId:  api+'/session/validate/:id',
        validateNoId:    api+'/session/validate'
    },
    startsession:        api+'/:type/startsession',
    sendtelemetrybatch:  api+'/:type/sendtelemetrybatch',
    endsession:          api+'/:type/endsession'
};
