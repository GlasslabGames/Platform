/**
 * Telemetry Consts
 *
 */

module.exports = {
    type: {
        game: 'game',
        challenge: 'challenge'
    },
    validate: {
        api: {
            session: '/api/session/validate'
        }
    },
    aeng: {
        key: "ae",
        resultsKey: "r"
    },
    game: {
        session: {
            started: 'started',
            ended: 'ended',
            cleanup: 'cleanup'
        },
        dataKey: 'gd',
        deviceKey: 'd',
        saveKey: 'save',
        prefKey: 'pref',
        playInfoKey: 'play',
        countKey: 'count',
        gameSessionKey: 'gs',
        eventKey: 'e',
        dsInfoKey: 'dataSchemaInfo',
        eventsKey: 'events',
        scoreKey: 'GL_Scenario_Score',
        versions: require('./data.const.game_versions')
    },
    webapp: {
        api: '/api',
        startsession: '/startsession',
        endsession: '/endsession',
        assessment: '/game/assessment/'
    }
};
