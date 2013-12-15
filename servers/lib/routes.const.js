/**
 * Routes Consts
 *
 */

var root = '/';

module.exports = {
    root: root,
    all:  root+'*',

    api:  require('./routes.const.api.js'),
    auth: require('./routes.const.auth.js'),

    static: {
        root: "/index.html",
        include: [
            "/challenges",
            "/css",
            "/font",
            "/images",
            "/js",
            "/less",
            "/maintenance",
            "/template",
            "/updates"
        ]
    },

    crossDomain: root+'crossdomain.xml'
};
