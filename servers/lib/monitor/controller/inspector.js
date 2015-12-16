
var path      = require('path');
var _         = require('lodash');
var when      = require('when');
var moment    = require('moment');
var os        = require('os');
var memwatch = require('memwatch-next');

//var request   = require('request');
var mConst    = require('../monitor.const.js');
var Util      = require('../../core/util.js');
var MySQL  = require('../../core/datastore.mysql.js');

module.exports = {
    runMonitor: runMonitor,
    monitorInfo: monitorInfo
};


var runningMonitor = false;
var memWatchActive = false;
var lastLeakInfo = null;

// used by monitor to test another monitor/archiver active
function monitorInfo(req, res){
    //console.log("monitorInfo");

    if (!memWatchActive) {
        memWatchActive = true;
        memwatch.on('leak', function(info) {
            lastLeakInfo = info;
        });
    }
    
    //memwatch.gc(); // used to test receiving stats events
    
    var data = {
        logCounts: this.serviceManager.logUtil.getLogCounts(),
        cpuAverage: os.loadavg(),
        cpuCount: os.cpus().length,
        memoryUsage: process.memoryUsage(),
        leakInfo: lastLeakInfo,
    };

    lastLeakInfo = null;

    this.requestUtil.jsonResponse(res, data);
}

// changes runningMonitor state to true, starting monitor if not active
function runMonitor(req, res){
    //console.log("runMonitor");

    if( !(req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length) ) {
        // if has no code
        this.requestUtil.errorResponse(res, {key:"monitor.access.invalid"}, 401);
        return;
    }

    if ( !(this.options.monitor &&
        this.options.monitor.alert &&
        this.options.monitor.alert.email) ) {
        // if has email setup
        console.errorExt("MonitorService", "Email for alert not configured");
        this.requestUtil.errorResponse(res, {key:"monitor.misconfigured"}, 401);
        return;
    }

    // code saved as a constant. discuss how we want the code to be saved.
    if( req.params.code !== mConst.code ) {
        // If the code is not valid
        this.requestUtil.errorResponse(res, {key:"monitor.access.invalid"}, 401);
        return;
    } else if(runningMonitor === true){
        // If archive running, inform that archive is in progress and return. no duplicate archive job
        this.requestUtil.jsonResponse(res, {status:"inspection already in progress"});
        return;
    } else{
        // runningArchive state is false. change to true
        runningMonitor = true;
        //console.log("runningMonitor = true");
    }

    var allErrors = [];

    couchBaseStatus.call(this)
    .then(function(result) {
        if (result.status !== "good") {
            //console.log(result.system, "reported alert");
            allErrors.push("----- " + result.system + " -----");
            allErrors.push.apply(allErrors, result.messages);
        }

        return mysqlStatus.call(this);
    }.bind(this))
    .then(function(result) {
        if (result.status !== "good") {
            //console.log(result.system, "reported alert");
            allErrors.push("----- " + result.system + " -----");
            allErrors.push.apply(allErrors, result.messages);
        }

        if (this.options.monitor &&
            this.options.monitor.tests &&
            this.options.monitor.tests.logger) {
          
            var promiseList = [];
        
            var hosts = _.cloneDeep(this.options.monitor.tests.logger.host);
            if (typeof hosts === 'string') {
                hosts = [hosts];
            }
            var protocol = this.options.monitor.tests.logger.protocol;

            hosts.forEach(function (host) {
                promiseList.push(loggerStatus.call(this, protocol + "://" + host));
            }.bind(this));

            return when.all(promiseList);
        }

        console.warnExt("MonitorService", "missing config data for logger servers");
        return when.reject({ errmsg: "missing config data", code: 400 });
    }.bind(this))
    .then(function(results) {
        results.forEach(function(result) {
            if (result.status !== "good") {
                //console.log(result.system, "reported alert");
                allErrors.push("----- " + result.system + " -----");
                allErrors.push.apply(allErrors, result.messages);
            }
        }.bind(this));
 
        if (this.options.monitor &&
            this.options.monitor.tests &&
            this.options.monitor.tests.app) {

            var promiseList = [];
            var app = this.options.monitor.tests.app
            for (var name in app) {
                if (app.hasOwnProperty(name)) {
                    server = app[name];
                    if (!server.skip) {
                        var hosts = _.cloneDeep(server.host);
                        if (typeof hosts === 'string') {
                            hosts = [hosts];
                        }
                        if (name === 'external') {
                            hosts.forEach(function (host) {
                                promiseList.push(externalServerStatus.call(this,
                                    server.protocol + "://" + host));
                            }.bind(this));
                        } else if (name === 'internal') {
                            hosts.forEach(function (host) {
                                promiseList.push(internalServerStatus.call(this,
                                    server.protocol + "://" + host));
                            }.bind(this));
                        } else if (name === 'archiver') {
                            hosts.forEach(function (host) {
                                promiseList.push(archiverServerStatus.call(this,
                                    server.protocol + "://" + host));
                            }.bind(this));
                        } else if (name === 'assessment') {
                            hosts.forEach(function (host) {
                                promiseList.push(assessmentServerStatus.call(this,
                                    server.protocol + "://" + host));
                            }.bind(this));
                        }
                    }
                }
            }
            return when.all(promiseList);
        }
        
        console.warnExt("MonitorService", "missing config data for app servers");
        return when.reject({ errmsg: "missing config data", code: 400 });
    }.bind(this))
    .then(function(results) {
        results.forEach(function(result) {
            if (result.status !== "good") {
                //console.log(result.system, "reported alert");
                allErrors.push("----- " + result.system + " -----");
                allErrors.push.apply(allErrors, result.messages);
            }
        }.bind(this));

        // additional tests can be inserted into the chain
        
        //allErrors.push("----- DEBUG -----");
        //allErrors.push.apply(allErrors, [ "This has been a test." ]);
        
        runningMonitor = false;
        //console.log("runningMonitor = false");

        if (allErrors.length > 0) {
            // Send an alert email
            var emailData = {
                subject: "Alert from monitor server",
                to: mConst.email,
                data: { messages: allErrors },
                host: req.protocol + "://" + req.headers.host
            };
            var email = new Util.Email(
                this.options.monitor.alert.email,
                path.join( __dirname, "../email-templates" ),
                this.stats );
            email.send( "monitor-status", emailData );
          
            this.requestUtil.jsonResponse(res, { status: "Alert sent" });
            return;
        }
        this.requestUtil.jsonResponse(res, { status: "OK" });
    }.bind(this))
    .then(null, function(err) {
        runningMonitor = false;
        //console.log("runMonitor error:", err, ", running false");
        this.requestUtil.errorResponse(res, {key:"monitor.internal.error"}, 401);
    }.bind(this));
}

