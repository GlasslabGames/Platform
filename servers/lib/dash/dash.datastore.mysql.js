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
                system_role as systemRole, \
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
