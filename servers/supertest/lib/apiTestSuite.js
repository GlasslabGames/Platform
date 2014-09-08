/////////////
// IMPORTS //
/////////////

var request   = require('superagent'),
    mocha     = require('mocha'),
    chai      = require('chai'),
    expect    = chai.expect;

var tools     	 = require('./tools.js'),
		tstamp       = tools.tstamp;


//////////////////
// TEST ROUTINE //
//////////////////

var apiTestSuite = function (env, testData, routeMap) {
	
	// Initializations
	
	var data      = testData[env],
			routes    = new routeMap(data),
			srvAddr   = data.serverAddress;
	
	var results, newClassId, classData;
	var agent = request.agent();

	describe(env.toUpperCase() + " API (v2) Test Suite", function (done) {

		console.log(tstamp());

		it("#should connect to " + env.toUpperCase() + " environment", function (done) {
			agent
				.get(srvAddr)
				.end(function (res) {
					expect(res.status).to.eql(200);
					done();
				});
		});

		it("#should retreive number of 'learning events' logged via sdk", function (done) {
			agent
				.get(srvAddr + routes.events.path)
				.end(function (res) {
					expect(res.status).to.eql(200);
					console.log(res.text);		// FUTURE add events count to results json doc
					done();
				});
		});

		it("should return valid SDK config data", function (done) {
			agent
				.get(srvAddr + routes.sdk.connect.path)
				.end(function (res) {
					expect(res.status).to.eql(200);
					expect(res.text).to.eql(routes.sdk.connect.expected);
					done();
				});
		});

		it("#shouldn't be able to manipulate data without login", function (done) {
			agent
				.get(srvAddr + routes.classes.list.path)
				.type('application/json')
				.end(function (res) {
					expect(res.status).to.eql(401);
					done();
				});
		});

		it("#should log in successfully", function (done) {

			agent
				.post(srvAddr + routes.login.path)
				.type('application/json')
				.send(routes.login.post)
				.end(function (res) {
					expect(res.status).to.eql(200);
					expect(res.body.id).to.eql(data.teacher.userId);
					done();
				});

		});

		it("#returns classes correctly", function (done) {

			agent
				.get(srvAddr + routes.classes.list.path)
				.type('application/json')
				.end(function (res) {
					expect(res.status).to.eql(200);
					done();
				});

		});

		it("#archives new class", function (done) {

			// start out un-archived
			agent
				.get(srvAddr + routes.classes.info.path)
				.end(function (res) {
					expect(res.status).to.eql(200);
					classData = JSON.parse(res.text);
					expect(classData["archived"]).to.eql(false);
					classData["archived"] = true;

					// send archive call
					agent
						.post(srvAddr + routes.classes.info.path)
						.type('application/json')
						.send(classData)
						.end(function (res) {
							expect(res.status).to.eql(200);

							// verify class was archived
							agent
								.get(srvAddr + routes.classes.info.path)
								.end(function (res) {
									expect(res.status).to.eql(200);
									expect(JSON.parse(res.text)["archived"]).to.eql(true);
									done();
								});
						});

				});

		});

		it("#restores class", function (done) {

			// start out archived
			agent
				.get(srvAddr + routes.classes.info.path)
				.end(function (res) {
					expect(res.status).to.eql(200);
					classData = JSON.parse(res.text);
					expect(classData["archived"]).to.eql(true);
					classData["archived"] = false;

					// send un-archive call
					agent
						.post(srvAddr + routes.classes.info.path)
						.type('application/json')
						.send(classData)
						.end(function (res) {
							expect(res.status).to.eql(200);


							// verify class was un-archived
							agent
								.get(srvAddr + routes.classes.info.path)
								.end(function (res) {
									expect(res.status).to.eql(200);
									expect(JSON.parse(res.text)["archived"]).to.eql(false);
									done();
								});
						});
				});

		});

		it("#returns reports - SOWO", function (done) {

			agent
				.get(srvAddr + routes.reports.sowo.path)
				.type('application/json')
				.end(function (res) {
					expect(res.status).to.eql(200);

					var resText = JSON.parse(res.text);
          
          var matched = false;
				
          // FUTURE - clean up and perhaps swap FOR-IN loop
					for (var studentIndex in resText) {
              if(resText[studentIndex]['userId'] == data.student.id) {
                  matched = true;
                  expect(resText[studentIndex]['results']).to.eql(data.student.sowo);
              }
          }
          
          expect(matched).to.eql(true);
          
					done();
          
				});
		});

		it("#returns reports - achievements", function (done) {
			agent
				.get(srvAddr + routes.reports.achievements.path)
				.type('application/json')
				.end(function (res) {
					expect(res.status).to.eql(200);

					var resText = JSON.parse(res.text);

          var matched = false;

					for (var studentIndex in resText) {
              if(resText[studentIndex]['userId'] == data.student.id) {
                  matched = true;
                  expect(resText[studentIndex]['achievements']).to.eql(data.student.achievements);
              }
          }
          
          expect(matched).to.eql(true);

					done();
				});
		});

		it("should log out afterwards", function (done) {

			agent
				.post(srvAddr + routes.logout.path)
				.type('application/json')
				.send(routes.logout.post)
				.end(function (res) {
					expect(res.status).to.eql(200);
					done();
				});
		});

		it.skip('#register as new teacher - normal', function (done) {

			done();
		});

		it.skip('#register as new teacher - Clever', function (done) {

			done();
		});

		it.skip('#register as new teacher - iCivics', function (done) {

			done();
		});

		it.skip("#creates new class", function (done) {

			var postData = routes.classes.create.post;
			postData['title'] = postData['title'] + tstamp();

			agent
				.post(srvAddr + routes.classes.create.path)
				.type('application/json')
				.send(JSON.stringify(postData))
				.end(function (res) {
					expect(res.status).to.eql(200);
					newClassId = res.body.id; // NOTE - passes id, prereq for archive steps
					done();
				});
		});

	});
}

module.exports = apiTestSuite;