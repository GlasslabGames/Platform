/**
 * Created by Michael on 2/21/14.
 */

module.exports = function () {
    var ConfigManager   = require('./config.manager.js'),
        config          = new ConfigManager();

    // Test            = require('../test/tests.js'),

    // load config files from first to last until successful
    var options = config.loadSync([
        "./config.json",
        "~/hydra.config.json"
    ]);

    global.ENV = options.env || 'dev';      // Perhaps this will be pulled out into config.json

    exports.start = function (serverName, spinUpFn) {

        var x = spinUpFn(options)               // Creates server
    //    Test.serverTest(x, serverName);     // Test

        console.log("---------------------------------------------");
        console.log("-- " + serverName + " Server - Start");
        console.log("---------------------------------------------");

        process.on('uncaughtException', function(err) {
            console.error(serverName + ": Uncaught Error -", err, ", stack:", err.stack);
        });

    }
}