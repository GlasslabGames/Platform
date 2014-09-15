/**
 * Dashboard Module
 *
 *
 */
module.exports = {
    LongName:    "Dashboard",
    ServiceName: "dash",
    Controller: {
        game:     require('./controller/game.js'),
        games:    require('./controller/games.js'),
        reports:  require('./controller/reports.js'),
        // internal routes
        _game:     require('./controller/_game.js'),
        _reports:  require('./controller/_reports.js')
    },
    Service:     require('./dash.service.js'),
    Const:       require('./dash.const.js'),

    Datastore: {
        MySQL:   require('./dash.datastore.mysql.js')
    }
}
