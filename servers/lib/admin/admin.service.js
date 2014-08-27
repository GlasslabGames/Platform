/**
 * AdminService Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  when       - https://github.com/cujojs/when
 *
 */

var when       = require('when');
// Third-party libs
var _          = require('lodash');
// load at runtime
var aConst, tConst, Util;


module.exports = AdminService;


function AdminService(options, serviceManager){
    try {
        Util       = require('../core/util.js');
        Errors     = require('../errors.js');

        this.options = _.merge(
            {
                AdminService: { port: 8081 }
            },
            options
        );
        this.requestUtil = new Util.Request(this.options, Errors);
    } catch(err) {
        console.trace("AdminService: Error -", err);
        this.stats.increment("error", "Generic");
    }
}