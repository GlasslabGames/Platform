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
          ended:   "ended",
          cleanup: "cleanup"
      },
      dataKey:    "gd",
      countKey:   "count",
      eventKey:   "e",
      eventsKey:  "events",
      scoreKey:   "GL_Scenario_Score",
      versions:   require('./telemetry.const.game_versions')
  },
  webapp: {
      api: '/api',
      startsession: '/startsession',
      endsession:   '/endsession',
      assessment:   '/game/assessment/'
  }
};
