/**
 * WebStore Module
 * Module dependencies:
 *
 */
// Glasslab libs
var MySQL    = require('./datastore.mysql.js');

module.exports = WebStore;

function WebStore(settings){
    this.settings = settings;

    this.ds = new MySQL(this.settings.datastore);
    // Connect to data store
    this.ds.testConnection();
}

WebStore.prototype.getCourses = function(id, cb) {
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
            user_id=" + id;

    this.ds.query(getCourses_Q, function(err, data){
        var courses = data;
        //console.log("getCourses courses:", courses);
        cb(err, courses);
    });
};

