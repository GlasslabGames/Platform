var _         = require('lodash');
var when      = require('when');
var lConst    = require('../dash.const.js');
//

module.exports = {
    getMessages:  getMessages,
    postMessage:  postMessage
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
        if( !req.session.passport.user.role ||
            req.session.passport.user.role != "admin" ) {
            this.requestUtil.errorResponse(res, {key:"dash.permission.denied", error: "you do not have permission"});
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