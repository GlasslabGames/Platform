var collector = require("../app-telemetry-collector"),
    should    = require('chai').should(),
    request   = require('supertest');

// Test 1 : Telem Server
describe('Telemetry Collection Server', function () {
    describe('Launch server', function() {
        it('should launch without error', function (done) {
            collector.should.be.ok;
            done();
        });
    });
});

/* Supertest unit testing an API call */
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
