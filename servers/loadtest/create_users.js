var http = require('http');

hostname = "localhost";
//port = 80;
port = 8001;

//hostname = "glasslab-dashboard-stage-164657619.us-west-2.elb.amazonaws.com";
//hostname = "test.glgames.org";
//hostname = "localhost:8001";

var templates = {};
Object.defineProperty( templates, "user", {
  	value: { "username":"_", "firstName":"_", "lastName":"_", "password":"_", "confirm":"_", "role":"student", "regCode":"_", "isRegCompleted":false, "errors":[] },
  	writable: false,
  	enumerable: true,
  	configurable: true
});
Object.defineProperty( templates, "post_options", {
  	value: {
    	host: hostname, 
    	port: port, 
    	path: "", 
    	method: 'POST',
    	headers: {
        	'x-requested-with': "XMLHttpRequest",
        	'Content-Type': "application/json;charset=UTF-8",
        	'Content-Length': 0
    	}
	},
  	writable: false,
  	enumerable: true,
  	configurable: true
});

var lastResponseFilename = "/tmp/lastReturnedPage.html";
function validateResponse(res,errorFunc) {
	if(res.statusCode <200 || res.statusCode > 299) {
		errorFunc(res);
		//var fs = require('fs');
		//var stream = fs.createWriteStream(lastResponseFilename);
		//stream.once('open', function(fd) {
  		//	stream.write(JSON.stringify(res));
  		//	stream.end();
		//});
		console.log(res);
		console.log("Error code: ", res.statusCode);
		//console.log("Last response saved in ", lastResponseFilename)
		process.exit(1);

	}
}

// -----------------------------------
// teacherUser, teacherPass,
// courseName, startCourseId, numOfCourse,
// username, startUserId, numOfUsersPerCourse
/*
// 1 course, 1 students in each course, 1 students total
createCoursesWithUsers(
    "jlt_1@instituteofplay.org", "jlt_1",
    "jlt_class1_",  0, 1,
    "jlt_test1_", 0, 1);
*/

var id = "LT01";
// 200 courss, 30 students in each course, 6000 students total
createCoursesWithUsers(
    "jlt_1@instituteofplay.org", "jlt_1",
    "jlt_class"+id+"_",  0, 200,
    "jlt_test"+id+"_", 0, 30);

// -----------------------------------

// code, username, startId, numOfUsers
//createUsersWithCode("S1CM9", "jlt_test_", 1400, 50);

// -----------------------------------
function createCoursesWithUsers(teacherUser, teacherPass,
                                courseName, startCourseId, numOfCourse,
                                username, startUserId, numOfUsersPerCourse) {
    teacherLogin(teacherUser, teacherPass, function(cookies){
        if(cookies) {
            for(var courseId = startCourseId; courseId < startCourseId+numOfCourse; courseId++){
                console.log("Create Course courseId:", courseId);
                createCode(cookies, courseName, courseId, function(code){
                    if(code != null) {
                        console.log("Create Student studentId:", this.studentId);
                        createUsersWithCode(code, username, this.studentId, numOfUsersPerCourse);
                        }
                    }.bind({studentId: startUserId}));
                startUserId += numOfUsersPerCourse;
            }
        }
    });
    console.log("Done!");
}

function teacherLogin(username, password, cb){
    var post_data = JSON.stringify( { "username":username, "password":password } );
    var post_options = new Object(templates.post_options)
    post_options.method = "POST";
    post_options.path = "/api/v2/auth/login/glasslab";
    post_options.headers['Content-Length'] = post_data.length;
    //console.log(post_data);
    var post_validate = http.request(post_options, function(res) {
    	validateResponse(res, function(res) {
        	console.log("Failed to login teacher [", username, "]");
        });
        // get first cookie, split and grab first
        cookies = res.headers['set-cookie'];
        //console.log('Response cookie: ', cookies);
        cb(cookies);
    });

    // post the data
    post_validate.write(post_data);
    post_validate.end();
}

