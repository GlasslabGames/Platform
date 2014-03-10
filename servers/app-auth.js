/**
 * Authentication - App Server
 */
var Auth          = require('./lib/auth.js');
var ConfigManager = require('./lib/config.manager.js');

var config = new ConfigManager();
// load config files from first to last until successful
var options = config.loadSync([
    "./config.json",
    "~/hydra.config.json"
]);
global.ENV = options.env || 'dev';

console.log("---------------------------------------------");
console.log("-- Authentication App Server - Start");
console.log("---------------------------------------------");

var authServer = new Auth.Server(options);

process.on('uncaughtException', function(err) {
    console.error("Auth: Uncaught Error -", err, ", stack:", err.stack);
});

/* Exposed to testing suite */
module.exports = authServer;
/* ------------------------ */
