///////////////////
// CONFIGURATION //
///////////////////

var apiTestSuite = require('./lib/apiTestSuite.js'),
		testData  = require('./lib/testData.js'),
		routeMap	= require('./lib/routes.js');


//////////////////
// TEST ROUTINE //
//////////////////

var testENVs  = ["prod", "stage"];  // NOTE - Since local will vary, not included by default.

for (var testENV in testENVs) {
	apiTestSuite(testENVs[testENV], testData, routeMap);
}