function createCode(cookie, courseName, courseId, cb){

//    var post_data = JSON.stringify( {
//        "title": courseName + courseId,
//        "grade":"7",
//        "institution":1,
//        "cb":1382584603667} );

    var post_data = JSON.stringify( {
        "title": courseName + courseId,
        "grade":"7",
		"games":[{
		    "gameId":"AA-1",
		    "enabled":true,
		    "visible":true,
		    "maintenance":null,
		    "shortName":"Argubot Academy EDU",
		    "longName":"Mars Generation One: Argubot Academy EDU",
		    "grades":"6 - 8",
		    "subject":"ELA",
		    "type":"App",
		    "platform":{
				"type":"iPad",
				"icon":{
				    "small":"/assets/platform-ipad.png",
				    "large":"/assets/platform-ipad@2x.png"
				}
		    },
		    "price":"Free",
		    "packages":"iPad Games",
		    "release":"live",
		    "releaseDate":"Sep 2, 2014",
		    "shortDescription":"Put your powers of persuasion to the ultimate test, on a whole new planet! Argubot Academy is an adventure game for iOS tablets.",
		    "description":"Put your powers of persuasion to the ultimate test, on a whole new planet! Argubot Academy is an adventure game for iOS tablets.",
		    "developer":{
				"id":"GL",
				"name":"GlassLab, Inc.",
				"logo":{
				    "small":"/assets/glasslab-logo.png",
				    "large":"/assets/glasslab-logo-2x.png"
				},
				"description":"GlassLab brings together leaders in commercial games and experts in learning and assessment to develop next generation digital games and interactive experiences that make learning visible. Our products and services are designed to deliver proven learning impact and reach youth in schools, informal learning environments, and at home.<br /><br />The Lab represents a groundbreaking collaboration between Educational Testing Service, Electronic Arts, the Entertainment Software Association, Institute of Play, Pearson's Center for Digital Data, Analytics & Adaptive Learning, Zynga, and others.<br /><br />GlassLab is made possible through the generous support of The Bill and Melinda Gates Foundation and The John D. and Catherine T. MacArthur Foundation."
		    },
		    "settings":{"canCreateMatches":false},
		    "license":{
				"type":"loginType",
				"loginType":["glasslabv2","icivics","edmodo"],
				"valid":true,
				"message":{
				    "invalid":"Coming Soon!"
				}
			},
		    "thumbnail":{
				"small":"/assets/thumb-game-AA-1.png",
				"large":"/assets/thumb-game-AA-1.png"
		    },
		    "card":{
				"small":"/assets/game-card-AA-1.jpg",
				"large":"/assets/game-card-AA-1@2x.jpg"
		    },
		    "banners":{
				"product":"/assets/game-banner-AA-1.png",
				"reports":"/assets/game-banner-AA-1.png"
		    },
		    "play":{
				"type":"download",
				"link":"https://itunes.apple.com/us/app/argubot-academy-edu/id912031024?mt=8"
		    },
	    "id":"AA-1"
		}]
    });

/*
    var post_data = JSON.stringify( {
	"title":courseName + courseId,
	"grade":"7",
	"games":[
	    {"gameId":"PRIMA",
	     "enabled":true,
	     "visible":true,
	     "maintenance":null,
	     "shortName":"Ratio Rancher",
	     "longName":"Ratio Rancher",
	     "grades":"6 - 12",
	     "subject":"Mathematics",
	     "type":"Browser",
	     "platform":{
		 "type":"Browser (Optimized for Chrome)",
		 "icon":{
		     "small":"/assets/platform-browser.png",
		     "large":"/assets/platform-browser@2x.png"
		 }
	     },
	     "price":"Free",
	     "packages":"PC/Mac, Chromebook/Web Games",
	     "release":"live",
	     "releaseDate":"May 22, 2015",
	     "shortDescription":"Ratio Rancher is a nurturing strategy/puzzle game that promotes understanding of ratios and proportions. Students are in charge of their own lush, green world filled with wacky creatures that have surprising eating habits!",
	     "description":"Ratio Rancher is a nurturing strategy/puzzle game that promotes understanding of ratios and proportions. Students are in charge of their own lush, green world filled with wacky creatures that have surprising eating habits!",
	     "developer":{
		 "id":"GL",
		 "name":"GlassLab, Inc.",
		 "logo":{
		     "small":"/assets/glasslab-logo.png",
		     "large":"/assets/glasslab-logo-2x.png"
		 },
		 "description":"GlassLab brings together leaders in commercial games and experts in learning and assessment to develop next generation digital games and interactive experiences that make learning visible. Our products and services are designed to deliver proven learning impact and reach youth in schools, informal learning environments, and at home.<br /><br />The Lab represents a groundbreaking collaboration between Educational Testing Service, Electronic Arts, the Entertainment Software Association, Institute of Play, Pearson's Center for Digital Data, Analytics & Adaptive Learning, Zynga, and others.<br /><br />GlassLab is made possible through the generous support of The Bill and Melinda Gates Foundation and The John D. and Catherine T. MacArthur Foundation."
	     },
	     "settings":{
		 "canCreateMatches":false
	     },
	     "license":{
		 "type":"loginType",
		 "loginType":["glasslabv2","icivics","edmodo"],
		 "valid":true,
		 "message":{
		     "invalid":"Coming Soon!"
		 }
	     },
	     "thumbnail":{
		 "small":"/assets/thumb-game-PRIMA.png",
		 "large":"/assets/thumb-game-PRIMA@2x.png"
	     },
	     "card":{
		 "small":"/assets/game-card-PRIMA.png",
		 "large":"/assets/game-card-PRIMA@2x.png"
	     },
	     "banners":{
		 "product":"/assets/game-banner-PRIMA.png",
		 "reports":"/assets/game-banner-PRIMA.png"
	     },
	     "play":{
		 "type":"page",
		 "page":{
		     "title":"Prima",
		     "embed":"http://s3-us-west-1.amazonaws.com/playfully-games/PRIMA/game/22/index.html?sdkURL=http://www.glasslabgames.org",
		     "embedSecure":"https://s3-us-west-1.amazonaws.com/playfully-games/PRIMA/game/22/index.html?sdkURL=https://www.glasslabgames.org",
		     "format":"html",
		     "size":{
			 "width":800,
			 "height":600
		     }
		 }
	     },
	     "id":"PRIMA"}
	]
    });
*/
    var post_options = new Object(templates.post_options);
    post_options.method = "POST";
    post_options.path = "/api/v2/lms/course/create";
    post_options.headers['Content-Length'] = post_data.length;
    post_options.headers['cookie'] = cookie;

    var post_validate = http.request(post_options, function(res) {
        validateResponse(res, function(res) {
        	console.log("Bad status code received creating course", courseId);
        	console.log("Posted:",post_data);
        });
        res.setEncoding('utf8');
        var data = "";
        res.on('data', function (chunk) {
            data += chunk;
        });
        res.on('end', function () {
            jdata = JSON.parse(data);
            //console.log('createCode Response:', jdata);
            if(jdata.hasOwnProperty("error")) {
                // probably already created then get list of courses and get the code
                getCodeForCourse(cookie, courseName + courseId, cb);
            } else {
                cb(jdata.code);
            }
        });
    });

    // post the data
    post_validate.write(post_data);
    post_validate.end();
}

