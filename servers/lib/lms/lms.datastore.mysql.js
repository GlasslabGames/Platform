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
var MySQL, Util;

module.exports = LMS_MySQL;

function LMS_MySQL(options){
    // Glasslab libs
    MySQL  = require('../core/datastore.mysql.js');
    Util   = require('../core/util.js');

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

LMS_MySQL.prototype.connect = function(serviceManager){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // migrate/update table
    this.updateCourseTable(serviceManager)
        .then(function(updated){
            if(updated) {
                console.log("LMS MySQL: Updated Course Table!");
            }
            return updated;
        }.bind(this))

        .then(function(updated){
            if(updated) {
                console.log("LMS MySQL: Updated Games Table!");
            }
            resolve();
        }.bind(this),
        function(err){
            reject(err);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


LMS_MySQL.prototype.updateCourseTable = function(serviceManager) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

var Q = "DESCRIBE GL_COURSE";
this.ds.query(Q)
    .then(function(results) {
        var updating = false;
        for(var i = 0; i < results.length; i++) {
            if( (results[i]['Field'] == 'institution_id') &&
                (results[i]['Null'] == 'NO') ) {

                updating = true;
                // need to update
                var Q = "ALTER TABLE `GL_COURSE` CHANGE COLUMN `institution_id` `institution_id` BIGINT(20) NULL";
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


var exampleOut = {};
exampleOut.getEnrolledCourses =
[
    {
        "id": 27,
        "dateCreated": 123456789,
        "title": "Test",
        "grade": "7",
        "archived": false,
        "archivedDate": null,
        "institution": 18,
        "code": "18ZBD",
        "studentCount": 1,
        "lockedRegistration": false
    }
];
LMS_MySQL.prototype.getEnrolledCourses = function(userId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q =
        "SELECT         \
            c.id,       \
            UNIX_TIMESTAMP(c.date_created) as dateCreated, \
            c.title,    \
            c.grade,    \
            c.archived > 0 as archived,  \
            c.locked > 0 as lockedRegistration,      \
            (SELECT code FROM GL_CODE WHERE course_id=c.id) as code,    \
            IFNULL((SELECT COUNT(course_id) FROM GL_MEMBERSHIP WHERE role='student' AND course_id=c.id GROUP BY course_id), 0) as studentCount,    \
            c.archived_Date as archivedDate,    \
            c.institution_id as institution     \
        FROM GL_COURSE c JOIN GL_MEMBERSHIP m ON c.id=m.course_id \
        WHERE m.user_id="+ this.ds.escape(userId)+
        " ORDER BY c.date_created";

    this.ds.query(Q)
        .then(function(results) {
                for(var i = 0; i < results.length; i++) {
                    results[i].archived = results[i].archived ? true : false;
                    results[i].lockedRegistration = results[i].lockedRegistration   ? true : false;

                    // convert string to array
                    results[i].grade = this._splitGrade(results[i].grade);

                    // normalize archive dates
                    results[i].archivedDate = Util.GetTimeStamp(results[i].archivedDate);
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
                results.locked   = results.locked   ? true : false;

                // convert string to array
                results.grade = this._splitGrade(results.grade);

                // normalize archive dates
                results.archivedDate = Util.GetTimeStamp(results.archivedDate);

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
            u.system_role as role \
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

LMS_MySQL.prototype.getTeacherOfCourse = function(courseId) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var Q =
            "SELECT     \
                u.id,   \
                u.first_name as firstName,  \
                u.last_name as lastName     \
            FROM GL_USER u JOIN  GL_MEMBERSHIP m on u.id = m.user_id    \
            WHERE m.role='instructor' AND  \
            m.course_id="+ this.ds.escape(courseId);

        this.ds.query(Q)
            .then(function(results) {
                if(results && results.length > 0){
                    resolve(results[0]);
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

LMS_MySQL.prototype.getCourseInfoFromCourseCode = function(courseCode) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var Q =
            "SELECT         \
                c.title,    \
                c.grade,    \
                c.locked > 0 as locked,      \
                c.archived > 0 as archived,  \
                c.archived_Date as archivedDate, \
                c.institution_id as institution, \
                u.first_name as firstName, \
                u.last_name as lastName \
            FROM GL_CODE co \
            JOIN GL_COURSE c on co.course_id=c.id \
            JOIN GL_MEMBERSHIP m on m.course_id=c.id AND m.role=\"instructor\" \
            JOIN GL_USER u on u.id=m.user_id \
            WHERE co.code="+ this.ds.escape(courseCode);

        this.ds.query(Q)
            .then(function(results) {
                if(results.length > 0) {
                    results = results[0];
                    results.archived = results.archived ? true : false;
                    results.locked   = results.locked   ? true : false;

                    // move teacher info inside object
                    results.teacher = {
                        firstName: results.firstName,
                        lastName: results.lastName
                    };
                    delete results.firstName;
                    delete results.lastName;

                    // convert string to array
                    results.grade = this._splitGrade(results.grade);

                    // normalize archive dates
                    results.archivedDate = Util.GetTimeStamp(results.archivedDate);

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

// convert grades delim string to array
LMS_MySQL.prototype._splitGrade = function(grade) {
    // remove all space
    grade = grade.replace(/\s+/g, '');
    // auto split grade into array
    grade = grade.split(",");

    return grade;
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
                    resolve( (results.length > 0) ? true :  false);
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


LMS_MySQL.prototype.isMultiUsersInInstructorCourse = function(userIds, instructorId) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var Q;
        Q = "SELECT \
                DISTINCT user_id as userId  \
            FROM GL_MEMBERSHIP              \
            WHERE                           \
                ROLE='student' AND course_id in \
                (SELECT                 \
                    course_id           \
                FROM GL_MEMBERSHIP      \
                WHERE                   \
                    ROLE='instructor'   \
                    AND user_id=";
        Q += parseInt(instructorId);
        Q += ") ORDER BY user_id";

        this.ds.query(Q)
            .then(function(results) {
                if(results){

                    var userIdList = {};
                    for(var i = 0; i < results.length; i++) {
                        userIdList[ results[i].userId ] = true;
                    }

                    for(var i = 0; i < userIds.length; i++) {
                        if(! userIdList[ userIds[i] ] ) {
                            // missing
                            resolve(false);
                        }
                    }

                    resolve(true);

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

// Enroll
LMS_MySQL.prototype.addUserToCourse = function(userId, courseId, role) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // if manager, make role in members instructor
    if( role == lConst.role.manager) {
        role = lConst.role.instructor;
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


LMS_MySQL.prototype.getUserCourses = function(userId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    if(!userId) {
        reject({"error": "failure", "exception": "invalid userId"}, 500);
        return;
    }

    var Q =
        "SELECT \
            c.id,\
            m.role as role,\
            c.title, \
            (SELECT COUNT(course_id) FROM GL_MEMBERSHIP WHERE role='student' AND \
                course_id=c.id \
            GROUP BY course_id) as studentCount \
        FROM \
            GL_MEMBERSHIP m \
            INNER JOIN GL_COURSE as c ON m.course_id=c.id \
        WHERE \
            user_id=" + this.ds.escape(userId);

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

LMS_MySQL.prototype.createCourse = function(userId, title, grade, institutionId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

        // if institutionId not set then set it to zero
        if(!institutionId) {
            institutionId = "NULL";
        } else {
            institutionId = parseInt(institutionId);
        }

        if(_.isArray(grade)) {
            grade = grade.join(',');
        }

        title = this.ds.escape(title);

        var values = [
            "NULL",  // id
            0,       // version
            0,       // archived
            "NULL",  // archived date
            "NULL",  // code
            "NOW()", // date created
            0,       // free play
            this.ds.escape(grade),    // grade
            institutionId,            // institution id
            "NOW()",                  // last updated
            0,                        // locked
            title                     // title
        ];
        values = values.join(',');

        var Q;
        Q = "INSERT INTO GL_COURSE (" +
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
            ") ";

        // if institutionId == NULL unique constraint will not apply so we need to check it
        if(institutionId == "NULL") {
            Q += "SELECT "+values+" FROM GL_COURSE ";
            // check if course name already exists for null institution_id's
            Q += "WHERE NOT EXISTS " +
                "(SELECT c.id FROM GL_COURSE c JOIN GL_MEMBERSHIP m on c.id = m.course_id WHERE m.role='instructor' AND ";
            Q += "c.title="+title+" AND m.user_id="+parseInt(userId)+") LIMIT 1";
        } else {
            Q += "VALUES("+values+")";
        }

        //console.log("createCourse Q:", Q);
        this.ds.query(Q)
            .then(function(data){
                    if(data.affectedRows == 0) {
                        reject({key:"course.notUnique.name"}, 400);
                    } else {
                        resolve(data.insertId);
                    }
                }.bind(this),
                function(err) {
                    if(err.code == "ER_DUP_ENTRY") {
                        reject({key:"course.notUnique.name"}, 400);
                    } else {
                        reject({"error": "failure", "exception": err}, 500);
                    }
                }.bind(this)
            );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

LMS_MySQL.prototype.updateCourseInfo = function(userId, courseData) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    courseData.id = parseInt(courseData.id);

    if(!courseData.institutionId) {
        courseData.institutionId = "NULL";
    } else {
        courseData.institutionId = parseInt(courseData.institutionId);
    }

    if(_.isArray(courseData.grade)) {
        courseData.grade = courseData.grade.join(",");
    }

    // normalize archive dates
    courseData.archivedDate = parseInt(courseData.archivedDate);
    courseData.archivedDate = Util.GetTimeStamp(courseData.archivedDate);

    // verify userId is instructor of course
    var Q = "SELECT c.id FROM GL_COURSE c JOIN GL_MEMBERSHIP m on c.id = m.course_id WHERE m.role='instructor' AND ";
    Q += "c.id="+courseData.id+" AND m.user_id="+parseInt(userId);
    //console.log("getCourses Q:", Q);
    this.ds.query(Q).then(function(data){
            if(data.length) {
                var Q = "UPDATE GL_COURSE " +
                    "SET last_updated=NOW(), " +
                    "title="+this.ds.escape(courseData.title)+", "+
                    "grade="+this.ds.escape(courseData.grade)+", ";

                if(courseData.archived) {
                    Q += "archived=true, archived_date="+courseData.archivedDate+", ";
                } else {
                    Q += "archived=false, archived_date=NULL, ";
                }
                if(courseData.hasOwnProperty('locked')) {
                    // convert bool to int
                    courseData.locked = (courseData.locked) ? 1 : 0;
                    Q += "locked="+this.ds.escape(courseData.locked)+", ";
                }

                Q += "institution_Id="+courseData.institutionId+" "+
                    "WHERE id="+courseData.id;

                //console.log("updateCourse Q:", Q);
                this.ds.query(Q).then(resolve, reject);
            } else {
                reject({key:"course.notUnique.name"}, 400);
            }
        }.bind(this),
        reject
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

    var Q = "SELECT * FROM GL_MEMBERSHIP" +
        " WHERE user_Id="+this.ds.escape(userId) +
        " AND course_Id="+this.ds.escape(courseId);

    //console.log("Q:", Q);
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

LMS_MySQL.prototype.isEnrolledInInstructorCourse = function(studentId, instructorId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q =
        "SELECT " +
        "m1.* " +
        "FROM " +
        "GL_MEMBERSHIP m1 " +
        "JOIN " +
        "(SELECT course_id FROM GL_MEMBERSHIP WHERE user_id="+this.ds.escape(instructorId)+") m2 on m1.course_id=m2.course_id " +
        "WHERE " +
        "m1.role='student' AND " +
        "m1.user_id="+this.ds.escape(studentId);

    this.ds.query(Q)
        .then(
        function(data){
            if( !data ||
                !_.isArray(data) ||
                data.length < 1) {
                reject({"error": "user not found"}, 404);
                return;
            }

            resolve(data);
        }.bind(this),
        function(err) {
            reject({"error": "failure", "exception": err}, 500);
        }.bind(this)
    );
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

LMS_MySQL.prototype.getCourseIdsFromUserId = function(userId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "SELECT course_id as courseId FROM GL_MEMBERSHIP \
             WHERE role=\"instructor\" AND \
                   user_id="+this.ds.escape(userId);

    this.ds.query(Q)
        .then(function(results) {
            if(results){
                resolve( _.pluck(results, 'courseId') );
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