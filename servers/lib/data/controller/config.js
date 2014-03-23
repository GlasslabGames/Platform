
var Util = require('../../core/util.js');

module.exports = {
    index: index
};

function index(req, res, next)
{
    // TODO
    this.requestUtil.jsonResponse(res, {test:123});
}
