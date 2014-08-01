/**
 * Telemetry MySQL Datastore Module
 *
 * Module dependencies:
 *  lodash - https://github.com/lodash/lodash
 *  when   - https://github.com/cujojs/when
 *
 */
// Third-party libs
var _    = require('lodash');
var when = require('when');
// load at runtime
var MySQL, tConst, Util;

module.exports = TelemDS_Mysql;

function TelemDS_Mysql(options){
    // Glasslab libs
    Util   = require('../core/util.js');
    MySQL  = require('../core/datastore.mysql.js');
    tConst = require('./data.const.js');

    this.options = _.merge(
        {
            "host"    : "localhost",
            "user"    : "root",
            "password": "",
            "database": ""
        },
        options
    );

    this.ds = new MySQL(this.options);
}

TelemDS_Mysql.prototype.connect = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // migrate/update table
    this.updateSessionTable()
        .then(function(updated){
            if(updated) {
                console.log("Data MySQL: Updated Session Table!");
            }
        }.bind(this))

        .then(resolve, reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


TelemDS_Mysql.prototype.updateSessionTable = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "DESCRIBE GL_SESSION";
    this.ds.query(Q)
        .then(function(results) {
            var updating = false;
            var exist = false;
            for(var i = 0; i < results.length; i++) {
                if (results[i]['Field'] == 'game_id') {
                    exist = true;
                }
            }

            // game_id column not exist then add it with default 'SC'
            if(!exist) {
                updating = true;
                // need to update
                var Q = "ALTER TABLE `GL_SESSION` ADD COLUMN `game_id` VARCHAR(32) NOT NULL DEFAULT 'SC' AFTER `user_id`";
                this.ds.query(Q)
                    .then(function(results) {
                        //console.log(results);
                        resolve(true);
                    }.bind(this),
                    function(err) {
                        reject({"error": "failure", "exception": err}, 500);
                    }.bind(this)
                );
            }

            if(!updating) {
                resolve(false);
            }
        }.bind(this),
        function(err) {
            reject({"error": "failure", "exception": err}, 500);
        }.bind(this)
    );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


TelemDS_Mysql.prototype.saveEvents = function(jdata){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var Q = "";
    var qInsertData = [];

    for(var i in jdata.events){
        var row = [
            "NULL",
            0,
            this.ds.escape(JSON.stringify(jdata.events[i].eventData)),
            "NOW()",
            this.ds.escape(jdata.gameVersion || ""),
            this.ds.escape(jdata.gameSessionId),
            "NOW()",
            this.ds.escape(jdata.events[i].name),
            "UNIX_TIMESTAMP()",
            this.ds.escape(jdata.userId)
        ];
        qInsertData.push( "("+row.join(",")+")" );
    }

    Q = "INSERT INTO GL_ACTIVITY_EVENTS (" +
        "id," +
        "version," +
        "data," +
        "date_created," +
        "game," +
        "game_session_id," +
        "last_updated," +
        "name," +
        "timestamp," +
        "user_id" +
        ") VALUES ";
    Q += qInsertData.join(",");
    //console.log('Q:', Q);

    this.ds.query(Q).then(resolve, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Mysql.prototype.getGameSessionWithGameSection = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var Q = "SELECT session_id, activity_id FROM GL_SESSION WHERE activity_id IS NOT NULL";
    //console.log('Q:', Q);

    this.ds.query(Q)
        .then(
            function(result){
                if(result.length > 0) {
                    // extract 'GAME_SESSION_ID' key value from results array with each row an object
                    var data = {};
                    for(var i = 0; i < result.length; i++){
                        data[result[i]['session_id']] = result[i]['activity_id'];
                    }

                    resolve( data );
                } else {
                    resolve( );
                }
            }.bind(this),
            reject
        );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Mysql.prototype.getAllUserSessions = function() {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var Q = "SELECT s.user_id as userId, s.session_id as gameSessionId, s.game_id as gameId \
                FROM GL_SESSION s \
                WHERE s.ACTIVITY_ID IS NOT NULL";

        this.ds.query(Q)
            .then(
            function(results){
                resolve(results);
            }.bind(this),
            function(err) {
                reject({"error": "failure", "exception": err}, 500);
            }.bind(this)
        );
// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

/*
// deviceId & userId optional
 example output:
 [
     {
         "userId": 12,
         "serverTimeStamp": 1392775453,
         "clientTimeStamp": 1392775453,
         "gameId": "SC-1",
         "clientVersion": "1.2.4156",
         "gameLevel": "397255e0-fee0-11e2-ab09-1f14110c1a8d",
         "gameSessionId": "34c8e488-c6b8-49f2-8f06-97f19bf07060",
         "eventName": "$ScenarioScore",
         "eventData": {
             "float key": 1.23,
             "int key": 1,
             "string key": "asd"
         }
     },
     {
         "userId": 12,
         "serverTimeStamp": 1392775453,
         "clientTimeStamp": 1392775453,
         "gameId": "SC",
         "clientVersion": "1.2.4156",
         "gameLevel": "Mission2.SubMission1",
         "gameSessionId": "34c8e488-c6b8-49f2-8f06-97f19bf07060",
         "eventName": "CustomEvent",
         "eventData": {
             "float key": 1.23,
             "int key": 1,
             "string key": "asd"
         }
     }
 ]

 // userId is optional
*/
TelemDS_Mysql.prototype.getArchiveEvents = function(limit){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        if(!limit) {
            limit = 1000;
        }

        var Q = "SELECT "
            + "ae.id, ae.user_id, ae.game_session_id, ae.date_created, ae.timestamp, ae.name, ae.game, ae.data "
            + "FROM GL_ACTIVITY_EVENTS_ARCHIVE ae "
            + "WHERE ae.version >= 0 LIMIT "+this.ds.escape(limit);
        //console.log('Q:', Q);

        this.ds.query(Q)
            .then(
                function(result){
                    if(result.length > 0) {
                        var data = [];
                        var ids  = [];
                        var edata;

                        for(var i = 0; i < result.length; i++) {
                            try{
                                edata = JSON.parse(result[i].data);
                            } catch(err) {
                                // could not parse data
                                edata = result[i].data;
                            }

                            var gameParts = result[i].game.split("_");
                            var clientVersion = "";
                            var gameId = "";
                            if(gameParts.length > 2) {
                                clientVersion = gameParts.pop();
                                gameId        = gameParts.join("_");
                            } else if(gameParts.length == 2) {
                                clientVersion = gameParts[1];
                                gameId        = gameParts[0];
                            } else if(gameParts.length == 1) {
                                clientVersion = gameParts[0];
                                gameId        = gameParts[0];
                            }

                            /*
                             {
                                 "userId": 12,
                                 "serverTimeStamp": 1392775453,
                                 "clientTimeStamp": 1392775453,
                                 "gameId": "SC",
                                 "clientVersion": "1.2.4156",
                                 "gameLevel": "Mission2.SubMission1",
                                 "gameSessionId": "34c8e488-c6b8-49f2-8f06-97f19bf07060",
                                 "eventName": "CustomEvent",
                                 "eventData": {
                                     "float key": 1.23,
                                     "int key": 1,
                                     "string key": "asd"
                                 }
                             }
                             */

                            data.push({
                                id:              result[i].id,
                                userId:          parseInt(result[i].user_id),
                                serverTimeStamp: Util.GetTimeStamp(result[i].date_created),
                                clientTimeStamp: result[i].timestamp,
                                clientVersion:   clientVersion,
                                gameId:          gameId,
                                gameLevel:       "",
                                gameSessionId:   result[i].game_session_id,
                                eventName:       result[i].name,
                                eventData:       edata
                            });

                            ids.push(result[i].id);
                        }

                        //console.log("data.events.length:", data.events.length);
                        resolve({events: data, ids: ids});
                    } else {
                        resolve();
                        return;
                    }
                }.bind(this),
                reject
            );

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};


TelemDS_Mysql.prototype.getArchiveEventsLastId = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var Q = "SELECT MAX(id) as maxid FROM GL_ACTIVITY_EVENTS_ARCHIVE WHERE version >= 0";
    //console.log('Q:', Q);

    this.ds.query(Q)
        .then(
            function(result){
                //console.log("result:", result);
                if(result[0].maxid) {
                    resolve(result[0].maxid);
                } else {
                    resolve();
                }
            }.bind(this),
            reject
        );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


TelemDS_Mysql.prototype.getArchiveEventsBySession = function(gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var Q = "SELECT "
        + "ae.id, ae.user_id, ae.game_session_id, ae.timestamp, ae.name, ae.game, ae.data, s.activity_id as gameLevel "
        + "FROM GL_ACTIVITY_EVENTS_ARCHIVE ae JOIN GL_SESSION s on s.session_id = ae.game_session_id "
        + "WHERE ae.version >= 0 AND ae.game_session_id="+this.ds.escape(gameSessionId);
    //console.log('Q:', Q);

    this.ds.query(Q)
        .then(
            function(result){
                if(result.length > 0) {
                    var data = [];
                    var edata;

                    for(var i = 0; i < result.length; i++) {
                        try{
                            edata = JSON.parse(result[i].data);
                        } catch(err) {
                            // could not parse data
                            edata = result[i].data;
                        }

                        var gameParts = result[i].game.split("_");
                        var clientVersion = "";
                        var gameId = "";
                        if(gameParts.length > 2) {
                            clientVersion = gameParts.pop();
                            gameId        = gameParts.join("_");
                        } else if(gameParts.length == 2) {
                            clientVersion = gameParts[1];
                            gameId        = gameParts[0];
                        } else if(gameParts.length == 1) {
                            clientVersion = gameParts[0];
                            gameId        = gameParts[0];
                        }

                        data.push({
                            clientTimeStamp: result[i].timestamp,
                            clientVersion:   clientVersion,
                            gameId:          gameId,
                            gameLevel:       result[i].gameLevel,
                            gameSessionId:   result[i].gameSessionId,
                            eventName:       result[i].name,
                            eventData:       edata,

                            userId: parseInt(result[i].user_id)
                        });
                    }

                    //console.log("data.events.length:", data.events.length);
                    resolve(data);
                } else {
                    reject(new Error("no events found"));
                    return;
                }
            }.bind(this),
            reject
        );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};



TelemDS_Mysql.prototype.disableArchiveEvents = function(ids){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        var Q = "UPDATE GL_ACTIVITY_EVENTS_ARCHIVE SET version=-1 WHERE id IN ("+ids.join(',')+")";
        //console.log('Q:', Q);

        this.ds.query(Q).then( resolve, reject );

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

TelemDS_Mysql.prototype.startGameSession = function(userId, courseId, gameLevel){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // create session ID
    var gameSessionId = Util.CreateUUID();
    var values = [
        "NULL",
        0,
        this.ds.escape(gameLevel),
        this.ds.escape(courseId),
        "NOW()",
        "NULL",
        "NOW()",
        "NULL",
        this.ds.escape(gameSessionId),
        "UNIX_TIMESTAMP()",
        this.ds.escape(userId)
    ];
    values = values.join(',');

    var Q = "INSERT INTO GL_SESSION (" +
        "id," +
        "version," +
        "activity_id," +
        "course_id," +
        "date_created," +
        "end_time," +
        "last_updated," +
        "reason_ended," +
        "session_id," +
        "start_time," +
        "user_id" +
        ") VALUES("+values+")";

    this.ds.query(Q)
        .then(
            function(){
                resolve(gameSessionId);
            }.bind(this),
            reject
        );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Mysql.prototype.cleanUpOldGameSessions = function(userId, gameLevel){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    if(!userId) {
        reject({"error": "failure", "exception": "invalid userId"}, 500);
        return;
    }
    if(!gameLevel) {
        reject({"error": "failure", "exception": "invalid gameLevel"}, 500);
        return;
    }

    var Q = "UPDATE GL_SESSION" +
        " SET" +
        "  end_time=UNIX_TIMESTAMP()," +
        "  reason_ended="+this.ds.escape(tConst.game.session.cleanup) +
        " WHERE" +
        "  user_id="+this.ds.escape(userId)+" AND" +
        "  activity_id="+this.ds.escape(gameLevel)+" AND" +
        "  end_time IS NULL";

    this.ds.query(Q).then( resolve, reject );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Mysql.prototype.endGameSession = function(gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "UPDATE GL_SESSION" +
        " SET" +
        "  end_time=UNIX_TIMESTAMP()," +
        "  reason_ended="+this.ds.escape(tConst.game.session.ended) +
        " WHERE" +
        "  session_id="+this.ds.escape(gameSessionId);

    this.ds.query(Q).then( resolve, reject );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


TelemDS_Mysql.prototype.getConfigs = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "SELECT * FROM GL_CONFIG";
    this.ds.query(Q)
        .then(
            function(data){
                //console.log("data:", data);
                var config = {};
                var n, v, nv;
                // build config from list
                for(var i in data){
                    n = data[i].NAME;
                    v = data[i].VALUE;

                    // convert string to number
                    nv = parseFloat(v);
                    // if string was a number then set value to converted
                    if( !isNaN(nv) ) { v = nv; }

                    config[n] = v;
                }
                //console.log("config:", config);

                resolve(config);
            }.bind(this),
            reject
        );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


TelemDS_Mysql.prototype.getSessionsByUserId = function(userId) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var Q = "SELECT session_id as sessionId FROM GL_SESSION WHERE activity_id IS NOT NULL AND user_id="+userId;
        this.ds.query(Q)
            .then(
                function(data) {
                    resolve( _.pluck(data, 'sessionId') );
                }.bind(this),
                reject
            );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


TelemDS_Mysql.prototype.getSessionInfo = function(gameSessionId){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var Q = "SELECT activity_id as activityId, course_id as courseId, user_id as userId FROM GL_SESSION WHERE" +
            "  session_id="+this.ds.escape(gameSessionId);

        this.ds.query(Q)
            .then(
            function(result){
                if(result[0]) {
                    resolve(result[0]);
                } else {
                    resolve();
                }
            }.bind(this),
            reject
        );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

// TODO: replace GL_COMPETENCY_RESULTS with a new table
TelemDS_Mysql.prototype.saveCompetencyResults = function(courseId, userId, compData){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        // create session ID
        var values = [
            "NULL",
            0,
            parseInt(compData.numAttempts), // numAttempts
            parseInt(courseId),
            this.ds.escape("POINTID"),
            this.ds.escape(compData.competencyType), // competency type
            "NOW()",
            this.ds.escape(compData.info), // info
            "NOW()",
            parseInt(compData.level), // competency level
            this.ds.escape(compData.studentFeedbackCode), // student feedback
            this.ds.escape(compData.teacherFeedbackCode), // teacher feedback
            this.ds.escape(compData.timeSpentSec), // time spent secs
            this.ds.escape(userId)
        ];
        values = values.join(',');

        var Q = "INSERT INTO GL_COMPETENCY_RESULTS (" +
            "id," +
            "version," +
            "num_attempts," +
            "course_id," +
            "c_point," +
            "c_type," +
            "date_created," +
            "info," +
            "last_updated," +
            "level," +
            "student_feedback_code," +
            "teacher_feedback_code," +
            "time_spent_secs," +
            "user_id" +
            ") VALUES("+values+")";

        this.ds.query(Q).then(resolve, reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};
