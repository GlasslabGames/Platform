
var path      = require('path');
var _         = require('lodash');
var when      = require('when');
var moment    = require('moment');
var csv       = require('csv');
var rConst    = require('../research.const.js');
var Util      = require('../../core/util.js');

var TOTALEVENTS = 0;
var runningArchive = false;

module.exports = {
    getEventsByDate: getEventsByDate,
    archiveEventsByGameId: archiveEventsByGameId,
    archiveEvents: archiveEvents,
    stopArchive: stopArchive,
    getSignedUrlsByDayRange: getSignedUrlsByDayRange
};

/*
 http://localhost:8090/research/events/get?gameId=AA-1&startDate=2014-05-01

 http://stage.argubotacademy.org:8090/research/events/get?gameId=AA-1&startDate=2014-05-01

 http://localhost:8090/research/events/get?gameId=AA-1&startDate=2014-05-01&endDate=2014-05-14&timeFormat="MM/DD/YYYY HH:mm:ss"


 required:
    gameId

 optional
    startDate
    endDate
    userIds
    saveToFile

    startEpoc
    dateRange
 */

// for a particular gameId, gets all aws signed urls between the designated days in the chosen month
// defaulted to only get csv files within archives/dev
function getSignedUrlsByDayRange(req, res){
    if( req.session &&
        req.session.passport) {
        var userData = req.session.passport.user;
        // check user permission
        if (!userData.permits.nav.parser) {
            this.requestUtil.errorResponse(res, {key: "user.permit.invalid"});
            return;
        }
    }

    if(!req.query) {
        this.requestUtil.errorResponse(res, {key: "research.arguments.missing"}, 401);
        return;
    }

    if( !(req.params.gameId &&
        req.params.hasOwnProperty("gameId") ) ) {
        // if has no code
        this.requestUtil.errorResponse(res, {key:"research.gameId.missing"});
        return
    }

    var gameId = req.params.gameId;
    // gameId are not case sensitive
    gameId = gameId.toUpperCase();

    if(req.query.startDate) {
        startDate = req.query.startDate;
        // if starts with " then strip "s
        if(startDate.charAt(0) == '"') {
            startDate = startDate.substring(1, startDate.length-1);
        }
    }
    if(!startDate) {
        this.requestUtil.errorResponse(res, {key: "research.startDate.missing"}, 401);
        return;
    }
    if(req.query.endDate) {
        endDate = req.query.endDate;
        // if starts with " then strip "s
        if(endDate.charAt(0) == '"') {
            endDate = endDate.substring(1, endDate.length-1);
        }
    }
    if(!endDate) {
        this.requestUtil.errorResponse(res, {key: "research.endDate.missing"}, 401);
        return;
    }

    var startDates = startDate.split('-');
    var year = startDates[0];
    var month = startDates[1];
    startDates[2] = startDates[2].slice(0,2);
    var day = parseInt(startDates[2], 10);
    var endDates = endDate.split('-');
    var endDay;
    if(endDates[0] !== year || endDates[1] !== month){
        endDay = 31;
    } else{
        endDates[2] = endDates[2].slice(0,2);
        endDay = parseInt(endDates[2], 10);
    }
    // index used as prefix to easily access the day param in file names.
    var fileString = gameId + '_' + year + '-' + month + '-';
    var outList = [];

    return when.promise(function(resolve, reject){
        function getSignedUrlsForParser(){
            var dayString;
            if(day < 10){
                dayString = "0" + day;
            } else{
                dayString = "" + day;
            }
            dayString = fileString + dayString;
            var pathParams = ['archives', 'dev', gameId, year, month, dayString];
            this.serviceManager.awss3.getSignedUrls('csv', pathParams, false)
                .then(function(urls){
                    urls.forEach(function(url){
                        outList.push(url);
                    });
                    if(day < endDay){
                        day++;
                        getSignedUrlsForParser.call(this);
                    } else{
                        this.requestUtil.jsonResponse(res, {
                            numCSVs: outList.length,
                            urls: outList
                        });
                        resolve();
                    }
                }.bind(this))
                .then(null, function(err){
                    reject(err);
                    this.requestUtil.errorResponse(res, err, 401);
                }.bind(this));
        }
        getSignedUrlsForParser.call(this);
    }.bind(this));
}

