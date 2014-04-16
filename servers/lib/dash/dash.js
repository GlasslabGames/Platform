/**
 * Dashboard Module
 *
 *
 */
module.exports = {
    LongName:    "Dashboard",
    ServiceName: "dash",
    Controller: {
        reports:  require('./controller/reports.js'),
        game:  require('./controller/game.js')
    },
    Service:     require('./dash.service.js'),
    Const:       require('./dash.const.js'),

    Datastore: {
        MySQL:   require('./dash.datastore.mysql.js')
    },

    Games: {
        'SC-1': require('./gameinfo/sc-1.json'),
        'AA-1': require('./gameinfo/aa-1.json')
    }
}
