/**
 * Telemetry Collector - App Server
 */
var telemetry     = require('./lib/telemetry.js');
var ConfigManager = require('./lib/config.manager.js');

var config = new ConfigManager();
// load config files from first to last until successful
var options = config.loadSync([
    "./config.json",
    "~/config.telemetry.json",
    "~/config.glasslab.json"
]);

console.log("---------------------------------------------");
console.log("-- Telemetry Collector App Server - Start");
console.log("---------------------------------------------");

var c = new telemetry.Collector(options);

process.on('uncaughtException', function(err) {
    console.error("Collector: Uncaught Error -", err);
});
