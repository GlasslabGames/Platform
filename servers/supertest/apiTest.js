///////////////////
// CONFIGURATION //
///////////////////

var apiTestSuite = require('./lib/apiTestSuite.js'),
		testData  = require('./lib/testData.js'),
		routeMap	= require('./lib/routes.js');


//////////////////
// TEST ROUTINE //
//////////////////

//var testENVs  = ["prod", "stage"];  // NOTE - Since local will vary, not included by default.
var testENVs  = ["stage"];  // DEBUG - use for testing in isloation

//var testGames = ["AA-1", "AW-1", "SC"];
var testGames = ["AA-1"];

for (var testENV in testENVs) {
	apiTestSuite(testENVs[testENV], testData[testENVs[testENV]], routeMap);
}
