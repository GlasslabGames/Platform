/**
 * Assessment - App Server
 */
var Assessment    = require('./lib/assessment.js');
var ConfigManager = require('./lib/config.manager.js');

var config = new ConfigManager();
// load config files from first to last until successful
var options = config.loadSync([
    "./config.json",
    "~/hydra.config.json"
]);
global.ENV = options.env || 'dev';

console.log("---------------------------------------------");
console.log("-- Assessment App Server - Start");
console.log("---------------------------------------------");

var aServer = new Assessment.Server(options);

process.on('uncaughtException', function(err) {
    console.error("Assessment: Uncaught Error -", err, ", stack:", err.stack);
});

/* Exposed to testing suite */
module.exports = aServer;
/* ------------------------ */
