
var _         = require('lodash');
var when      = require('when');
var lConst    = require('../../lms/lms.const.js');
var Util      = require('../../core/util');
//

module.exports = {
    getReport:          getReport,
    getReportInfo:      getReportInfo,
    getTotalTimePlayed: getTotalTimePlayed
};

var exampleIn = {}, exampleOut = {};

// http://127.0.0.1:8001/api/v2/dash/reports/sowo/game/AA-1/course/44
// http://127.0.0.1:8001/api/v2/dash/reports/achievements/game/AA-1/course/44
// http://127.0.0.1:8001/api/v2/dash/reports/mission-progress/game/SC/course/44
exampleIn.getSOWO = {
    gameId: "AA-1",
    courseId: 1
};
exampleOut.getSOWO =
    [
        {"results": {"watchout": [
            {"total": 6, "overPercent": 1, "timestamp": 1409012387023, "id": "wo1", "name": "Contradictory Mechanic", "description": "Student is struggling with claim-data pairs. They are consistently using evidence that contradicts their claim. More core construction practice is needed."},
            {"total": 2, "overPercent": 0.5, "timestamp": 1408658285716, "id": "wo3", "name": "Straggler", "description": "Struggling with identifying strengths and weaknesses of claim-data pairs."}
        ], "shoutout": [
            {"total": 10, "overPercent": 2.6666666666666665, "timestamp": 1409012387031, "id": "so1", "name": "Nailed It!", "description": "Outstanding performance at identifying weaknesses of claim-data pairs."}
        ]}, "gameId": "AA-1", "userId": "25", "assessmentId": "sowo"},
        {"gameId": "AA-1", "userId": "250", "assessmentId": "sowo", "results": {"watchout": [
            {"total": 6, "overPercent": 1, "timestamp": 1409256462557, "id": "wo1", "name": "Contradictory Mechanic", "description": "Student is struggling with claim-data pairs. They are consistently using evidence that contradicts their claim. More core construction practice is needed."}
        ], "shoutout": []}}
    ];
function getReport(req, res, next) {

    if (!req.params.reportId) {
        this.requestUtil.errorResponse(res, {key:"report.reportId.missing", error: "missing reportId"});
        return;
    }
    if (!req.params.gameId) {
        this.requestUtil.errorResponse(res, {key:"report.gameId.missing", error: "missing gameId"});
        return;
    }
    if (!req.params.courseId) {
        this.requestUtil.errorResponse(res, {key:"report.courseId.missing", error: "missing courseId"});
        return;
    }

    var reportId = req.params.reportId.toLowerCase();
    var courseId = parseInt(req.params.courseId);
    // gameId is not case sensitive
    var gameId = req.params.gameId.toUpperCase();

    // check if valid gameId
    this.isValidGameId(gameId)
        .then(function(state){
            if(!state){
                this.requestUtil.errorResponse(res, {key:"report.gameId.invalid"});
            } else {
                if(reportId == 'sowo') {
                    _getSOWO.call(this, req, res, reportId, gameId, courseId);
                }
                else if(reportId == 'progress') {
                    _getGameProgress.call(this, req, res, reportId, gameId, courseId);
                }
                else if(reportId == 'achievements') {
                    _getAchievements.call(this, req, res, reportId, gameId, courseId);
                }
                else if(reportId == 'mission-progress') {
                    _getMissionProgress.call(this, req, res, reportId, gameId, courseId);
                }
                else if(reportId == 'competency') {
                    _getCompetency.call(this, req, res, reportId, gameId, courseId);
                }
                else if(reportId === "standards") {
                    _getStandards.call(this, req, res, reportId, gameId, courseId);
                }
                else if(reportId === "drk12_b") {
                    _getDRK12_b.call(this, req, res, reportId, gameId, courseId);
                }
                else {
                    this.requestUtil.errorResponse(res, {key:"report.reportId.invalid"});
                }
            }
        }.bind(this) )
        .then(null,function(err){
            console.trace("Reports: Get Reports Error -", err);
            this.stats.increment("error", "getReport.Catch");
        }.bind(this) );
}

