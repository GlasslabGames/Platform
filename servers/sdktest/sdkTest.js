///////////////////
// CONFIGURATION //
///////////////////

var sdkTestSuite = require('./lib/sdkTestSuite.js'),
		testData  = require('./lib/sdkTestData.js'),
		routeMap	= require('./lib/routes.js');


//////////////////
// TEST ROUTINE //
//////////////////

//var testENVs  = ["prod", "stage", "local", "dev"];  // NOTE - Since local will vary, not included by default.
//var testENVs  = ["stage", "prod"];  // DEBUG - use for testing in isloation
var testENVs  = ["local"];  // DEBUG - use for testing in isloation

var logDebug = 0;   // NOTE - 0: quiet, 1: verbose

// NOTE - timeout is set in the grunt config

for (var testENV in testENVs) {
	sdkTestSuite(testENVs[testENV], testData[testENVs[testENV]], routeMap, logDebug);
}
