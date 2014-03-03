var authServer   = require("../app-auth"),
    authValidate = require("../app-auth"),
    should       = require('chai').should(),
    request      = require('supertest'),
    testData     = require("./data/testData").auth;

// Test 1 : Auth Server
describe('Authorization Server Initialization', function () {
    describe('Launch auth server', function() {
        it('should launch without error', function (done) {
            authServer.should.be.ok;
            done();
        });

        it('should launch without error', function (done) {
            authValidate.should.be.ok;
            done();
        });
    });
});

/* Test 2 : Login Testing *
describe('Authorization Server Initialization', function () {
    describe('Launch auth server', function() {
        it('should log in correctly with good credentials', function (done) {
            // supply good creds
            done();
        });

        it('should not log in and alert with bad credentials', function (done) {
            // supply bad creds
            done();
        });
    });
});
/* ---- */