// for a particular gameId, gets all aws signed urls for a certain date range
// defaulted to only get csv files within archive/dev
// concern about researchers asking for too many files at once, don't use unless solution found
function getSignedUrlsByMonthRange(req, res){
    if( req.session &&
        req.session.passport) {
        var userData = req.session.passport.user;
        // check user permission
        if (!userData.permits.nav.parser) {
            this.requestUtil.errorResponse(res, {key: "user.permit.invalid"});
            return;
        }
    }

    if(!req.query) {
        this.requestUtil.errorResponse(res, {key: "research.arguments.missing"}, 401);
        return;
    }

    if( !(req.params.gameId &&
        req.params.hasOwnProperty("gameId") ) ) {
        // if has no code
        this.requestUtil.errorResponse(res, {key:"research.gameId.missing"});
        return
    }

    var gameId = req.params.gameId;
    // gameId are not case sensitive
    gameId = gameId.toUpperCase();

    if(req.query.startDate) {
        startDate = req.query.startDate;
        // if starts with " then strip "s
        if(startDate.charAt(0) == '"') {
            startDate = startDate.substring(1, startDate.length-1);
        }
    }
    if(!startDate) {
        this.requestUtil.errorResponse(res, {key: "research.startDate.missing"}, 401);
        return;
    }
    if(req.query.endDate) {
        endDate = req.query.endDate;
        // if starts with " then strip "s
        if(endDate.charAt(0) == '"') {
            endDate = endDate.substring(1, endDate.length-1);
        }
    }
    if(!endDate) {
        this.requestUtil.errorResponse(res, {key: "research.endDate.missing"}, 401);
        return;
    }
    var startDates = startDate.split('-');
    startDates[0] = parseInt(startDates[0], 10);
    startDates[1] = parseInt(startDates[1], 10);
    var endDates = endDate.split('-');
    endDates[0] = parseInt(endDates[0], 10);
    endDates[1] = parseInt(endDates[1], 10);
    var yearsToGo = endDates[0] - startDates[0];
    var monthsToGo;
    if(yearsToGo === 0){
        monthsToGo = endDates[1] - startDates[1];
    } else{
        var startYearMonths = 13 - startDates[1];
        var endYearMonths = endDates[1];
        if(yearsToGo === 1){
            monthsToGo = startYearMonths + endYearMonths;
        } else{
            var midYearsMonths = (yearsToGo-1)*12;
            monthsToGo = startYearMonths + midYearsMonths + endYearMonths;
        }
    }
    var year = startDates[0];
    var month = startDates[1];
    var outList = [];

    return when.promise(function(resolve, reject){
        function getSignedUrlsForParser(){
            var monthString;
            if(month < 10){
                monthString = "0" + month;
            } else{
                monthString = "" + month;
            }
            var pathParams = ['archives', 'dev', gameId, year, monthString];
            this.serviceManager.awss3.getSignedUrls('csv', pathParams)
                .then(function(urls){
                    urls.forEach(function(url){
                        outList.push(url);
                    });
                    if(monthsToGo > 0){
                        monthsToGo--;
                        month++;
                        if(month === 13){
                            month = 1;
                            year++;
                        }
                        getSignedUrlsForParser.call(this);
                    } else{
                        this.requestUtil.jsonResponse(res, {
                            numCSVs: outList.length,
                            urls: outList
                        });
                        resolve();
                    }
                }.bind(this))
                .then(null, function(err){
                    reject(err);
                    this.requestUtil.errorResponse(res, err, 401);
                }.bind(this));
        }
        getSignedUrlsForParser.call(this);
    }.bind(this));
}

// changes runningArchive state to false, stopping archive
function stopArchive(req, res){

    if( !(req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length) ) {
        // if has no code
        return this.requestUtil.errorResponse(res, {key:"research.access.invalid"}, 401);
    }

    // code saved as a constant. discuss how we want the code to be saved.
    if( req.params.code !== rConst.code ) {
        // If the code is not valid
        this.requestUtil.errorResponse(res, {key:"research.access.invalid"}, 401);
    } else if(runningArchive === true){
        // If archive running, then change to state to false, stopping archive in recursor
        this.requestUtil.jsonResponse(res, {status:"archiving stopped"});
        runningArchive = false;
    } else{
        // runningArchive state is false, inform that stop archive is not stopping a running job
        this.requestUtil.jsonResponse(res, {status:"archive not running"});
    }
}

function archiveEventsByGameId(req, res, next) {
    // api method, archives events for one particular game
    var gameId = req.params.gameId;
    return archiveEvents.call(this, req, res, next, gameId);
}

