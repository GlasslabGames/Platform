/**
 * Authentication Validate - App Server
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
console.log("-- Authentication Validate App Server - Start");
console.log("---------------------------------------------");

var av = new Auth.Validate(options);

process.on('uncaughtException', function(err) {
    console.trace("AuthValidate: Uncaught Error -", err);
});
