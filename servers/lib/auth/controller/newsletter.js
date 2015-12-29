
var path      = require('path');
var _         = require('lodash');
var when      = require('when');
var lConst    = require('../../lms/lms.const.js');
var aConst    = require('../../auth/auth.const.js');
var Util      = require('../../core/util.js');

module.exports = {
    subscribe:  subscribe
};

var exampleIn = {};
var exampleOut = {};

function subscribe(req, res, next) {
    if( !(req.body.email &&
          _.isString(req.body.email) &&
         req.body.email.length) ) {
        this.stats.increment("error", "Route.Register.User.SubscribeToNewsletter.noemail");
        this.requestUtil.errorResponse(res, {key:"user.create.input.missing.email"}, 404);
        return;
    }
    var regData = {
        email: req.body.email
    };

    this.subscribeToNewsletter(
        this.options.auth.email.mailChimp.apiKey,
        this.options.auth.email.mailChimp.mailListName,
        regData)
        .then(function(){
            this.stats.increment("info", "Route.Register.User.SubscribeToNewsletter");
            this.requestUtil.jsonResponse(res, {});
        }.bind(this))
        // errors
        .then(null, function(err){
            this.stats.increment("error", "Route.Register.User.SubscribeToNewsletter");
            console.errorExt("AuthService", "RegisterUserV2 -", err);
            this.requestUtil.errorResponse(res, {key:"user.create.general"}, 500);
        }.bind(this))
}
