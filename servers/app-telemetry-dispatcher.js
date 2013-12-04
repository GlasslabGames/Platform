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

try {
    dispatcher = new telemetry.Dispatcher(settings);
} catch(err){
    console.trace("Dispatcher: Error -", err);
}

process.on('uncaughtException', function(err) {
    console.error("Dispatcher: Uncaught Error -", err);
});
