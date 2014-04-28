/**
 * Telemetry Consts
 *
 */

module.exports = {
  type: {
      game:      'game',
      challenge: 'challenge'
  },
  validate: {
      api: {
          session: '/api/session/validate'
      }
  },
  game: {
      session: {
          started: 'started',
          ended:   'ended',
          cleanup: 'cleanup'
      },
      dataKey:    'gd',
      saveKey:    'save',
      countKey:   'count',
      gameSessionKey: 'gs',
      eventKey:   'e',
      eventsKey:  'events',
      scoreKey:   'GL_Scenario_Score',
      versions:   require('./data.const.game_versions')
  },
  webapp: {
      api: '/api',
      startsession: '/startsession',
      endsession:   '/endsession',
      assessment:   '/game/assessment/'
  }
};
