
module.exports = {
    index: "index.html",
    // --------------------------------------------------------------------------------------
    apis: [
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
            api: "/int/v1/data/game/:gameId/user/:userId/events",
            service: "data",
            controller: "_events",
            method: {
                get: "getUserEvents"
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
            api: "/admin/data/runMigration",
            service: "data",
            controller: "_events",
            method: {
                get: "runDataMigration"
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
            api: "/int/v1/dash/game/:gameId/assessment/results",
            service: "dash",
            controller: "_game",
            method: {
                post: "saveAssessmentResults"
            }
        }
    ]
};