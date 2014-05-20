
var when   = require('when');
var Util   = require('../../core/util.js');
var lConst = require('../../lms/lms.const.js');

module.exports = {
    sendBatchTelemetryV2: sendBatchTelemetryV2,
    sendBatchTelemetryV1: sendBatchTelemetryV1,
    getEventsByUserId:    getEventsByUserId
};

function sendBatchTelemetryV2(req, outRes){
    try {
        // TODO: validate all inputs

        // if logged in auto add userId
        if( req.session &&
            req.session.passport &&
            req.session.passport.user &&
            req.session.passport.user.id) {
            req.body.userId = req.session.passport.user.id;
         }

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

/*
 http://localhost:8001/api/v2/data/events/get?userId=25
 requires userId
 */
function getEventsByUserId(req, res, next){
    try {
        if( req.session &&
            req.session.passport) {
            var userData = req.session.passport.user;

            this.stats.increment("info", "Route.GetUserData");

            if( req.query &&
                req.query.userId) {

                if(userData.role  == lConst.role.admin) {
                    this.myds.getSessionsByUserId(req.query.userId)
                        .then(function(sessionList){

                            if(!sessionList || (sessionList.length == 0)) {
                                this.requestUtil.jsonResponse(res, []);
                                return;
                            }

                            when.reduce(sessionList, function(currentResult, sessionId, index){

                                    if(sessionId.length > 0) {
                                        return this.cbds.getRawEvents(sessionId)
                                            .then( function (results) {

                                                //if(results.length > 0) console.log("getRawEvents length:", results.length);

                                                return currentResult.concat(results);
                                            }.bind(this));
                                    } else {
                                        return currentResult;
                                    }
                                }.bind(this), [])

                                // done
                                .then(function(result){
                                    // output in pretty format
                                    this.requestUtil.jsonResponse(res, JSON.stringify(result, undefined, 2));
                                }.bind(this))

                                // error
                                .then(null, function(err){
                                    console.error("err:", err);
                                }.bind(this))


                        }.bind(this))

                } else {
                    this.requestUtil.errorResponse(res, {error: "invalid access"});
                }
            } else {
                this.requestUtil.errorResponse(res, {error: "missing userId"}, 401);
            }
        } else {
            this.requestUtil.errorResponse(res, {error: "not logged in"});
        }
    } catch(err) {
        console.trace("Collector: Get User Data Error -", err);
        this.stats.increment("error", "GetUserData.Catch");
        this.requestUtil.errorResponse(res, {error: err});
    }
}