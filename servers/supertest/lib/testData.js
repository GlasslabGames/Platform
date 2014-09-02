var stage = require('./stage.js'),
    local = require('./local.js'),
    prod  = require('./prod.js');

module.exports = {

    stage: stage,
    local: local,
    prod: prod
    
}
