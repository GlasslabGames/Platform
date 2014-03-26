/**
 * LMS Module
 * Module dependencies:
 *  lodash - https://github.com/lodash/lodash
 *  when   - https://github.com/cujojs/when
 *
 */
// Third-party libs
var _     = require('lodash');
var when  = require('when');
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
LMS_MySQL.prototype.getEnrolledCourses = function(id) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    if(!id) {
        reject({"error": "failure", "exception": "invalid userId"}, 500);
        return;
    }

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
        WHERE m.user_id="+ this.ds.escape(id);

    this.ds.query(Q)
        .then(function(results) {
                for(var i = 0; i < results.length; i++) {
                    results[i].archived = results[i].archived ? true : false;
                    results[i].freePlay = results[i].freePlay ? true : false;
                    results[i].locked   = results[i].locked ? true : false;
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


LMS_MySQL.prototype.getStudentsOfCourse = function(id) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    if(!id) {
        reject({"error": "failure", "exception": "invalid userId"}, 500);
        return;
    }

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
        m.course_id="+ this.ds.escape(id);

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
