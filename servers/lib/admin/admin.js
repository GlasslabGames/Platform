/**
 * Admin Module
 *
 *
 */
module.exports = {
    LongName:    "Admin",
    ServiceName: "admin",
    Controller: {
        config:  require('./controller/config.js')
    },
    Service: require('./admin.service.js')
}
