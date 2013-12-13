/**
 * Auth Routes Consts
 *
 */

var api = '/api';

module.exports = {
    exclude: [
        api+"/config"
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
        "/challenge",
        "/license"
    ]
};