/*
method: get, url: /api/course?cb=1382588368323&showMembers=0&showMissions=0, headers: {"host":"localhost:8080",
    "connection":"keep-alive","accept":"application/json, text/plain, * /*",
    "x-requested-with":"XMLHttpRequest","user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) A
    ppleWebKit/537.36 (KHTML, like Gecko) Chrome/30.0.1599.101 Safari/537.36","referer":"http://localhost:8080/classes","accept-encoding":"gzip,deflate,sdch","accept-language":"en-US,en;q=0.8",
    "cookie":"JSESSIONID=FBBE2B84FA6EED729F6AE1AC44C670F5"}
*/
function getCodeForCourse(cookie, courseName, cb) {
    // /api/course?cb=1382588368323&showMembers=0&showMissions=0

    var options = {};
    options.host    = hostname;
    options.port    = port;
    options.method  = "GET";
    options.path    = "/api/course?cb=1382588368323&showMembers=0&showMissions=0";
    options.headers = {};
    options.headers["x-requested-with"] = "XMLHttpRequest";
    options.headers['cookie']           = cookie;

    var request = http.request(options, function(res) {
 		validateResponse(res, function(res) {
        	console.log("Failed to get code for course");
        });
        res.setEncoding('utf8');
        var data = "";
        res.on('data', function (chunk) {
            data += chunk;
        });
        res.on('end', function () {
            jdata = JSON.parse(data);
            //console.log('getCodeForCourse Response:', jdata);
            jdata.forEach(function(course){
                if(course.title == courseName) {
                    console.log('course found:', course);
                    cb(course.code);
                }
            });
        });
    });
    request.end();
}

function createUsersWithCode(code, username, startId, numOfUsers){
    validateCode(code, function(code){
        createUsers(code, username, startId, numOfUsers);
    });
}

function validateCode(code, cb)
{
    options = {};
    options.host    = hostname;
    options.port    = port;
    options.method  = "GET";
    options.path    = "/api/v2/lms/course/code/"+code+"/verify";
    options.headers = {};
    options.headers["x-requested-with"] = "XMLHttpRequest";
 
    var post_validate = http.request(options, function(res) {
    	validateResponse(res, function(res) {
        	console.log("Failed to validate code");
        });
        res.setEncoding('utf8');
        var data = "";
        res.on('data', function (chunk) {
            data += chunk;
        });
        res.on('end', function () {
            //console.log('verify Response: ', data);

            jdata = JSON.parse(data);
            cb(code);
        });

        //console.log('Response headers: ', res.headers);
    });
    // post the data
    post_validate.end();
}

function createUsers(code, username, startId, numOfUsers) {
    for(var i = startId; i < startId + numOfUsers; i++){
        var data = new Object(templates.user);
        data.username = username + i;
        data.firstName = username + i;
        data.lastName = "x";
        data.password = username + i;
        data.confirm = username + i;
        data.regCode = code;
        post_data = JSON.stringify(data);

        var post_options = new Object(templates.post_options);
        post_options.method = "POST";
        post_options.headers['Content-Length'] = post_data.length;
        post_options.path = "/api/v2/auth/user/register";
	
	// Execute anonymous function with capture of i;
        (function a(id) {
	    var post_reg = http.request(post_options, function(res) {
		validateResponse(res, function(res) {
        	    console.log("Failed to create user", id );
		});
       		console.log("creating user ",id);
		res.setEncoding('utf8');
		var newdata = "";
		res.on('data', function (chunk) {
                    newdata += chunk;
		});
		res.on('end', function () {
                    if(res.statusCode != 200) {
			console.log('error!!! createUsers Response - username:', username, ', statusCode', res.statusCode, ', data:', newdata);
                    } else {
			//console.log('createUsers Response: ', data);
                    }
		});
            });
            // post the data
            post_reg.write(post_data);
            post_reg.end();
	})(i);
    }
}

