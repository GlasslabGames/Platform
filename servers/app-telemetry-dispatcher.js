/**
 * Telemetry Dispatcher - App Server
 */
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

var dispatcher = new telemetry.Dispatcher(settings);

process.on('uncaughtException', function(err) {
    console.error("Dispatcher: Uncaught Error -", err);
});
