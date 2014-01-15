/**
 * Telemetry Dispatcher - App Server
 */
var telemetry     = require('./lib/telemetry.js');
var ConfigManager = require('./lib/config.manager.js');

var config = new ConfigManager();
// load config files from first to last until successful
var options = config.loadSync([
    "./config.json",
    "~/hydra.config.json"
]);
global.ENV = options.env || 'dev';

console.log("---------------------------------------------");
console.log("-- Telemetry Dispatcher App Server - Start");
console.log("---------------------------------------------");

var d = new telemetry.Dispatcher(options);

process.on('uncaughtException', function(err) {
    console.error("Dispatcher: Uncaught Error -", err, ", stack:", err.stack);
});
