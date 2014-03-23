/**
 * Telemetry Distiller - App Server
 */
var assessment     = require('./lib/aeng/assessment.js');
var ConfigManager = require('./lib/core/config.manager.js');

var config = new ConfigManager();
// load config files from first to last until successful
var options = config.loadSync([
    "./config.json",
    "~/hydra.config.json"
]);
global.ENV = options.env || 'dev';

console.log("---------------------------------------------");
console.log("-- Telemetry Distiller App Server - Start");
console.log("---------------------------------------------");

var d = new assessment.Distiller.Server(options);

process.on('uncaughtException', function(err) {
    console.error("Distiller: Uncaught Error -", err, ", stack:", err.stack);
});
