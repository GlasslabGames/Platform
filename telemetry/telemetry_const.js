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
      telemetryGetMax: 20,
      batchGetMax: 100,
      telemetryPollDelay: 1000,
      batchInPollDelay:   5000,
      assessmentDelay:    1*30*1000,
      cleanupPollDelay:   1*60*60*1000, // 1 hour
      sessionExpire:      4*60*60*1000  // 4 hours
  }
};
