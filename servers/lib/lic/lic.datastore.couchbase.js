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
            console.errorExt("LicStore Couchbase", err);

            if(err) throw err;
        }.bind(this));

        this.client.on('error', function (err) {
            console.errorExt("LicStore Couchbase", err);
            reject(err);
        }.bind(this));

        this.client.on('connect', function () {
            resolve();
        }.bind(this));

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

Lic_Couchbase.prototype.getStudentsByLicense = function(licenseId){
    return when.promise(function(resolve, reject){
        // lic:licenseId
        var key = lConst.datastore.licenseKey + ":" + licenseId;
        this.client.get(key, function(err, results){
            if(err){
                console.errorExt("LicStore Couchbase", "Get Active Students By License Error -", err);
                reject(err);
                return;
            }
            var students = results.value.students;
            resolve(students);
        });
    }.bind(this));
};


Lic_Couchbase.prototype.getActiveStudentsByLicense = function(licenseId){
    return when.promise(function(resolve, reject){
        // lic:licenseId
        var key = lConst.datastore.licenseKey + ":" + licenseId;
        this.client.get(key, function(err, results){
            if(err){
                console.errorExt("LicStore Couchbase", "Get Active Students By License Error -", err);
                reject(err);
                return;
            }
            var activeStudents = {};
            var students = results.value.students;
            _(students).forEach(function(premiumCourses, student){
                _(premiumCourses).some(function(state){
                    if(state === true){
                        activeStudents[student] = premiumCourses;
                    }
                });
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
                console.errorExt("LicStore Couchbase", "Count Active Students By License Error -", err);
                reject(err);
                return;
            }
            var students = results.value.students;
            var count = 0;
            var premiumClassCount;
            _(students).forEach(function(premiumCourses, student){
                premiumClassCount = 0;
                _(premiumCourses).some(function(isEnrolled, courseId){
                    if(isEnrolled){
                        count++;
                        return true;
                    }
                });
            });
            resolve(count);
        });
    }.bind(this));
};

Lic_Couchbase.prototype.updateStudentsByLicense = function(licenseId, data){
    return when.promise(function(resolve, reject){
        var key = lConst.datastore.licenseKey + ":" + licenseId;
        this.client.set(key, data, function(err, results){
            if(err){
                console.errorExt("LicStore Couchbase", "Update Active Students By License Error -",err);
                reject(err);
                return;
            }
            resolve(results.value);
        });
    }.bind(this));
};

Lic_Couchbase.prototype.createLicenseStudentObject = function(licenseId){
    return when.promise(function(resolve, reject){
        var key = lConst.datastore.licenseKey + ":" + licenseId;
        var data = {};
        data.students = {};
        this.client.set(key, data, function(err, results){
            if(err){
                console.errorExt("LicStore Couchbase", "Create License Student Object Error -",err);
                reject(err);
                return;
            }
            resolve(results.value);
        });
    }.bind(this));
};

Lic_Couchbase.prototype.getEmailLastSentTimestamp = function(licenseId, emailTemplateKey) {
    return when.promise(function(resolve, reject){
        // lic:email:templateKey:licenseId
        var key = _getEmailKey(licenseId, emailTemplateKey);
        this.client.get(key, function(err, results){
            resolve(err ? 0 : results.value.ts); // return 0 if key doesn't exist
        });
    }.bind(this));
};

Lic_Couchbase.prototype.updateEmailLastSentTimestamp = function(licenseId, emailTemplateKey, timestamp, ttl){
    return when.promise(function(resolve, reject){
        // lic:email:templateKey:licenseId
        var key = _getEmailKey(licenseId, emailTemplateKey);
        var data = {ts: timestamp};
        var metadata = {expiry: ttl || 0};
        this.client.set(key, data, metadata, function(err, results){
            if(err){
                console.errorExt("LicStore Couchbase", "Update Email Timestamp Error -",err);
                reject(err);
                return;
            }
            console.log("Couchbase LicStore: Update Email Timestamp id:", licenseId, "ttl:", ttl);
            resolve(results.value);
        });
    }.bind(this));
};

function _getEmailKey(licenseId, emailTemplateKey) {
    return lConst.datastore.licenseKeyEmail + ":" + emailTemplateKey + ":" + licenseId;
}