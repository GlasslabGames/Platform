
var path      = require('path');
var _         = require('lodash');
var when      = require('when');
var moment    = require('moment');
//var request   = require('request');
var mConst    = require('../monitor.const.js');
var Util      = require('../../core/util.js');
var MySQL  = require('../../core/datastore.mysql.js');


var runningMonitor = false;

module.exports = {
    runMonitor: runMonitor
};

// changes runningMonitor state to true, starting monitor if not active
function runMonitor(req, res){
    console.log("runMonitor: enter");

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
        console.error("Email for alert not configured");
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
        console.log("runningMonitor = true");
    }

    var allErrors = [];

    couchBaseStatus.call(this)
    .then(function(result) {
        if (result.status !== "good") {
            console.log(result.system, "reported alert");
            allErrors.push("----- " + result.system + " -----");
            allErrors.push.apply(allErrors, result.messages);
        }

        return mysqlStatus.call(this);
    }.bind(this))
    .then(function(result) {
        if (result.status !== "good") {
            console.log(result.system, "reported alert");
            allErrors.push("----- " + result.system + " -----");
            allErrors.push.apply(allErrors, result.messages);
        }
 
        return appServerStatus.call(this);
    }.bind(this))
    .then(function(result) {
        if (result.status !== "good") {
            console.log(result.system, "reported alert");
            allErrors.push("----- " + result.system + " -----");
            allErrors.push.apply(allErrors, result.messages);
        }

        // additional tests can be inserted into the chain
        
        //allErrors.push("----- DEBUG -----");
        //allErrors.push.apply(allErrors, [ "This has been a test." ]);
        
        runningMonitor = false;
        console.log("runningMonitor = false");

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
        console.log("runMonitor error:", err, ", running false");
        this.requestUtil.errorResponse(res, {key:"monitor.internal.error"}, 401);
    }.bind(this));
}

function couchBaseStatus() {
    console.log("couchBaseStatus: enter");

    return when.promise(function(resolve, reject) {
        if (this.options.monitor &&
            this.options.monitor.tests &&
            this.options.monitor.tests.couchbase) {
        
            var host = this.options.monitor.tests.couchbase.host;
            var protocol = this.options.monitor.tests.couchbase.protocol;
            //var bucket = this.options.monitor.tests.couchbase.bucket;
            var username = this.options.monitor.tests.couchbase.username;
            var password = this.options.monitor.tests.couchbase.password;

            var url = protocol + '://' + host + '/nodeStatuses';
            var auth = new Buffer(username + ":" + password).toString('base64');
            
            this.requestUtil.getRequest(url, { "Authorization": "Basic " + auth },
                function(error, response, body) {
                    console.log("couchBaseStatus: process /nodeStatuses");

                    if (!error && response.statusCode == 200) {
                        var messages = [];
                        
                        var json = JSON.parse(body);
                        _(json).forEach(function(value, key){
                            // is status 'healthy'?
                            if (value.status !== "healthy") {
                                messages.push("Node " + key + " has status '" + value.status + "'");
                            }
                        });

                        var result = {
                            system: "couchbase",
                            status: (messages.length > 0 ? "bad" : "good"),
                            messages: messages
                        };
                        resolve(result);
                    } else {
                        console.log("cousebase monitor /nodeStatuses failed!");
                        var result = {
                            system: "couchbase",
                            status: "bad",
                            messages: [ "Failed to connect to Coushbase server at " + host ]
                        };
                        resolve(result);
                    }
                }.bind(this));
        } else {
            console.log("cousebase monitor missing config data");
            reject({ errmsg: "missing config data", code: 400 });
        }
    }.bind(this));
}

function mysqlStatus() {
    console.log("mysqlStatus: enter");

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
                    console.log("mysqlStatus: process aborted_connects");

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

//            }.bind(this))
//            .then(function(results){
            

                var result = {
                    system: "mysql",
                    status: (messages.length > 0 ? "bad" : "good"),
                    messages: messages
                };
                resolve(result);
            }.bind(this));
        } else {
            console.log("mysql monitor missing config data");
            reject({ errmsg: "missing config data", code: 400 });
        }
    }.bind(this));
}

function appServerStatus() {
    console.log("appServerStatus: enter");

    return when.promise(function(resolve, reject) {
        if (this.options.monitor &&
            this.options.monitor.tests &&
            this.options.monitor.tests.app &&
            this.options.monitor.tests.app.external) {
        
            var host = this.options.monitor.tests.app.external.host;
            var protocol = this.options.monitor.tests.app.external.protocol;
            var url = protocol + '://' + host + '/sdk/connect';

            this.requestUtil.getRequest(url, { },
                function(error, response, body) {
                    console.log("appServerStatus: process /sdk/conenct");

                    if (!error && response.statusCode == 200) {
                        var messages = [];

                        if (!body || body.indexOf("http") !== 0) {
                            messages.push("/sdk/connect replied with bad URL");
                        }
                        
                        var result = {
                            system: "application server",
                            status: (messages.length > 0 ? "bad" : "good"),
                            messages: messages
                        };
                        resolve(result);
                    } else {
                        console.log("appserver monitor failed!");

                        var result = {
                            system: "application server",
                            status: "bad",
                            messages: [ "Unable to connect to app server at " + host ]
                        };
                        resolve(result);
                    }
                }.bind(this));
        } else {
            console.log("appserver monitor missing config data");
            reject({ errmsg: "missing config data", code: 400 });
        }
    }.bind(this));
}
