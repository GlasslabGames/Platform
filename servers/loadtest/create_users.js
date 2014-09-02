var http = require('http');
var hostname = "stage.glgames.org";
port = 80;

//hostname = "localhost";
//port = 8000;

//hostname = "glasslab-dashboard-stage-164657619.us-west-2.elb.amazonaws.com";
//hostname = "test.glgames.org";
hostname = "localhost:8001";

var userTemplate = { "username":"_", "firstName":"_", "lastName":"_", "password":"_", "type":"course", "associatedId":0, "email":"" };
var contentType = "application/json;charset=UTF-8"
var post_options = {
    host: hostname, port: port, path: "", method: 'POST',
    headers: {
        'x-requested-with': "XMLHttpRequest",
        'Content-Type': contentType,
        'Content-Length': 0
    }
};

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

// 200 courses, 30 students in each course, 6000 students total
createCoursesWithUsers(
    "jlt_1@instituteofplay.org", "jlt_1",
    "jlt_class1_",  0, 200,
    "jlt_test1_", 0, 30);

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
                createCode(cookies,
                    courseName, courseId,
                    function(code){
                        if(code != null) {
                            console.log("Create Student studentId:", this.studentId);
                            createUsersWithCode(code, username, this.studentId, numOfUsersPerCourse);
                        }
                    }.bind({studentId: startUserId}));
                startUserId += numOfUsersPerCourse;
            }
        }
    });
}

function teacherLogin(username, password, cb){
    var post_data = JSON.stringify( { "username":username, "password":password } );

    post_options.method = "POST";
    post_options.path = "/api/user/login";
    post_options.headers['Content-Length'] = post_data.length;

    var post_validate = http.request(post_options, function(res) {
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

    var post_data = JSON.stringify( {
        "title": courseName + courseId,
        "grade":"7",
        "institution":1,
        "cb":1382584603667} );

    post_options.method = "POST";
    post_options.path = "/api/course/create";
    post_options.headers['Content-Length'] = post_data.length;
    post_options.headers['cookie'] = cookie;

    var post_validate = http.request(post_options, function(res) {
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
    options.headers['Content-Type']     = contentType;
    options.headers['cookie']           = cookie;

    var request = http.request(options, function(res) {
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
    validateCode(code, function(associatedId){
        createUsers(associatedId, username, startId, numOfUsers);
    });
}

function validateCode(code, cb)
{
    var post_data = '{"code":"'+code+'"}';
    post_options.method = "POST";
    post_options.path = "/api/code/valid";
    post_options.headers['Content-Length'] = post_data.length;
    var post_validate = http.request(post_options, function(res) {
        res.setEncoding('utf8');
        var data = "";
        res.on('data', function (chunk) {
            data += chunk;
        });
        res.on('end', function () {
            console.log('validateCode Response: ' + data);

            jdata = JSON.parse(data);
            cb(jdata.associatedData.id);
        });
        //console.log('Response headers: ', res.headers);
    });
    // post the data
    post_validate.write(post_data);
    post_validate.end();
}

function createUsers(associatedId, username, startId, numOfUsers) {
    for(var i = startId; i < startId + numOfUsers; i++){
        data = new Object(userTemplate);
        data.username = username + i;
        data.firstName = username + i;
        data.lastName = username + i;
        data.password = username + i;
        data.associatedId = associatedId;
        post_data = JSON.stringify(data);

        post_options.method = "POST";
        post_options.headers['Content-Length'] = post_data.length;
        post_options.path = "/api/user/register";
        var post_reg = http.request(post_options, function(res) {
            res.setEncoding('utf8');
            var data = "";
            res.on('data', function (chunk) {
                data += chunk;
            });
            res.on('end', function () {
                
                if(res.statusCode != 200) {
                    console.log('error!!! createUsers Response - username:', username, ', statusCode', res.statusCode, ', data:', data);
                } else {
                    console.log('createUsers Response: ', data);
                }
            });
        });
        // post the data
        post_reg.write(post_data);
        post_reg.end();
    }
}

