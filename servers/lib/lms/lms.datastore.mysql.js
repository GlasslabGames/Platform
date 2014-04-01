/**
 * LMS Module
 * Module dependencies:
 *  lodash - https://github.com/lodash/lodash
 *  when   - https://github.com/cujojs/when
 *
 */
// Third-party libs
var _      = require('lodash');
var moment = require('moment');
var when   = require('when');
var lConst = require('./lms.const.js');

// load at runtime
var MySQL;

module.exports = LMS_MySQL;

function LMS_MySQL(options){
    // Glasslab libs
    MySQL   = require('../core/datastore.mysql.js');

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

LMS_MySQL.prototype.connect = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    resolve();
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

var exampleOut = {};
exampleOut.getCourses =
[
    {
        "id": 27,
        "title": "Test",
        "grade": "7",
        "locked": false,
        "archived": false,
        "archivedDate": null,
        "institution": 18,
        "code": "18ZBD",
        "studentCount": 1,
        "freePlay": false
    }
];
LMS_MySQL.prototype.getEnrolledCourses = function(userId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q =
        "SELECT         \
            c.id,       \
            c.title,    \
            c.grade,    \
            c.locked > 0 as locked,      \
            c.archived > 0 as archived,  \
            c.free_Play > 0 as freePlay, \
            (SELECT code FROM GL_CODE WHERE course_id=c.id) as code,    \
            IFNULL((SELECT COUNT(course_id) FROM GL_MEMBERSHIP WHERE role='student' AND course_id=c.id GROUP BY course_id), 0) as studentCount,    \
            c.archived_Date as archivedDate,    \
            c.institution_id as institution     \
        FROM GL_COURSE c JOIN GL_MEMBERSHIP m ON c.id=m.course_id \
        WHERE m.user_id="+ this.ds.escape(userId);

    this.ds.query(Q)
        .then(function(results) {
                for(var i = 0; i < results.length; i++) {
                    results[i].archived = results[i].archived ? true : false;
                    results[i].freePlay = results[i].freePlay ? true : false;
                    results[i].locked   = results[i].locked   ? true : false;
                }

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


LMS_MySQL.prototype.getCourse = function(couserId) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var Q =
            "SELECT         \
                c.id,       \
                c.title,    \
                c.grade,    \
                c.locked > 0 as locked,      \
                c.archived > 0 as archived,  \
                c.free_Play > 0 as freePlay, \
                (SELECT code FROM GL_CODE WHERE course_id=c.id) as code,    \
                IFNULL((SELECT COUNT(course_id) FROM GL_MEMBERSHIP WHERE role='student' AND course_id=c.id GROUP BY course_id), 0) as studentCount,    \
                c.archived_Date as archivedDate,    \
                c.institution_id as institution     \
            FROM GL_COURSE c JOIN GL_MEMBERSHIP m ON c.id=m.course_id \
            WHERE c.id="+ this.ds.escape(couserId);

        this.ds.query(Q)
            .then(function(results) {
                if(results.length > 0) {
                    results = results[0];
                    results.archived = results.archived ? true : false;
                    results.freePlay = results.freePlay ? true : false;
                    results.locked   = results.locked   ? true : false;

                    resolve(results);
                } else {
                    resolve();
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

LMS_MySQL.prototype.getStudentsOfCourse = function(courseId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q =
        "SELECT     \
            u.id,   \
            u.first_name as firstName,  \
            u.last_name as lastName,    \
            u.username,                 \
            u.email,                    \
            u.system_role as systemRole \
        FROM GL_USER u JOIN  GL_MEMBERSHIP m on u.id = m.user_id    \
        WHERE m.role='student' AND  \
        m.course_id="+ this.ds.escape(courseId);

    this.ds.query(Q)
        .then(resolve,
            function(err) {
                reject({"error": "failure", "exception": err}, 500);
            }.bind(this)
        );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


LMS_MySQL.prototype.removeUserFromCourse = function(userId, courseId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var Q =
        "DELETE FROM GL_MEMBERSHIP WHERE "+
            "user_id="+ this.ds.escape(userId)+" AND "+
            "course_id="+this.ds.escape(courseId);

    this.ds.query(Q)
        .then(resolve,
            function(err) {
                reject({"error": "failure", "exception": err}, 500);
            }.bind(this)
        );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


LMS_MySQL.prototype.getCourseIdFromCourseCode = function(courseCode) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q =
        "SELECT course_id FROM GL_CODE WHERE code="+ this.ds.escape(courseCode);

    this.ds.query(Q)
        .then(function(results) {
            if(results && results.length > 0){
                resolve(results[0].course_id);
            } else {
                resolve();
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


LMS_MySQL.prototype.getInstitutionIdFromCourseCode = function(courseCode) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var Q =
            "SELECT course.institution_id as institutionId " +
                "FROM GL_COURSE course INNER JOIN GL_CODE co ON course.id=co.course_id " +
                "WHERE co.code="+ this.ds.escape(courseCode);

        this.ds.query(Q)
            .then(function(results) {
                if(results && results.length > 0){
                    resolve(results[0].institutionId);
                } else {
                    resolve();
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


LMS_MySQL.prototype.isUserInCourse = function(userId, courseId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q =
        "SELECT id FROM GL_MEMBERSHIP WHERE "+
            "user_id="+ this.ds.escape(userId)+" AND "+
            "course_id="+this.ds.escape(courseId);

    this.ds.query(Q)
        .then(function(results) {
                if(results){
                    resolve(results.length > 0);
                } else {
                    reject({"error": "failure", "exception": err}, 500);
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


LMS_MySQL.prototype.addUserToCourse = function(userId, courseId, systemRole) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // if manager, make role in members instructor
    if( systemRole == lConst.role.manager) {
        systemRole = lConst.role.instructor;
    }

    var values = [
        "NULL",  // id
        0,       // version
        this.ds.escape(courseId),
        "NOW()", // date created
        "NOW()", // last updated
        this.ds.escape(systemRole),
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

    this.ds.query(Q)
        .then(
            function(data){
                resolve(data.insertId);
            }.bind(this),
            function(err) {
                reject({"error": "failure", "exception": err}, 500);
            }.bind(this)
        );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


LMS_MySQL.prototype.getUserCourses = function(id) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    if(!id) {
        reject({"error": "failure", "exception": "invalid userId"}, 500);
        return;
    }

    var Q =
        "SELECT \
            c.id,\
            m.role as systemRole,\
            c.title, \
            (SELECT COUNT(course_id) FROM GL_MEMBERSHIP WHERE role='student' AND \
                course_id=c.id \
            GROUP BY course_id) as studentCount \
        FROM \
            GL_MEMBERSHIP m \
            INNER JOIN GL_COURSE as c ON m.course_id=c.id \
        WHERE \
            user_id=" + this.ds.escape(id);

    this.ds.query(Q)
        .then(resolve,
            function(err) {
                reject({"error": "failure", "exception": err}, 500);
            }.bind(this)
        );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

LMS_MySQL.prototype.getInstitutionIdFromCourse = function(courseId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "SELECT id, institution_id as institutionId FROM GL_COURSE WHERE id=" + this.ds.escape(courseId);
    this.ds.query(Q)
        .then(resolve,
            function(err) {
                reject({"error": "failure", "exception": err}, 500);
            }.bind(this)
        );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

LMS_MySQL.prototype.getInstitution = function(institutionId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "SELECT * FROM GL_INSTITUTION WHERE id=" + this.ds.escape(institutionId);
    this.ds.query(Q)
        .then(resolve,
            function(err) {
                reject({"error": "failure", "exception": err}, 500);
            }.bind(this)
        );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

LMS_MySQL.prototype.createCourse = function(title, grade, institutionId) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var values = [
            "NULL",  // id
            0,       // version
            0,       // archived
            "NULL",  // archived date
            "NULL",  // code
            "NOW()", // date created
            0,       // free play
            this.ds.escape(grade),    // grade
            parseInt(institutionId),  // institution id
            "NOW()",                  // last updated
            0,                        // locked
            this.ds.escape(title)     // title
        ];
        values = values.join(',');

        var Q = "INSERT INTO GL_COURSE (" +
            "id," +
            "version," +
            "archived," +
            "archived_date," +
            "code," +
            "date_created," +
            "free_play," +
            "grade," +
            "institution_id," +
            "last_updated," +
            "locked," +
            "title" +
            ") VALUES("+values+")";

        this.ds.query(Q)
            .then(function(data){
                    resolve(data.insertId);
                }.bind(this),
                function(err) {
                    if(err.code == "ER_DUP_ENTRY") {
                        reject({"error":"data validation","key":"course.not.unique"}, 400);
                    } else {
                        reject({"error": "failure", "exception": err}, 500);
                    }
                }.bind(this)
            );

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

LMS_MySQL.prototype.addCode = function(code, id, type) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var values = [
            "NULL",  // id
            0,       // version
            this.ds.escape(code),    // code
            (type == lConst.code.type.course)      ? parseInt(id) : "NULL", // courseId
            "NOW()", // date created
            1,       // enabled
            (type == lConst.code.type.institution) ? parseInt(id) : "NULL", // institution id
            "NOW()", // last updated
            this.ds.escape(type)    // type
        ];
        values = values.join(',');

        var Q = "INSERT INTO GL_CODE (" +
            "id," +
            "version," +
            "code," +
            "course_Id," +
            "date_created," +
            "enabled," +
            "institution_id," +
            "last_updated," +
            "type" +
            ") VALUES("+values+")";

        this.ds.query(Q)
            .then(function(data){
                resolve(data.insertId);
            }.bind(this),
                function(err) {
                    reject({"error": "failure", "exception": err}, 500);
                }.bind(this)
            );

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};


LMS_MySQL.prototype.isEnrolledInCourse = function(userId, courseId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "SELECT * FROM GL_MEMBERSHIP " +
        "WHERE user_Id="+this.ds.escape(userId) +
        "AND course_Id="+this.ds.escape(courseId);

    this.ds.query(Q)
        .then(function(results) {
                if(results.length > 0) {
                    resolve();
                } else {
                    reject({"error": "user not found"}, 500);
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


LMS_MySQL.prototype.updateCourse = function(courseData) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var Q = "UPDATE GL_COURSE " +
        "SET last_updated=NOW(), " +
        "title="+this.ds.escape(courseData.title)+", "+
        "grade="+this.ds.escape(courseData.grade)+", ";
    if(courseData.archived) {
        Q += "archived=true, archived_date="+parseInt(courseData.archivedDate)+", ";
    } else {
        Q += "archived=false, archived_date=NULL, ";
    }
    Q += "institution_Id="+this.ds.escape(courseData.institutionId)+" "+
         "WHERE id="+courseData.id;

    this.ds.query(Q).then( resolve, reject );
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};