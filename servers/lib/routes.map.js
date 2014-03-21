
module.exports = {
    index: "index.html",
    // --------------------------------------------------------------------------------------
    statics: [
        {
            routes: [
                "/login",
                "/check",
                "/privacy-policy",
                "/register"
            ],
            file: "index"
        },
        {
            requireAuth: true,
            routes: [
                "/welcome",
                "/classes",
                "/roster",
                "/class",
                "/report",
                "/create",
                "/code",
                "/missions",
                "/challenge",
                "/license",
                "/admin"
            ],
            file: "index"
        }
    ],

    // --------------------------------------------------------------------------------------
    apis:[
    // ---------------------------------------------------
    // Version 2
    // ---------------------------------------------------
        {
            api: "/v2/data/config/:id",
            service: "data",
            controller: "config",
            method: {
                get: "index"
            }
        },
        {
            api: "/v2/data/session/start",
            service: "data",
            controller: "session",
            method: {
                post: "startSessionV2"
            }
        },
        {
            api: "/v2/data/session/end",
            service: "data",
            controller: "session",
            method: {
                post: "endSessionV2"
            }
        },
        {
            api: "/v2/data/events",
            service: "data",
            controller: "events",
            method: {
                post: "sendBatchTelemetryV2"
            }
        },
        // ---------------------------------------------------
        {
            requireAuth: true,
            api: "/v2/lms/courses",
            service: "lms",
            controller: "course",
            method: {
                get: "enrolledCourses"
            }
        },
        {
            requireAuth: true,
            api: "/v2/lms/course/create",
            service: "lms",
            controller: "course",
            method: {
                post: "createCourse"
            }
        },
        {
            api: "/v2/lms/course/code/valid",
            service: "lms",
            controller: "course",
            method: {
                post: "validCode"
            }
        },
        {
            api: "/v2/lms/course/code/newcode",
            service: "lms",
            controller: "course",
            method: {
                post: "newCode"
            }
        },
        {
            requireAuth: true,
            api: "/v2/lms/course/:id",
            service: "lms",
            controller: "course",
            method: {
                get: "showCourse",
                post: "updateCourse",
                "delete": "deleteCourse"
            }
        },
        {
            requireAuth: true,
            api: "/v2/lms/course/enroll",
            service: "lms",
            controller: "course",
            method: {
                get: "enroll"
            }
        },
        {
            requireAuth: true,
            api: "/v2/lms/course/unenroll",
            service: "lms",
            controller: "course",
            method: {
                get: "unenroll"
            }
        },
        // ---------------------------------------------------
        {
            api: "/v2/auth/user/register",
            service: "auth",
            controller: "user",
            method: {
                post: "registerUser"
            }
        },
        {
            requireAuth: true,
            api: "/v2/auth/user/:id",
            service: "auth",
            controller: "user",
            method: {
                get: "showUser",
                post: "updateUser"
            }
        },
        {
            api: "/v2/auth/login/glasslab",
            service: "auth",
            controller: "login",
            method: {
                post: "glasslab"
            }
        },
        {
            api: "/v2/auth/resetpassword/send",
            service: "auth",
            controller: "resetpassword",
            method: {
                post: "resetPasswordSendLink"
            }
        },
        {
            api: "/v2/auth/resetpassword/update",
            service: "auth",
            controller: "resetpassword",
            method: {
                post: "resetPasswordUpdate"
            }
        },
        {
            api: "/v2/auth/resetpassword/verify",
            service: "auth",
            controller: "resetpassword",
            method: {
                post: "resetPasswordVerifyLink"
            }
        },
    // ---------------------------------------------------
    // Version 1
    // ---------------------------------------------------
        {
            api: "/api/config",
            service: "data",
            controller: "config",
            method: {
                get: "index"
            }
        },
        {
            api: "/api/user/login",
            service: "auth",
            controller: "login",
            method: {
                post: "glasslab"
            }
        }
    ]

};