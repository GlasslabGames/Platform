///////////////////
// CONFIGURATION //
///////////////////

var apiTestSuite = require('./lib/apiTestSuite.js'),
		testData  = require('./lib/testData.js'),
		routeMap	= require('./lib/routes.js');


//////////////////
// TEST ROUTINE //
//////////////////

//var testENVs  = ["prod", "stage", "local", "dev"];  // NOTE - Since local will vary, not included by default.
var testENVs  = ["stage"];  // DEBUG - use for testing in isloation

var logDebug = 0;   // NOTE - 0: quiet, 1: verbose

// NOTE - timeout is set in the grunt config

for (var testENV in testENVs) {
	apiTestSuite(testENVs[testENV], testData[testENVs[testENV]], routeMap, logDebug);
}