function archiveEvents(req, res, next, id) {
    if( !(req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length) ) {
        // if has no code
        this.requestUtil.errorResponse(res, {key:"research.access.invalid"}, 401);
    }

    // code saved as a constant. discuss how we want the code to be saved.
    if( req.params.code !== rConst.code ) {
        // If the code is not valid
        this.requestUtil.errorResponse(res, {key:"research.access.invalid"}, 401);
    } else if(runningArchive === true){
        // If archive running, inform that archive is in progress and return. no duplicate archive job
        this.requestUtil.jsonResponse(res, {status:"archive already in progress"});
        return;
    } else{
        // runningArchive state is false. change to true
        runningArchive = true;
    }

    // Check if specific game Id given. else, archive for all games
    var gameIds = [];
    if(id){
        gameIds.push(id);
    } else if( req.query.gameId ) {
        gameIds.push( req.query.gameId );
    } else {
        // archive for all games
        // 'all games' hard coded.  maybe change
        gameIds.push( "SC" );
        gameIds.push( "AA-1" );
        gameIds.push( "AW-1" );
    }


    // Get the service manager
    var serviceManager = this.serviceManager;

    // index for ids array, changes when one game is upToDate, and sets new gameId for archiveEventsByDate
    var index = 0;
    var upToDate;
    var gameId;

    // eventCount and startProcess used in gd:archiveInfo
    var eventCount = 0;
    var startProcess;

    // catches seconds which need to be manually pulled from couchbase
    // describes the exact second, game, and s3 key that these seconds of data belong to
    var manualSeconds = [];

    // Set the duration if it exists, other default to 1 hour
    var duration = 1;
    if( req.query.duration ) {
        duration = req.query.duration;
    }
    duration *= ( rConst.oneHour );

    // Set the limit if it exists, otherwise default to 2000
    // Also, don't allow the limit to be 0 or less
    var limit = 2000;
    if( req.query.limit ) {
        limit = req.query.limit > 0 ? req.query.limit : limit;
    }

    // Everything seems valid, return a response
    this.requestUtil.jsonResponse(res, {status:"archiving triggered"});

    // Send a started email
    var emailData = {
        subject: "Data Archiving Started...",
        to: rConst.email,
        data: { message: "started" },
        host: req.protocol + "://" + req.headers.host
    };
    var email = new Util.Email(
        this.options.auth.email,
        path.join( __dirname, "../email-templates" ),
        this.stats );
    email.send( "archive-status", emailData );

    console.log( "Archiving: Beginning Archiving!" );

    return when.promise(function(resolve, reject) {
        var startTime = Date.now();
        startProcess = Date.now();
        console.log( "Archiving: Start Time: " + startTime + ", Start Process: " + startProcess );
        // archiveCheck called recursively till archiving complete or time duration has run out
        function archiveCheck() {
            var currentTime = Date.now();
            console.log( "Archiving: Checking for available time." );
            // max duration in milliseconds, start determined by api call with code
            // cron job will determine when to make api call
            if(currentTime - startTime < duration && index < gameIds.length){
                gameId = gameIds[index];
                archiveEventsByDate.call( this, gameId, eventCount, startProcess, limit )
                    .then(function(output){
                        console.log( "Archiving: archiveEventsByDate complete, checking up to date." );
                        // upToDate boolean says if game is archived through yesterday
                        upToDate = output[0];
                        eventCount = output[1];
                        if(output[2].length > 0){
                            output[2].forEach(function(second){
                                manualSeconds.push(second);
                            }.bind(this));
                        }
                        if(upToDate){
                            eventCount = 0;
                            index++;
                            startProcess = Date.now();
                        }
                        archiveCheck.call(this);
                    }.bind(this))
                    .then(null, function(err){
                        // err has both the error object, and the date of the events where the error occurred
                        var error = JSON.stringify(err.error);
                        console.log( "Archiving: Error in archiving: " + error );
                        // archive job errored out, so set state to false
                        runningArchive = false;
                        // Send a failure email
                        // failure email contains additional information to help track down the error
                        // manualSeconds is not error related and can appear in either failure or success email
                        var emailData = {
                            subject: "Data Archiving Failure!",
                            to: rConst.email,
                            data: { message: error, game: gameId, date: err.date, manualSeconds: manualSeconds },
                            host: req.protocol + "://" + req.headers.host
                        };
                        if(manualSeconds.length > 0){
                            console.log('seconds to pull manually:',manualSeconds);
                        }
                        var email = new Util.Email(
                            this.options.auth.email,
                            path.join( __dirname, "../email-templates" ),
                            this.stats );
                        email.send( "archive-status", emailData );

                        reject();
                    }.bind(this));
            } else{
                console.log( "Archiving: completed archiving job!" );
                // archive job complete, so set state to false
                runningArchive = false;
                // Send a success email
                // manualSeconds is not error related and can appear in either failure or success email
                var emailData = {
                    subject: "Data Archiving Successful!",
                    to: rConst.email,
                    data: { message: "success", manualSeconds: manualSeconds },
                    host: req.protocol + "://" + req.headers.host
                };
                if(manualSeconds.length > 0){
                    console.log('seconds to pull manually:',manualSeconds);
                }
                var email = new Util.Email(
                    this.options.auth.email,
                    path.join( __dirname, "../email-templates" ),
                    this.stats );
                email.send( "archive-status", emailData );

                resolve();
            }
        }
        archiveCheck.call(this);
    }.bind(this));
}


