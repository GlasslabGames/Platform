/**
 * App Service for Telemetry Disbatch
 *
 * redis - https://github.com/mranney/node_redis
 *
 */
var tDispatch   = require('./tdispatch.js');

dispatch = new tDispatch();
console.log('Waiting for messages...');
