/**
 * Telemetry Config
 *
 */

module.exports = {
  telemetryKey: "t",
  metaKey:      "m",
  batchKey:     "b",
  inKey:        "i",
  activeKey:    "a",

  dispatch: {
      telemetryGetMax: 10,
      batchGetMax: 100,
      telemetryPollDelay: 500,
      batchInPollDelay:   500,
      cleanupPollDelay:   1*60*60*1000, // 1 hour
      sessionExpire:      4*60*60*1000  // 4 hours
  }
};
