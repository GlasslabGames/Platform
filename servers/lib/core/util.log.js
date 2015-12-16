
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

function consoleExtArgs (args) {
  var newArgs = [args[0] + "]"];
  for (var i = 1, n = args.length; i < n; i++){
    newArgs[i] = args[i];
  }
  return newArgs;
}

console.Console.prototype.logExt = function() {
    if (arguments.length > 0) {
        this.log.apply(this, consoleExtArgs(arguments));
    }
};

console.Console.prototype.infoExt = function() {
    if (arguments.length > 0) {
        this.info.apply(this, consoleExtArgs(arguments));
    }
};

console.Console.prototype.warnExt = function() {
    if (arguments.length > 0) {
        this.warn.apply(this, consoleExtArgs(arguments));
    }
};

console.Console.prototype.errorExt = function() {
    if (arguments.length > 0) {
        this.error.apply(this, consoleExtArgs(arguments));
    }
};
