///////////////////
// CONFIGURATION //
///////////////////

var apiTestSuite = require('./lib/apiTestSuite.js'),
		testData  = require('./lib/testData.js'),
		routeMap	= require('./lib/routes.js');


//////////////////
// TEST ROUTINE //
//////////////////

//var testENVs  = ["prod", "stage", "local"];  // NOTE - Since local will vary, not included by default.
var testENVs  = ["local"];  // DEBUG - use for testing in isloation

var debugFlag = true;   // Will log debug statements to console if TRUE

for (var testENV in testENVs) {
	apiTestSuite(testENVs[testENV], testData[testENVs[testENV]], routeMap, debugFlag);
}
