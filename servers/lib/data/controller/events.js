
var when   = require('when');
var Util   = require('../../core/util.js');
var lConst = require('../../lms/lms.const.js');

module.exports = {
    sendBatchTelemetryV2: sendBatchTelemetryV2,
    eventsCount:          eventsCount
};

/*
 Required properties
 clientTimeStamp, gameId, eventName

 Input Types accepted
 gameSessionId: String
 eventList : (Array or Object)
     userId: String or Integer (Optional)
     deviceId: String          (Optional)
     clientTimeStamp: Integer  (Required)
     gameId: String            (Required)
     clientVersion: String     (Optional)
     gameLevel: String         (Optional)
     eventName: String         (Required)
     eventData: Object         (Optional)
 */
function sendBatchTelemetryV2(req, outRes, next){
    try {
        // TODO: validate all inputs

        this.stats.increment("info", "Route.SendBatchTelemetry2");

        //console.log("send telemetry batch body:", req.body);
        // Queue Data
        this._validateSendBatch(outRes, req.body);
    } catch(err) {
        console.trace("Collector: Send Telemetry Batch Error -", err);
        this.stats.increment("error", "SendBatchTelemetry.Catch");
    }
}


// http://localhost:8001/api/v2/data/eventsCount
function eventsCount(req, res, next, serviceManager){
    try {
        // TODO: replace this with DB lookup, return promise
        var dash = serviceManager.get("dash").service

        getListOfVisibleGameIds()
            .then(function(gameIds){
                when.reduce(gameIds, function(eventCount, gameId) {
                    return this.cbds.getEventCount(gameId)
                        .then(function(count){
                            return eventCount + count;
                        }.bind(this))
                }.bind(this), 0)
                    .then(function(eventCount){
                        if(!eventCount) {
                            eventCount = 0;
                        }
                        this.requestUtil.jsonResponse(res, {eventCount: eventCount});
                    }.bind(this))
                    //
                    .then(null, function(err){
                        this.requestUtil.errorResponse(res, err);
                    }.bind(this))

            }.bind(this) );

    } catch(err) {
        console.trace("Collector: Events Count Error -", err);
        this.stats.increment("error", "EventsCount.Catch");
    }
}
