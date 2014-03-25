/**
 * LMS Module
 *
 *
 */
module.exports = {
    LongName:    "Learning Management System",
    ServiceName: "lms",
    Controller: {
        course:  require('./controller/course.js')
    },
    Service: require('./lms.service.js'),
    Const:   require('./lms.const.js'),

    Datastore: {
        MySQL:  require('./lms.datastore.mysql.js')
    }
}
