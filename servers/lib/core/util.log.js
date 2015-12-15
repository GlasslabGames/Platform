
var moment    = require('moment');

module.exports = LogUtil;

var logPrefix = { log: "LOG]", info: "INFO]", warn: "WARN]", error: "ERROR]" };
var logCounts = { log: 0, info: 0, warn: 0, error: 0 };

function LogUtil() {
    ["log", "info", "warn", "error"].forEach(function(method) {
        var oldMethod = console[method].bind(console);
        console[method] = function() {
            var args = [moment().utc().format("YYYY-MM-DD HH:mm:ss"), logPrefix[method]];
            args.push.apply(args, arguments);
            oldMethod.apply(
                console,
                args
            );
            logCounts[method]++;
        };
    });
}

LogUtil.prototype.getLogCounts = function() {
    return logCounts;
};
