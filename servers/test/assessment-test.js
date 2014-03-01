/**
 * Assessment - App Server
 */
var Assessment = require('../app-assessment.js'),
    should     = require('chai').should();

// Test 1 : Assessment Server
describe('Assessment Server', function () {
    describe('Launch server', function() {
        it('should launch without error', function (done) {
            Assessment.should.be.ok;
            done();
        });
    });
});
