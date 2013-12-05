/**
 * App Service for Telemetry Disbatch
 *
 * redis - https://github.com/mranney/node_redis
 *
 */
var _             = require('underscore');
var telemetry     = require('./lib/telemetry.js');
var ConfigManager = require('./lib/config.manager.js');

var config = new ConfigManager();
// load config files from first to last until successful
var settings = config.loadSync([
    "./config.json",
    "~/config.telemetry.json",
]);

console.log("---------------------------------------------");
console.log("-- Telemetry Dispatcher App Server - Start");
console.log("---------------------------------------------");

try {
    dispatcher = new telemetry.Dispatcher(settings);
} catch(err){
    console.log("Dispatcher: Error -", err);
}

process.on('uncaughtException', function(err) {
    console.log("Dispatcher: Uncaught Error -", err);
});
