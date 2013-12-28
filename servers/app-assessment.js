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

console.log("---------------------------------------------");
console.log("-- Assessment App Server - Start");
console.log("---------------------------------------------");

var a = new Assessment.Server(options);

process.on('uncaughtException', function(err) {
    console.trace("Assessment: Uncaught Error -", err);
});
