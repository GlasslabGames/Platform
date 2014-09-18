
var _         = require('lodash');
var when      = require('when');
var moment    = require('moment');
var csv       = require('csv');

module.exports = {
    getEventsByDate: getEventsByDate
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
function getEventsByDate(req, res, next){
    try {
        // set timeout so request doesn't close connection
        req.connection.setTimeout(this.options.request.httpTimeout);

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
        endDate.hour(23);
        endDate.minute(59);
        endDate.seconds(59);
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
        .on('error', function(error){
            reject(error);
        }.bind(this));

    } catch(err) {
        console.trace("Research: Parse CSV Schema Error -", err);
        this.requestUtil.errorResponse(res, {error: err});
    }

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}


function processEvents(parsedSchema, events, timeFormat) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    //console.log("events:", events);
    //console.log("Parsed Schema for", schema, ":", parsedSchema);

    var outIt = 0;
    var outList = [];

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
            outList.unshift(parsedSchema.header);
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