// http://127.0.0.1:8001/api/v2/dash/reports/sowo/game/AA-1/course/93
exampleIn.getSOWO = {
    gameId: "AA-1",
    courseId: 1
};
exampleOut.getSOWO = [

];
function _getSOWO(req, res, reportId, gameId, courseId) {
    var assessmentId = reportId;
    var currentAssessmentData;
    var outAssessmentData;

    // get user list in class
    // TODO: use service route
    var lmsService = this.serviceManager.get("lms").service;
    lmsService.getStudentsOfCourse(courseId)
        .then(function(users){
            // shortcut no users
            if(!users) return;

            var outList = [];
            var userMap = {};
            var promiseList = [];
            //console.log("users:", users);

            // get SOWO data per game per user
            users.forEach(function(user){
                var userId = user.id;
////  testing
                //console.log("getAssessmentResults gameId:", gameId, ", userId:", userId, ", assessmentId:", assessmentId);
                var p = this.telmStore.getAssessmentResults(userId, gameId, assessmentId)
                    .then(function(assessmentData) {
                        // shortcut invalid assessmentData
                        if (!assessmentData || !assessmentData.results) return;

                        // create copy of data for output
                        outAssessmentData = _.cloneDeep(assessmentData);

                        // Set the current assessment data
                        currentAssessmentData = assessmentData;

                        // TODO: replace this with promise
                        // find assessment by ID
                        return this.getGameAssessmentInfo(gameId);

                    }.bind(this) )
                    .then(function(assessment){
                        if(!assessment) return;
                        for(var i = 0; i < assessment.length; i++) {
                            if(assessment[i].id == assessmentId) {
                                // merge in sowo info from game assessment info

                                // output is array not object
                                outAssessmentData.results.shoutout = [];
                                // shoutout rules
                                for(var j in currentAssessmentData.results.shoutout) {
                                    var so = currentAssessmentData.results.shoutout[j];
                                    // don't need to expose the gameSessionId
                                    delete so.gameSessionId;
                                    so.id = j;

                                    outAssessmentData.results.shoutout.push( _.merge(
                                        so,
                                        assessment[i].rules[ j ] )
                                    );
                                    //console.log("shoutout:", currentAssessmentData.results.shoutout[j]);
                                }

                                // output is array not object
                                outAssessmentData.results.watchout = [];
                                // watchout rules
                                for(var j in currentAssessmentData.results.watchout) {
                                    var wo = currentAssessmentData.results.watchout[j];
                                    // don't need to expose the gameSessionId
                                    delete wo.gameSessionId;
                                    wo.id = j;

                                    outAssessmentData.results.watchout.push( _.merge(
                                        wo,
                                        assessment[i].rules[ j ] )
                                    );

                                    //console.log("shoutout:", currentAssessmentData.results.watchout[j]);
                                }

                                // done!
                                break;
                            }
                        }

                        outList.push(outAssessmentData);

                    }.bind(this))
                    .then(null,function(){
                        console.errorExt("DashService", "Get SOWO Error - Key is not defined in database");
                    }.bind(this));

                promiseList.push(p);
            }.bind(this) );


            when.all(promiseList)
                .then(function(){
                    // all done
                    this.requestUtil.jsonResponse(res, outList);
                }.bind(this) );
        }.bind(this) );
}


function _getGameProgress(req, res, reportId, gameId, courseId) {
    var assessmentId = reportId;
    var currentAssessmentData;
    var outAssessmentData;
    var assessment;
    this.getGameAssessmentInfo(gameId)
        .then(function (results) {
            //console.log("getGameAssessmentInfo results", results);
            if (!results) {
                return;
            }
            assessment = results;
            var lmsService = this.serviceManager.get("lms").service;
            return lmsService.getStudentsOfCourse(courseId);
        }.bind(this))
        .then(function (users) {
            //console.log("getStudentsOfCourse", users);
            if (!users) {
                return;
            }

            var outList = [];
            var userMap = {};
            var promiseList = [];
            //console.log("assessmentId", assessmentId);

            //get Standards data per game per user
            users.forEach(function (user) {
                var userId = user.id;

                var p = this.telmStore.getAssessmentResults(userId, gameId, assessmentId)
                    .then(function (assessmentData) {
                        if (!assessmentData || !assessmentData.results) {
                            return;
                        }

                        currentAssessmentData = assessmentData;



                        for (var i = 0; i < assessment.length; i++) {
                            //console.log("assessment[i].id", assessment[i].id);
                            if (assessment[i].id === assessmentId) {

                                outAssessmentData = {};
                                outAssessmentData.gameId = gameId;
                                outAssessmentData.userId = userId;
                                outAssessmentData.assessmentId = assessmentId;
                                outAssessmentData.results = currentAssessmentData.results;

                                break;
                            }
                        }

                        outList.push(outAssessmentData);

                    }.bind(this))
                    .then(null, function (err) {
                        console.errorExt("DashService", "getGameProgress Error 1 -", err);
                    }.bind(this));

                promiseList.push(p);
            }.bind(this));

            when.all(promiseList)
                .then(function () {
                    this.requestUtil.jsonResponse(res, outList);
                }.bind(this))
                .then(null, function (err) {
                    // give some error code
                    console.errorExt("DashService", "getGameProgress Error 2 -", err);
                    this.requestUtil.errorResponse(res, {key: "dash.general"});
                }.bind(this));
        }.bind(this))
        .then(null, function (err) {
            console.errorExt("DashService", "getGameProgress Error 3 -", err);
            this.requestUtil.errorResponse(res, {key: "dash.general"});
        }.bind(this));
}


