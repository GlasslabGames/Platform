
module.exports = {
    index: "index.html",
    // --------------------------------------------------------------------------------------
    apis: [
        {
            api: "/admin/api/version",
            service: "admin",
            controller: "config",
            method: {
                get: "version"
            }
        },

        {
            api: "/int/v1/data/qsession/end",
            service: "data",
            controller: "_queueSession",
            method: {
                post: "endQSession"
            }
        },
        {
            api: "/int/v1/data/qsession/cleanup",
            service: "data",
            controller: "_queueSession",
            method: {
                post: "cleanupQSession"
            }
        },
        {
            api: "/int/v1/data/session/:gameSessionId/events",
            service: "data",
            controller: "_gameSession",
            method: {
                get: "getGameSessionEvents"
            }
        },
        {
            api: "/int/v1/data/session/game/:gameId/user/:userId/info",
            service: "data",
            controller: "_gameSession",
            method: {
                get: "getGameSessionsInfo"
            }
        },
        {
            api: "/int/v1/data/game/:gameId/latestSessions",
            service: "data",
            controller: "_gameSession",
            method: {
                get: "getLatestGameSessions"
            }
        },
        {
            api: "/int/v1/data/game/sessionsSince/:timestamp",
            service: "data",
            controller: "_gameSession",
            method: {
                get: "getGameSessionsSince"
            }
        },

        {
            api: "/int/v1/data/game/:gameId/user/:userId/events",
            service: "data",
            controller: "_events",
            method: {
                get: "getUserEvents"
            }
        },
        {
            api: "/int/v1/dash/game/:gameId/assessment/definitions",
            service: "dash",
            controller: "_game",
            method: {
                get: "getAssessmentDefinitions"
            }
        },
        {
            api: "/int/v1/dash/game/:gameId/user/:userId/assessment/:assessmentId/results",
            service: "dash",
            controller: "_game",
            method: {
                get: "getAssessmentResults",
                post: "saveAssessmentResults"
            }
        },
        // admin routes
        {
            // used for testing templates
            api: "/admin/auth/user/email-template",
            service: "auth",
            controller: "_user",
            method: {
                get: "renderEmailTemplate"
            }
        },
        {
            api: "/admin/data/runMigration",
            service: "data",
            controller: "_events",
            method: {
                get: "runDataMigration"
            }
        },
        {
            api: "/admin/data/user/setAllActive",
            service: "data",
            controller: "_events",
            method: {
                get: "setAllUsersActive"
            }
        },
        {
            api: "/api/v2/data/config/:gameId",
            service: "data",
            controller: "_config",
            method: {
                post: "updateGameConfigs"
            }
        },
        // monitoring routes
        {
            api: "/api/v2/monitor/info",
            service: "monitor",
            controller: "inspector",
            method: {
                get: "monitorInfo"
            }
        }
    ]
};