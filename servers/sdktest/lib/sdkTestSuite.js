/////////////
// IMPORTS //
/////////////

// Externals
var fs        = require('fs'),
    request   = require('superagent'),
    mocha     = require('mocha'),
    chai      = require('chai'),
    expect    = chai.expect;

// Custom helper f'ns
var tools = require('./tools.js');

var tstamp    			= tools.tstamp,
    logout              = tools.logout,
    genClass  			= tools.genClass,
    genUser   			= tools.genUser,
    listenForEmailsFrom = tools.listenForEmailsFrom,
    setUser             = tools.setUser,
    setCourse           = tools.setCourse,
    setGame				= tools.setGame,
    conLog              = tools.conLog;

// Routes - on-hold for referencing
// var routes = require('../../lib/routes.external.map.js');

// Errors
var errors = require('../../lib/errors.js');

// Game specific data and functions
//var games  = require('./games/index.js'),
//    aa1    = games.aa1,
//    aw1    = games.aw1,
//    sc     = games.sc;

//////////////////
// TEST ROUTINE //
//////////////////

var sdkTestSuite = function (env, data, routeMap, logLevel) {
  
    // Set write level
    conLog = conLog(logLevel);
  
	var routes  = new routeMap(data),
        srvAddr = data.serverAddress,
        teacher = data.teacher,
        student = data.student;
	
	var agent   = request.agent(),
        results = {},
        gameSessionId,
        playSessionId,
        totalTimePlayed,
        saveGameData;
	
    function logout(agent, logoutPath, cb) {
      agent
        .post(logoutPath)
        .type('application/json')
        .send({})
        .end(function (res) {
          expect(res.status).to.eql(200);
          cb();
        });
    }

	describe(env.toUpperCase() + " Game SDK Test Suite", function (done) {

		results['timestamp'] = tstamp();

        it("[0. general] #should return valid SDK config data", function (done) {
			agent
				.get(srvAddr + routes.sdk.connect.path)
				.end(function (res) {
					expect(res.status).to.eql(200);
					expect(res.text).to.eql(data.serverAddress);
				
					agent
						.get(srvAddr + routes.sdk.config.path)
						.end(function (res) {
							expect(res.status).to.eql(200);
							expect(res.text).to.contain("eventsMaxSize");
							expect(res.text).to.contain("eventsMinSize");
							expect(res.text).to.contain("eventsPeriodSecs");
							done();
						});
				});
		});

        it("[0. general] #should return valid SDK config data", function (done) {
			agent
				.get(srvAddr + routes.sdk.connect.path)
				.end(function (res) {
					expect(res.status).to.eql(200);
					expect(res.text).to.eql(data.serverAddress);
				
					agent
						.get(srvAddr + routes.sdk.config.path)
						.end(function (res) {
							expect(res.status).to.eql(200);
							expect(res.text).to.contain("eventsMaxSize");
							expect(res.text).to.contain("eventsMinSize");
							expect(res.text).to.contain("eventsPeriodSecs");
							done();
						});
				});
		});
    
        it("[0. general] #able to log in student user via SDK login", function (done) {
			agent
                .post(srvAddr + routes.sdk.login.path)
                .type('application/json')
                .send({ "username":student.name, "password":student.pass }) 
                .end(function (res) {
                    expect(res.status).to.eql(200);
                    logout(agent, srvAddr + routes.logout.path, done);
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
				.send({"username": student.name, "password": student.pass})
				.end(function (res) {
					expect(res.status).to.eql(200);
					expect(res.body.id).to.eql(student.id);
					done();
				});
		});
		
		it("[1. existing user] #should have good login status", function (done) {
			agent
				.get(srvAddr + routes.user.authStatus.path)
				.type('application/json')
				.end(function (res) {
					expect(res.status).to.eql(200);
					expect(res.body.status).to.eql("ok");
                    
                    var playInfoPath = setGame(routes.sdk.playInfo.path, data.testGameId);

                    agent
                        .get(srvAddr + playInfoPath)
                        .type('application/json')
                        .end(function (res) {
                            expect(res.status).to.eql(200);
                            expect(res.body).to.have.ownProperty("totalTimePlayed");
                            totalTimePlayed = res.body.totalTimePlayed;
                            done();
                        });
				});
		});
		
		it("[1. existing user] #returns user info correctly", function (done) {
			agent
				.get(srvAddr + routes.user.info.path)
				.type('application/json')
				.end(function (res) {
					expect(res.status).to.eql(200);
					expect(res.body.id).to.eql(student.id);
					done();
				});
		});
		
		it("[1. existing user] #returns courses correctly", function (done) {
            agent
				.get(srvAddr + routes.classes.list.path)
				.type('application/json')
				.end(function (res) {
					expect(res.status).to.eql(200);
//          conLog(res.text, 'classes');  // DEBUG
                    expect(res.body).to.have.length.of.at.least(1);
					done();
				});
		});

		it("[1. existing user] #returns course correctly", function (done) {
			var coursePath = setCourse(routes.classes.info.path, teacher.testClass.id);

            agent
				.get(srvAddr + coursePath)
				.type('application/json')
				.end(function (res) {
					expect(res.status).to.eql(200);
					classData = JSON.parse(res.text);
					expect(classData["archived"]).to.eql(false);
					expect(classData["code"]).to.eql(teacher.testClass.code);
					done();
				});
		});
    
        ///////////////////////////
        //// 2. game functions ////
        ///////////////////////////

		it("[2. game functions] #should start game session", function (done) {
			agent
				.post(srvAddr + routes.sdk.startSession.path)
				.type('application/json')
				.send({
                    "gameId": data.testGameId,
                    "deviceId": student.deviceId,
                    "gameLevel": 1,
                    "timestamp": +new Date()
                    })
				.end(function (res) {
					expect(res.status).to.eql(200);
					expect(res.body).to.have.ownProperty("gameSessionId");
                    gameSessionId = res.body.gameSessionId;
                    
                    agent
                        .get(srvAddr + routes.sdk.startPlaySession.path)
                        .type('application/json')
                        .end(function (res) {
                            expect(res.status).to.eql(200);
                            expect(res.body).to.have.ownProperty("playSessionId");
                            playSessionId = res.body.playSessionId;
                            done();
                        });
				});
		});

        it("[2. game functions] #should save telem event if session started", function (done) {
            if (gameSessionId && playSessionId) {
                var timeStamp = +new Date();
                agent
                    .post(srvAddr + routes.sdk.saveTelemEvent.path)
                    .type('application/json')
                    .send({
                        "clientTimeStamp": timeStamp,
                        "gameId": data.testGameId,
                        "gameVersion": 1,
                        "deviceId": student.deviceId,
                        "gameLevel": 1,
                        "gameSessionId": gameSessionId,
                        "playSessionId": playSessionId,
                        "gameSessionEventOrder": 1,
                        "playSessionEventOrder": 1,
                        "totalTimePlayed": totalTimePlayed,
                        "eventName": "sdk-test",
                        "eventData": { "sdk-test": timeStamp }
                        })
                    .end(function (res) {
                        expect(res.status).to.eql(200);
                        done();
                    });
            } else {
                done();
            }
        });

		it("[2. game functions] #returns saved achievement correctly", function (done) {
			var saveAchievementPath = setGame(routes.sdk.saveAchievement.path, data.testGameId);

            agent
				.post(srvAddr + saveAchievementPath)
				.type('application/json')
				.send(student.achievements[0])
				.end(function (res) {
					expect(res.status).to.eql(200);
					done();
				});
		});

		it("[2. game functions] #should save game data", function (done) {
			var saveGamePath = setGame(routes.sdk.saveGame.path, data.testGameId);

            saveGameData = { "data": +new Date() };
           
			agent
				.post(srvAddr + saveGamePath)
				.type('application/json')
				.send(saveGameData)
				.end(function (res) {
					expect(res.status).to.eql(200);
                    done();
				});
		});

		it("[2. game functions] #returns saved game correctly", function (done) {
			var saveGamePath = setGame(routes.sdk.saveGame.path, data.testGameId);

            agent
				.get(srvAddr + saveGamePath)
				.type('application/json')
				.end(function (res) {
					expect(res.status).to.eql(200);
                    expect(res.body).to.eql(saveGameData);
					done();
				});
		});

        it("[2. game functions] #should end game session is started", function (done) {
            if (gameSessionId) {
                agent
                    .post(srvAddr + routes.sdk.endSession.path)
                    .type('application/json')
                    .send({
                        "gameSessionId": gameSessionId,
                        "timestamp": +new Date()
                        })
                    .end(function (res) {
                        expect(res.status).to.eql(200);
                        done();
                    });
            } else {
                done();
            }
        });
        
    /*
    
  // NOTE - to store data between tests for generated users
	var classData, adminEmail, newTeacher, newTeacherLogin,
      approveLink, verifyLink, verifyCode, newStudent;
  
  if (env == 'local') {
    adminEmail = 'build@glasslabgames.org';
  } else {
    adminEmail = 'accounts@glasslabgames.org';
  }
  
  // FUTURE - change the casing format to a list.
  // then, make blocks of code 
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
    
    it("[0. general] #able to log in student user via SDK login", function (done) {
			agent
        .post(srvAddr + routes.sdk.login.path)
        .type('application/json')
        .send({ "username":student.name, "password":student.pass }) 
        .end(function (res) {
          expect(res.status).to.eql(200);
          logout(agent, srvAddr + routes.logout.path, done);
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
//          conLog(res.text, 'classes');  // DEBUG
        
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

		      if (env != 'local') {

		        var matched = false;

		        for (var studentIndex in resText) {
		          if (resText[studentIndex]['userId'] == data.student.id) {
		            matched = true;
		            expect(resText[studentIndex]['achievements']).to.eql(data.student.achievements);
                break;
		          }
		        }
		        expect(matched).to.eql(true);
		      }
		      done();
		    });
		});
    
    it("[1. existing user] #should log out successfully", function (done) {
//			agent
//				.post(srvAddr + routes.logout.path)
//				.type('application/json')
//				.send({})
//				.end(function (res) {
//					expect(res.status).to.eql(200);
//					done();
//				});
      
      logout(agent, srvAddr + routes.logout.path, done);
      
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
      
      listenForEmailsFrom(adminEmail, "Your GlassLab Games Password", function (email) {
        confirmationEmail = email;
        done();
      }, conLog);
      
    });
    

    ///////////////////////////
    //// 2. new beta user /////
    ///////////////////////////
    
		it('[2. new beta user] #can request access to GlassLab Games', function(done) {
			
      // Prepare data for beta registration tests
			newTeacher = JSON.parse(requestAccess('glTestTeacher' + tstamp(), 'build+' + tstamp() + '@glasslabgames.org', 'glasslab123'));
      newTeacherLogin = {"username": newTeacher['email'], "password": newTeacher['password']};
      
      // Store data for future debugging opportunities, repro
			results['newTeacherRequestPost'] = newTeacher;

      if (env == 'local') {   // TODO swap 'local' with testable group
        
        // Stop 0: get admin email, grab approve link (and generate verify link)
        listenForEmailsFrom(adminEmail, "GlassLab Games Beta confirmation", function (email) {
          confirmationEmail = email;
          results['approveEmail'] = email;
          
          approveLink = email.text.match(new RegExp(srvAddr+'.*?(?=\n)'))[0];
          
          results['approveLink'] = approveLink;
          results['verifyLink'] = verifyLink;
          
          done();
        }, conLog);
      }
      
      // request new teacher account
			agent
				.post(srvAddr + routes.register.teacher.path)
				.type('application/json')
				.send(newTeacher)
				.end(function (res) {
					expect(res.status).to.eql(200);
          if (env != 'local') { done(); }
				});
		});

    it('[2. new beta user] #cannot log in without being confirmed', function (done) {

      agent
        .post(srvAddr + routes.login.path)
        .type('application/json')
        .send(newTeacherLogin)
        .end(function (res) {
          expect(res.status).to.eql(401);
          expect(JSON.parse(res.text)['error']).to.eql(errors["user.login.betaPending"]);
          done();
        });
    });
    
  if (env == 'local') {
    
    it('[2. new beta user] #admin can approve new teacher user', function (done) {

       // Step 1: preemptively wait for the verify email to user
      listenForEmailsFrom(adminEmail, "Beta status confirmed - Verify your email", function (email) {
        confirmationEmail = email;
        results['verifyEmail'] = email;

        verifyCode = email.text.match(new RegExp('email/.*?(?=\n)'))[0];
        verifyCode = verifyCode.substring(6, verifyCode.length);

        verifyLink = srvAddr + routes.verifyEmail.path.replace(':code', verifyCode);

        done();
      }, conLog);

      // approve user
      agent
        .get(approveLink)
        .type('application/json')
        .end(function (res) {
          expect(res.status).to.eql(200);
        });
    });

    it('[2. new beta user] #cannot log in without verifying email', function(done) {

      agent
        .post(srvAddr + routes.login.path)
        .type('application/json')
        .send(newTeacherLogin)
        .end(function (res) {
          expect(res.status).to.eql(401);
          expect(JSON.parse(res.text)['error']).to.eql(errors["user.login.notVerified"]);

          agent
            .get(verifyLink)    // FIXME
            .type('application/json')
            .end(function (res) {
              conLog(res.text, 'verifyLinkRes');
              expect(res.status).to.eql(200);
              done();
            });
        });
    });

    it('[2. new beta user] #can log in once confirmed and verified', function(done) {

      agent
        .post(srvAddr + routes.login.path)
        .type('application/json')
        .send(newTeacherLogin)
        .end(function (res) {
          expect(res.status).to.eql(200);
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
    
    */
    
	});
	
	after(function () {

		var resultFile = 'sdktest/results/' + env + '.' + results['timestamp'].split(/:/).join('.') + '.json';
		fs.writeFile(resultFile, JSON.stringify(results, null, 4), function (err) {
			if (err) {
				console.log(err);
			} else {
				console.log("Results saved to " + resultFile);
			}
		});
	});
	
}

module.exports = sdkTestSuite;
