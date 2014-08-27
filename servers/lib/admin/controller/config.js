var Util = require('../../core/util.js');
var _    = require('lodash');
var fs = require('fs');
var when       = require('when');

module.exports = {
    version: version
};

function version(req, res, next, serviceManager) {
    if (serviceManager.version) {
        this.requestUtil.jsonResponse(res, serviceManager.version);
    } else {
        this.requestUtil.jsonResponse(res, 'version file not found')
    }
}