function archiveEventsByDate(gameId, count, startProcess, limit){
    return when.promise(function(resolve, reject){
        // multiple of the limit in _archiveEventsByLimit, toggle as needed for testing
        var maxCSVQueries = Math.round( rConst.csvLimit / limit );
        console.log( "Archiving: maxCSVQueries is " + maxCSVQueries );
        var queriesTillNewCSV = maxCSVQueries;

        // running count of number of events archived for this particular game in archive job
        var eventCount = count;

        // moment date objects used in _archiveEventsByLimit
        // when startDateTime equals endDateTime, then archiving for this day is done
        var startDateTime;
        var endDateTime;

        // dates compared to see if game data is 'up to date.' if up to date, values will be equal
        // thisDate should be <= yesterdayDate
        var yesterdayDate;
        var thisDate;

        // human readable date string used in s3 object name
        var formattedDate;
        // game data for a day can be divided into many csvs
        // part included in s3 file name to distinguish data files from same day
        var part = 1;
        // part of s3 fileName that does not change in a given day, combine with part to form fileName
        var fileString;
        // informs whether we are creating a new file or updating an existing one
        var existingFile = false;

        // schema for this game's data
        var parsedSchemaData;

        var manualSeconds = [];
        // reveals if there are any manualSeconds
        var manualState = false;

        // data that will be written to a single csv file s3. reset when moving on to new file
        var outData = [];

        console.log( "Archiving: beginning archiveEventsByDate" );

        // calls archiveEventsByLimit.
        // If limit is reached, calls again, changing the fileName so data can be written to new s3 object
        function recursor(){
            console.log( "Archiving: started recursor." );
            return when.promise(function(resolve, reject){
                _archiveEventsByLimit.call(this, gameId, startDateTime, endDateTime, parsedSchemaData, existingFile, limit)
                    .then(function(outputs){
                        // updatedDateTime from _archiveEventsByLimit becomes new startDateTime
                        startDateTime = outputs[0];
                        if(outputs[1] > 0){
                            eventCount += outputs[1];
                        }
                        // add events retrieved from _archiveEventsByLimit to outData
                        var limitEvents = outputs[2];
                        limitEvents.forEach(function(event){
                            outData.push(event);
                        });
                        // if not null, then second was seen where data at second is greater than limit
                        // save second information to message it needs to be manually pulled
                        var manualSecond = outputs[3];
                        if(manualSecond !== null){
                            manualSeconds.push({game: 'game: ' + gameId,
                                                second: 'second: ' + manualSecond,
                                                file: 'file: ' + fileString + "_p" + part + ".csv"});
                            manualState = true;
                        }
                        // check if runningArchive state is true.  If true, keep archiving, else stop archiving
                        if(!runningArchive){
                            var stopTime = startDateTime.format("MM/DD/YYYY HH:mm:ss");
                            var error = {'stop.archive': 'Call made to stop archive'};
                            error.stopTime = stopTime;
                            reject(error);
                        }

                        console.log( "Archiving: finished _archiveEventsByLimit with startDateTime: " + startDateTime );

                        queriesTillNewCSV--;
                        if(startDateTime !== endDateTime) {
                            // still more time to check for events in the day
                            console.log( "Archiving: startDateTime and endDateTime are not equal" );
                            existingFile = true;
                            if ((queriesTillNewCSV === 0 || manualState) && outData.length > 1) {
                                // send current data to s3, if csv had enough queries or we saw a manualSecond
                                manualState = false;
                                outData = outData.join("\n");
                                var fileName = fileString + "_p" + part + ".csv";
                                console.log( "Archiving: saving file: " + fileName );
                                // create new object in s3 with data formatted as csv
                                // when promise resolves for putS3, continue recursor
                                this.serviceManager.awss3.putS3Object( fileName, outData )
                                    .then(function(){
                                        outData = [];
                                        // Start the next part
                                         console.log( "Archiving: start the next part." );
                                         queriesTillNewCSV = maxCSVQueries;
                                         part++;
                                         existingFile = false;

                                         return recursor.call(this)
                                    }.bind(this))
                                    .then(function(){
                                        resolve()
                                    }.bind(this))
                                    .then(null, function(err){
                                        reject(err);
                                    }.bind(this));
                            } else{
                                if(queriesTillNewCSV === 0 || manualState){
                                    // if no events in outData and these conditions true, just move to next part
                                    manualState = false;
                                    // Start the next part, new s3 object
                                    console.log("Archiving: start the next part.");
                                    queriesTillNewCSV = maxCSVQueries;
                                    part++;
                                    existingFile = false;
                                }
                                // continue with recursor
                                recursor.call(this)
                                    .then(function () {
                                        resolve()
                                    }.bind(this))
                                    .then(null, function (err) {
                                        reject(err);
                                    }.bind(this));
                            }
                        } else {
                            // startDateTime === endDateTime, so no more calls to recursor
                            // create new object in s3 with data formatted as csv
                            if( outData.length > 1 ) {
                                outData = outData.join("\n");
                                var fileName = fileString + "_p" + part + ".csv";
                                console.log( "Archiving: saving file: " + fileName );
                                return this.serviceManager.awss3.putS3Object( fileName, outData )
                                    .then(function(){
                                        resolve();
                                    }.bind(this))
                                    .then(null, function(err){
                                        reject(err);
                                    }.bind(this));
                            }
                            else {
                                resolve();
                            }
                        }
                    }.bind(this))
                    .then( null, function( err ) {
                        reject( err );
                    });
            }.bind(this));
        }

        // data from gd:archiveInfo couchbase object. will be updated and resubmitted when day's archiving is done
        var archiveInfo;
        this.store.getArchiveInfo()
            .then(function(info){
                console.log( "Archiving: archiveInfo retrieved" );
                archiveInfo = info;
                // date on gd:archiveInfo is saved in milliseconds
                var dateInMS = archiveInfo[gameId].lastArchive.date + rConst.oneDay;
                archiveInfo[gameId].lastArchive.date = dateInMS;
                var dateObj = new Date(dateInMS);
                var dateArr = dateObj.toJSON().split('-');
                var date = dateArr[1] + '-' + dateArr[2].slice(0,2) + '-' + dateArr[0].slice(2,4);

                var dateVariables = _initDates(date);
                startDateTime = dateVariables[0];
                endDateTime = dateVariables[1];
                yesterdayDate = dateVariables[2];
                thisDate = dateVariables[3];
                formattedDate = dateVariables[4];

                if(thisDate > yesterdayDate){
                    // if reaches here, thisDate is invalid, ahead of yesterdayDate. investigate why
                    console.log( "Archiving: rejecting because archiveInfo is up to date" );
                    var error = {"ahead.of.schedule": "gd:archiveInfo is later then it should be"};
                    return when.reject(error);
                }

                var dates = formattedDate.split( "-" );
                fileString =  "archives/" + this.options.env + "/" + gameId + "/"
                                + dates[0] + "/" + dates[1] + "/" + gameId + "_" + formattedDate;

                return this.store.getCsvDataByGameId(gameId);
            }.bind(this))
            .then(function (csvData) {
               return parseCSVSchema(csvData);
            }.bind(this))
            .then(function (_parsedSchemaData) {
                parsedSchemaData = _parsedSchemaData;
                console.log( "Archiving: calling recursor" );
                return recursor.call(this)
            }.bind(this))
            .then(function(){
                var endProcess = Date.now();
                // total number of events for game on this day
                archiveInfo[gameId].lastArchive.eventCount = eventCount;
                // time of processing this day, in milliseconds
                var processTime = endProcess - startProcess;
                archiveInfo[gameId].lastArchive.processTime = processTime;
                return this.store.updateArchiveInfo(archiveInfo);
            }.bind(this))
            .then(function(){
                var upToDate = (thisDate === yesterdayDate);
                resolve([upToDate, eventCount, manualSeconds]);
            }.bind(this))
            .then(null, function(err){
                console.log( "Archiving: Archive Events By Date Error - ", err);
                var error = {};
                error.error = err;
                error.date = formattedDate;
                error.manualSeconds = manualSeconds;
                reject(error);
            }.bind(this));

    }.bind(this));
}


