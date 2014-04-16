
var _         = require('lodash');
var when      = require('when');
//

module.exports = {
    getAchievements: getAchievements
};

function getAchievements(req, res){
    try {
        if( req.session &&
            req.session.passport &&
            req.session.passport.user &&
            req.session.passport.user.id) {
            var userData = req.session.passport.user;

            this.authStore.getLastUserDeviceId(userData.id)
                .then(function(deviceId){
                    return this.telmStore.getAchievements(deviceId);
                }.bind(this))
                .then(function(events){

                    /*
                     {
                         "deviceId": "cheese",
                         "clientTimeStamp": 1397607228,
                         "clientId": "SC-1",
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

                    // with totals
                    var out = { }, e, ed, tevent;
                    for(var i in events) {
                        e = events[i];

                        // per client Id (aka game Id)
                        if( !out.hasOwnProperty(e.clientId) ) {
                            if( this.gameInfo.hasOwnProperty(e.clientId) &&
                                this.gameInfo[e.clientId].hasOwnProperty('$Achievements') ) {
                                out[e.clientId] = _.cloneDeep( this.gameInfo[e.clientId]['$Achievements'] );
                            } else {
                                // skip this event because it's not in client list
                                continue;
                            }
                        }
                        //
                        o = out[e.clientId];

                        ed = e.eventData;
                        tevent = {
                            timestamp: e.serverTimeStamp,
                            gameSessionId: e.gameSessionId
                        };

                        if( !o.hasOwnProperty('total') ) {
                            o.received = 0;
                            o.total = 0;
                        }
                        if( !o.groups[ed.group].hasOwnProperty('total') ) {
                            o.groups[ed.group].received = 0;
                            o.groups[ed.group].total = 0;
                        }
                        if( !o.groups[ed.group].subGroups[ed.subGroup].hasOwnProperty('total') ) {
                            o.groups[ed.group].subGroups[ed.subGroup].received = 0;
                            o.groups[ed.group].subGroups[ed.subGroup].total = 0;
                        }

                        // new item, update total in tree
                        if( !o.groups[ed.group].subGroups[ed.subGroup].items[ed.item].hasOwnProperty('events') ) {
                            // add events list
                            o.groups[ed.group].subGroups[ed.subGroup].items[ed.item].events = [];
                            o.received++;
                            o.groups[ed.group].received++;
                            o.groups[ed.group].subGroups[ed.subGroup].received++;

                            o.total++;
                            o.groups[ed.group].total++;
                            o.groups[ed.group].subGroups[ed.subGroup].total++;
                        }

                        o.groups[ed.group].subGroups[ed.subGroup].items[ed.item].events.push(tevent);
                    }

                    // TODO: replace this with the totals in the game info
                    // add in missing totals
                    for(var c in out) {
                        for(var g in out[c].groups) {
                            for(var sg in out[c].groups[g].subGroups) {
                                for(var i in out[c].groups[g].subGroups[sg].items) {
                                    if( !out[c].groups[g].subGroups[sg].items[i].hasOwnProperty('events') ) {
                                        out[c].total++;
                                        out[c].groups[g].total++;
                                        out[c].groups[g].subGroups[sg].total++;
                                    }
                                }
                            }
                        }
                    }

                    //console.log("getAchievements out:", out);
                    this.requestUtil.jsonResponse(res, out);
                }.bind(this))

                // error
                .then(null, function(err){
                    this.requestUtil.errorResponse(res, err);
                }.bind(this));
        } else {
            this.requestUtil.errorResponse(res, {error: "not logged in"});
        }

    } catch(err) {
        console.trace("Reports: Get Achievements Error -", err);
        this.stats.increment("error", "GetAchievements.Catch");
    }
}