exampleIn._getAchievements = {
    gameId: "AA-1",
    courseId: 93
};
exampleOut._getAchievements = [
    {
        "userId": 25,
        "achievements": [
            {
                "group":    "21st.Century.Skills",
                "subGroup": "a",
                "item":     "Bold",
                "won":      true
            },
            {
                "group":    "21st.Century.Skills",
                "subGroup": "a",
                "item":     "Persistent",
                "won":      false
            }
        ],
        "totalTimePlayed": 123456789
    }
];
function _getAchievements(req, res, reportId, gameId, courseId) {

    var loginUserSessionData = req.session.passport.user;
    if(loginUserSessionData.role == lConst.role.student) {
        this.requestUtil.errorResponse(res, {error: "invalid access"});
        return;
    }

    //console.log("userIds:", userIds);
    // validate users in teachers class
    this.lmsStore.isUserInCourse(loginUserSessionData.id, courseId)
        .then(function(verified) {
            if(verified) {
                var lmsService = this.serviceManager.get("lms").service;
                return lmsService.getStudentsOfCourse(courseId);
            } else {
                this.requestUtil.errorResponse(res, {error: "invalid access"});
            }
        }.bind(this))

        .then(function(userInfo) {
            if(userInfo) {
                var userIds = _.pluck(userInfo, "id");
                return this.telmStore.getMultiGamePlayInfo(userIds, gameId);
            } else {
                this.requestUtil.errorResponse(res, {error: "invalid access"});
            }
        }.bind(this))

        .then(function(playerInfoList) {
            var achievements = [];
            var defaultStandards = req.session.passport.user.standards;
            //console.log("playerInfoList:", playerInfoList);

            for(var userId in playerInfoList) {
                var info = playerInfoList[userId];
                //console.log("info:", info);

                var userAchievements = {
                    userId: userId,
                    achievements: [],
                    totalTimePlayed: info.totalTimePlayed || 0
                };

                userAchievements.achievements = this.getListOfAchievements(gameId, info.achievement, defaultStandards);
                achievements.push(userAchievements);
            }

            //console.log("getAchievements:", achievements);
            this.requestUtil.jsonResponse(res, achievements);
        }.bind(this))

        // error
        .then(null, function(err){
            if(err == 'none found') {
                // empty list
                this.requestUtil.jsonResponse(res, {});
            } else {
                this.requestUtil.errorResponse(res, err);
            }
        }.bind(this));
}

