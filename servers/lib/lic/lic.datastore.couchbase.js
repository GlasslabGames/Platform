var _      = require('lodash');
var when   = require('when');
var couchbase = require('couchbase');
var Util;
var lConst;

module.exports = Lic_Couchbase;

function Lic_Couchbase(options){
    // Glasslab libs
    Util   = require('../core/util.js');
    lConst = require('./lic.const.js');

    this.options = _.merge(
        {
            host:     "localhost:8091",
            bucket:   "default",
            password: "",
            gameSessionExpire: 1*1*60 //24*60*60 // in seconds
        },
        options
    );
}

Lic_Couchbase.prototype.connect = function(){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        this.client = new couchbase.Connection({
            host:     this.options.host,
            bucket:   this.options.bucket,
            password: this.options.password,
            connectionTimeout: this.options.timeout || 6000,
            operationTimeout:  this.options.timeout || 6000
        }, function(err) {
            console.error("[Lic] CouchBase LicDataStore: Error -", err);

            if(err) throw err;
        }.bind(this));

        this.client.on('error', function (err) {
            console.error("[Lic] CouchBase LicDataStore: Error -", err);
            reject(err);
        }.bind(this));

        this.client.on('connect', function () {
            resolve();
        }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

Lic_Couchbase.prototype.getActiveStudentsByLicense = function(licenseId){
    return when.promise(function(resolve, reject){
        // lic:licenseId
        var key = lConst.datastore.licenseKey + ":" + licenseId;
        this.client.get(key, function(err, results){
            if(err){
                console.error("Couchbase LicStore: Get Active Students By License Error -", err);
                reject(err);
                return;
            }
            var activeStudents = {};
            var students = results.value.students;
            _(students).forEach(function(premiumCourses, student){
                var courseList = Object.keys(premiumCourses);
                if(courseList.length > 0){
                    activeStudents[student] = premiumCourses;
                }
            });
            resolve(activeStudents);
        });
    }.bind(this));
};

Lic_Couchbase.prototype.countActiveStudentsByLicense = function(licenseId){
    return when.promise(function(resolve, reject){
        // lic:licenseId
        var key = lConst.datastore.licenseKey + ":" + licenseId;
        this.client.get(key, function(err, results){
            if(err){
                console.error("Couchbase LicStore: Count Active Students By License Error -", err);
                reject(err);
                return;
            }
            var students = results.value.students;
            var count = 0;
            _(students).forEach(function(premiumCourses, student){
                var courseList = Object.keys(premiumCourses);
                if(courseList.length > 0){
                    count++;
                }
            });
            resolve(count);
        });
    }.bind(this));
};

Lic_Couchbase.prototype.updateActiveStudentsByLicense = function(licenseId, data){
    return when.promise(function(resolve, reject){
        var key = lConst.datastore.licenseKey + ":" + licenseId;
        this.client.set(key, data, function(err, results){
            if(err){
                console.error("Couchbase LicStore: Update Active Students By License Error -",err);
                reject(err);
                return;
            }
            resolve(results.value);
        });
    }.bind(this));
};
