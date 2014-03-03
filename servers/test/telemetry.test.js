var collector = require("../app-telemetry-collector"),
    should    = require('chai').should(),
    request   = require('supertest'),
    testData  = require("./data/testData").telemetry;

// Test 1 : Telem Server
describe('Telemetry Collection Server', function () {
    describe('Launch server', function() {
        it('should launch without error', function (done) {
            collector.should.be.ok;
            done();
        });
    });
});

/* Sample API call test */
describe('GET /users', function(){
    it('respond with json', function(done){
        request(collector.app)
        .get('/users')
        .set('Accept', 'application/json')
        .expect(404)
        .end(function(err, res){
            if (err) return done(err);
            done()
        });
    })
});
/* ---- */
