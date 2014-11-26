
var path      = require('path');
var _         = require('lodash');
var when      = require('when');
var moment    = require('moment');
var csv       = require('csv');
var Util      = require('../../core/util.js');

var TOTALEVENTS = 0;
var runningArchive = false;

module.exports = {
    getEventsByDate: getEventsByDate,
    archiveEventsByGameId: archiveEventsByGameId,
    archiveEvents: archiveEvents,
    stopArchive: stopArchive
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

function stopArchive(req, res){
    //0eebfae0-6d9b-ede9-41e1-f726be96e1b0
    if( !(req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length) ) {
        this.requestUtil.errorResponse(res, {key:"research.access.invalid"}, 401);
    }

    // If the code is not valid
    if( req.params.code !== "0eebfae0-6d9b-ede9-41e1-f726be96e1b0" ) {
        this.requestUtil.errorResponse(res, {key:"research.access.invalid"}, 401);
    } else if(runningArchive === true){
        this.requestUtil.jsonResponse(res, {status:"archiving stopped"});
        runningArchive = false;
    } else{
        this.requestUtil.jsonResponse(res, {status:"archive not running"});
    }
}

function archiveEventsByGameId(req, res, next) {

}

function archiveEvents(req, res, next) {
    // 0eebfae0-6d9b-ede9-41e1-f726be96e1b0
    if( !(req.params.code &&
        _.isString(req.params.code) &&
        req.params.code.length) ) {
        this.requestUtil.errorResponse(res, {key:"research.access.invalid"}, 401);
    }

    // If the code is not valid
    if( req.params.code !== "0eebfae0-6d9b-ede9-41e1-f726be96e1b0" ) {
        this.requestUtil.errorResponse(res, {key:"research.access.invalid"}, 401);
    } else if(runningArchive === true){
        this.requestUtil.jsonResponse(res, {status:"archive already in progress"});
        return;
    } else{
        runningArchive = true;
    }

    // Check for game Id
    var gameIds = [];
    if( req.query.gameId ) {
        gameIds.push( req.query.gameId );
    }
    else {
        gameIds.push( "SC" );
        gameIds.push( "AA-1" );
        gameIds.push( "AW-1" );
    }


    // Get the service manager
    var serviceManager = this.serviceManager;

    // hard coded ids array for now
    // when integrate info.json couchbase stuff, then can use view to find list of all ids programmatically
    var index = 0;
    var eventCount = 0;
    var startProcess;
    var upToDate;
    var manualSeconds = [];
    var gameId;

    // Set the duration if it exists, other default to 1 hour
    var duration = 1;
    if( req.query.duration ) {
        duration = req.query.duration;
    }
    duration *= ( 3600 * 1000 );

    // Everything seems valid, return a response
    this.requestUtil.jsonResponse(res, {status:"archiving triggered"});

    // Send a started email
    var emailData = {
        subject: "Data Archiving Started...",
        to: "ben@glasslabgames.org",
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
        function archiveCheck() {
            var currentTime = Date.now();
            console.log( "Archiving: Checking for available time." );
            // duration in milliseconds, job runs from 12 am to 4 am pacific time normally,
            // but can be triggered at any time provided a valid code.
            if(currentTime - startTime < duration && index < gameIds.length){
                gameId = gameIds[index];
                archiveEventsByDate.call( this, gameId, eventCount, startProcess )
                    .then(function(output){
                        console.log( "Archiving: archiveEventsByDate complete, checking up to date." );
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
                        var error = JSON.stringify(err.error);
                        console.log( "Archiving: Error in archiving: " + error );
                        runningArchive = false;
                        // Send a failure email
                        var emailData = {
                            subject: "Data Archiving Failure!",
                            to: "ben@glasslabgames.org",
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
                runningArchive = false;
                // Send a success email
                var emailData = {
                    subject: "Data Archiving Successful!",
                    to: "ben@glasslabgames.org",
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


function archiveEventsByDate(gameId, count, startProcess){
    return when.promise(function(resolve, reject){
        // multiple of the limit in _archiveEventsByLimit, toggle as needed for testing
        // with the production query limit of 2000, maxCSVQueries would be 5, 5*2000 is 10000
        var maxCSVQueries = 5;
        var queriesTillNewCSV = maxCSVQueries;

        var startDateTime;
        var endDateTime;
        var yesterdayDate;
        var thisDate;
        var formattedDate;
        var eventCount = count;

        var part = 1;
        var parsedSchemaData;
        var fileString;
        var file;
        var existingFile = false;
        var manualSeconds = [];
        var manualState = false;

        var outData = [];

        console.log( "Archiving: beginning archiveEventsByDate" );

        // calls archiveEventsByLimit.
        // If limit is reached, calls again, changing the fileName so data can be written to new s3 object
        function recursor(){
            console.log( "Archiving: started recursor." );
            return when.promise(function(resolve, reject){
                _archiveEventsByLimit.call(this, gameId, startDateTime, endDateTime, parsedSchemaData, existingFile)
                    .then(function(outputs){
                        startDateTime = outputs[0];
                        if(outputs[1] > 0){
                            eventCount += outputs[1];
                        }
                        outData = outData.concat( outputs[2] );
                        if(outputs[3] !== null){
                            manualSeconds.push({game: 'game: ' + gameId,
                                                second: 'second: ' + outputs[3],
                                                file: 'file: ' + fileString + "_p" + part + ".csv"});
                            manualState = true;
                        }

                        if(!runningArchive){
                            var stopTime = startDateTime.format("MM/DD/YYYY HH:mm:ss");
                            var error = {'stop.archive': 'Call made to stop archive'};
                            error.stopTime = stopTime;
                            reject(error);
                        }

                        console.log( "Archiving: finished _archiveEventsByLimit with startDateTime: " + startDateTime );

                        queriesTillNewCSV--;
                        if(startDateTime !== endDateTime) {
                            console.log( "Archiving: startDateTime and endDateTime are not equal" );
                            existingFile = true;
                            if (queriesTillNewCSV === 0 || manualState) {
                                // send current data to s3
                                manualState = false;
                                if( outData.length > 1 ) {
                                    outData = outData.join("\n");
                                    var fileName = fileString + "_p" + part + ".csv";
                                    console.log( "Archiving: saving file: " + fileName );
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
                                }

                                // Start the next part, new s3 object
                                console.log( "Archiving: start the next part." );
                                queriesTillNewCSV = maxCSVQueries;
                                part++;
                                existingFile = false;
                            }
                            recursor.call(this)
                                .then(function () {
                                    resolve()
                                }.bind(this))
                                .then(null, function (err) {
                                    reject(err);
                                }.bind(this));
                        } else {
                            // Once we're finished, send to s3
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
                    }.bind(this));
            }.bind(this));
        }

        var archiveInfo;
        this.store.getArchiveInfo()
            .then(function(info){
                console.log( "Archiving: archiveInfo retrieved" );
                archiveInfo = info;
                // one day in milliseconds.  Date is saved in gd:archiveInfo in terms of milliseconds
                var oneDay = 86400000;
                var dateInMS = archiveInfo[gameId].lastArchive.date + oneDay;
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
                    console.log( "Archiving: rejecting because archiveInfo is up to date" );
                    return when.reject('up to date');
                }

                var dates = formattedDate.split( "-" );
                fileString =  "archives/" + this.options.env + "/" + gameId + "/"
                                + dates[0] + "/" + dates[2] + "/" + gameId + "_" + formattedDate;

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
            .then(function(state){
                upToDate = state;
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
                if(err === 'up to date'){
                    console.log( "Archiving: returning because up to date" );
                    resolve([true, null, manualSeconds]);
                    return;
                }
                console.log( "Archiving: Archive Events By Date Error - ", err);
                var error = {};
                error.error = err;
                error.date = formattedDate;
                error.manualSeconds = manualSeconds;
                reject(error);
            }.bind(this));

    }.bind(this));
}


function _archiveEventsByLimit(gameId, startDateTime, endDateTime, parsedSchemaData, existingFile){
    return when.promise(function(resolve, reject) {
        try {
            console.log( "Archiving: in _archiveEventsByLimit with sdt: " + startDateTime + ", edt: " + endDateTime );
            var timeFormat = "MM/DD/YYYY HH:mm:ss";
            // query limit for couchbase.  the max number of elements in csv file is a multiple of this value
            var limit = 2000;
            var updatedDateTime = startDateTime;
            var eventCount;
            var manualSecond = null;

            var startDateTimeArray = startDateTime.toArray();
            var endDateTimeArray = endDateTime.toArray();
            console.log('Start before getEventsbyGameIdDate:', JSON.stringify(startDateTimeArray));
            console.log('End before getEventsByGameIdDate:', JSON.stringify(endDateTimeArray));
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
                        var lastEventTime = events[events.length - 1].serverTimeStamp;
                        if(lastEventTime < 10000000000){
                            lastEventTime *= 1000;
                        }
                        var lastSecond = Math.floor(lastEventTime/1000)*1000;
                        var firstEventTime = events[0].serverTimeStamp;
                        if(firstEventTime < 10000000000){
                            firstEventTime *= 1000;
                        }
                        if (firstEventTime < lastSecond) {
                            // remove events that occurred in last second of events array
                            while (lastEventTime >= lastSecond || events.length === 1) {
                                events.pop();
                                lastEventTime = events[events.length - 1].serverTimeStamp;
                                if(lastEventTime < 10000000000){
                                    lastEventTime *= 1000;
                                }
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
                            return;
                        }
                    }
                    TOTALEVENTS += eventCount;
                    console.log( "Archiving: TOTAL EVENT: " + TOTALEVENTS );
                    return processEvents.call(this, parsedSchemaData, events, timeFormat, existingFile);
                }.bind(this))
                .then(function(outList){
                    outList = outList || [];
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

    var formattedDate = startDateTime.format("YYYY-DD-MM");

    return [startDateTime, endDateTime, yesterdayDate, thisDate, formattedDate];
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
            this.requestUtil.errorResponse(res, {error: "missing arguments"}, 401);
            return;
        }

        if( !( req.params &&
            req.params.hasOwnProperty("gameId") ) ) {
            this.requestUtil.errorResponse(res, {error: "missing game id"});
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
            this.requestUtil.errorResponse(res, {error: "missing startDate or startEpoc missing"}, 401);
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

        var limit;
        if(req.query.limit) {
            limit = req.query.limit;
        }

        var saveToFile = false;
        if(req.query.saveToFile) {
            saveToFile = (req.query.saveToFile === "true" ? true : false);
        }

        this.store.getCsvDataByGameId(gameId)
            .then(function(csvData){
                return parseCSVSchema(csvData);
            }.bind(this))

            .then(function(_parsedSchemaData){
                parsedSchemaData = _parsedSchemaData;

                console.log("Getting Events For Game:", gameId, "from", startDate.format("MM/DD/YYYY"), "to", endDate.format("MM/DD/YYYY"));
                return this.store.getEventsByGameIdDate(gameId, startDate.toArray(), endDate.toArray(), limit)
            }.bind(this))

            .then(function(events){

                try {
                    console.log("Running Filter...");
                    console.log("Processing", events.length, "Events...");

                    // process events
                    var p = processEvents.call(this, parsedSchemaData, events, timeFormat);
                    p.then(function(outList) {
                        var outData = outList.join("\n");

                        if(saveToFile) {
                            var file = gameId
                                +"_"+startDate.format("YYYY-DD-MM")
                                +"_"+endDate.format("YYYY-DD-MM")
                                +".csv";
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
                    }.bind(this));

                } catch(err) {
                    console.trace("Research: Process Events -", err);
                    this.requestUtil.errorResponse(res, {error: err});
                }

            }.bind(this))

            // catch all
            .then(null, function(err){
                this.requestUtil.errorResponse(res, err);
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