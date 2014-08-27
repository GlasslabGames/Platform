

module.exports = {
    LongName:    "Admin",
    ServiceName: "admin",
    Controller: {
        config:  require('./admin/controller/config.js')
    },
    Service: require('./admin/admin.service.js')
}
