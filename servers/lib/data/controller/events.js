
var when   = require('when');
var Util   = require('../../core/util.js');
var lConst = require('../../lms/lms.const.js');

module.exports = {
    sendBatchTelemetryV2: sendBatchTelemetryV2,
    sendBatchTelemetryV1: sendBatchTelemetryV1,
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
function sendBatchTelemetryV2(req, outRes){
    try {
        // TODO: validate all inputs

        this.stats.increment("info", "Route.SendBatchTelemetry2");

        //console.log("send telemetry batch body:", req.body);
        // Queue Data
        this._validateSendBatch(2, outRes, req.body);
    } catch(err) {
        console.trace("Collector: Send Telemetry Batch Error -", err);
        this.stats.increment("error", "SendBatchTelemetry.Catch");
    }
}

function sendBatchTelemetryV1(req, outRes){
    try {
        // TODO: validate all inputs

        this.stats.increment("info", "Route.SendBatchTelemetry");

        if(req.params.type == tConst.type.game) {
            var form = new multiparty.Form();
            form.parse(req, function(err, fields) {
                if(err){
                    console.error("Collector: Error -", err);
                    this.stats.increment("error", "SendBatchTelemetry.General");
                    this.requestUtil.errorResponse(outRes, err, 500);
                    return;
                }

                if(fields){
                    if(fields.events)        fields.events        = fields.events[0];
                    if(fields.gameSessionId) fields.gameSessionId = fields.gameSessionId[0];
                    if(fields.gameVersion)   fields.gameVersion   = fields.gameVersion[0];

                    //console.log("fields:", fields);
                    this._validateSendBatch(1, outRes, fields, fields.gameSessionId);
                } else {
                    outRes.send();
                }
            }.bind(this));
        } else {
            //console.log("send telemetry batch body:", req.body);
            // Queue Data
            this._validateSendBatch(1, outRes, req.body, req.body.gameSessionId);
        }
    } catch(err) {
        console.trace("Collector: Send Telemetry Batch Error -", err);
        this.stats.increment("error", "SendBatchTelemetry.Catch");
    }
}


function eventsCount(req, res, next){
    try {
        this.cbds.getEventCount()
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


    } catch(err) {
        console.trace("Collector: Events Count Error -", err);
        this.stats.increment("error", "EventsCount.Catch");
    }
}
