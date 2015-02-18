/**
 * LMS Service Module
 *
 */

var http       = require('http');
// Third-party libs
var _          = require('lodash');
var when       = require('when');
// load at runtime
var Util, lConst;

module.exports = LicService;

function LicService(options, serviceManager) {
    try{
        var LicStore, Errors;

        this.options = _.merge(
            {
            },
            options
        );

        // Glasslab libs
        LicStore     = require('./lic.js').Datastore.MySQL;
        LicDataStore = require('./lic.js').Datastore.Couchbase;
        Util         = require('../core/util.js');
        lConst       = require('./lic.js').Const;
        Errors       = require('../errors.js');

        this.requestUtil = new Util.Request(this.options, Errors);
        this.myds        = new LicStore(this.options.lic.datastore.mysql);
        this.cbds        = new LicDataStore(this.options.lic.datastore.couchbase);
        this.stats       = new Util.Stats(this.options, "LMS");
        this.serviceManager = serviceManager;

    } catch(err){
        console.trace("LicService: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

LicService.prototype.start = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // test connection to LMS MySQL
    this.myds.connect()
        .then(function(){
                console.log("LicService: MySQL DS Connected");
                this.stats.increment("info", "MySQL.Connect");
            }.bind(this),
            function(err){
                console.trace("LicService: MySQL Error -", err);
                this.stats.increment("error", "MySQL.Connect");
            }.bind(this))
        .then(function(){
            return this.cbds.connect();
        }.bind(this))
            .then(function(){
                console.log("LicService: Couchbase DS Connected");
                this.stats.increment("info", "Couchbase.Connect");
            }.bind(this),
            function(err){
                console.trace("LicService: Couchbase Error -", err);
                this.stats.increment("error", "Couchbase.Connect");
            }.bind(this))
        .then(resolve, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

LicService.prototype.unassignPremiumCourses = function(courseIds, licenseId, userId){
    return when.promise(function(resolve, reject){
        var studentSeats;
        var studentList;
        var promiseList = [];
        promiseList.push(this.myds.getLicenseById(licenseId));
        promiseList.push(this.cbds.getActiveStudentsByLicense(licenseId));
        when.all(promiseList)
            .then(function(results){
                var courseObj = {};
                var premiumCourses = [];
                courseIds.forEach(function(id){
                    courseObj[id] = true;
                });
                var license = results[0][0];
                var packageSize = license["package_size_tier"];
                studentSeats = lConst.seats[packageSize].studentSeats;
                studentList = results[1];
                _(studentList).forEach(function(student){
                    _(student).forEach(function(premiumCourse, courseId, courseList){
                        if(premiumCourse && courseObj[courseId]){
                            courseList[courseId] = false;
                            premiumCourses.push(courseId);
                        }
                    })
                });
                if(premiumCourses.length > 0){
                    return this.myds.unassignPremiumCourses(premiumCourses);
                }
                return "continue";
            }.bind(this))
            .then(function(status){
                if(status === "continue"){
                    return status;
                }
                var licenseStudentList = { students: studentList};
                return this.cbds.updateActiveStudentsByLicense(licenseId, licenseStudentList);
            }.bind(this))
            .then(function(status){
                if(status === "continue"){
                    return status;
                }
                return this.updateStudentSeatsRemaining(licenseId, studentSeats);
            }.bind(this))
            .then(function(){
                resolve();
            })
            .then(null, function(err){
                console.error("Unassign Instructor Premium Courses Error -",err);
                reject(err);
            })
    }.bind(this));
};

LicService.prototype.assignPremiumCourses = function(courseIds){

};

LicService.prototype.updateEducatorSeatsRemaining = function(licenseId, seats){
    return when.promise(function(resolve, reject){
        this.myds.countEducatorSeatsByLicense(licenseId)
            .then(function(count){
                var seatsRemaining = seats - count +1;
                var seatsRemainingString = "educator_seats_remaining = " + seatsRemaining;
                var updateFields = [seatsRemainingString];
                return this.myds.updateLicenseById(licenseId, updateFields);
            }.bind(this))
            .then(function(){
                resolve();
            })
            .then(null, function(err){
                console.error("Update Educator Seats Remaining Error -",err);
                reject(err);
            });
    }.bind(this));
};

LicService.prototype.updateStudentSeatsRemaining = function(licenseId, seats){
    return when.promise(function(resolve, reject){
        this.cbds.countActiveStudentsByLicense(licenseId)
            .then(function(count){
                var seatsRemaining = seats - count;
                var seatsRemainingString = "student_seats_remaining = " + seatsRemaining;
                var updateFields = [seatsRemainingString];
                return this.myds.updateLicenseById(licenseId, updateFields);
            }.bind(this))
            .then(function(){
                resolve();
            })
            .then(null,function(err){
                console.error("Update Student Seats Remaining Error -",err);
                reject(err);
            });
    }.bind(this));
};
