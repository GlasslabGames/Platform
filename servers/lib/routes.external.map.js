
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
            api: "/api/v2/data/game/:gameId/releases:type",
            service: "data",
            controller: "game",
            method: {
                get: "releases"
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
            api: "/api/v2/data/playSession/start",
            service: "data",
            controller: "session",
            method: {
                get: "startPlaySession"
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
        {
            requireAuth: true,
            api: "/api/v2/data/game/:gameId/user/:userId",
            service: "data",
            controller: "game",
            method: {
                get: "getGameDataForUser"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/data/game/:gameId/create",
            service: "data",
            controller: "game",
            method: {
                post: "createMatch"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/data/game/:gameId/match/:matchId",
            service: "data",
            controller: "game",
            method: {
                get: "getMatch"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/data/game/:gameId/submit",
            service: "data",
            controller: "game",
            method: {
                post: "updateMatches"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/data/game/:gameId/matches",
            service: "data",
            controller: "game",
            method: {
                get: "pollMatches"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/data/game/:gameId/complete",
            service: "data",
            controller: "game",
            method: {
                post: "completeMatch"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/data/game/saves/delete",
            service: "data",
            controller: "game",
            method: {
                post: "deleteGameSaves"
            }
        },
        // ---------------------------------------------------
        {
            requireAuth: true,
            api: "/api/v2/dash/game/assessment/:assessmentId",
            service: "dash",
            controller: "game",
            method: {
                post: "saveAssessmentResults"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/dash/reports/:reportId/game/:gameId/course/:courseId",
            service: "dash",
            controller: "reports",
            method: {
                get: "getReport"
            }
        },
        {
            api: "/api/v2/dash/reports/:reportId/game/:gameId/info",
            service: "dash",
            controller: "reports",
            method: {
                get: "getReportInfo"
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
            api: "/api/v2/dash/game/:gameId/achievements/user",
            service: "dash",
            controller: "game",
            method: {
                get: "getUserGameAchievements"
            }
        },
        {
            api: "/api/v2/dash/game/:gameId/reports/all",
            service: "dash",
            controller: "game",
            method: {
                get: "getGameReports"
            }
        },
        {
            api: "/api/v2/dash/game/:gameId/missions",
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
        //{
        //    api: "/api/v2/dash/games/active/minimal",
        //    service: "dash",
        //    controller: "games",
        //    method: {
        //        get: "getGamesBasicInfo"
        //    }
        //},
        {
            requireAuth: true,
            api: "/api/v2/admin/games-submission-target",
            service: "dash",
            controller: "game",
            method: {
                get: "getDeveloperGameSubmissionTarget"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/dash/game/:gameId/from-submission-target",
            service: "dash",
            controller: "game",
            method: {
                get: "getGameInfoFromSubmissionTarget"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/dash/game/:gameId/approve",
            service: "dash",
            controller: "game",
            method: {
                post: "approveDeveloperGame"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/dash/game/:gameId/reject",
            service: "dash",
            controller: "game",
            method: {
                post: "rejectDeveloperGame"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/dash/game/:gameId/requestInfo",
            service: "dash",
            controller: "game",
            method: {
                post: "requestInfoDeveloperGame"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/dash/games/awaiting-approval",
            service: "dash",
            controller: "games",
            method: {
                get: "getAllDeveloperGamesAwaitingApproval"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/dash/games/rejected",
            service: "dash",
            controller: "games",
            method: {
                get: "getAllDeveloperGamesRejected"
            }
        },
        {
            api: "/api/v2/dash/games/active/details",
            service: "dash",
            controller: "games",
            method: {
                get: "getActiveGamesDetails"
            }
        },
        {
            api: "/api/v2/dash/games/active/basic",
            service: "dash",
            controller: "games",
            method: {
                get: "getActiveGamesBasicInfo"
            }
        },
        {
            api: "/api/v2/dash/games/plan/basic",
            service: "dash",
            controller: "games",
            method: {
                get: "getPlanLicenseGamesBasicInfo"
            }
        },
        {
            api: "/api/v2/dash/games/available",
            service: "dash",
            controller: "games",
            method: {
                get: "getAvailableGamesObj"
            }
        },
        {
            api: "/api/v2/dash/games/plan/:planId/basic",
            service: "dash",
            controller: "games",
            method: {
                get: "getGamesBasicInfoByPlan"
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
        {
            api: "/api/v2/dash/games/approved",
            service: "dash",
            controller: "games",
            method: {
                get: "getApprovedGamesOrgInfo"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/dash/myGames",
            service: "dash",
            controller: "games",
            method: {
                get: "getMyGames"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/dash/message-center/:messageId",
            service: "dash",
            controller: "dash",
            method: {
                get: "getMessages",
                post: "postMessage"
            }
        },
        {
            api: "/api/v2/admin-thx1138-data/export-report-data",
            service: "dash",
            controller: "dash",
            method: {
                get: "exportReportData"
            }
        },
        {
            api: "/api/v2/dash/migrate/:code",
            service: "dash",
            controller: "games",
            method: {
                get: "migrateInfoFiles"
            }
        },
        {
            api: "/api/v2/dash/reload/:code",
            service: "dash",
            controller: "games",
            method: {
                get: "reloadGameFiles"
            }
        },
        {
            api: "/api/v2/dash/replace/:gameId/:code",
            service: "dash",
            controller: "games",
            method: {
                post: "replaceGameInfo"
            }
        },
        {
            api: "/api/v2/dash/badge/:badgeId",
            service: "dash",
            controller: "games",
            method: {
                get: "getBadgeJSON"
            }
        },
        {
            api: "/api/v2/dash/badge/:badgeId/generateCode/:userId",
            service: "dash",
            controller: "games",
            method: {
                post: "generateBadgeCode"
            }
        },
        {
            api: "/api/v2/dash/badge/:badgeId/codeAwarded/:code",
            service: "dash",
            controller: "games",
            method: {
                get: "badgeCodeAwarded"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/dash/developer/profile",
            service: "dash",
            controller: "games",
            method: {
                get: "getDeveloperProfile"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/dash/developer/info",
            service: "dash",
            controller: "games",
            method: {
                get: "getDeveloperGamesInfo"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/dash/developer/info/schema",
            service: "dash",
            controller: "games",
            method: {
                get: "getDeveloperGamesInfoSchema"
            }
        },
        {
            //requireAuth: true,
            api: "/api/v2/dash/developer/info/game/:gameId",
            service: "dash",
            controller: "games",
            method: {
                get: "getDeveloperGameInfo",
                post: "updateDeveloperGameInfo"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/dash/developer/info/game/:gameId/upload",
            service: "dash",
            controller: "games",
            method: {
                post: "uploadGameFile"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/dash/developer/new-game/:gameId",
            service: "dash",
            controller: "games",
            method: {
                post: "createNewGame"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/dash/developer/submit/:gameId",
            service: "dash",
            controller: "games",
            method: {
                post: "submitGameForApproval"
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
            api: "/api/v2/lms/course/:courseId/game/:gameId/verify-course",
            service: "lms",
            controller: "course",
            method: {
                get: "verifyGameInCourse"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/lms/course/:courseId/game/:gameId/verify-access",
            service: "lms",
            controller: "course",
            method: {
                get: "verifyAccessToGameInCourse"
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
        //{
        //    requireAuth: true,
        //    api: "/api/v2/lms/course/unenroll",
        //    service: "lms",
        //    controller: "course",
        //    method: {
        //        post: "unenrollFromCourse"
        //    }
        //},
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
        {
            api: "/api/v2/lms/course/block/code/:code",
            service: "lms",
            controller: "course",
            method: {
                post: "blockPremiumGamesBasicCourses"
            }
        },
        {
            api: "/api/v2/lms/course/games/map",
            service: "lms",
            controller: "course",
            method: {
                post: "getGamesCourseMap"
            }
        },

        // ---------------------------------------------------
        {
            api: "/api/v2/license/packages",
            service: "lic",
            controller: "license",
            method: {
                get: "getSubscriptionPackages"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/plan",
            service: "lic",
            controller: "license",
            method: {
                get: "getCurrentPlan"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/planforuser",
            service: "lic",
            controller: "license",
            method: {
                get: "getPlanForUser"
            }
        },
		{
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/students",
            service: "lic",
            controller: "license",
            method: {
                get: "getStudentsInLicense"
            }
        },

        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/billing",
            service: "lic",
            controller: "license",
            method: {
                get: "getBillingInfo",
                post: "updateBillingInfo"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/subscribe",
            service: "lic",
            controller: "license",
            method: {
                post: "subscribeToLicense"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/trial",
            service: "lic",
            controller: "license",
            method: {
                post: "subscribeToTrialLicense"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/upgrade",
            service: "lic",
            controller: "license",
            method: {
                post: "upgradeLicense"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/alter",
            service: "lic",
            controller: "license",
            method: {
                post: "alterLicense"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/trial/upgrade",
            service: "lic",
            controller: "license",
            method: {
                post: "upgradeTrialLicense"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/promo-code/:code",
            service: "lic",
            controller: "license",
            method: {
                get: "validatePromoCode"
            }
        },
        //{
        //    requireAuth: true,
        //    requireHttps: true,
        //    api: "/api/v2/license/cancel",
        //    service: "lic",
        //    controller: "license",
        //    method: {
        //        post: "cancelLicenseAutoRenew"
        //    }
        //},
        //{
        //    requireAuth: true,
        //    requireHttps: true,
        //    api: "/api/v2/license/renew",
        //    service: "lic",
        //    controller: "license",
        //    method: {
        //        post: "enableLicenseAutoRenew"
        //    }
        //},
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/invite",
            service: "lic",
            controller: "license",
            method: {
                post: "addTeachersToLicense"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/activate",
            service: "lic",
            controller: "license",
            method: {
                post: "setLicenseMapStatusToActive"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/remove",
            service: "lic",
            controller: "license",
            method: {
                post: "removeTeacherFromLicense"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/leave",
            service: "lic",
            controller: "license",
            method: {
                post: "teacherLeavesLicense"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/subscribe/po",
            service: "lic",
            controller: "license",
            method: {
                post: "subscribeToLicensePurchaseOrder"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/trial/upgrade/po",
            service: "lic",
            controller: "license",
            method: {
                post: "upgradeTrialLicensePurchaseOrder"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/po",
            service: "lic",
            controller: "license",
            method: {
                get: "getActivePurchaseOrderInfo"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/po/open",
            service: "lic",
            controller: "license",
            method: {
                get: "getOpenPurchaseOrders"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/po/notopen",
            service: "lic",
            controller: "license",
            method: {
                get: "getNotOpenPurchaseOrders"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/po/openforuser/:userId",
            service: "lic",
            controller: "license",
            method: {
                get: "getOpenPurchaseOrderForUser"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/po/cancel",
            service: "lic",
            controller: "license",
            method: {
                post: "cancelActivePurchaseOrder"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/nullify",
            service: "lic",
            controller: "license",
            method: {
                post: "setLicenseMapStatusToNull"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/po/receive",
            service: "lic",
            controller: "license",
            method: {
                post: "receivePurchaseOrder"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/po/reject",
            service: "lic",
            controller: "license",
            method: {
                post: "rejectPurchaseOrder"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/po/invoice",
            service: "lic",
            controller: "license",
            method: {
                post: "invoicePurchaseOrder"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/po/approve",
            service: "lic",
            controller: "license",
            method: {
                post: "approvePurchaseOrder"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/trial/legacy",
            service: "lic",
            controller: "license",
            method: {
                post: "migrateToTrialLegacy"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/end",
            service: "lic",
            controller: "license",
            method: {
                post: "cancelLicense"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/end/internal",
            service: "lic",
            controller: "license",
            method: {
                post: "cancelLicenseInternal"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/subscribe/internal",
            service: "lic",
            controller: "license",
            method: {
                post: "subscribeToLicenseInternal"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/inspect",
            service: "lic",
            controller: "license",
            method: {
                post: "inspectLicenses"
            }
        },
        {
            requireAuth: true,
            requireHttps: true,
            api: "/api/v2/license/trial/move",
            service: "lic",
            controller: "license",
            method: {
                post: "trialMoveToTeacher"
            }
        },
        // old api methods, not in use
        //{
        //    requireAuth: true,
        //    api: "/api/v2/license/:licenseKey/verify",
        //    service: "lic",
        //    controller: "license",
        //    method: {
        //        get: "verifyLicense"
        //    }
        //},
        //{
        //    requireAuth: true,
        //    api: "/api/v2/license/current",
        //    service: "lic",
        //    controller: "license",
        //    method: {
        //        get: "getLicenses"
        //    }
        //},
        //{
        //    requireAuth: true,
        //    api: "/api/v2/license/register",
        //    service: "lic",
        //    controller: "license",
        //    method: {
        //        post: "registerLicense"
        //    }
        //},
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
            api: "/api/v2/auth/user/unregister",
            service: "auth",
            controller: "user",
            method: {
                post: "unregisterUserV2"
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
            requireAuth: true,
            api: "/api/v2/auth/userResellers",
            service: "auth",
            controller: "user",
            method: {
                get: "getResellers",
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/auth/user/:userId/updateRole/:role",
            service: "auth",
            controller: "user",
            method: {
                post: "updateUserRole",
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/auth/userbyemail",
            service: "auth",
            controller: "user",
            method: {
                get: "getUserDataByEmail",
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/auth/userbyusername",
            service: "auth",
            controller: "user",
            method: {
                get: "getUserDataByUserName",
            }
        },
        {
            api: "/api/v2/auth/user/:userId/badgeList",
            service: "auth",
            controller: "user",
            method: {
                get: "getUserBadgeList",
                post: "updateUserBadgeList"
            }
        },
        {
            api: "/api/v2/auth/user/:userId/badgeList/add",
            service: "auth",
            controller: "user",
            method: {
                post: "addUserBadgeList"
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
            api: "/api/v2/auth/newsletter/subscribe",
            service: "auth",
            controller: "newsletter",
            method: {
                post: "subscribe"
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
            api: "/api/v2/auth/register-verify/:code/verify",
            service: "auth",
            controller: "user",
            method: {
                get: "verifyEmailCode"
            }
        },
        {
            api: "/api/v2/auth/register-verify/:code/verifyBeta",
            service: "auth",
            controller: "user",
            method: {
                get: "verifyBetaCode"
            }
        },
        {
            api: "/api/v2/auth/register-verify/:code/verifyDeveloper",
            service: "auth",
            controller: "user",
            method: {
                get: "verifyDeveloperCode"
            }
        },
        {
            api: "/api/v2/auth/alter-developer-status",
            service: "auth",
            controller: "user",
            method: {
                post: "alterDeveloperVerifyCodeStatus"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/auth/developers",
            service: "auth",
            controller: "user",
            method: {
                get: "getAllDevelopers"
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
        {
            requireAuth: true,
            api: "/api/v2/auth/developer/game/:gameId/request",
            service: "auth",
            controller: "user",
            method: {
                get: "requestDeveloperGameAccess"
            }
        },
        {
            api: "/api/v2/auth/developer/game/:gameId/request/:code/approve",
            service: "auth",
            controller: "user",
            method: {
                get: "approveDeveloperGameAccess"
            }
        },


        {
            api: "/api/v2/zzzz/test0824esi",
            service: "auth",
            controller: "user",
            method: {
                post: "eraseStudentInfo"
            }
        },

        {
           api: "/api/v2/zzzz/test0828eti",
           service: "auth",
           controller: "user",
           method: {
                post: "eraseInstructorInfo"
           }
        },
/*
        {
            requireAuth: true,
            api: "/api/v2/auth/delete/user",
            service: "auth",
            controller: "user",
            method: {
                post: "deleteUser"
            }
        },
*/
        // monitoring routes
        {
            api: "/api/v2/monitor/info",
            service: "monitor",
            controller: "inspector",
            method: {
                get: "monitorInfo"
            }
        },

    // ---------------------------------------------------
    // Research
    // ---------------------------------------------------
        {
            requireAuth: true,
            api: "/api/v2/research/game/:gameId/parse-schema",
            service: "research",
            controller: "csv",
            method: {
                get: "getCsvParseSchema",
                post: "updateCsvParseSchema"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/research/game/:gameId/events",
            service: "research",
            controller: "events",
            method: {
                get: "getEventsByDate"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/research/game/:gameId/dev-game-report",
            service: "research",
            controller: "events",
            method: {
                get: "getDeveloperGameReport"
            }
        },
        {
            requireAuth: true,
            api: "/api/v2/research/game/:gameId/urls",
            service: "research",
            controller: "events",
            method: {
                get: "getSignedUrlsByDayRange"
            }
        },
        {
            api: "/api/v2/research/code/:code/archive",
            service: "research",
            controller: "events",
            method: {
                get: "archiveEvents"
            }
        },
        {
            api: "/api/v2/research/code/:code/archive/stop",
            service: "research",
            controller: "events",
            method: {
                get: "stopArchive"
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
        // ---------------------------------------------------
        // SDK
        // ---------------------------------------------------
        {
            api: "/sdk/connect",
            service: "data",
            controller: "config",
            method: {
                get: "connect"
            }
        }
    ]

};