exampleIn.getTotalTimePlayed = {
    gameId: "AA-1",
    userIds: [1, 2]
};
function getTotalTimePlayed(req, res) {
    try {
        if( !(req.session &&
            req.session.passport &&
            req.session.passport.user &&
            req.session.passport.user.id ) ) {
            this.requestUtil.errorResponse(res, {error: "not logged in"});
            return;
        }

        var loginUserSessionData = req.session.passport.user;
        if(loginUserSessionData.role == lConst.role.student) {
            this.requestUtil.errorResponse(res, {error: "invalid access"});
            return;
        }

        if(!req.query.gameId) {
            this.requestUtil.errorResponse(res, {error: "missing gameId"});
            return;
        }

        if(!req.query.userIds) {
            this.requestUtil.errorResponse(res, {error: "missing userIds"});
            return;
        }

        var gameId  = req.query.gameId;
        var userIds = req.query.userIds;

        // make sure userId is array
        if(!_.isArray(userIds)) {
            var id = parseInt(userIds);
            if(_.isNaN(id)) {
                this.requestUtil.errorResponse(res, {error: "invalid parameter"});
                return;
            }
            userIds = [ id ];
        }

        //console.log("userIds:", userIds);
        // validate users in teachers class
        this.lmsStore.isMultiUsersInInstructorCourse(userIds, loginUserSessionData.id)
            .then(function(verified) {
                if(verified) {

                    var promiseList = [];

                    userIds.forEach(function(userId) {
                        var p = this.telmStore.getGamePlayInfo(userId, gameId)
                            .then(function (info) {
                                if (info) {
                                    return info.totalTimePlayed;
                                }
                            }.bind(this))
                            .then(function (totalTimePlayed) {
                                // if totalTime set to zero try getting from saved game
                                if (totalTimePlayed != 0) {
                                    console.log("totalTimePlayed from PlayInfo - userId:", userId, ", totalTimePlayed:", totalTimePlayed);
                                    // ensure it's a float and make it seconds
                                    return parseFloat(totalTimePlayed);
                                }

                                // TODO: remove this!!! but will need to write a migrate script to pull old over to use user pref
                                return this.telmStore.getUserGameData(userId, gameId)
                                    .then(function (gameData) {
                                        if (gameData) {
                                            // Look in save file for total TimePlayed

                                            var totalTimePlayed = 0;
                                            if (gameData &&
                                                gameData.hasOwnProperty('ExplorationManager') &&
                                                gameData.ExplorationManager &&
                                                gameData.ExplorationManager.hasOwnProperty('ExplorationManager') &&
                                                gameData.ExplorationManager.ExplorationManager &&
                                                gameData.ExplorationManager.ExplorationManager.hasOwnProperty('m_totalTimePlayed') &&
                                                gameData.ExplorationManager.ExplorationManager.m_totalTimePlayed) {

                                                //console.log("totalTimePlayed from SaveGame - userId:", userId, ", totalTimePlayed:", totalTimePlayed);
                                                // ensure it's a float and make it seconds
                                                totalTimePlayed = parseFloat(gameData.ExplorationManager.ExplorationManager.m_totalTimePlayed);
                                            }

                                            return totalTimePlayed;
                                        }
                                    }.bind(this),
                                function() {
                                    return 0;
                                })
                            }.bind(this))
                            .then(function (totalTimePlayed) {
                                // create object, with userId and totalTimePlayed
                                var data = {};
                                data[userId] = totalTimePlayed;
                                return data;
                            }.bind(this));
                        promiseList.push(p);
                    }.bind(this));

                    // join all results
                    var reduceList = when.reduce(promiseList, function(list, item){
                        list = _.merge(list, item);
                        return list;
                    }.bind(this));

                    reduceList.then(function(list){
                        this.requestUtil.jsonResponse(res, list);
                    }.bind(this));
                } else {
                    this.requestUtil.errorResponse(res, {key: "report.access.invalid"});
                }
            }.bind(this))
            // error
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this));

    } catch(err) {
        console.trace("Reports: Get Achievements Error -", err);
        this.stats.increment("error", "GetAchievements.Catch");
    }
}

function getReportInfo(req, res){
    if (!req.params.reportId) {
        this.requestUtil.errorResponse(res, {key:"report.reportId.missing"});
        return;
    }
    if (!req.params.gameId) {
        this.requestUtil.errorResponse(res, {key:"report.gameId.missing"});
        return;
    }

    var reportId = req.params.reportId.toLowerCase();
    // gameId is not case sensitive
    var gameId = req.params.gameId.toUpperCase();

    // check if valid gameId
    this.isValidGameId(gameId)
        .then(function(state){
            if(!state){
                return when.reject( {key:"report.gameId.invalid"} );
            }
            return this.getGameReportInfo(gameId, reportId);
        }.bind(this) )
        .then(function(reportInfo){
                this.requestUtil.jsonResponse(res, reportInfo);
        }.bind(this) )
        .then(null,function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this) );
}


