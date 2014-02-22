/**
 * Assessment - App Server
 */
var Assessment    = require('../lib/assessment.js'),
    ConfigManager = require('../lib/config.manager.js'),
    config        = new ConfigManager(),
    should        = require('chai').should();

// testnote - load settings (refactor sep pkg?), verify returns expected options
var config = new ConfigManager();
// load config files from first to last until successful
var options = config.loadSync([
    "../config.json",
    "~/hydra.config.json"
]);
global.ENV = options.env || 'dev';

// testnote - run & log, verify that it ran "properly"
var a = new Assessment.Server(options);
console.log("---------------------------------------------");
console.log("-- Assessment App Server - Start");
console.log("---------------------------------------------");

// testnote - catch unexpected err, verify function does log errors
process.on('uncaughtException', function(err) {
    console.error("Assessment: Uncaught Error -", err, ", stack:", err.stack);
});


/* 
Test 1:
Sort of copy-paste, consider refactoring "../app-*.js" files to allow 
testing endpoints.
*/
describe("Assessment Server", function () {
    describe("#sever_start()", function () {
        it("should start without error", function () {
            a.should.exist;
        });
    });
});