function _archiveEventsByLimit(gameId, startDateTime, endDateTime, parsedSchemaData, existingFile, limit){
    return when.promise(function(resolve, reject) {
        try {
            console.log( "Archiving: in _archiveEventsByLimit with sdt: " + startDateTime + ", edt: " + endDateTime );
            var timeFormat = "MM/DD/YYYY HH:mm:ss";
            // moment object which will become parent scope's startDateTime when _archiveEventsByLimit resolves
            var updatedDateTime = startDateTime;
            var eventCount;
            // second where number of events at that second are >= limit. flagged to be manually pulled
            var manualSecond = null;

            var startDateTimeArray = startDateTime.toArray();
            var endDateTimeArray = endDateTime.toArray();
            this.store.getEventsByGameIdDate(gameId, startDateTimeArray, endDateTimeArray, limit)
                .then(function (events) {
                    console.log( "Archiving: Running Filter: eventCount: " + events.length + ", limit: " + limit );
                    eventCount = events.length;

                    if(eventCount < limit){
                        // did not find events up to limit, so day's querying is done
                        updatedDateTime = endDateTime;
                    }
                    else {
                        // limit reached
                        // serverTimeStamp of last event in events array
                        var lastEventTime = events[events.length - 1].serverTimeStamp;
                        // timestamps below lowTimestamp are malformed, no milliseconds. change to add milliseconds
                        if(lastEventTime < rConst.lowTimeStamp){
                            console.log( "Archiving: adding MS to lastEventTime before while!" );
                            lastEventTime *= 1000;
                        }
                        // the second lastEventTime is part of
                        var lastSecond = Math.floor(lastEventTime/1000)*1000;
                        // serverTimeStamp of first event in events array
                        var firstEventTime = events[0].serverTimeStamp;
                        if(firstEventTime < rConst.lowTimestamp){
                            console.log( "Archiving: adding MS to firstEventTime!" );
                            firstEventTime *= 1000;
                        }
                        if (firstEventTime < lastSecond) {
                            // remove events that occurred in last second of events array
                            var addedMsCount = 0;
                            while (lastEventTime >= lastSecond && events.length > 1) {
                                events.pop();
                                lastEventTime = events[events.length - 1].serverTimeStamp;
                                if(lastEventTime < rConst.lowTimestamp){
                                    lastEventTime *= 1000;
                                    addedMsCount++;
                                }
                            }
                            if(addedMs){
                                console.log( "Archiving: added MS to " + addedMsCount + " Events within while loop!" );
                            }
                        } else {
                            // if all seconds in array were in the last second, do a manual pull on the data
                            manualSecond = new Date(lastSecond).toJSON();
                            console.error( "Archiving: Number of Events at this second >= query limit:", manualSecond );
                            events = [];
                        }
                        updatedDateTime = moment(lastEventTime);
                        updatedDateTime = updatedDateTime.utc();
                        eventCount = events.length;
                        if(eventCount === 0){
                            return [];
                        }
                    }
                    TOTALEVENTS += eventCount;
                    console.log( "Archiving: TOTAL EVENT: " + TOTALEVENTS );
                    // existingFile boolean determines if schema will be added to front of outList
                    return processEvents.call(this, parsedSchemaData, events, timeFormat, existingFile);
                }.bind(this))
                .then(function(outList){
                    resolve([updatedDateTime, eventCount, outList, manualSecond]);
                }.bind(this))
                // catch all
                .then(null, function (err){
                    console.log( "Archiving: Process Events ERROR: " + err );
                    reject(err);
                }.bind(this));

        } catch (err) {
            console.log( "Archiving: Get User Date ERROR: " + err );
            reject(err);
        }
    }.bind(this));
}

