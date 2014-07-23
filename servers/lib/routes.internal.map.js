
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
            api: "/int/v1/data/session/:gameSessionId/info",
            service: "data",
            controller: "_gameSession",
            method: {
                get: "getGameSessionInfo"
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
            api: "/int/v1/dash/reports/competency/results",
            service: "dash",
            controller: "_reports",
            method: {
                get: "saveCompetencyResults"
            }
        }
    ]
};