/////////////
// IMPORTS //
/////////////

// Externals
var fs				= require('fs'),
		request   = require('superagent'),
    mocha     = require('mocha'),
    chai      = require('chai'),
    expect    = chai.expect;

// Custom helper f'ns
var tools    						= require('./tools.js'),
		tstamp    					= tools.tstamp,
    genClass  					= tools.genClass,
		genUser   					= tools.genUser,
		requestAccess 			= tools.requestAccess,
		listenForEmailsFrom = tools.listenForEmailsFrom;

//////////////////
// TEST ROUTINE //
//////////////////

var apiTestSuite = function (env, data, routeMap) {

	var routes  = new routeMap(data),
			srvAddr = data.serverAddress;
	
	var agent   = request.agent(),
			results = {};
	
	var classData;

	describe(env.toUpperCase() + " API (v2) Test Suite", function (done) {

		results['timestamp'] = tstamp();

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
					results['events'] = (res.text);
					done();
				});
		});

		it("should return valid SDK config data", function (done) {
			agent
				.get(srvAddr + routes.sdk.connect.path)
				.end(function (res) {
					expect(res.status).to.eql(200);
					expect(res.text).to.eql(routes.sdk.connect.expected);
				
					agent
						.get(res.text + '/api/v2/data/config/' + data.testGameId)
						.end(function (res) {
							
							console.log(res.text);
							// TODO check event size and timeout data in the AA-1
							

							done();
						});
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
				
          // FUTURE - clean up and perhaps swap FOR-IN loop (achievements too)
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

		it("#should log out afterwards", function (done) {
			agent
				.post(srvAddr + routes.logout.path)
				.type('application/json')
				.send(routes.logout.post)
				.end(function (res) {
					expect(res.status).to.eql(200);
					done();
				});
		});

//		it.skip('#register as new teacher - Playfully', function (done) {   // FUTURE - reinstate post closed beta
//      
//			var newUser = genUser('glTestTeacher' + tstamp(), 'build+' + tstamp() + '@glasslabgames.org', 'glasslab123', 'teacher');
//				// NOTE - should this reuse timestamp?
//			results['newTeacherPost'] = newUser;
//      
//      console.log(srvAddr + routes.register.teacher.path);
//      
//			agent
//				.post(srvAddr + routes.register.teacher.path)
//				.type('application/json')
//				.send(JSON.parse(newUser))
//				.end(function (res) {
//        
//					expect(res.status).to.eql(200);
//					results['newTeacher'] = res.text;
//					done();
//				});
//      
//		});
		
		it('#can request access to Playfully.org', function(done) {
			
			// TODO - still in dev, blocked by server issues
			var newUser = requestAccess('glTestTeacher' + tstamp(), 'build+' + tstamp() + '@glasslabgames.org', 'glasslab123');
			results['newTeacherRequestPost'] = newUser;
      
			agent
				.post(srvAddr + routes.register.teacher.path)
				.type('application/json')
				.send(JSON.parse(newUser))
				.end(function (res) {
					expect(res.status).to.eql(200);
					results['newTeacher'] = res.text;
					
				
					done(); // TODO - this is step 1 of 3
									// need to reroute the confirm email
									// click on the confirm link, then
									// catch the response email and confirm
									
									// NOTE - following steps will only work
									// locally if config is changed, if case
				
				});
			
		});
		
		it.skip('#register as new teacher - Clever', function (done) {
			done();
		});
			
		it("#lists SCE missions", function(done) {
			agent
				.get(srvAddr + "/api/v2/dash/game/SC/missions")
				.end(function(res) {
					expect(res.status).to.eql(200);
				
//					console.log(res.text);	// DEBUG/
					done();
				})
			
		});

		it.skip('#register as new teacher - iCivics', function (done) {
			done();
		});
    
		it.skip("#creates new class", function(done) {

			var postData = genClass("glTestClass" + tstamp(), '7, 11', data.testGameId);
			results['newClassPost'] = postData;

			agent
				.post(srvAddr + routes.classes.create.path)
				.type('application/json')
				.send(postData)
				.end(function (res) {
					expect(res.status).to.eql(200);
					results['newClass'] = res.body;
					results['newClassCode'] = results['newClass']['code'];
					done();
				});
		});
		
//    it.skip('#register as a new student in that class', function(done) {    // NOTE - will not work with closed beta
//      
//      var newStudentPost = genUser('glTestStudent' + tstamp(), results['newClassCode'], 'glasslab321', 'student');
//      results['newStudentPost'] = newStudentPost;
//      
//			agent
//				.post(srvAddr + routes.register.student.path.replace(':code', results['newClassCode']))
//				.type('application/json')
//				.send(JSON.parse(newStudentPost))
//				.end(function (res) {
//					expect(res.status).to.eql(200);
//					
//					var confirmation = JSON.parse(res.text);
//					results['newStudent'] = res.text;
//					done();
//				});
//    });
		
    it("#can reset a teacher's password", function(done) {
      
			var confirmationEmail;
			
      agent
				.post(srvAddr + routes.password_reset.path)
				.type('application/json')
				.send({'email': data.teacher.email})
				.end(function (res) {

					expect(res.status).to.eql(200);

					listenForEmailsFrom('accounts@glasslabgames.org', function (email) {

						confirmationEmail = email;
						
						

						done();
					});
				});
    });
	});
	
	after(function () {

		var resultFile = 'supertest/results/' + env + results['timestamp'] + '.json';		// NOTE - may need to clean the tstamp for fname

		fs.writeFile(resultFile, JSON.stringify(results, null, 4), function (err) {
			if (err) {
				console.log(err);
			} else {
				console.log("Results saved to " + resultFile);
			}
		});

	});
	
}

module.exports = apiTestSuite;