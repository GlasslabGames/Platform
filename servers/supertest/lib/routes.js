//// IMPORTS ////
//var routes = require('../../lib/routes.external.map');  no good way to refernce, all apis are in a list []

//// CONFIG ////
var testData = require('./testData').stage;     // NOTE - Set to stage here
var teacher  = testData.teacher,
    student  = testData.student;

////////////////

//// ROUTES ////
module.exports = {

    login: {
        path: "/api/v2/auth/login/glasslab",    // TODO Change to like: routes.api.[_____].api
        post: {"username":teacher.email, "password":teacher.pass}
    },
    
    events: {
        // number of learning events
        path: "/api/v2/data/eventsCount"
    },
    
    password_reset: {
        path: "/api/v2/auth/password-reset/send/",
        post: {"email":teacher.email}
    },
    
    classes: {
        info: {
            path: "/api/v2/lms/course/"+teacher.testClass.id+"/info"    // Get pulls info
        },
        list: {
            path: "/api/v2/lms/courses?showMembers=1"
        },
        create: {
            path: "/api/v2/lms/course/create",
            post: testData.newMGOClass,
        }
    },
    
    reports: {
        achievements: {
            path: "/api/v2/dash/reports/achievements/game/"+testData.testGameId+"/course/"+teacher.testClass.id,
        },
        sowo: {
            path: "/api/v2/dash/reports/sowo/game/"+testData.testGameId+"/course/"+teacher.testClass.id,
        }
    },
    
// FUTURE - need to pick up verification code, so difficult to implement without hooking to some kind of automated email hook
//    password_confirm: {
//        path: "/api/v2/auth/password-reset/:code/verify".replace(':code', testData.
//    },

    logout: {
        path: "/api/v2/auth/logout",
        post: {}
    }

}