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


LMS_MySQL.prototype.updateCourseTable = function() {
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
            m.role as role,\
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
                        reject({"error":"data validation","key":"course.not.unique"}, 400);
                    } else {
                        resolve(data.insertId);
                    }
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

LMS_MySQL.prototype.updateCourse = function(userId, courseData) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var title = this.ds.escape(courseData.title);

        var promise;
        if(!courseData.institutionId) {
            courseData.institutionId = "NULL";

            var Q = "SELECT c.id FROM GL_COURSE c JOIN GL_MEMBERSHIP m on c.id = m.course_id WHERE m.role='instructor' AND ";
            Q += "c.id!="+courseData.id+" AND c.title="+title+" AND m.user_id="+parseInt(userId);

            //console.log("getCourses Q:", Q);
            promise = this.ds.query(Q);
        } else {
            courseData.institutionId = parseInt(courseData.institutionId);
            promise = this.Utils.PromiseContinue();
        }

        promise.then(function(data){
                if(data.length == 0) {
                    var Q = "UPDATE GL_COURSE " +
                        "SET last_updated=NOW(), " +
                        "title="+title+", "+
                        "grade="+this.ds.escape(courseData.grade)+", ";
                    if(courseData.archived) {
                        Q += "archived=true, archived_date="+parseInt(courseData.archivedDate)+", ";
                    } else {
                        Q += "archived=false, archived_date=NULL, ";
                    }
                    Q += "institution_Id="+courseData.institutionId+" "+
                        "WHERE id="+courseData.id;

                    //console.log("updateCourse Q:", Q);
                    this.ds.query(Q).then(resolve);
                } else {
                    reject({"error":"data validation","key":"course.not.unique"}, 400);
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
