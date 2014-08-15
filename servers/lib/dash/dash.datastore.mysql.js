/**
 * WebStore Module
 * Module dependencies:
 *  lodash - https://github.com/lodash/lodash
 *  when   - https://github.com/cujojs/when
 *
 */
// Third-party libs
var _     = require('lodash');
var when  = require('when');
// load at runtime
var MySQL, waConst, lConst;

module.exports = WebStore_MySQL;

var exampleIn = {}, exampleOut = {};

function WebStore_MySQL(options){
    // Glasslab libs
    MySQL   = require('../core/datastore.mysql.js');
    lConst  = require('../lms/lms.const.js');
    waConst = require('./dash.const.js');

    this.options = _.merge(
        {
            host    : "localhost",
            user    : "glasslab",
            password: "glasslab",
            database: "glasslab_dev"
        },
        options
    );

    this.ds = new MySQL(this.options);
}


WebStore_MySQL.prototype.connect = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    resolve();
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


var exampleOutput = {};
exampleOutput.getUserInfo = {
    "id": 175,
    "username": "test2_s1",
    "lastName": "test2_s1",
    "firstName": "test2_s1",
    "email": "",
    "role": "student",
    "type": null,
    "institution": 10,
    "collectTelemetry": false,
    "enabled": true,
    "courses":
        [
            {
                "id": 8,
                "title": "test2",
                "role": "student",
                "studentCount": 0
            }
        ]
};
WebStore_MySQL.prototype.getUserInfoById = function(id) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        if(!id) {
            reject({"error": "failure", "exception": "invalid userId"}, 500);
            return;
        }

        var Q =
            "SELECT     \
                id,   \
                username,                  \
                first_name as firstName,   \
                last_name as lastName,     \
                email,                     \
                system_role as role, \
                user_type as type,         \
                institution_id as institution, \
                collect_Telemetry > 0 as collectTelemetry, \
                enabled > 0 as enabled, \
                login_Type as loginType \
            FROM GL_USER  \
            WHERE id="+ this.ds.escape(id);

        this.ds.query(Q)
            .then(function(results) {
                if(results.length > 0) {
                    results = results[0];
                    results.collectTelemetry = results.collectTelemetry ? true : false;
                    results.enabled          = results.enabled ? true : false;
                    resolve(results);
                } else {
                    reject({"error": "none found"}, 500);
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


WebStore_MySQL.prototype.createChallengeSubmission = function(data) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    if(!data.challengeId) {
        resolve();
        return;
    }

    try{
        data.assessment  = data.assessment  ? JSON.stringify(data.assessment)  : "";
        data.connections = data.connections ? JSON.stringify(data.connections) : "";
        data.objects     = data.objects     ? JSON.stringify(data.objects)     : "";
    } catch (err) {
        reject(err);
        return;
    }

    // insert into DB
    var values = [
        "NULL",
        0,
        this.ds.escape(data.assessment),
        this.ds.escape(data.challengeId),
        this.ds.escape(data.connections),
        "NOW()",
        this.ds.escape(data.gameSessionId),
        "NOW()",
        this.ds.escape(data.objects),
        this.ds.escape(data.type)
    ];
    values = values.join(",");
    var Q = "INSERT INTO GL_CHALLENGE_SUBMISSION (" +
        "id," +
        "version," +
        "assessment," +
        "challenge_id," +
        "connections," +
        "date_created," +
        "game_session_id," +
        "last_updated," +
        "objects," +
        "type" +
        ") VALUES("+values+")";

    this.ds.query(Q).then(resolve, reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}


WebStore_MySQL.prototype.createActivityResults = function(gameSessionId, userId, courseId, gameLevel) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

// insert into DB
    var values = [
        "NULL",
        0,
        this.ds.escape(gameLevel), // aka activityId
        this.ds.escape(courseId),
        "NULL",
        "NOW()",
        this.ds.escape(gameSessionId),
        "NOW()",
        "NULL", // end time
        "UNIX_TIMESTAMP()", // start time
        "NULL", // score
        "NULL", // note
        this.ds.escape(waConst.activityResult.status.new), // status
        "NULL", // student feedback code
        "NULL", // teacher feedback code
        this.ds.escape(userId)
    ];
    values = values.join(",");
    var Q = "INSERT INTO GL_ACTIVITY_RESULTS (\
        id,\
        version,\
        activity_id,\
        course_id,\
        data,\
        date_created,\
        game_session_id,\
        last_updated,\
        end_time,\
        start_time,\
        score,\
        note,\
        status,\
        student_feedback_code,\
        teacher_feedback_code,\
        user_id\
        ) VALUES("+values+")";

    this.ds.query(Q).then(resolve, reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

WebStore_MySQL.prototype.updateActivityResults = function(gameSessionId, stars, cancelled) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // if cancelled set status to canceled
    var status = (cancelled) ? waConst.activityResult.status.cancelled : waConst.activityResult.status.live;

    var Q = "UPDATE GL_ACTIVITY_RESULTS" +
        " SET" +
        "   last_updated=NOW()" +
        "  ,end_time=UNIX_TIMESTAMP()" +
        "  ,status="+this.ds.escape(status) +
        "  ,score="+this.ds.escape(stars) +
        " WHERE" +
        "  game_session_id="+this.ds.escape(gameSessionId);

    this.ds.query(Q).then(resolve, reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


exampleOut.getLicensedGameIdsFromUserId = {
    "SC": true
};
WebStore_MySQL.prototype.getLicensedGameIdsFromUserId = function(userId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "SELECT DISTINCT(game_id) as gameId \
             FROM GL_LICENSE l  \
             JOIN GL_LICENSE_MAP lm on lm.license_id=l.id \
             WHERE user_id \
               IN (SELECT DISTINCT(user_id) as userId \
                  FROM GL_MEMBERSHIP \
                  WHERE course_id \
                    IN (SELECT course_id \
                        FROM GL_MEMBERSHIP \
                        WHERE user_id="+this.ds.escape(userId);
        Q += ") AND role='instructor')";

    //console.log("Q:", Q);
    this.ds.query(Q).then(function(results) {
            if(results.length > 0) {
                var gameIds = {};
                for(var i = 0; i < results.length; i++) {
                    // gameId is not case sensitive, always lowercase
                    gameIds[ results[i].gameId.toUpperCase() ] = true;
                }

                resolve( gameIds );
            } else {
                resolve({});
            }
        }.bind(this)
        , reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


exampleOut.getGameSettingsFromCourseId = {
    "SC": { "missionProgressLock": false },
    "AA-1": {},
    "AW-1": {}
};
WebStore_MySQL.prototype.getGameSettingsFromCourseId = function(courseId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "SELECT game_id as gameId, game_settings as gameSettings" +
        " FROM GL_COURSE_GAME_MAP" +
        " WHERE course_id="+this.ds.escape(courseId);

    //console.log("Q:", Q);
    this.ds.query(Q).then(function(results) {
            if(results.length > 0) {
                var gameSettings = {};
                for(var i = 0; i < results.length; i++) {
                    try {
                        // gameId is not case sensitive, always lowercase
                        gameSettings[ results[i].gameId.toUpperCase() ] = JSON.parse(results[i].gameSettings);
                    } catch(err) {
                        // invalid json
                        console.error("WebStore_MySQL getGameSettingsFromCourseId: Error -", err);
                        gameSettings[ results[i].gameId.toUpperCase() ] = {};
                    }
                }

                resolve( gameSettings );
            } else {
                resolve([]);
            }
        }.bind(this)
        , reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

// TODO: use a new table with gameId column
// return missions map with "missionId" as key and "endTime" value
WebStore_MySQL.prototype.getCompletedMissions = function(userId, courseId, gameId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "SELECT activity_id as mission, end_time as endTime" +
        " FROM GL_ACTIVITY_RESULTS" +
        " WHERE status='live'" +
        " AND score > 0" +
        " AND user_id=" + this.ds.escape(userId) +
        " AND course_id=" + this.ds.escape(courseId) +
        " ORDER BY end_time";

    //console.log("Q:", Q);
    this.ds.query(Q).then(function(results) {
            if(results.length > 0) {
                var missions = {};
                for(var i = 0; i < results.length; i++) {
                    missions[ results[i].mission ] = results[i].endTime;
                }
                resolve( missions );
            } else {
                resolve([]);
            }
        }.bind(this)
        , reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


WebStore_MySQL.prototype.getDistinctGames = function(userId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "SELECT DISTINCT(gm.game_id) as gameId FROM \
            GL_COURSE_GAME_MAP gm \
            JOIN (SELECT * FROM GL_MEMBERSHIP \
                WHERE role=\"instructor\" AND user_id="+this.ds.escape(userId)+" \
            ) m on m.course_id=gm.course_id";

    //console.log("Q:", Q);
    this.ds.query(Q).then(function(results) {
            if(results.length > 0) {
                var gameIdList = [];
                for(var i = 0; i < results.length; i++) {
                    gameIdList.push( results[i].gameId.toUpperCase() );
                }

                resolve( gameIdList );
            } else {
                resolve([]);
            }
        }.bind(this)
        , reject);

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};