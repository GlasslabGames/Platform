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
      telemetryGetMax: 1,
      batchGetMax: 1,
      telemetryPollDelay: 1000,
      batchInPollDelay:   1000,
      assessmentDelay:    1000,
      cleanupPollDelay:   1*60*60*1000, // 1 hour
      sessionExpire:      4*60*60*1000  // 4 hours
  }
};
