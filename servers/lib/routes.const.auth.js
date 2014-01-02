/**
 * Auth Routes Consts
 *
 */

var api = '/api';

module.exports = {
    special: [
        {
            route: api+"/config",
            include:  "post",
            exclude:  "get"
        }
    ],
    exclude: [
        "/static", // needs to be served by the webapp because it's from admin
        api+"/user/login",
        api+"/user/create",
        api+"/user/register",
        api+"/user/resetpassword",
        api+"/code/valid",
        api+"/game"
        //,api+"/challenge"
    ],
    include: [
        api,
        "/classes",
        "/roster",
        "/class",
        "/report",
        "/create",
        "/code",
        "/missions",
        "/license",
        "/admin"
    ]
};
