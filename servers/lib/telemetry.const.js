/**
 * Telemetry Consts
 *
 */

module.exports = {
  telemetryKey: 't',
  metaKey:      'm',
  batchKey:     'b',
  inKey:        'i',
  activeKey:    'a',
  start:        'start',
  end:          'end',
  type: {
      game: 'game',
      challenge: 'challenge'
  },
  validate: {
      api: {
          session: '/api/session/validate'
      }
  },
  webapp: {
      api: '/api',
      startsession: '/startsession',
      endsession:   '/endsession',
      assessment:   '/game/assessment/'
  }
};
