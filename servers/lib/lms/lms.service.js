/**
 * LMS Service Module
 *
 */

var http       = require('http');
// Third-party libs
var _          = require('lodash');
var when       = require('when');
// load at runtime
var Util, lConst, exampleOut;
exampleOut = {};

module.exports = LMSService;

function LMSService(options){
    try{
        var TelmStore, WebStore, LMSStore, Errors;

        this.options = _.merge(
            {
            },
            options
        );

        // Glasslab libs
        LMSStore   = require('./lms.js').Datastore.MySQL;
        WebStore   = require('../dash/dash.js').Datastore.MySQL;
        TelmStore  = require('../data/data.js').Datastore.Couchbase;
        Util       = require('../core/util.js');
        lConst     = require('./lms.js').Const;
        Errors     = require('../errors.js');

        this.requestUtil = new Util.Request(this.options, Errors);
        this.telmStore   = new TelmStore(this.options.telemetry.datastore.couchbase);
        this.webstore    = new WebStore(this.options.webapp.datastore.mysql);
        this.myds        = new LMSStore(this.options.lms.datastore.mysql);
        this.stats       = new Util.Stats(this.options, "LMS");

    } catch(err){
        console.trace("LMSService: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

LMSService.prototype.start = function(serviceManager) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // test connection to LMS MySQL
    this.myds.connect(serviceManager)
        .then(function(){
                console.log("LMSService: MySQL DS Connected");
                this.stats.increment("info", "MySQL.Connect");
            }.bind(this),
            function(err){
                console.trace("LMSService: MySQL Error -", err);
                this.stats.increment("error", "MySQL.Connect");
            }.bind(this))

        // test connection to WebApp MySQL
        .then(function(){
            return this.webstore.connect();
        }.bind(this))
        .then(function(){
            console.log("WebApp: MySQL DS Connected");
            this.stats.increment("info", "MySQL.Connect");
        }.bind(this),
            function(err){
                console.trace("WebApp: MySQL Error -", err);
                this.stats.increment("error", "MySQL.Connect");
            }.bind(this))

        // test connection to TelmStore Couchbase
        .then(function(){
            return this.telmStore.connect();
        }.bind(this))
        .then(function(){
            console.log("TelmStore: Couchbase DS Connected");
            this.stats.increment("info", "Couchbase.Connect");
        }.bind(this),
        function(err){
            console.trace("TelmStore: Couchbase Error -", err);
            this.stats.increment("error", "Couchbase.Connect");
        }.bind(this))

        .then(resolve, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


LMSService.prototype._generateCode = function() {

    var code = "";
    for( var i = 0; i < lConst.code.length; i++) {
        code += lConst.code.charSet.charAt(Math.floor(Math.random() * lConst.code.charSet.length));
    }

    return code;
};


exampleOut.getCoursesDetails = {
    "id": 9,
    "dateCreated": 123456789,
    "title": "test3",
    "grade": "7",
    "lockedRegistration": false,
    "archived": false,
    "archivedDate": null,
    "institution": 10,
    "games": [
        { "id": "SC",   "settings": {"missionProgressLock": true } },
        { "id": "AA-1", "settings": {} }
    ],
    "code": "SK1FC",
    "studentCount": 0,
    "users": []
};
LMSService.prototype.getCoursesDetails = function(courses, showMembers, showTeacher){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    if( courses &&
        courses.length) {

        when.reduce(courses, function(data, course, i){
            if(course.id) {
                //console.log("id:", course.id);

                // convert showMembers to int and then check it's value
                var p;
                if( showMembers ) {
                    // init user
                    course.users = [];

                    p = this.myds.getStudentsOfCourse(course.id)
                        .then(function(studentList) {
                            course.users = _.clone(studentList);
                            return this.telmStore.getGamesForCourse(course.id);
                        }.bind(this));
                }
                else if( showTeacher ) {
                    p = this.myds.getTeacherOfCourse(course.id)
                        .then(function(teacherInfo) {
                            course.teacher = _.clone(teacherInfo);
                            return this.telmStore.getGamesForCourse(course.id);
                        }.bind(this));
                }
                else {
                    p = this.telmStore.getGamesForCourse(course.id);
                }

                p.then(function(games) {
                    // create games object if one does not exist
                    if(!_.isArray(course.games)) {
                        course.games = [];
                    }

                    // fill in settings
                    for(var g in games) {
                        // if not settings default to empty object
                        course.games.push( {
                            id:       g,
                            settings: games[g].settings || {}
                        } );
                    }

                    // need to return something for reduce to continue
                    return 1;
                }.bind(this));

                return p;
            }
        }.bind(this), {})
            .then(null, function(err){
                reject(err);
            }.bind(this))

            .done(function(){
                //console.log("done");
                resolve(courses);
            }.bind(this))
    } else {
        resolve(courses);
    }
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};