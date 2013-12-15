/**
 * Auth Routes Consts
 *
 */

var api = '/api';

module.exports = {
    exclude: [
        api+"/config"
        /*,
        "/challenges",
        "/css",
        "/font",
        "/images",
        "/js",
        "/maintenance",
        "/template",
        "/updates"*/
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
        "/license"
    ]
};