// create the various date variables used in archiveEventsByDate
function _initDates(date){
    var startDateTime = moment(date);
    startDateTime.hour(0);
    startDateTime.minute(0);
    startDateTime.seconds(0);
    startDateTime = startDateTime.utc();

    var endDateTime = moment(date);
    endDateTime.hour(23);
    endDateTime.minute(59);
    endDateTime.seconds(59);
    endDateTime = endDateTime.utc();

    var yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate()-1);
    yesterdayDate = yesterdayDate.setHours(0,0,0,0);

    var thisDate =  new Date(date);
    thisDate = thisDate.setHours(0,0,0,0);

    var formattedDate = startDateTime.format("YYYY-MM-DD");

    return [startDateTime, endDateTime, yesterdayDate, thisDate, formattedDate];
}

// to be passed as formatter argument with awss3.alterS3ObjectNames(formatter, docType, pathParams)
// parses an s3 key and, if the month parameter is in the wrong spot in the file name, changes the file name
function swapDateFormatForCSV(key){
    try {
        var pathStart = 's3://' + this.bucket + '/';
        var paths = key.split('/');
        var month = paths[4];
        var fileName = paths[5];
        var nameParts = fileName.split("_");
        var dates = nameParts[1].split("-");
        if (month !== dates[1]) {
            var startKey = pathStart + key;
            dates[2] = dates[1];
            dates[1] = month;
            nameParts[1] = dates.join("-");
            paths[5] = nameParts.join("_");
            key = paths.join('/');
            var endKey = pathStart + key;
            return [startKey, endKey];
        } else {
            return 'name is already properly date formatted';
        }
    } catch(err){
        return err;
    }
}

