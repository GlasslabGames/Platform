/**
 * App Service for Telemetry Disbatch
 *
 * redis - https://github.com/mranney/node_redis
 *
 */
var tDispatch = require('./tdispatch.js');
var settings  = require('../server_config.json');

dispatch = new tDispatch(settings);
console.log('Waiting for messages...');
