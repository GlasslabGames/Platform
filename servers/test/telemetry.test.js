var collector  = require("../app-telemetry-collector"),
    dispatcher = require("../app-telemetry-dispatcher"),
    should     = require('chai').should(),
    request    = require('supertest')
    v1         = require('../lib/routes.const.api').v1,
    v2         = require('../lib/routes.const.api').v2,
    testData   = require("./data/testData").telemetry;

// Test 1 : Telem Server
describe('Telemetry Server', function () {
    describe('Telemetry collector', function () {
        it('should launch without error', function (done) {
            // not a robust lunch test
            collector.should.be.ok;
            done();
        });
    });
    describe('Telemetry dispatcher', function () {
        it('should launch without error', function (done) {
            // not a robust lunch test
            dispatcher.should.be.ok;
            done();
        });
    });
});

// Initialize Supertesting
var collRequest = request(collector.app);
//var dispRequest = request(dispatcher.app);

// Test 2 : Telem Events
describe('Telemetry Session [Version 1]', function () {
    describe.skip('#startSession()', function () {
        it('initiates a new challenge session', function (done) {
            collRequest
                .post('/api/challenge/startsession')
                .send(testData.session)
                .end(function (err, res) {
                    should.not.exist(err);
                    res.should.have.status(200);
                    done();
                });
        });
    });

    // negative test - start duplicate session
    // negative test - start session improperly
    // negative test - end wrong session
    // negative test - end non-existent session

    describe.skip('#endSession()', function () {
        it('terminates current valid session', function (done) {
            collRequest
                .post('/api/challenge/startsession')
                .send(testData.session)
                .end(function (err, res) {
                    should.not.exist(err);
                    res.should.have.status(404);
                    done();
                });
        });
    });
});


//Collector.prototype.setupRoutes = function() {
//    this.app.post(rConst.api.v1.startsession,       this.startSession.bind(this));
//    this.app.post(rConst.api.v1.sendtelemetrybatch, this.sendBatchTelemetryV1.bind(this));
//    this.app.post(rConst.api.v2.sendEvents,         this.sendBatchTelemetryV2.bind(this));
//    this.app.post(rConst.api.v1.endsession,         this.endSession.bind(this));
//}

//wa_session: {
//    validate:        api+'/wa-session/validate/:id'
//},
//session: {
//    validateWithId:  api+'/session/validate/:id',
//    validateNoId:    api+'/session/validate'
//},
//
//v1: {
//    startsession:        api+'/:type/startsession',
//    sendtelemetrybatch:  api+'/:type/sendtelemetrybatch',
//    endsession:          api+'/:type/endsession'
//},
//v2: {
//    sessionStart:  api+'/2/telem/session/start',
//    sendEvents:    api+'/2/telem/sendEvents',
//    sessionEnd:    api+'/2/telem/session/end'
//}