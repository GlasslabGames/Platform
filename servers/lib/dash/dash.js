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
        game:     require('./controller/game.js'),
        games:    require('./controller/games.js')
    },
    Service:     require('./dash.service.js'),
    Const:       require('./dash.const.js'),

    Datastore: {
        MySQL:   require('./dash.datastore.mysql.js')
    }
}
