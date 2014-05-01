
var _         = require('lodash');
var when      = require('when');
var lConst    = require('../../lms/lms.const.js');
//

module.exports = {
    getAchievements: getAchievements,
    getTotalTimePlayed: getTotalTimePlayed
};

var exampleIn = {};

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
                    return this.telmStore.getMultiUserSavedGames(userIds, gameId);
                } else {
                    this.requestUtil.errorResponse(res, {error: "invalid access"});
                }
            }.bind(this))
            .then(function(userIdGameDataMap) {
                if(userIdGameDataMap) {

                    // Look in save file for total TimePlayed
                    for(var i in userIdGameDataMap) {
                        if( userIdGameDataMap[i] &&
                            userIdGameDataMap[i].hasOwnProperty('ExplorationManager') &&
                            userIdGameDataMap[i].ExplorationManager &&
                            userIdGameDataMap[i].ExplorationManager.hasOwnProperty('ExplorationManager') &&
                            userIdGameDataMap[i].ExplorationManager.ExplorationManager &&
                            userIdGameDataMap[i].ExplorationManager.ExplorationManager.hasOwnProperty('m_totalTimePlayed') &&
                            userIdGameDataMap[i].ExplorationManager.ExplorationManager.m_totalTimePlayed )
                        {
                            userIdGameDataMap[i] = userIdGameDataMap[i].ExplorationManager.ExplorationManager.m_totalTimePlayed;
                        } else {
                            delete userIdGameDataMap[i];
                        }
                    }
                    this.requestUtil.jsonResponse(res, userIdGameDataMap);
                } else {
                    this.requestUtil.jsonResponse(res, {});
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


exampleIn.getAchievements = {
    gameId: "AA-1",
    userIds: [1, 2]
};
function getAchievements(req, res){
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

        if(!req.query.userIds) {
            this.requestUtil.errorResponse(res, {error: "missing userIds"});
            return;
        }
        if(!req.query.gameId) {
            this.requestUtil.errorResponse(res, {error: "missing gameId"});
            return;
        }

        var userIds = req.query.userIds;
        var gameId = req.query.gameId;

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
        var deviceUserIdMap = {};
        // validate users in teachers class
        this.lmsStore.isMultiUsersInInstructorCourse(userIds, loginUserSessionData.id)
            .then(function(verified) {
                if(verified) {
                    return this.telmStore.getMultiUserLastDeviceId(userIds, gameId);
                } else {
                    this.requestUtil.errorResponse(res, {error: "invalid access"});
                }
            }.bind(this))
            // User LastDeviceId
            .then(function(deviceMap) {
                // if no deviceMap skip to next
                if(!deviceMap) return;

                deviceUserIdMap = deviceMap;
                //console.log("deviceUserIdMap:", deviceUserIdMap);
                var deviceIds = _.keys(deviceUserIdMap);

                return this.telmStore.getAchievements(deviceIds);
            }.bind(this))
            .then(function(events) {
                // if no events skip to next
                if(!events) return;

                var out = { }, e, ed, tevent, userId;
                for(var i in events) {
                    e = events[i];
                    ed = e.eventData;
                    tevent = {
                        timestamp: e.serverTimeStamp,
                        gameSessionId: e.gameSessionId
                    };
                    userId = deviceUserIdMap[ e.deviceId ];

                    // if user id not in list, then init object
                    if( !out.hasOwnProperty(userId) ) {
                        out[userId] = {};
                    }

                    // per client Id (aka game Id)
                    if( !out[userId].hasOwnProperty(e.gameId) ) {
                        out[userId][e.gameId] = { groups:{}, won: 0 };
                    }

                    //
                    o = out[userId][e.gameId];
                    if( !o.groups.hasOwnProperty(ed.group) ) {
                        o.groups[ed.group] = { subGroups:{}, won: 0 };
                    }
                    if( !o.groups[ed.group].subGroups.hasOwnProperty(ed.subGroup) ) {
                        o.groups[ed.group].subGroups[ed.subGroup] = { items:{}, won: 0 };
                    }
                    if( !o.groups[ed.group].subGroups[ed.subGroup].items.hasOwnProperty(ed.item) ) {
                        o.groups[ed.group].subGroups[ed.subGroup].items[ed.item] = {};
                    }
                    // new item, update total in tree
                    if( !o.groups[ed.group].subGroups[ed.subGroup].items[ed.item].hasOwnProperty('events') ) {
                        // add events list
                        o.groups[ed.group].subGroups[ed.subGroup].items[ed.item].events = [];

                        o.won++;
                        o.groups[ed.group].won++;
                        o.groups[ed.group].subGroups[ed.subGroup].won++;
                    }

                    o.groups[ed.group].subGroups[ed.subGroup].items[ed.item].events.push(tevent);
                }

                /*
                 {
                 "deviceId": "cheese",
                 "clientTimeStamp": 1397607228,
                 "gameId": "SC-1",
                 "clientVersion": "1.2.4156",
                 "eventName": "$Achievement",
                 "eventData": {
                 "group": "CCSS.ELA-Literacy.WHST.6-8.1b",
                 "item": "Battle Hungry",
                 "subGroup": "CCSS.ELA-Literacy.WHST.6-8.1b-b"
                 },
                 "gameSessionId": "fb86aeb0-c4fb-11e3-8a1d-df7e0ec67e6c",
                 "serverTimeStamp": 1397607230
                 }
                 */
                /*
                // with totals
                var out = { }, e, ed, tevent, userId;
                for(var i in events) {
                    e = events[i];
                    userId = deviceUserIdMap[ e.deviceId ];

                    // if user id not in list, then init object
                    if( !out.hasOwnProperty(userId) ) {
                        out[userId] = {};
                    }

                    // per client Id (aka game Id)
                    if( !out[userId].hasOwnProperty(e.gameId) ) {
                        if( this.gameInfo.hasOwnProperty(e.gameId) &&
                            this.gameInfo[e.gameId].hasOwnProperty('$Achievements') ) {
                            out[userId][e.gameId] = _.cloneDeep( this.gameInfo[e.gameId]['$Achievements'] );
                        } else {
                            // skip this event because it's not in client list
                            continue;
                        }
                    }
                    //
                    o = out[userId][e.gameId];

                    ed = e.eventData;
                    tevent = {
                        timestamp: e.serverTimeStamp,
                        gameSessionId: e.gameSessionId
                    };

                    if( !o.hasOwnProperty('total') ) {
                        o.won = 0;
                        o.total = 0;
                    }
                    if( !o.groups[ed.group].hasOwnProperty('total') ) {
                        o.groups[ed.group].won = 0;
                        o.groups[ed.group].total = 0;
                    }
                    if( !o.groups[ed.group].subGroups[ed.subGroup].hasOwnProperty('total') ) {
                        o.groups[ed.group].subGroups[ed.subGroup].won = 0;
                        o.groups[ed.group].subGroups[ed.subGroup].total = 0;
                    }

                    // new item, update total in tree
                    if( !o.groups[ed.group].subGroups[ed.subGroup].items[ed.item].hasOwnProperty('events') ) {
                        // add events list
                        o.groups[ed.group].subGroups[ed.subGroup].items[ed.item].events = [];
                        o.won++;
                        o.groups[ed.group].won++;
                        o.groups[ed.group].subGroups[ed.subGroup].won++;

                        o.total++;
                        o.groups[ed.group].total++;
                        o.groups[ed.group].subGroups[ed.subGroup].total++;
                    }

                    o.groups[ed.group].subGroups[ed.subGroup].items[ed.item].events.push(tevent);
                }

                // TODO: replace this with the totals in the game info
                // add in missing totals
                for(var u in out) {
                    for(var c in out[u]) {
                        for(var g in out[u][c].groups) {
                            for(var sg in out[u][c].groups[g].subGroups) {
                                for(var i in out[u][c].groups[g].subGroups[sg].items) {
                                    if( !out[u][c].groups[g].subGroups[sg].items[i].hasOwnProperty('events') ) {
                                        out[u][c].total++;
                                        out[u][c].groups[g].total++;
                                        out[u][c].groups[g].subGroups[sg].total++;
                                    }
                                }
                            }
                        }
                    }
                }
                */

                //console.log("getAchievements out:", out);
                this.requestUtil.jsonResponse(res, out);
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
