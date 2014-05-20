
var _         = require('lodash');
var when      = require('when');
var moment    = require('moment');

var Util      = require('../../core/util.js');
var lConst    = require('../../lms/lms.const.js');

module.exports = {
    getEventsByDate: getEventsByDate
};

/*
 http://localhost:8090/research/events/get?gameId=AA-1&startDate=2014-05-01&endDate=2014-05-14&timeFormat="mm/dd/yyyy hh:mm:ss"

 http://localhost:8001/research/events/get?gameId=AA-1&startDate=2014-05-01&endDate=2014-05-14&timeFormat="mm/dd/yyyy hh:mm:ss"

 required:
    gameId
    startDate
 */
function getEventsByDate(req, res, next){
    try {
        if(!req.query) {
            this.requestUtil.errorResponse(res, {error: "missing arguments"}, 401);
            return;
        }

        if(!req.query.gameId) {
            this.requestUtil.errorResponse(res, {error: "missing gameId"}, 401);
            return;
        }
        var gameId = req.query.gameId;

        if(!this.parsedSchema.hasOwnProperty(gameId)) {
            this.requestUtil.errorResponse(res, {error: "missing game parser schema"}, 401);
            return;
        }

        if(!req.query.startDate) {
            this.requestUtil.errorResponse(res, {error: "missing startDate"}, 401);
            return;
        }
        var startDate = moment(req.query.startDate);

        var endDate   = moment();
        if(!req.query.endDate) {
            endDate = moment(req.query.endDate);
        }

        var timeFormat = "";
        if(!req.query.timeFormat) {
            timeFormat = req.query.timeFormat;
        }

        this.store.getEventsByDate(startDate.toArray(), endDate.toArray())
            .then(function(events){

                try {
                    console.log("Running Filter...");
                    events = _.filter(events,
                        function (event) {
                            return (event.gameId == gameId);
                        }
                    );

                    console.log("Process Events...");
                    // process events
                    var out = processEvents.call(this, gameId, events, timeFormat);
                    res.writeHead(200, {
                        'Content-Type': 'text/plain'
                        //'Content-Type': 'text/csv'
                    });
                    res.end(out);

                } catch(err) {
                    console.trace("Research: Process Events -", err);
                    this.stats.increment("error", "ProcessEvents.Catch");
                    this.requestUtil.errorResponse(res, {error: err});
                }

            }.bind(this),
            function(err){
                this.requestUtil.errorResponse(res, err);
            }.bind(this)
        );
    } catch(err) {
        console.trace("Research: Get User Data Error -", err);
        this.stats.increment("error", "GetUserData.Catch");
        this.requestUtil.errorResponse(res, {error: err});
    }
}

function processEvents(gameId, events, timeFormat) {
    //console.log("events:", events);
    var parsedSchema = this.parsedSchema[gameId];

    var sessionOrderList = {};
    var out = parsedSchema.header + "\n";
    var row = "";

    for(var i = 0; i < events; i++) {
        var event = events[i];

        //console.log("Process Event", i);
        // event name exists in parse map
        if( parsedSchema.rows.hasOwnProperty(event.eventName) ) {
            row = parsedSchema.rows[ event.eventName ];

            if(timeFormat) {
                event.clientTimeStamp = moment(event.clientTimeStamp).format(timeFormat);
                event.serverTimeStamp = moment(event.serverTimeStamp).format(timeFormat);
            }

            // if session not in list then gen
            if(!sessionOrderList.hasOwnProperty(event.gameSessionId)) {
                sessionOrderList[event.gameSessionId] = 1;
            } else {
                sessionOrderList[event.gameSessionId]++;
            }
            event.gameSessionOrder = sessionOrderList[event.gameSessionId];

            for(e in event) {
                var re = new RegExp('{'+e+'}', 'g');
                row = row.replace(re, event[e]);
            }

            for(d in event.eventData) {
                var re = new RegExp('['+d+']', 'g');
                row = row.replace(re, event[d]);
            }

            out += row + "\n";
            //console.log(row);
        }
    }

    return out;
}