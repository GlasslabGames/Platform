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
        "/passwordreset",
        api+"/user/login",
        api+"/user/create",
        api+"/user/register",
        api+"/user/resetpassword",
        api+"/code/valid",
        api+"/game",
        "/check",
        "/privacy-policy",
        "/register"
    ],
    include: [
        api,
        "/welcome",
        "/classes",
        "/roster",
        "/class",
        "/report",
        "/create",
        "/code",
        "/missions",
        "/challenge",
        "/license",
        "/admin"
    ]
};