function couchBaseStatus() {
    //console.log("couchBaseStatus: enter");

    return when.promise(function(resolve, reject) {
        if (this.options.monitor &&
            this.options.monitor.tests &&
            this.options.monitor.tests.couchbase) {
        
            var host = this.options.monitor.tests.couchbase.host;
            var protocol = this.options.monitor.tests.couchbase.protocol;
            var username = this.options.monitor.tests.couchbase.username;
            var password = this.options.monitor.tests.couchbase.password;
            var urlBase = protocol + "://" + host;
            var auth = new Buffer(username + ":" + password).toString('base64');
            var messages = [];

            couchbaseStatusPools.call(this, urlBase, auth)
            .then(function(result) {
                if (result.messages.length > 0) {
                    messages.push.apply(messages, result.messages);
                }

                if (result.connect === 'no') {
                    return "connect fail";
                }
                return couchbaseStatusBuckets.call(this, urlBase, result.bucketsURI, auth);
            }.bind(this))
            .then(function(result) {
                if (typeof result !== 'string') {
                    if (result.messages.length > 0) {
                        messages.push.apply(messages, result.messages);
                    }
                }

                var data = {
                    system: "couchbase",
                    status: (messages.length > 0 ? "bad" : "good"),
                    messages: messages
                };
                resolve(data);
            }.bind(this));
        } else {
            console.warnExt("MonitorService", "missing config data for Couchbase server");
            reject({ errmsg: "missing config data", code: 400 });
        }
    }.bind(this));
}

