///////////////////
// CONFIGURATION //
///////////////////

var apiTestSuite = require('./lib/apiTestSuite.js'),
		testData  = require('./lib/testData.js'),
		routeMap	= require('./lib/routes.js');


//////////////////
// TEST ROUTINE //
//////////////////

var testENVs  = ["stage", "prod"];
//var testENVs  = ["stage"];

for (var testENV in testENVs) {
	console.log(testENVs[testENV]);
	apiTestSuite(testENVs[testENV], testData, routeMap);
}
