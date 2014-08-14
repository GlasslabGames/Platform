
var _         = require('lodash');
var when      = require('when');
var lConst    = require('../../lms/lms.const.js');
//

module.exports = {
    getAchievements:    getAchievements,
    getSOWO:            getSOWO,
    getCompetency:      getCompetency,
    getTotalTimePlayed: getTotalTimePlayed
};

var exampleIn = {}, exampleOut = {};

// http://localhost:8001/api/v2/dash/reports/sowo?gameId=AA-1&courseId=93
exampleIn.getSOWO = {
    gameId: "AA-1",
    courseId: 1
};
exampleOut.getSOWO = [

];
function getSOWO(req, res) {
    if(!req.query.courseId) {
        this.requestUtil.errorResponse(res, {error: "missing userIds"});
        return;
    }
    var courseId = req.query.courseId;
    if(!req.query.gameId) {
        this.requestUtil.errorResponse(res, {error: "missing gameId"});
        return;
    }
    var gameId = req.query.gameId;
    var assessmentId = "sowo";

    // get user list in class
    // TODO: use service route
    this.lmsStore.getStudentsOfCourse(courseId)
        .then(function(users){
            // shortcut no users
            if(!users) return;

            var outList = [];
            var userMap = {};
            var promistList = [];

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
                         var outAssessmentData = _.cloneDeep(assessmentData);

                         // TODO: replace this with promise
                         // find assessment by ID
                         var assessment = this.getGameAssessmentInfo(gameId);

                         for(var i = 0; i < assessment.length; i++) {
                             if(assessment[i].id == assessmentId) {
                                 // merge in sowo info from game assessment info

                                 // output is array not object
                                 outAssessmentData.results.shoutout = [];
                                 // shoutout rules
                                 for(var j in assessmentData.results.shoutout) {
                                     var so = assessmentData.results.shoutout[j];
                                     // don't need to expose the gameSessionId
                                     delete so.gameSessionId;
                                     so.id = j;

                                     outAssessmentData.results.shoutout.push( _.merge(
                                         so,
                                         assessment[i].rules[ j ] )
                                     );
                                    //console.log("shoutout:", assessmentData.results.shoutout[j]);
                                 }

                                 // output is array not object
                                 outAssessmentData.results.watchout = [];
                                 // watchout rules
                                 for(var j in assessmentData.results.watchout) {
                                     var wo = assessmentData.results.watchout[j];
                                     // don't need to expose the gameSessionId
                                     delete wo.gameSessionId;
                                     wo.id = j;

                                     outAssessmentData.results.watchout.push( _.merge(
                                         wo,
                                         assessment[i].rules[ j ] )
                                     );

                                     //console.log("shoutout:", assessmentData.results.watchout[j]);
                                 }

                                 // done!
                                 break;
                             }
                         }

                         outList.push(outAssessmentData);
                    }.bind(this));

                promistList.push(p);
            }.bind(this));


            when.all(promistList)
                .then(function(){
                    // all done
                    this.requestUtil.jsonResponse(res, outList);
                }.bind(this));
        }.bind(this));
}


exampleIn.getCompetency = {
    gameId: "AA-1",
    courseId: 1
};
function getCompetency(req, res) {
    this.requestUtil.jsonResponse(res, {});
}


// http://localhost:8001/api/v2/dash/reports/achievements?gameId=AA-1&courseId=93
exampleIn.getAchievements = {
    gameId: "AA-1",
    courseId: 93
};
exampleOut.getAchievements = [
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
function getAchievements(req, res) {
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

        if(!req.query.courseId) {
            this.requestUtil.errorResponse(res, {error: "missing userIds"});
            return;
        }
        if(!req.query.gameId) {
            this.requestUtil.errorResponse(res, {error: "missing gameId"});
            return;
        }

        var courseId = parseInt(req.query.courseId);
        var gameId = req.query.gameId;
        // gameId is not case sensitive
        gameId = gameId.toUpperCase();

        //console.log("userIds:", userIds);
        // validate users in teachers class
        this.lmsStore.isUserInCourse(loginUserSessionData.id, courseId)
            .then(function(verified) {
                if(verified) {
                    return this.lmsStore.getStudentsOfCourse(courseId);
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
                //console.log("playerInfoList:", playerInfoList);

                for(var userId in playerInfoList) {
                    var info = playerInfoList[userId];
                    //console.log("info:", info);

                    var userAchievements = {
                        userId: userId,
                        achievements: [],
                        totalTimePlayed: info.totalTimePlayed || 0
                    };

                    userAchievements.achievements = this.getListOfAchievements(gameId, info.achievement);
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

    } catch(err) {
        console.trace("Reports: Get Achievements Error -", err);
        this.stats.increment("error", "GetAchievements.Catch");
    }
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

                                                console.log("totalTimePlayed from SaveGame - userId:", userId, ", totalTimePlayed:", totalTimePlayed);
                                                // ensure it's a float and make it seconds
                                                totalTimePlayed = parseFloat(gameData.ExplorationManager.ExplorationManager.m_totalTimePlayed);
                                            }

                                            return totalTimePlayed;
                                        }
                                    }.bind(this))
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
                    this.requestUtil.errorResponse(res, {error: "invalid access"});
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
