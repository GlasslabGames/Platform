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
var MySQL, waConst, aConst;

module.exports = WebStore_MySQL;

function WebStore_MySQL(options){
    // Glasslab libs
    MySQL   = require('./datastore.mysql.js');
    waConst = require('./webapp.const.js');
    aConst  = require('./auth.const.js');

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
    // Connect to data store
    this.ds.testConnection();
}

WebStore_MySQL.prototype.getCourses = function(id, cb) {
    var getCourses_Q =
        "SELECT \
            c.id,\
            m.role,\
            c.title, \
            (SELECT COUNT(course_id) FROM GL_MEMBERSHIP WHERE role='student' AND \
                course_id=c.id \
            GROUP BY course_id) as studentCount \
        FROM \
            GL_MEMBERSHIP m \
            INNER JOIN GL_COURSE as c ON m.course_id=c.id \
        WHERE \
            user_id=" + this.ds.escape(id);

    this.ds.query(getCourses_Q, function(err, data){
        var courses = data;
        //console.log("getCourses courses:", courses);
        cb(err, courses);
    });
};

WebStore_MySQL.prototype.getInstitutionIdFromCourse = function(courseId) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var Q = "SELECT id, institution_id as institutionId FROM GL_COURSE WHERE id=" + this.ds.escape(courseId);
        this.ds.query(Q, function(err, data){
            if(err) {
                reject({"error": "failure", "exception": err}, 500);
                return;
            }
            resolve(data);
        });

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

WebStore_MySQL.prototype.getInstitution = function(institutionId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "SELECT * FROM GL_INSTITUTION WHERE id=" + this.ds.escape(institutionId);
    this.ds.query(Q, function(err, data){
        if(err) {
            reject({"error": "failure", "exception": err}, 500);
            return;
        }
        resolve(data);
    });

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


WebStore_MySQL.prototype.addUserToCourse = function(courseId, userId, role) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // if manager, make role in memebers instructor
    if(role == aConst.role.manager) {
        role = aConst.role.instructor;
    }

    var values = [
        "NULL",  // id
        0,       // version
        this.ds.escape(courseId),
        "NOW()", // date created
        "NOW()", // last updated
        this.ds.escape(role),
        this.ds.escape(userId)
    ];
    values = values.join(',');

    var Q = "INSERT INTO GL_MEMBERSHIP (" +
        "id," +
        "version," +
        "course_id," +
        "date_created," +
        "last_updated," +
        "role," +
        "user_id" +
        ") VALUES("+values+")";

    this.ds.query(Q, function(err, data){
        if(err) {
            reject({"error": "failure", "exception": err}, 500);
            return;
        }
        resolve(data.insertId);
    });

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

    this.ds.query(Q, function(err){
        if(err) {
            reject(err);
            return;
        }
        resolve();
    });

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}

WebStore_MySQL.prototype.createActivityResults = function(gameSessionId, userId, courseId, gameType) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

// insert into DB
    var values = [
        "NULL",
        0,
        this.ds.escape(gameType), // aka activityId
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

    this.ds.query(Q, function(err){
        if(err) {
            reject(err);
            return;
        }
        resolve();
    });

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
    this.ds.query(Q, function(err) {
        if(err) {
            reject(err);
            return;
        }
        resolve();
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

WebStore_MySQL.prototype.getConfigs = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "SELECT * FROM GL_CONFIG";
    this.ds.query(Q, function(err, data) {
        if(err) {
            reject(err);
            return;
        }

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
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};
