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
		listenForEmailsFrom = tools.listenForEmailsFrom,
		setCourse           = tools.setCourse,
		setGame							= tools.setGame,
    conLog              = tools.conLog;

// Routes - on-hold for referencing
// var routes = require('../../lib/routes.external.map.js');

// Errors
var errors = require('../../lib/errors.js');

// Game specific data and functions
var games = require('./games/index.js'),
    aa1   = games.aa1,
    aw1   = games.aw1,
    sc    = games.sc;

//////////////////
// TEST ROUTINE //
//////////////////

var apiTestSuite = function (env, data, routeMap, logLevel) {
  
  // Set write level
  conLog = conLog(logLevel);
  
	var routes  = new routeMap(data),
			srvAddr = data.serverAddress,
			teacher = data.teacher;
	
	var agent   = request.agent(),
			results = {};
	
	var classData, adminEmail, newTeacher, newTeacherLogin, newStudent;   // NOTE - to store data between tests for generated users
  
  if (env == 'local') {
    adminEmail = 'build@glasslabgames.org';
  } else {
    adminEmail = 'accounts@glasslabgames.org';
  }

	describe(env.toUpperCase() + " API (v2) Test Suite", function (done) {

		results['timestamp'] = tstamp();

    /////////////////////
    //// 0. general /////
    /////////////////////
    
		it("[0. general] #should connect to " + env.toUpperCase() + " environment", function (done) {
			agent
				.get(srvAddr)
				.end(function (res) {
					expect(res.status).to.eql(200);
					done();
				});
		});

		it("[0. general] #should retreive number of 'learning events' logged via sdk", function (done) {
			agent
				.get(srvAddr + routes.events.path)
				.end(function (res) {
					expect(res.status).to.eql(200);
					results['events'] = (res.text);
					done();
				});
		});

		it("[0. general] #should return valid SDK config data for MGO", function (done) {
			agent
				.get(srvAddr + routes.sdk.connect.path)
				.end(function (res) {
					expect(res.status).to.eql(200);
					expect(res.text).to.eql(data.serverAddress);
				
					agent
						.get(res.text + '/api/v2/data/config/' + "AA-1")
						.end(function (res) {
							expect(res.status).to.eql(200);
							expect(res.text).to.contain("eventsMaxSize");
							expect(res.text).to.contain("eventsMinSize");
							expect(res.text).to.contain("eventsPeriodSecs");
							done();
						});
				});
		});

		it("[0. general] #shouldn't be able to manipulate data without login", function (done) {
			agent
				.get(srvAddr + routes.classes.list.path)
				.type('application/json')
				.end(function (res) {
					expect(res.status).to.eql(401);
					done();
				});
		});
    
    
    ///////////////////////////
    //// 1. existing user /////
    ///////////////////////////
    
		it("[1. existing user] #should log in successfully", function (done) {

			agent
				.post(srvAddr + routes.login.path)
				.type('application/json')
				.send({"username": teacher.email, "password": teacher.pass})
				.end(function (res) {
					expect(res.status).to.eql(200);
					expect(res.body.id).to.eql(teacher.userId);
					done();
				});
		});

		
		it("[1. existing user] #returns classes correctly", function (done) {

      agent
				.get(srvAddr + routes.classes.list.path)
				.type('application/json')
				.end(function (res) {
					expect(res.status).to.eql(200);
          conLog(res.text, 'classes');  // DEBUG
        
					// FUTURE - do some validation of returned data
					done();
				});
		});
    
    it("[1. existing user] #archives new class", function (done) {
			
			var coursePath = setCourse(routes.classes.info.path,teacher.testClass.id);

			// start out un-archived
			agent
				.get(srvAddr + coursePath)
				.end(function (res) {
					expect(res.status).to.eql(200);
					classData = JSON.parse(res.text);
					expect(classData["archived"]).to.eql(false);
					classData["archived"] = true;

					// send archive call
					agent
						.post(srvAddr + coursePath)
						.type('application/json')
						.send(classData)
						.end(function (res) {
							expect(res.status).to.eql(200);

							// verify class was archived
							agent
								.get(srvAddr + coursePath)
								.end(function (res) {
									expect(res.status).to.eql(200);
									expect(JSON.parse(res.text)["archived"]).to.eql(true);
									done();
								});
						});
				});
		});

		it("[1. existing user] #restores class", function (done) {
			
			var coursePath = setCourse(routes.classes.info.path,teacher.testClass.id);

			// start out archived
			agent
				.get(srvAddr + coursePath)
				.end(function (res) {
					expect(res.status).to.eql(200);
					classData = JSON.parse(res.text);
					expect(classData["archived"]).to.eql(true);
					classData["archived"] = false;

					// send un-archive call
					agent
						.post(srvAddr + coursePath)
						.type('application/json')
						.send(classData)
						.end(function (res) {
							expect(res.status).to.eql(200);


							// verify class was un-archived
							agent
								.get(srvAddr + coursePath)
								.end(function (res) {
									expect(res.status).to.eql(200);
									expect(JSON.parse(res.text)["archived"]).to.eql(false);
									done();
								});
						});
				});
		});
    
    it("[1. existing user] #returns reports - SOWO", function (done) {

			agent
				.get(srvAddr + setCourse(setGame(routes.reports.sowo.path, data.testGameId), teacher.testClass.id))
				.type('application/json')
				.end(function (res) {
					expect(res.status).to.eql(200);

					var resText = JSON.parse(res.text);

          if(env != 'local') {

            var matched = false;

            // FUTURE - clean up (achievements too)
            for (var studentIndex in resText) {
              if(resText[studentIndex]['userId'] == data.student.id) {
                  matched = true;
                  expect(resText[studentIndex]['results']).to.eql(data.student.sowo);
              }
            }
            expect(matched).to.eql(true);
          }

					done();
				});
		});
		
		it("[1. existing user] #returns reports - achievements", function (done) {
			agent
				.get(srvAddr + setCourse(setGame(routes.reports.achievements.path, data.testGameId), teacher.testClass.id))
				.type('application/json')
				.end(function (res) {
					expect(res.status).to.eql(200);

					var resText = JSON.parse(res.text);

          if(env != 'local') {
            
            var matched = false;

            for (var studentIndex in resText) {
                if(resText[studentIndex]['userId'] == data.student.id) {
                    matched = true;
                    expect(resText[studentIndex]['achievements']).to.eql(data.student.achievements);
                }
            }
            expect(matched).to.eql(true);
          }
					done();
				});
		});
    
    it("[1. existing user] #should log out successfully", function (done) {
			agent
				.post(srvAddr + routes.logout.path)
				.type('application/json')
				.send(routes.logout.post)
				.end(function (res) {
					expect(res.status).to.eql(200);
					done();
				});
		});
       
    it("[1. existing user] #can reset a teacher's password", function(done) {
      
			var confirmationEmail;
			
      agent
				.post(srvAddr + routes.password_reset.path)
				.type('application/json')
				.send({'email': teacher.email})
				.end(function (res) {
					expect(res.status).to.eql(200);
				});
      
      listenForEmailsFrom(adminEmail, function (email) {
        confirmationEmail = email;
        done();
      });
      
    });
    

    ///////////////////////////
    //// 2. new beta user /////
    ///////////////////////////
    
		it('[2. new beta user] #can request access to Playfully.org', function(done) {
			
      // Prepare data for beta registration tests
			newTeacher = JSON.parse(requestAccess('glTestTeacher' + tstamp(), 'build+' + tstamp() + '@glasslabgames.org', 'glasslab123'));
      newTeacherLogin = JSON.stringify({"username": newTeacher['email'], "password": newTeacher['password']});
      
      // Store data for future debugging opportunities, repro
			results['newTeacherRequestPost'] = newTeacher;

      if (env == 'local') {
        listenForEmailsFrom(adminEmail, function (email) {
          confirmationEmail = email;
          results['requestEmail'] = email;

          var linkReg = new RegExp(srvAddr+'.*?(?=\n)');
          var confirmLink = email.text.match(linkReg)[0];
//          conLog(confirmLink, 'link');  // DEBUG
          done();
        });
      }
      
			agent
				.post(srvAddr + routes.register.teacher.path)
				.type('application/json')
				.send(newTeacher)
				.end(function (res) {
					expect(res.status).to.eql(200);
        
          if (env != 'local') {
            // Not waiting for email
            // response, so done here
            done(); 
          }
				});
      
		});
  
    it('[2. new beta user] #cannot log in without being confirmed', function(done) {
      
      agent
				.post(srvAddr + routes.login.path)
				.type('application/json')
				.send(newTeacherLogin)
				.end(function (res) {
        
          expect(res.status).to.eql(401);
          expect(JSON.parse(res.text)['error']).to.eql(errors["user.login.betaPending"]);
        
					done();
				});
      
      // TODO hit confirm link and then check again, this time for 200
      
      
    });
    
    if (env == 'local') {
      
      // NOTE - can only test when connected to local machine
						
      it.skip('[2. new beta user] #cannot log in without verifying email', function(done) {

        agent
          .post(srvAddr + routes.login.path)
          .type('application/json')
          .send(newTeacherLogin)
          .end(function (res) {
            expect(res.status).to.eql(401);
            expect(JSON.parse(res.text)['error']).to.eql(errors["user.login.notVerified"]);
            done();
          });
      });

      it.skip('[2. new beta user] #can log in once confirmed and verified', function(done) {

        
        agent
          .post(srvAddr + routes.login.path)
          .type('application/json')
          .send(newTeacherLogin)
          .end(function (res) {
            expect(res.status).to.eql(200);
          
          
          
            // TODO - magic.w
          
            done();
          });
      });
      
    } else {
      // Just skip those tests
      it.skip('[2. new beta user] #cannot log in without verifying email - APPROVE & MANUALLY CONFIRM', function() {});
      it.skip('[2. new beta user] #can log in once confirmed and verified - MANUALLY CONFIRM', function() {});
    }
      
    //////////////////////////
    //// 3. iCivics user /////
    //////////////////////////
  
		it.skip('[3. iCivics user] #logs in with iCivics credentials', function (done) {
			done();
		});
    
    // TODO - add login & data verification for icivcs

    
    /////////////////////////
    //// 4. Clever user /////
    /////////////////////////
  
    
    it.skip('[4. Clever user] #logs in with Clever credentials', function (done) {
			done();
		});
    
    it.skip('[4. Clever user] #shows SimCityEDU reports', function(done) {  
      done();
    });

    // TODO - add login & data verification for clever
    
	});
	
	after(function () {

		var resultFile = 'supertest/results/' + env + '.' + results['timestamp'].split(/:/).join('.') + '.json';
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
