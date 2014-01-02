/**
 * Routes Consts
 *
 */

var root = '/';

module.exports = {
    root:  root,
    login: root+"login",
    all:   root+'*',

    api:  require('./routes.const.api.js'),
    auth: require('./routes.const.auth.js'),

    static: {
        root: "/index.html",
        include: [
            {route:"/login", path:"/index.html"},
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
