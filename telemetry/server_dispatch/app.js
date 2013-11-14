/**
 * App Service for Telemetry Disbatch
 *
 * redis - https://github.com/mranney/node_redis
 *
 */
var tDispatch = require('./tdispatch.js');
var settings  = require('../server_config.json');

dispatch = new tDispatch(settings);

process.on('uncaughtException', function(err) {
    console.log("Dispatch Uncaught Error:", err);
});

console.log('Waiting for messages...');
