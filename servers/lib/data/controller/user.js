
var path      = require('path');
var _         = require('lodash');
var when      = require('when');
var mailChimp = require('mailchimp').MailChimpAPI;
var lConst    = require('../../lms/lms.const.js');
var aConst    = require('../../auth/auth.const.js');
var Util      = require('../../core/util.js');

module.exports = {
    updateUserDevice:    updateUserDevice
};
var exampleIn = {};
var exampleOut = {};

exampleIn.updateUserDevice = {
    deviceId: "ASD-QWER-ASD"
};
function updateUserDevice(req, res, next) {
    if( req.session &&
        req.session.passport &&
        req.session.passport.user) {

        var userData = req.session.passport.user;

        // deviveId required
        if( req.body &&
            req.body.deviceId &&
            req.body.deviceId.length ) {

            // update device Id
            //console.log("deviceId:", req.body.deviceId);
            this.cbds.updateUserDeviceId(userData.id, req.body.deviceId)
                .then(function(){
                    this.requestUtil.jsonResponse(res, { status: "ok" } );
                }.bind(this))

                // catch all errors
                .then(null, function(err){
                    this.requestUtil.errorResponse(res, err);
                }.bind(this));
        } else {
            this.requestUtil.errorResponse(res, "missing deviceId");
        }
    } else {
        this.requestUtil.errorResponse(res, "not logged in");
    }
}