function getEventsByDate(req, res, next){

    try {
        // set timeout so request doesn't close connection
        req.connection.setTimeout(this.options.request.httpTimeout);

        if( req.session &&
        req.session.passport) {
            var userData = req.session.passport.user;
            // check user permission
            if (!userData.permits.nav.parser) {
                this.requestUtil.errorResponse(res, {key: "user.permit.invalid"});
                return;
            }
        }

        if(!req.query) {
            this.requestUtil.errorResponse(res, {key: "research.arguments.missing"}, 401);
            return;
        }

        if( !( req.params &&
            req.params.hasOwnProperty("gameId") ) ) {
            this.requestUtil.errorResponse(res, {key: "research.gameId.missing"});
            return;
        }
        var gameId = req.params.gameId;
        // gameId are not case sensitive
        gameId = gameId.toUpperCase();

        var parsedSchemaData = { header: "", rows: {} };
        // if no schema assume it's gameId
        var schema = gameId;
        if(req.query.schema) {
            schema = req.query.schema;
        }

        var startDate = moment({hour: 0});
        // startDate or startEpoc optional
        if(req.query.startEpoc) {
            startDate = parseInt(req.query.startEpoc)*1000;
        }
        if(req.query.startDate) {
            startDate = req.query.startDate;
            // if starts with " then strip "s
            if(startDate.charAt(0) == '"') {
                startDate = startDate.substring(1, startDate.length-1);
            }
        }
        if(!startDate) {
            this.requestUtil.errorResponse(res, {key: "research.startDate.missing"}, 401);
            return;
        }
        startDate = moment(startDate);
        if( req.query.startDateHour ) {
            var startDateHour = req.query.startDateHour;
            startDate.hour( startDateHour );
        }
        else {
            startDate.hour(0);
        }
        if( req.query.startDateMin ) {
            var startDateMin = req.query.startDateMin;
            startDate.minute( startDateMin );
        }
        else {
            startDate.minute(0);
        }
        if( req.query.startDateSec ) {
            var startDateSec = req.query.startDateSec;
            startDate.seconds( startDateSec );
        }
        else {
            startDate.seconds(0);
        }
        startDate = startDate.utc();

        var endDate = moment();
        if(req.query.dateRange) {

            try {
                endDate = JSON.parse(req.query.dateRange);
                endDate = moment(startDate).add(endDate);
            } catch(err) {
                // error is ok, just ignore dateRange
                console.error("dateRange err:", err);
            }
        }
        if(req.query.endDate) {
            endDate = req.query.endDate;
            // if starts with " then strip "s
            if(endDate.charAt(0) == '"') {
                endDate = endDate.substring(1, endDate.length-1);
            }
            endDate = moment(endDate);
        }
        if( req.query.endDateHour ) {
            var endDateHour = req.query.endDateHour;
            endDate.hour( endDateHour );
        }
        else {
            endDate.hour(23);
        }
        if( req.query.endDateMin ) {
            var endDateMin = req.query.endDateMin;
            endDate.minute( endDateMin );
        }
        else {
            endDate.minute(59);
        }
        if( req.query.endDateSec ) {
            var endDateSec = req.query.endDateSec;
            endDate.seconds( endDateSec );
        }
        else {
            endDate.seconds(59);
        }
        //endDate.hour(23);
        //endDate.minute(59);
        //endDate.seconds(59);
        endDate = endDate.utc();


        var timeFormat = "MM/DD/YYYY HH:mm:ss";
        if(req.query.timeFormat) {
            timeFormat = req.query.timeFormat;
        }

        var limit = 10000;
        if(req.query.limit) {
            limit = req.query.limit;
        }

        var saveToFile = false;
        if(req.query.saveToFile) {
            saveToFile = (req.query.saveToFile === "true" ? true : false);
        }
        var outList;
        return when.promise(function(resolve, reject) {
            this.store.getCsvDataByGameId(gameId)
                .then(function (csvData) {
                    return parseCSVSchema(csvData);
                }.bind(this))

                .then(function (_parsedSchemaData) {
                    parsedSchemaData = _parsedSchemaData;

                    console.log("Getting Events For Game:", gameId, "from", startDate.format("MM/DD/YYYY"), "to", endDate.format("MM/DD/YYYY"));
                    return this.store.getEventsByGameIdDate(gameId, startDate.toArray(), endDate.toArray(), limit)
                }.bind(this))

                .then(function (events) {
                    console.log("Running Filter...");
                    console.log("Processing", events.length, "Events...");
                    // process events
                    return processEvents.call(this, parsedSchemaData, events, timeFormat);
                }.bind(this))

                .then(function (list) {
                    outList = list;
                    if (outList.length > limit) {
                        return getSignedUrlsByDayRange.call(this, req, res);
                    }
                }.bind(this))

                .then(function () {
                    var outData = outList.join("\n");
                    if(outList.length > limit){
                        if (saveToFile) {
                            var file = gameId
                                + "_" + startDate.format("YYYY-DD-MM")
                                + "_" + endDate.format("YYYY-DD-MM")
                                + ".csv";
                            this.requestUtil.downloadResponse(res, outData, file, 'text/csv');
                            /*
                             this.requestUtil.jsonResponse(res, {
                             numEvents: outList.length - 1, // minus header
                             data: outData
                             });
                             */
                        } else {
                            this.requestUtil.jsonResponse(res, {
                                numEvents: outList.length - 1, // minus header
                                data: outData
                            });
                        }
                    }
                    resolve();
                }.bind(this))

                // catch all
                .then(null, function (err) {
                    console.trace("Research: Process Events -", err);
                    this.requestUtil.errorResponse(res, {error: err});
                    reject(err);
                }.bind(this));
            }.bind(this));
    } catch(err) {
        console.trace("Research: Get User Data Error -", err);
        this.requestUtil.errorResponse(res, {error: err});
    }
}

