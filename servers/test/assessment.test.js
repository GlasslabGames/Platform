var Assessment = require('../app-assessment.js'),
    should     = require('chai').should(),
    testData   = require("./data/testData").assessment;

// Test 1 : Assessment Server
describe('Assessment Server', function () {
    describe('Launch server', function() {
        it('should launch without error', function (done) {
            Assessment.should.be.ok;
            done();
        });
    });
});