function couchbaseStatusPools(host, auth) {
    //console.log("couchbaseStatusPools: enter");
    
    return when.promise(function(resolve, reject) {
        var url = host + '/pools/default';
        this.requestUtil.getRequest(url, { "Authorization": "Basic " + auth },
            function(error, response, body) {
                //console.log("couchbaseStatusPools: process /pools/default");

                if (!error && response.statusCode == 200) {
                    var messages = [];
                    var json = JSON.parse(body);
                    json.nodes.forEach(function(node){
                        // is status 'healthy'?
                        if (node.status !== "healthy") {
                            messages.push("Node " + node.hostname + " has status '" + node.status + "'");
                        }
                    });
                    resolve({ connect: "yes", messages: messages, bucketsURI: json.buckets.uri });
                } else {
                    resolve({ connect: "no", messages: [ "Failed to connect to Coushbase server at " + host ] });
                }
            }.bind(this));
    }.bind(this));
}

function couchbaseStatusBuckets(host, uri, auth) {
    return when.promise(function(resolve, reject) {
        var url = host + uri;
        this.requestUtil.getRequest(url, { "Authorization": "Basic " + auth },
            function(error, response, body) {
                //console.log("couchBaseStatus: process", uri);

                if (!error && response.statusCode == 200) {
                    var messages = [];
                    
                    var json = JSON.parse(body);
                    /*
                    json.nodes.forEach(function(node){
                        // is status 'healthy'?
                        if (node.status !== "healthy") {
                            messages.push("Node " + node.hostname + " has status '" + node.status + "'");
                        }
                    });
                    */
                    resolve({ connect: "yes", messages: messages });
                } else {
                    resolve({ connect: "no", messages: [ "Failed to connect to Coushbase server at " + host ] });
                }
            }.bind(this));
    }.bind(this));
}

function mysqlStatus() {
    //console.log("mysqlStatus: enter");

    // http://blog.webyog.com/2012/09/03/top-10-things-to-monitor-on-your-mysql/
    
    return when.promise(function(resolve, reject) {
        if (this.options.monitor &&
            this.options.monitor.tests &&
            this.options.monitor.tests.mysql &&
            this.options.monitor.tests.per_check_limits) {

            var messages = [];
        
            var Q;
            
            Q = "SHOW GLOBAL STATUS LIKE 'aborted_connects'";
            this.monds.query(Q)
            .then(function(results) {
                if(results.length > 0) {
                    //console.log("mysqlStatus: process aborted_connects");

                    results = results[0];
                  
                    var aborted_connects = results.Value;

                    if (this.workingdata.aborted_connects !== undefined) {
                        var max_aborted_connects =
                            this.options.monitor.tests.per_check_limits.mysql_max_aborted_connects;
                        var delta = aborted_connects - this.workingdata.aborted_connects;
                        if (delta > max_aborted_connects) {
                            messages.push("Excessive per check aborted connects [" + delta + " > " + max_aborted_connects + "] to mysql server at " + host);
                        }
                    }
                    this.workingdata.aborted_connects = aborted_connects;
                } else {
                    // not good
                    messages.push("Unable to connect to mysql server at " + host);
                    //return "abort";
                }

                var result = {
                    system: "mysql",
                    status: (messages.length > 0 ? "bad" : "good"),
                    messages: messages
                };
                resolve(result);
            }.bind(this));
        } else {
            console.warnExt("MonitorService", "missing config data for mysql server");
            reject({ errmsg: "missing config data", code: 400 });
        }
    }.bind(this));
}

