var _ = require('lodash');
var when = require('when');
var couchbase = require('couchbase');
var cluster = new couchbase.Connection({
	host:		'127.0.0.1:8091',
	bucket:   	'glasslab_gamedata',
	username: 	'glasslab_gamedata',
	password: 	'glasslab',
	operationTimeout: 100000
});

var json2csv = require('json2csv');

var MySQL = require('../Platform/servers/lib/core/datastore.mysql.js');
var ds = new MySQL({
    "host": "localhost",
    "user": "glasslab",
	"password": "glasslab",
    "database": "glasslab_prod",
});

var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/*
 output csv:

 courseId, courseName, dateCourseCreated, instructorId, gameId1, gameId2, ...
 */


function findCoursesWithGames(gameIds, callback) {
	cluster.view('telemetry', 'getAllCourseGameProfiles').query({}, function (err, rows) {
        if (err) {
            console.error(err);
            process.exit(1);
        } else {
            var docIds = _.map(rows, function (row) {
                return row.key;
            });

            //lookup documents
            cluster.getMulti(docIds, {}, function (err, results) {
                if (err) {
                    console.log(err);
                }

                // map courseId -> courseGameProfile
                var courses = _.map(_.keys(results), function (key) {
                    var r = results[key];
                    var k = key.split(':');
                    var courseId = k[2];
                    return {
                        'courseId': courseId,
                        'games': r.value,
                    };
                });

                // find courses with at least one of the games in gameIds
                var coursesWithGames = _.filter(courses, function (c) {
                    var matchingGames = _.intersection(gameIds, _.keys(c.games));
                    return matchingGames.length > 0;
                });

                callback(coursesWithGames);
            });

        }
    }.bind(this));
}

function _format_date(d) {
    return (d.getMonth()+1)+"/"+d.getDate()+"/"+d.getFullYear();
}

function getDateCreatedRestrictionQueryString(table, year, month) {
	var queryString = table+".date_created >= '"+year+"-";
	if (month) {
		var strFirstMonth = month < 10 ? ("0"+month) : (""+month);
		var nextMonth = (month + 1) % 12;
		var strNextMonth = nextMonth < 10 ? ("0"+nextMonth) : (""+nextMonth);

		queryString += strFirstMonth+"-01 00:00:00' AND "+table+".date_created < '";
		queryString += (year+(month == 12 ? 1 : 0));
		queryString += "-"+strNextMonth+"-01 00:00:00'";
	} else {
		queryString += "01-01 00:00:00'";
	}
	return queryString;
}

function getRegistrations(type, year, month) {
	return when.promise(function(resolve, reject) {
	// ------------------------------------------------
		var q = "SELECT count(*) as registrations FROM GL_USER as u WHERE u.SYSTEM_ROLE='"+type+"'";
		if (year) {
			q += " AND "+getDateCreatedRestrictionQueryString('u', year, month);
		}
	
		ds.query(q).then(
			function (results) {
				resolve({
					type: type.charAt(0).toUpperCase()+type.slice(1)+'s registered',
					month: month,
					year: year,
					result: results[0]['registrations']
				});
			},
			function (err) {
			    console.error("mysql err", err);
			    reject(err);
			});
	// ------------------------------------------------
	}.bind(this));
}

function getCoursesCreated(courseIds, gameId, year, month) {
	return when.promise(function(resolve, reject) {
	// ------------------------------------------------
		var q = "SELECT count(*) as courses from GL_COURSE as c WHERE c.id IN ("+ds.escapeArray(courseIds)+")";
		if (year) {
			q += " AND "+getDateCreatedRestrictionQueryString('c', year, month);
		}
	
		ds.query(q).then(
			function (results) {
				resolve({
					type: 'Courses created ('+gameId+')',
					month: month,
					year: year,
					result: results[0]['courses']
				});
			},
			function (err) {
			    console.error("mysql err", err);
			    reject(err);
			});
	// ------------------------------------------------
	}.bind(this));
}

