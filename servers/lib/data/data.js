/**
 * Data Module
 *
 *
 */
module.exports = {
    LongName:    "Data",
    ServiceName: "data",
    Controller: {
        config:  require('./controller/config.js'),
        session: require('./controller/session.js'),
        events:  require('./controller/events.js'),
        game:    require('./controller/game.js'),
        user:    require('./controller/user.js'),
        // internal route
        _queueSession: require('./controller/_queueSession.js'),
        _gameSession:  require('./controller/_gameSession.js'),
        _events:       require('./controller/_events.js')
    },
    Service: require('./data.service.js'),
    Const:   require('./data.const.js'),

    Datastore: {
        MySQL:     require('./data.datastore.mysql.js'),
        Couchbase: require('./data.datastore.couchbase.js')
    }
}
