/**
 * App Service for Telemetry Disbatch
 *
 * redis - https://github.com/mranney/node_redis
 *
 */
var _         = require('underscore');
var telemetry = require('./lib/telemetry.js');
var settings  = _.extend(
    require('./config.json'),
    require('./telemetry.settings.js')
);

try {
    dispatcher = new telemetry.Dispatcher(settings);
} catch(err){
    console.log("Dispatcher Error:", err);
}

process.on('uncaughtException', function(err) {
    console.log("Dispatch Uncaught Error:", err);
});

console.log('Waiting for messages...');