function getStudentsEnrolled(courseIds, gameId, year, month) {
	return when.promise(function(resolve, reject) {
	// ------------------------------------------------
		var q = "SELECT count(m.id) as enrollments FROM GL_MEMBERSHIP as m WHERE m.course_id IN ("+ds.escapeArray(courseIds)+") AND m.role='student'";
		if (year) {
			q += " AND "+getDateCreatedRestrictionQueryString('m', year, month);
		}
	
		ds.query(q).then(
			function (results) {
				resolve({
					type: 'Students enrolled ('+gameId+')',
					month: month,
					year: year,
					result: results[0]['enrollments']
				});
			},
			function (err) {
			    console.error("mysql err", err);
			    reject(err);
			});
	// ------------------------------------------------
	}.bind(this));
}

function getInstructorsLastLoggedIn(year, month) {
	return when.promise(function(resolve, reject) {
	// ------------------------------------------------
		var q = "SELECT count(*) as lastlogins FROM GL_USER as u WHERE u.SYSTEM_ROLE='instructor'";
		q += " AND u.last_login >= '"+year+"-";
		var strFirstMonth = month < 10 ? ("0"+month) : (""+month);
		var nextMonth = (month + 1) % 12;
		var strNextMonth = nextMonth < 10 ? ("0"+nextMonth) : (""+nextMonth);

		q += strFirstMonth+"-01 00:00:00' AND u.last_login < '";
		q += (year+(month == 12 ? 1 : 0));
		q += "-"+strNextMonth+"-01 00:00:00'";
	
		ds.query(q).then(
			function (results) {
				resolve({
					type: 'Instructors last logged in',
					month: month,
					year: year,
					result: results[0]['lastlogins']
				});
			},
			function (err) {
			    console.error("mysql err", err);
			    reject(err);
			});
	// ------------------------------------------------
	}.bind(this));
}

function main() {
	var year = 2018;
	var startMonth = 4;
	var endMonth = 6;
	
    var gameIdsToFind = ["AA-1", "AW-1", "B538", "GOG", "PRIMA", "SLFR", "WPLUS", "WT", "SC", "PVZ"];

    findCoursesWithGames(gameIdsToFind, function (courses) {

        //build map of gameId -> courseIds
        var gameIdx = _.reduce(courses, function(acc,c) {
			for (var game in c.games) {
				if (!acc[game])
					acc[game] = [];
				acc[game].push(c.courseId);
			}
            return acc;
        }, {});
		
		var promiseList = [];
		
		for (var m=startMonth; m<=endMonth; m++) {
			promiseList.push(getRegistrations('instructor', year, m));
			promiseList.push(getRegistrations('student', year, m));
			promiseList.push(getInstructorsLastLoggedIn(year, m));
		}
		promiseList.push(getRegistrations('instructor', year));
		promiseList.push(getRegistrations('student', year));
		promiseList.push(getRegistrations('instructor'));
		promiseList.push(getRegistrations('student'));
		
		for (var g=0; g<gameIdsToFind.length; g++) {
			var gameId = gameIdsToFind[g];
			var courseIds = gameIdx[gameId];
			if (courseIds) {
				for (var m=startMonth; m<=endMonth; m++) {
					promiseList.push(getCoursesCreated(courseIds, gameId, year, m));
					promiseList.push(getStudentsEnrolled(courseIds, gameId, year, m));
				}
				promiseList.push(getCoursesCreated(courseIds, gameId, year));
				promiseList.push(getStudentsEnrolled(courseIds, gameId, year));
				promiseList.push(getCoursesCreated(courseIds, gameId));
				promiseList.push(getStudentsEnrolled(courseIds, gameId));
			}
		}
		
	    when.all(promiseList)
	        .then(function(results){
		        var metric_map = _.reduce(results, function(acc,result) {
					var date_bucket = (result.month?MONTHS[result.month-1]+" ":"") + (result.year?result.year:"All time");
					
					if (!acc[result.type])
						acc[result.type] = {'Metric':result.type};
					acc[result.type][date_bucket] = result.result;

		            return acc;
		        }, {});

				var csv_rows = _.values(metric_map);

                console.log(json2csv({
                    data: csv_rows,
                    fields: [
                        'Metric',
						'All time',
						''+year
                    ].concat(_.map(MONTHS, function(m){
                    	return m+' '+year;
                    }))
                }));
				
				process.exit(0);
			}.bind(this));
    });

}
main();
