var stage = require('./data/stage.js'),
    local = require('./data/local.js'),
    prod  = require('./data/prod.js'),
    valid = require('./data/valid.js');

module.exports = {

    stage: stage,
    local: local,
    prod: prod,
	
    valid: valid
}
