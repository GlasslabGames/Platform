/**
 * Telemetry Distiller - App Server
 */
var assessment     = require('./lib/assessment.js');
var ConfigManager = require('./lib/config.manager.js');

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

<<<<<<< HEAD:servers/app-telemetry-dispatcher.js
var tDispatcher = new telemetry.Dispatcher(options);
=======
var d = new assessment.Distiller.Server(options);
>>>>>>> upstream/Phase3:servers/app-assessment-distiller.js

process.on('uncaughtException', function(err) {
    console.error("Distiller: Uncaught Error -", err, ", stack:", err.stack);
});

/* Exposed to testing suite */
module.exports = tDispatcher;
/* ------------------------ */