function externalServerStatus(host) {
    //console.log("externalServerStatus: enter");

    return when.promise(function(resolve, reject) {
        var messages = [];
        
        this.requestUtil.request(host + '/api/v2/monitor/info')
        .then(function(result) {
            //console.log("externalServerStatus: process /api/v2/monitor/info");

            if (!result.logCounts) {
                var data = {
                    system: "internal",
                    status: "bad",
                    messages: [ "/api/v2/monitor/info return bad data at " + host ]
                };
                resolve(data);
                return;
            }
            
            var per_check_limits = this.options.monitor.tests.per_check_limits;
            if (per_check_limits) {
                var external_errors_reported = result.logCounts.error;
                
                if (per_check_limits.external_max_errors_reported && this.workingdata.external_errors_reported !== undefined) {
                    var delta = external_errors_reported - this.workingdata.external_errors_reported;
                    if (delta > per_check_limits.external_max_errors_reported) {
                        messages.push("Excessive per check errors reported [" + delta + " > " + per_check_limits.external_max_errors_reported + "] to external server at " + host);
                    }
                }
                this.workingdata.external_errors_reported = external_errors_reported;

                if (result.leakInfo) {
                    messages.push("Leak - " + result.leakInfo.reason + ", growth " + result.leakInfo.growth + " (" + result.leakInfo.start + " to " + result.leakInfo.end + ") on external server at " + host);
                }

                if (result.cpuCount && per_check_limits.external_max_cpu_usage) {
                    // of the 1, 5 and 15 min load avaerages, use 5 min
                    var usage = result.cpuAverage[1] / result.cpuCount;
                    if (usage > per_check_limits.external_max_cpu_usage) {
                        messages.push("CPU usage exceeds limit [" + usage + " > " + per_check_limits.external_max_cpu_usage + "] to external server at " + host);
                    }
                }
            }

            var data = {
                system: "external",
                status: (messages.length > 0 ? "bad" : "good"),
                messages: messages
            };
            resolve(data);
        }.bind(this))
        .then(null, function(err) {
            //console.log("externalServerStatus monitor failed!");

            var data = {
                system: "external",
                status: "bad",
                messages: [ "Error " + JSON.stringify(err) + " for " + host ]
            };
            resolve(data);
            
        }.bind(this));
    }.bind(this));
}

function internalServerStatus(host) {
    //console.log("internalServerStatus: enter");

    return when.promise(function(resolve, reject) {
        var messages = [];
        
        this.requestUtil.request(host + '/api/v2/monitor/info')
        .then(function(result) {
            //console.log("internalServerStatus: process /api/v2/monitor/info");

            if (!result.logCounts) {
                var data = {
                    system: "internal",
                    status: "bad",
                    messages: [ "/api/v2/monitor/info return bad data at " + host ]
                };
                resolve(data);
                return;
            }
            
            var per_check_limits = this.options.monitor.tests.per_check_limits;
            if (per_check_limits) {
                var internal_errors_reported = result.logCounts.error;
                
                if (per_check_limits.internal_max_errors_reported && this.workingdata.internal_errors_reported !== undefined) {
                    var delta = internal_errors_reported - this.workingdata.internal_errors_reported;
                    if (delta > per_check_limits.internal_max_errors_reported) {
                        messages.push("Excessive per check errors reported [" + delta + " > " + per_check_limits.internal_max_errors_reported + "] to internal server at " + host);
                    }
                }
                this.workingdata.internal_errors_reported = internal_errors_reported;

                if (result.leakInfo) {
                    messages.push("Leak - " + result.leakInfo.reason + ", growth " + result.leakInfo.growth + " (" + result.leakInfo.start + " to " + result.leakInfo.end + ") on internal server at " + host);
                }

                if (result.cpuCount && per_check_limits.internal_max_cpu_usage) {
                    // of the 1, 5 and 15 min load avaerages, use 5 min
                    var usage = result.cpuAverage[1] / result.cpuCount;
                    if (usage > per_check_limits.internal_max_cpu_usage) {
                        messages.push("CPU usage exceeds limit [" + usage + " > " + per_check_limits.internal_max_cpu_usage + "] to internal server at " + host);
                    }
                }
            }

            var data = {
                system: "internal",
                status: (messages.length > 0 ? "bad" : "good"),
                messages: messages
            };
            resolve(data);
        }.bind(this))
        .then(null, function(err) {
            //console.log("internalServerStatus monitor failed!");

            var data = {
                system: "internal",
                status: "bad",
                messages: [ "Error " + JSON.stringify(err) + " for " + host ]
            };
            resolve(data);
            
        }.bind(this));
    }.bind(this));
}

