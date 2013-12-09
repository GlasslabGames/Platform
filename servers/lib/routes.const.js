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

    crossDomain: root+'crossdomain.xml'
};