exampleOut._getAchievements = [
    {
        "userId": 25,
        "missions": [
            {

            }
        ],
        "totalTimePlayed": 123456789
    }
];
function _getMissionProgress(req, res, reportId, gameId, courseId) {
    var lmsService = this.serviceManager.get("lms").service;
    lmsService.getStudentsOfCourse(courseId)
        .then(function(userList) {
            var cmp = [];
            // get all users missions info in promises
            var getMissionTimePlayed = _getMissionTimePlayed.bind(this);

            for(var i in userList) {
                //console.log("courseId:", courseId, ", gameId:", gameId, ", userId:", userList[i].id);
                cmp.push( getMissionTimePlayed(userList[i].id, gameId) );
            }

            // add users mission info to user list
            var p = when.reduce(cmp, function(allUsers, userData){
                allUsers.push(userData);
                return allUsers;
            }.bind(this), []);

            p.then(function(allUsers){
                this.requestUtil.jsonResponse(res, allUsers );
            }.bind(this))
            // catch all errors
            .then(null, function(err){
                console.errorExt("DashService", "getMissionProgress Error -", err);
                this.requestUtil.errorResponse(res, {key:"report.general"});
            }.bind(this));
        }.bind(this));
}

function _getMissionTimePlayed(userId, gameId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var completedMissions;
    var userData = {
        userId: userId
    };
    var dataService = this.serviceManager.get("data").service;

    dataService.getCompletedMissions(userId, gameId)
        .then(function(missions){

            completedMissions = missions;
            userData.missions = [];
            // flatten mission list
            return this.getGameMissions(gameId);
        }.bind(this))
        .then(function(missions){

            var gameMissions = _.cloneDeep(missions);
            for(var i = 0; i < gameMissions.groups.length; i++){
                for(var j = 0; j < gameMissions.groups[i].missions.length; j++){

                    // remove links, they are not needed
                    delete gameMissions.groups[i].missions[j].links;

                    userData.missions.push(gameMissions.groups[i].missions[j]);
                }
            }

            //console.log("completedMissions:", completedMissions);
            //console.log("gameMissions:",      gameMissions);
            // add completed mission flags
            for(i = 0; i < userData.missions.length; i++){
                for(j = 0; j < completedMissions.length; j++){
                    if(userData.missions[i].id == completedMissions[j].gameLevel) {
                        userData.missions[i].completed = completedMissions[j].summary.completed;
                        userData.missions[i].completedDate = completedMissions[j].serverEndTimeStamp;
                        userData.missions[i].data = {};

                        // add summary and score info to mission data
                        if(completedMissions[j].summary) {
                            userData.missions[i].data.summary = completedMissions[j].summary;
                        }
                        if(completedMissions[j].score) {
                            userData.missions[i].data.score = completedMissions[j].score;
                        }
                    }
                }
            }

            return this.telmStore.getGamePlayInfo(userId, gameId);
        }.bind(this))
        .then(function(playInfo){
            // add ttp info
            userData.totalTimePlayed = playInfo.totalTimePlayed;
            resolve(userData);
        }.bind(this))
        .then(null,function(err){
            console.errorExt("DashService", "getMissionTimePlayed Error -", err);
            this.requestUtil.errorResponse(res, {key:"report.general"});
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}


// http://127.0.0.1:8001/api/v2/dash/reports/competency/game/SC/course/44
exampleOut.getCompetency = [

];
function _getCompetency(req, res, reportId, gameId, courseId) {
    var assessmentId = reportId;
    var outAssessmentData;

    // get user list in class
    // TODO: use service route
    var lmsService = this.serviceManager.get("lms").service;
    lmsService.getStudentsOfCourse(courseId)
        .then(function(users){
            // shortcut no users
            if(!users) return;

            var outList = [];
            var userMap = {};
            var promiseList = [];

            //console.log("users:", users);

            // get SOWO data per game per user
            users.forEach(function(user){
                var userId = user.id;

                //console.log("getAssessmentResults gameId:", gameId, ", userId:", userId, ", assessmentId:", assessmentId);
                var p = this.telmStore.getAssessmentResults(userId, gameId, assessmentId)
                    .then(function(assessmentData){
                        // shortcut invalid assessmentData
                        if(!assessmentData || !assessmentData.results) return;

                        // create copy of data for output
                        outAssessmentData = _.cloneDeep(assessmentData);

                        // TODO: replace this with promise
                        // find assessment by ID
                        return this.getGameAssessmentInfo(gameId);
                    }.bind(this) )
                    .then(function(assessment){
                        if(!assessment) return;
                        for(var i = 0; i < assessment.length; i++) {
                            if(assessment[i].id == assessmentId) {

                                // merge in info from game assessment info
                                for(var j in assessment[i].missions) {
                                    // check if exist in results, if not then set to empty object {}
                                    outAssessmentData.results[j] = _.merge(outAssessmentData.results[j] || {}, assessment[i].missions[j]);
                                }

                                // done!
                                break;
                            }
                        }
                        return outAssessmentData;
                    }.bind(this))
                    .then(null,function(err){
                        console.errorExt("DashService", "Get Competency Error - Key is not defined in database");
                        p = 'reject';
                    });
                if(p !== 'reject'){
                    promiseList.push(p);
                }
            }.bind(this) );

            when.reduce(promiseList, function(list, item){
                    list.push(item);
                    return list;
                }.bind(this), [])
                .then(function(outList){
                    // all done
                    this.requestUtil.jsonResponse(res, outList);
                }.bind(this) );
        }.bind(this) );
}

function _getStandards(req, res, reportId, gameId, courseId) {
    var assessmentId = reportId;
    var currentAssessmentData;
    var outAssessmentData;
    var assessment;
    this.getGameAssessmentInfo(gameId)
        .then(function(results){
            if(!results){
                return;
            }
            assessment = results;
            var lmsService = this.serviceManager.get("lms").service;
            return lmsService.getStudentsOfCourse(courseId);
        }.bind(this))
        .then(function(users){
            if(!users){
                return;
            }

            var outList = [];
            var userMap = {};
            var promiseList = [];

            //get Standards data per game per user
            users.forEach(function(user){
                var userId = user.id;

                var p = this.telmStore.getAssessmentResults(userId, gameId, assessmentId)
                    .then(function(assessmentData){
                        if(!assessmentData || !assessmentData.results){
                            return;
                        }

                        currentAssessmentData = assessmentData;

                        for(var i = 0; i < assessment.length; i++){
                            if(assessment[i].id === assessmentId){

                                var results = currentAssessmentData.results;

                                outAssessmentData = {};
                                outAssessmentData.gameId = gameId;
                                outAssessmentData.userId = userId;
                                outAssessmentData.assessmentId = assessmentId;
                                outAssessmentData.timestamp = results.timestamp;
                                var outResults = outAssessmentData.results = {};

                                _(results).forEach(function(report, standard){
                                    outResults[standard] = report.status;
                                });

                                break;
                            }
                        }

                        outList.push(outAssessmentData);

                    }.bind(this))
                    .then(null, function(err){
                        console.errorExt("DashService", "Get Standards Error 1 -", err);
                    }.bind(this));

                promiseList.push(p);
            }.bind(this));

            when.all(promiseList)
                .then(function(){
                    this.requestUtil.jsonResponse(res, outList);
                }.bind(this))
                .then(null, function(err){
                    // give some error code
                    console.errorExt("DashService", "Get Standards Error 2 -", err);
                    this.requestUtil.errorResponse(res, { key: "dash.general"});
                }.bind(this));
        }.bind(this))
        .then(null, function(err){
            console.errorExt("DashService", "Get Standards Error 3 -", err);
            this.requestUtil.errorResponse(res, { key: "dash.general"});
        }.bind(this));
}

function _determineLevel(skillId, score, questInfo) {
    var grade = score.correct / score.attempts;
    if (questInfo && !_.contains(questInfo.skills, skillId)) {
        return "NotAvailable";
    }
    if (grade >= 0.70) {
        return "Advancing";
    }
    else if (score.attempts > 0) {
        return "NeedSupport";
    }
    else {
        return "NotAttempted";
    }
}

function _getDRK12_b(req, res, assessmentId, gameId, courseId) {

    var lmsService = this.serviceManager.get("lms").service;
    var aInfo = null;

    this.getGameAssessmentInfo(gameId).then(function(assessmentInfo) {
        aInfo = assessmentInfo;
        return this.getGameReportInfo(gameId, "drk12_b");
    }.bind(this))
    .then(function(gInfo){
        var drkInfo = _.find(aInfo, function(a) { return a.id == "drk12_b" });
        if (!drkInfo) {
            var emptyReport = {}
            this.requestUtil.jsonResponse(res, emptyReport);
            return;
        }

        lmsService.getStudentsOfCourse(courseId).then(function(users) {
            if (!users) return;
            var studentPromises = _.map(users, function(user) {
                var userId = user.id;

                return this.telmStore.getAssessmentResults(userId, gameId, assessmentId)
                    .then(function(assessmentData) {

                        var latestMission = drkInfo.missionList[0];
                        var latestSkillScores = {};
                        var studentSkillAndSubskillAverages = {};
                        var studentQuests = {};

                        if (assessmentData && assessmentData.results) {
                            //build a questId -> skills map for this student
                            _.forOwn(assessmentData.results.skill, function (skillInfo, skillId) {
                                if (skillInfo.quests) {
	                                _.forEach(skillInfo.quests, function (questSkillInfo) {
		                                if (!(questSkillInfo.questId in studentQuests)) {
			                                studentQuests[questSkillInfo.questId] = {
				                                "questId": questSkillInfo.questId,
				                                "skills": {}
			                                }
		                                }
		                                studentQuests[questSkillInfo.questId].skills[skillId] = {
			                                score: questSkillInfo.score,
			                                detail: questSkillInfo.detail,
			                                attemptList: questSkillInfo.attemptList
		                                }

	                                });
                                }
                            });
                        }

                        //iterate over all possible missions and determine levels
                        var missionProgress = _.map(_.keys(drkInfo.quests), function(questId) {
                            var questInfo = drkInfo.quests[questId];

                            var studentQuestScore = studentQuests[questId];
                            var skills;
                            if (studentQuestScore) {
                                skills = _.mapValues(studentQuestScore.skills, function(skillInfo, skillId) {

                                    var skillScore = skillInfo.score;

                                    var skillLevel = _determineLevel(skillId, skillScore, questInfo);
                                    if (skillLevel != "NotAvailable" && skillLevel != "NotAttempted") {
                                        if (!(skillId in latestSkillScores)) {
                                            latestSkillScores[skillId] = {
                                                mission: questInfo.mission,
                                                level: skillLevel,
                                                score: skillScore,
                                                detail: skillInfo.detail,
	                                            attemptList: skillInfo.attemptList
                                            }
                                        }
                                        else if (questInfo.mission > latestSkillScores[skillId].mission) {
                                            latestSkillScores[skillId].mission = questInfo.mission;
                                            latestSkillScores[skillId].level = skillLevel;
                                            latestSkillScores[skillId].score = skillScore;
                                            latestSkillScores[skillId].detail = skillInfo.detail;
	                                        latestSkillScores[skillId].attemptList = skillInfo.attemptList;
                                        }
                                    }

                                    // Accumulate running totals of correct answers and attempts for each skill and subskill,
                                    // so we can compute averages at the end
                                    if (gInfo.skills && gInfo.skills[skillId] &&
                                        gInfo.skills[skillId].missions &&
                                        gInfo.skills[skillId].missions.indexOf(questInfo.mission) >= 0) {
                                        if (!(skillId in studentSkillAndSubskillAverages)) {
                                            studentSkillAndSubskillAverages[skillId] = {
                                                correct: 0,
                                                attempts: 0,
                                                details: {}
                                            }
                                        }
                                        studentSkillAndSubskillAverages[skillId].correct += skillScore.correct;
                                        studentSkillAndSubskillAverages[skillId].attempts += skillScore.attempts;
                                        if (skillInfo.detail) {
                                            _.forEach(skillInfo.detail, function (detailInfo, detailId) {
                                                if (!(detailId in studentSkillAndSubskillAverages[skillId].details)) {
                                                    studentSkillAndSubskillAverages[skillId].details[detailId] = {
                                                        correct: 0,
                                                        attempts: 0
                                                    }
                                                }
                                                studentSkillAndSubskillAverages[skillId].details[detailId].correct += detailInfo.correct;
                                                studentSkillAndSubskillAverages[skillId].details[detailId].attempts += detailInfo.attempts;
                                            });
                                        }
                                    }

                                    return {
                                        "level": skillLevel,
                                        "score": skillScore,
                                        "detail": skillInfo.detail,
	                                    "attemptList": skillInfo.attemptList
                                    }
                                });
                                if (drkInfo.missionList.indexOf(questInfo.mission) > drkInfo.missionList.indexOf(latestMission)) {
                                    latestMission = questInfo.mission;
                                }
                            } else {
                                var score = {"correct":0, "attempts":0};
                                skills = _.mapValues(drkInfo.skills, function(skillName, skillId) {
                                    return {
                                        "level": _determineLevel(skillId, score, questInfo),
                                        "score": score
                                    }
                                });
                            }

                            return {
                                "mission": questInfo.mission,
                                "skillLevel": skills
                            }

                        });

                        // Compute the averages and add them to the current progress info
                        _.forEach(studentSkillAndSubskillAverages, function (skillAverageInfo, skillId) {
                            if (latestSkillScores[skillId]) {
                                latestSkillScores[skillId].average = (skillAverageInfo.correct / skillAverageInfo.attempts) * 100;
                                _.forEach(skillAverageInfo.details, function (detailAverageInfo, detailId) {
                                    if (latestSkillScores[skillId].detail && latestSkillScores[skillId].detail[detailId]) {
                                        latestSkillScores[skillId].detail[detailId].average = (detailAverageInfo.correct / detailAverageInfo.attempts) * 100;
                                    }
                                });
                            }
                        });

                        var progress = {
                            mission: latestMission,
                            skillLevel: latestSkillScores
                        };

                        var argubotsUnlocked = {};
	                    if (assessmentData &&
                            assessmentData.results &&
		                    assessmentData.results.skill &&
                            assessmentData.results.skill.argubotsUnlocked) {
		                    _.forOwn(assessmentData.results.skill.argubotsUnlocked.bots, function (questId, botId) {
		                        if (drkInfo.quests[questId]) {
			                        argubotsUnlocked[botId] = drkInfo.quests[questId].mission;
		                        }
		                    });
                        }

                        // student row
                        return {
                            'userId': userId,
                            'currentProgress': progress,
                            'missions': missionProgress,
                            'argubotsUnlocked': argubotsUnlocked
                        }
                    }.bind(this));
            }.bind(this));

            when.all(studentPromises).then(function(studentAssessments) {

                var courseSkills = _calculate_course_skill_average(studentAssessments, drkInfo);
                var courseProgress = _build_course_progress(studentAssessments, drkInfo);

                var report = {
                    "gameId": gameId,
                    "assessmentId": assessmentId,
                    "timestamp": Util.GetTimeStamp(),
                    "totalMissions": _.keys(drkInfo.quests).length,
                    "courseProgress": courseProgress,
                    "courseSkills": courseSkills,
                    "students": studentAssessments
                };

                this.requestUtil.jsonResponse(res, report);
            }.bind(this));
        }.bind(this));

    }.bind(this));
}

function _build_course_progress(studentAssessments, drkInfo) {
    var progress = {};
    _.forEach(studentAssessments, function(studentReport) {
        if (studentReport && studentReport.currentProgress && studentReport.currentProgress.mission) {
            var mission = studentReport.currentProgress.mission;
            if (!(mission in progress)) {
                progress[mission] = 0;
            }
            progress[mission] += 1;
        }
    });

    return _.map(_.values(drkInfo.quests), function(m) {
        var missionId = m.mission;
        var count = progress[missionId] || 0;
        return {
            "mission": missionId,
            "studentCount": count
        }
    });
}

function _calculate_course_skill_average(studentAssessments, drkInfo) {

    // count up students currentProgress.skillLevels
    var acc = _.mapValues(drkInfo.skills, function() {
        return _.mapValues(drkInfo.levels, function() { return 0; });
    });
    var courseSkillTotals = _.transform(studentAssessments, function(result, studentReport) {

        _.forOwn(drkInfo.skills, function(skillInfo, skillId) {
            if (studentReport && (skillId in studentReport.currentProgress.skillLevel)) {
                var level = studentReport.currentProgress.skillLevel[skillId].level;
                result[skillId][level] += 1;
            } else {
                result[skillId]['NotAttempted'] += 1;
            }

        });
        return result;

    }, acc);

    //fold NotAvailable into NotAttempted
    _.forOwn(courseSkillTotals, function(skillTotals, skillId) {
        if ('NotAvailable' in courseSkillTotals[skillId]) {
            var c = courseSkillTotals[skillId]['NotAvailable'];
            delete courseSkillTotals[skillId]['NotAvailable'];
            courseSkillTotals[skillId]['NotAttempted'] += c;
        }
    });

    return courseSkillTotals;
}
