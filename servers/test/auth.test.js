var AuthServer   = require("../app-auth"),
    AuthValidate = require("../app-auth"),
    should       = require('chai').should(),
    request      = require('supertest'),
    testData     = require("./data/testData").auth;

// Test 1 : Auth Server
describe('Authorization Server', function () {
    describe('Auth server', function() {
        it('should launch without error', function (done) {
            AuthServer.should.be.ok;
            done();
        });
    });
    describe('Auth validation server', function() {
        it('should launch without error', function (done) {
            AuthValidate.should.be.ok;
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

// Test 3 : User Actions




//user: {
//    login:           api+'/user/login',
//        logout:          api+'/user/logout',
//        regUser:         api+'/user/register',
//        regManager:      api+'/user/register/manager',     // TODO
//        resetPassUpdate: api+'/user/resetpassword/update', // TODO
//        updateUser:      api+'/user/:id'