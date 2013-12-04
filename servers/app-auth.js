/**
 * Authentication - App Server
 */
var Auth          = require('./lib/auth.js');
var ConfigManager = require('./lib/config.manager.js');

var config = new ConfigManager();
// load config files from first to last until successful
var settings = config.loadSync([
    "./config.json",
    "~/config.telemetry.json",
]);

try {
    auth = new Auth.Server(settings);
} catch(err){
    console.trace("Auth: Error -", err);
}

process.on('uncaughtException', function(err) {
    console.error("Auth: Uncaught Error -", err);
});
