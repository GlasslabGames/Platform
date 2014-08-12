
module.exports = {
    index: "index.html",
    // --------------------------------------------------------------------------------------
    statics: [
        {
            requireAuth: true,
            routes: [
                "/welcome",
                "/classes",
                "/reports",
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
    apis: [
    // ---------------------------------------------------
    // Version 2
    // ---------------------------------------------------
        {
            api: "/api/v2/data/config/:gameId",
            service: "data",
            controller: "config",
            method: {
                get: "index"
            }
        },
        {
            api: "/api/v2/data/eventsCount",
            service: "data",
            controller: "events",
            method: {
                get: "eventsCount"
            }
        },
        {
            api: "/api/v2/data/session/start",
            service: "data",
            controller: "session",
            method: {
                post: "startSessionV2"
            }
        },
        {
            api: "/api/v2/data/session/end",
            service: "data",
            controller: "session",
            method: {
                post: "endSessionV2"
            }
        },
        {
            api: "/api/v2/data/events",
            service: "data",
            controller: "events",
            method: {
                post: "sendBatchTelemetryV2"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/data/game/device",
            service: "data",
            controller: "game",
            method: {
                post: "updateDevice"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/data/game/:gameId/playInfo",
            service: "data",
            controller: "game",
            method: {
                get: "getGamePlayInfo"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/data/game/:gameId/totalTimePlayed",
            service: "data",
            controller: "game",
            method: {
                post: "postTotalTimePlayed"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/data/game/:gameId/achievement",
            service: "data",
            controller: "game",
            method: {
                post: "postGameAchievement"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/data/game/:gameId",
            service: "data",
            controller: "game",
            method: {
                post: "saveGameData",
                get: "getGameData",
                "delete": "deleteGameData"
            }
        },
        // ---------------------------------------------------
        {
            requireAuth: true,
            api: "/api/v2/dash/reports/achievements",
            service: "dash",
            controller: "reports",
            method: {
                get: "getAchievements"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/dash/reports/sowo",
            service: "dash",
            controller: "reports",
            method: {
                get: "getSOWO"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/dash/reports/competency",
            service: "dash",
            controller: "reports",
            method: {
                get: "getCompetency"
            }
        },
        {
            api: "/api/v2/dash/reports/totalTimePlayed",
            service: "dash",
            controller: "reports",
            method: {
                get: "getTotalTimePlayed"
            }
        },
        {
            api: "/api/v2/dash/game/:gameId/achievements/all",
            service: "dash",
            controller: "game",
            method: {
                get: "getAllGameAchievements"
            }
        },
        {
            api: "/api/v2/dash/game/:gameId/achievements/user",
            service: "dash",
            controller: "game",
            method: {
                get: "getUserGameAchievements"
            }
        },
        {
            api: "/api/v2/dash/game/:gameId/reports",
            service: "dash",
            controller: "game",
            method: {
                get: "getGameReports"
            }
        },
        {
            api: "/api/v2/dash/course/:courseId/game/:gameId/missions",
            service: "dash",
            controller: "game",
            method: {
                get: "getGameMissions"
            }
        },
        {
            api: "/api/v2/dash/game/:gameId",
            service: "dash",
            controller: "game",
            method: {
                get: "getGameDetails"
            }
        },
        {
            api: "/api/v2/dash/games",
            service: "dash",
            controller: "games",
            method: {
                get: "getGamesBasicInfo"
            }
        },
        // ---------------------------------------------------
        {
            requireAuth: true,
            api: "/api/v2/lms/courses",
            service: "lms",
            controller: "course",
            method: {
                get: "getEnrolledCourses"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/lms/course/create",
            service: "lms",
            controller: "course",
            method: {
                post: "createCourse"
            }
        },
        {
            api: "/api/v2/lms/course/code/:code/verify",
            service: "lms",
            controller: "course",
            method: {
                get: "verifyCode"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/lms/course/enroll",
            service: "lms",
            controller: "course",
            method: {
                post: "enrollInCourse"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/lms/course/unenroll",
            service: "lms",
            controller: "course",
            method: {
                post: "unenrollFromCourse"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/lms/course/unenroll-user",
            service: "lms",
            controller: "course",
            method: {
                post: "unenrollUserFromCourse"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/lms/course/:courseId/info",
            service: "lms",
            controller: "course",
            method: {
                get: "getCourse",
                post: "updateCourseInfo"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/lms/course/:courseId/games",
            service: "lms",
            controller: "course",
            method: {
                post: "updateGamesInCourse"
            }
        },
        // ---------------------------------------------------
        {
            requireAuth: true,
            api: "/api/v2/license/:licenseKey/verify",
            service: "lic",
            controller: "license",
            method: {
                get: "verifyLicense"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/license/current",
            service: "lic",
            controller: "license",
            method: {
                get: "getLicenses"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/license/register",
            service: "lic",
            controller: "license",
            method: {
                post: "registerLicense"
            }
        },
        // ---------------------------------------------------
        {
            api: "/api/v2/auth/user/register",
            service: "auth",
            controller: "user",
            method: {
                post: "registerUserV2"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/auth/user/profile",
            service: "auth",
            controller: "user",
            method: {
                get: "getUserProfileData"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/auth/user/:userId",
            service: "auth",
            controller: "user",
            method: {
                get: "getUserDataById",
                post: "updateUserData"
            }
        },
        {
            api: "/api/v2/auth/login/glasslab",
            service: "auth",
            controller: "login",
            method: {
                post: "glassLabLogin"
            }
        },
        /*
        // ROUTE DEFINED IN auth.account.edmodo
        {
            api: "/api/v2/auth/login/edmodo",
            service: "auth",
            controller: "login",
            method: {
                post: "edmodoLogin"
            }
        },
        {
            api: "/api/v2/auth/login/icivics",
            service: "auth",
            controller: "login",
            method: {
                post: "icivicsLogin"
            }
        },
        */
        {
            api: "/api/v2/auth/login/status",
            service: "auth",
            controller: "login",
            method: {
                get: "loginStatus"
            }
        },
        {
            api: "/api/v2/auth/password-reset/send",
            service: "auth",
            controller: "user",
            method: {
                post: "resetPasswordSend"
            }
        },
        {
            api: "/api/v2/auth/password-reset/update",
            service: "auth",
            controller: "user",
            method: {
                post: "resetPasswordUpdate"
            }
        },
        {
            api: "/api/v2/auth/password-reset/:code/verify",
            service: "auth",
            controller: "user",
            method: {
                get: "resetPasswordVerify"
            }
        },
        {
            api: "/api/v2/auth/logout",
            service: "auth",
            controller: "login",
            method: {
                post: "logout"
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
        }
    ]

};