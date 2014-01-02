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

console.log("---------------------------------------------");
console.log("-- Authentication App Server - Start");
console.log("---------------------------------------------");

var a = new Auth.Server(options);

process.on('uncaughtException', function(err) {
    console.trace("Auth: Uncaught Error -", err);
});
