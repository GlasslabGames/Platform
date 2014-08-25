var data      = require('./lib/testData.js').stage,
		routes		= require('./lib/routes.js'),
		request   = require('superagent'),
    mocha     = require('mocha'),
    chai      = require('chai'),
    expect    = chai.expect;

///////////////////
// CONFIGURATION //
///////////////////

var testENV = "stage",
    srvAddr = data.serverAddress;

var newClassId, classData;
var agent = request.agent();

//////////////////////
// HELPER FUNCTIONS //
//////////////////////

function zfill(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}

function tstamp() {
	var date = (new Date());
	return date.getYear() + zfill(date.getMonth(),2) + zfill(date.getDate(),2) + '-' + zfill(date.getHours(),2) + '.' + date.getMinutes() + '.' + date.getSeconds()
}


describe("API v2 testing", function(done) {
	
    it("#should connect to " + testENV + "environment", function(done) {
        agent
					.get(srvAddr)
					.end(function(res){
            expect(res.status).to.eql(200);
						done();
					});
    });
    
    it("should return valid SDK config data", function(done) {
        agent
          .get(srvAddr + routes.sdk.connect.path)
          .end(function(res) {
              expect(res.status).to.eql(200);
              expect(res.text).to.eql(routes.sdk.connect.expected);
              done();
          });        
    });

    it("#shouldn't be able to manipulate data without login", function (done) {
        agent
					.get(srvAddr + routes.classes.list.path)
          .type('application/json')
					.end(function(res){
            expect(res.status).to.eql(401);
						done();
					});
    });
    
    it("#should log in successfully", function(done) {

        agent
					.post(srvAddr + routes.login.path)
          .type('application/json')
          .send(routes.login.post)
					.end(function(res){
            expect(res.status).to.eql(200);
            expect(res.body.id).to.eql(data.teacher.userId);
						done();
					});
        
    });
    
    it("#returns classes correctly", function(done) {
        
        agent
					.get(srvAddr + routes.classes.list.path)
          .type('application/json')
					.end(function(res){
            expect(res.status).to.eql(200);
						done();
					});
        
    });
    
    it.skip("#creates new class", function(done) {
        
        // NOTE - adds timestamp to class name
        var postData = routes.classes.create.post;
        postData['title'] = postData['title'] + tstamp();
        
        agent
					.post(srvAddr + routes.classes.create.path)
          .type('application/json')
          .send(JSON.stringify(postData))
					.end(function(res){
            expect(res.status).to.eql(200);
            newClasId = res.body.id;    // NOTE - passes id, prereq for archive steps
						done();
					});
    });
    
    it.skip("#archives new class", function(done) {
        
        agent
					.post(srvAddr + routes.classes.create.path)
          .type('application/json')
          .send(JSON.stringify(postData))
					.end(function(res){
            expect(res.status).to.eql(200);
						done();
					});
    });

    it.skip("#restores class", function(done) {
        
        agent
					.post(srvAddr + routes.classes.create.path)
          .type('application/json')
          .send(JSON.stringify(postData))
					.end(function(res){
            expect(res.status).to.eql(200);
						done();
					});
    });
    
    it("#returns reports - SOWO", function(done) {
        
        console.log(srvAddr + routes.reports.sowo.path);
        
        agent
					.get(srvAddr + routes.reports.sowo.path)
          .type('application/json')
					.end(function(res){
            expect(res.status).to.eql(200);
              // TODO - more robust checking for specific achievements for classes, likely coverage
						done();
					});
    });
    
    it.skip("#returns reports - achievements", function() {
        
    });
    
    it("should log out afterwards", function(done) {
        
        agent
					.post(srvAddr + routes.logout.path)
          .type('application/json')
          .send(routes.logout.post)
					.end(function(res){
            expect(res.status).to.eql(200);
						done();
					});
    });
    
});