function archiverServerStatus(host) {
    //console.log("archiverServerStatus: enter");

    return when.promise(function(resolve, reject) {
        var messages = [];
        
        this.requestUtil.request(host + '/api/v2/monitor/info')
        .then(function(result) {
            //console.log("archiverServerStatus: process /api/v2/monitor/info");

            if (!result.logCounts) {
                var data = {
                    system: "archiver",
                    status: "bad",
                    messages: [ "/api/v2/monitor/info return bad data at " + host ]
                };
                resolve(data);
                return;
            }
            
            var per_check_limits = this.options.monitor.tests.per_check_limits;
            if (per_check_limits) {
                var archiver_errors_reported = result.logCounts.error;
                
                if (per_check_limits.archiver_max_errors_reported && this.workingdata.archiver_errors_reported !== undefined) {
                    var delta = archiver_errors_reported - this.workingdata.archiver_errors_reported;
                    if (delta > per_check_limits.archiver_max_errors_reported) {
                        messages.push("Excessive per check errors reported [" + delta + " > " + per_check_limits.archiver_max_errors_reported + "] to archiver server at " + host);
                    }
                }
                this.workingdata.archiver_errors_reported = archiver_errors_reported;

                if (result.leakInfo) {
                    messages.push("Leak - " + result.leakInfo.reason + ", growth " + result.leakInfo.growth + " (" + result.leakInfo.start + " to " + result.leakInfo.end + ") on archiver server at " + host);
                }

                if (result.cpuCount && per_check_limits.archiver_max_cpu_usage) {
                    // of the 1, 5 and 15 min load avaerages, use 5 min
                    var usage = result.cpuAverage[1] / result.cpuCount;
                    if (usage > per_check_limits.archiver_max_cpu_usage) {
                        messages.push("CPU usage exceeds limit [" + usage + " > " + per_check_limits.archiver_max_cpu_usage + "] to archiver server at " + host);
                    }
                }
            }

            var data = {
                system: "archiver",
                status: (messages.length > 0 ? "bad" : "good"),
                messages: messages
            };
            resolve(data);
        }.bind(this))
        .then(null, function(err) {
            //console.log("archiverServerStatus monitor failed!");

            var data = {
                system: "archiver",
                status: "bad",
                messages: [ "Error " + JSON.stringify(err) + " for " + host ]
            };
            resolve(data);
            
        }.bind(this));
    }.bind(this));
}

function assessmentServerStatus(host) {
    //console.log("assessmentServerStatus: enter");

    return when.promise(function(resolve, reject) {
        var messages = [];
        
        this.requestUtil.request(host + '/int/v1/aeng/processStatus')
        .then(function(result) {
            //console.log("assessmentServerStatus: process /int/v1/aeng/processStatus");

            if (!result.hasOwnProperty("jobCount")) {
                var data = {
                    system: "assessment",
                    status: "bad",
                    messages: [ "/int/v1/aeng/processStatus missing jobCount at " + host ]
                };
                resolve(data);
                return;
            }
            
            var data = {
                system: "assessment",
                status: (messages.length > 0 ? "bad" : "good"),
                messages: messages
            };
            resolve(data);
        }.bind(this))
        .then(null, function(err) {
            //console.log("assessmentServerStatus monitor failed!");

            var data = {
                system: "assessment",
                status: "bad",
                messages: [ "Error " + JSON.stringify(err) + " for " + host ]
            };
            resolve(data);
            
        }.bind(this));
    }.bind(this));
}

function loggerStatus(url) {
    //console.log("loggerStatus: enter");

    return when.promise(function(resolve, reject) {
        this.requestUtil.getRequest(url, { },
            function(error, response, body) {
                //console.log("loggerStatus: process");

                if (!error && response.statusCode == 200) {
                    var data = {
                        system: "logger",
                        status: "good",
                        messages: [ ]
                    };
                    resolve(data);
                } else {
                    var data = {
                        system: "logger",
                        status: "bad",
                        messages: ["Unable to connect to logger server at " + host]
                    };
                    resolve(data);
                }
            }.bind(this));
    }.bind(this));
}
