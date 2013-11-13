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
      batchGetMax: 10,
      telemetryPollDelay: 1000,
      batchInPollDelay:   1000,
      cleanupPollDelay:   5*60*1000, // 5 min
      sessionExpire:      5*60*1000  // 5 min
  }
};