function parseCSVSchema(csvData) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var parsedSchemaData = { header: "", rows: {} };
    try {
        csv()
        .from(csvData, { delimiter: ',', escape: '"' })
        .on('record', function(row, index){

            // header
            if(index == 0) {
                row.shift(); // remove first column
                parsedSchemaData.header = csv().stringifier.stringify(row);
            } else {
                var key = row.shift(); // remove first (key) column
                parsedSchemaData.rows[ key ] = row;
            }

            //console.log('#'+index+' '+JSON.stringify(row));
        }.bind(this))
        .on('end', function(){
            resolve(parsedSchemaData);
        }.bind(this))
        .on('error', function(err){
            reject(err);
        }.bind(this));

    } catch(err) {
        console.trace("Research: Parse CSV Schema Error -", err);
        var res = res || false;
        if(res){
            this.requestUtil.errorResponse(res, {error: err});
        }
    }

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}


function processEvents(parsedSchema, events, timeFormat, existingFile) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    //console.log("events:", events);
    //console.log("Parsed Schema for", schema, ":", parsedSchema);

    var outIt = 0;
    var outList = [];
    existingFile = existingFile || false;

    gameSessionIdList = _.pluck(events, "gameSessionId");
    this.store.getUserDataBySessions(gameSessionIdList)
        .then(function(userDataList){

            var timeDiff = 0;
            events.forEach(function(event, i) {

                try {
                    var startTime = moment();
                    var row = [];
                    if( i != 0 &&
                        i % this.options.research.dataChunkSize == 0)
                    {
                        var avgTimeDiff = timeDiff/i;
                        console.log("Processed Events:", i, ", Avg Time:", avgTimeDiff.toFixed(3));
                    }

                    if( !event.userId &&
                        event.gameSessionId &&
                        userDataList[event.gameSessionId] &&
                        userDataList[event.gameSessionId].userId
                      ) {
                        // add user Id to event
                        event.userId = userDataList[event.gameSessionId].userId;
                    }

                    // event name exists in parse map
                    if( parsedSchema.rows.hasOwnProperty(event.eventName) ) {
                        row = _.clone(parsedSchema.rows[ event.eventName ]);
                    }
                    // wildcard to catch all other event types
                    else if( parsedSchema.rows.hasOwnProperty('*') ) {
                        row = _.clone(parsedSchema.rows['*']);
                    } else {
                        //console.log("Process Event - Event Name not in List:", event.eventName);
                    }

                    if(timeFormat) {
                        // convert timestamp if not in milliseconds
                        var ct = event.clientTimeStamp;
                        var st = event.serverTimeStamp;
                        if(ct < 10000000000) ct *= 1000;
                        if(st < 10000000000) st *= 1000;

                        // need to convert EPOC to milliseconds
                        event.clientTimeStamp = moment(ct).format(timeFormat);
                        event.serverTimeStamp = moment(st).format(timeFormat);
                    }

                    if(row.length > 0) {
                        // check each row item
                        for(var r in row) {
                            if(row[r] == '*') {
                                row[r] = JSON.stringify(event);
                            } else {
                                row[r] = parseItems(event, row[r], '{', '}');
                                row[r] = parseItems(event.eventData, row[r], '[', ']');
                            }
                        }

                        outList[outIt] = csv().stringifier.stringify(row);
                        outIt++;
                    }

                    timeDiff += moment().diff(startTime);
                } catch(err) {
                    console.trace("Research: Process Events Error -", err);
                    reject(err);
                }
            }.bind(this));

        }.bind(this))
        .then(function(){
            console.log("Done Processing", events.length, "Events -> Out Events", outList.length);

            // add header
            if(!existingFile){
                outList.unshift(parsedSchema.header);
            }
            resolve(outList);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}

function parseItems(event, row, left, right){
    var re = new RegExp("\\"+left+"(.*?)\\"+right, 'g');
    var matchs = getMatches(row, re, 1);

    var item = "", key = "";
    for(var m in matchs) {
        key = left + matchs[m] + right;
        item = processSpecialRowItem(matchs[m], event);

        var reReplace = new RegExp(escapeRegExp(key), 'g');
        row = row.replace(reReplace, item);
    }

    return row;
}

function processSpecialRowItem (item, data) {
    var results = "";
    with(data){
        try {
            results = eval(item);
        }
        catch(err) {
            // this is ok
        }
    }

    if(_.isObject(results)) {
        results = JSON.stringify(results);
    }

    return results;
}


function escapeRegExp(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function getMatches(string, regex, index) {
    index = index || 1; // default to the first capturing group
    var matches = [];
    var match;
    while (match = regex.exec(string)) {
        matches.push(match[index]);
    }
    return matches;
}