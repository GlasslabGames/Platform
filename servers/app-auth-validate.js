/**
 * Authentication Validate - App Server
 */
var Auth          = require('./lib/auth/auth.js');
var ConfigManager = require('./lib/core/config.manager.js');

var config = new ConfigManager();
// load config files from first to last until successful
var options = config.loadSync([
    "./config.json",
    "~/hydra.config.json"
]);
global.ENV = options.env || 'dev';

console.log("---------------------------------------------");
console.log("-- Authentication Validate App Server - Start");
console.log("---------------------------------------------");

var av = new Auth.Validate(options);

process.on('uncaughtException', function(err) {
    console.error("AuthValidate: Uncaught Error -", err, ", stack:", err.stack);
});

/* Exposed to testing suite */
module.exports = av;
/* ------------------------ */
