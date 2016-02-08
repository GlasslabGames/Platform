var _         = require('lodash');
var when      = require('when');
var lConst    = require('../dash.const.js');
var moment    = require('moment');
//

module.exports = {
    getMessages:  getMessages,
    postMessage:  postMessage,
    exportReportData: exportReportData
};

var exampleIn = {}, exampleOut = {};


// http://127.0.0.1:8001/api/v2/dash/message-center/messageId
// http://127.0.0.1:8001/api/v2/dash/message-center/messages
// http://127.0.0.1:8001/api/v2/dash/message-center/tweets
exampleIn.getMessages = {
    messageId: "message"
};

exampleOut.getMessages = [
    {
        icon: "app-test-icon.png",
        subject: "SimCityEDU has been updated!",
        message: "Check out the new updates for the game on the game page.",
        timestamp: 122340438900
    },
    {
        icon: "app-test-icon.png",
        subject: "SimCityEDU has been updated!",
        message: "Check out the new updates for the game on the game page.",
        timestamp: 122340438900
    }
];

function getMessages(req, res, next) {

    if( req.session &&
        req.session.passport &&
        req.session.passport.user) {

        // Validate the messageId
        if (!req.params.messageId) {
            this.requestUtil.errorResponse(res, {key:"dash.messageId.missing", error: "missing messageId"});
            return;
        }

        // Check for limit query parameter
        var limit = 3;
        if( req.query.limit ) {
            limit = req.query.limit;
        }
        // Check for ascending/descending query parameter
        var ascending = false;
        if( req.query.asc ) {
            ascending = req.query.asc;
        }

        // Get the messageId
        var messageId = req.params.messageId.toLowerCase();

        // Get the messages
        this.dashCBStore.getMessageCenterMessages( messageId, limit, ascending )
            .then(function(messages) {
                this.requestUtil.jsonResponse(res, messages);
            }.bind(this))
            .then(null, function(err) {
                this.requestUtil.errorResponse(res, err);
            }.bind(this));
    }
    else {
        this.requestUtil.errorResponse( res, "not logged in" );
    }
}

// http://127.0.0.1:8001/api/v2/dash/message-center/messageId
// http://127.0.0.1:8001/api/v2/dash/message-center/messages
// http://127.0.0.1:8001/api/v2/dash/message-center/tweets
exampleIn.postMessage = {
    icon: "app-test-icon.png",
    subject: "SimCityEDU has been updated!",
    message: "Check out the new updates for the game on the game page."
};

function postMessage(req, res, next) {

    if( req.session &&
        req.session.passport &&
        req.session.passport.user) {

        // Only allow admin users to proceed

        if (!req.session.passport.user.role ||
            req.session.passport.user.role != "admin") {
            this.requestUtil.errorResponse(res, {key: "dash.permission.denied", error: "you do not have permission"});
            return;
        }

        // Validate the messageId
        if (!req.params.messageId) {
            this.requestUtil.errorResponse(res, {key:"dash.messageId.missing", error: "missing messageId"});
            return;
        }

        // Validate the icon
        if (!req.body.icon) {
            this.requestUtil.errorResponse(res, {key:"dash.icon.missing", error: "missing icon"});
            return;
        }
        // Validate the subject
        if (!req.body.subject) {
            this.requestUtil.errorResponse(res, {key:"dash.subject.missing", error: "missing subject"});
            return;
        }
        // Validate the message
        if (!req.body.message) {
            this.requestUtil.errorResponse(res, {key:"dash.message.missing", error: "missing message"});
            return;
        }

        // Get the messageId
        var messageId = req.params.messageId.toLowerCase();

        // Set the message data
        var messageData = {};
        messageData.subject = req.body.subject;
        messageData.message = req.body.message;
        messageData.icon = req.body.icon;

        // Get the messages
        this.dashCBStore.saveMessageCenterMessage( messageId, messageData )
            .then(function() {
                this.requestUtil.jsonResponse(res, { "success": "successfully added a message to the message center" });
            }.bind(this))
            .then(null, function(err) {
                this.requestUtil.errorResponse(res, err);
            }.bind(this));
    }
    else {
        this.requestUtil.errorResponse( res, "not logged in" );
    }
}

// api: "/api/v2/admin-thx1138-data/export-report-data",
// Platform/servers/lib/dash/controller/dash.js
//
function exportReportData(req, res){

    var qOut1, qOut2, qOut3, qOut4;
    var out = [];
    out[0] = '---- retry ----';
    out[1] = '2';
    out[2] = '3';
    out[3] = '4';

    this.dashStore.getReportDataP2()
    .then(function(qOut1) {
        out[0] = qOut1[0];
        // console.log('  this.dashStore.getReportDataP2() pass\n', qOut1[0]);

        return this.dashStore.getReportDataP2('student');
    }.bind(this), function(err){
        console.log('  this.dashStore.getReportDataP2() fail', err);
        // this.requestUtil.errorResponse(res, err); ?
    }.bind(this) )


    .then(function(qOut2) {
        out[1] = qOut2[0];
        // console.log('  this.dashStore.getReportDataP2("student") pass\n', qOut2[0]);
        return this.dashStore.getReportDataP2('instructor');
    }.bind(this), function(err){
        console.log('  this.dashStore.getReportDataP2("student") fail', err);
    }.bind(this) )


    .then(function(qOut3) {
        out[2] = qOut3[0];
        // console.log('  this.dashStore.getReportDataP2("instructor") pass\n', qOut3[0]);
        return this.dashStore.getReportDataP3();
    }.bind(this), function(err){
        console.log('  this.dashStore.getReportDataP2("instructor") fail', err);
    }.bind(this) )


    .then(function(enrolledStudents) {
        var courseIds = Object.keys(_.reduce(enrolledStudents, function(result, row) {
            result[row.course_id] = [];
            return result;
        }.bind(this), {}));


        return when.reduce(courseIds, function (result, courseId) {
                return this.telmStore.getGamesForCourse(courseId)
                    .then(function(games) {
                        result[courseId] = games;
                        return result;
                    }.bind(this));

            }.bind(this), {})
            .then(function(courseGamesLookup) {
                var result = {};
                _.forEach(enrolledStudents, function(row) {
                    var date = moment(row.date).format('YYYYMMDD');
                    if (!result[date]) {
                        result[date] = {};
                    }
                    _.forEach(courseGamesLookup[row.course_id], function(data, gameId) {
                        if(!result[date][gameId]) {
                            result[date][gameId] = 0;
                        }
                        result[date][gameId] += row.numStudent;

                    });
                });

                return result;
            }.bind(this), function(err) {
                console.log(' this.dashStore.getReportDataP3() fail ', err);
            });

    }.bind(this))

    .then(function(qOut4) {
        out[3] = qOut4;
        this.requestUtil.jsonResponse(res, out);
    }.bind(this))

    .catch(function (err) {
        out.push(err);
        this.requestUtil.errorResponse(res, out, 503);
    }.bind(this));

    // this.requestUtil.jsonResponse(res, out);

}
