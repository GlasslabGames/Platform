var Util = require('../../core/util.js');
var _    = require('lodash');
var fs = require('fs');
var when       = require('when');

module.exports = {
    version: version
};

function version(req, res, next, serviceManager) {
  this.requestUtil.jsonResponse(res, serviceManager.version);
}