
var path      = require('path');
var _         = require('lodash');
var when      = require('when');
var lConst    = require('../../lms/lms.const.js');
var Util      = require('../../core/util.js');

module.exports = {
    renderEmailTemplate: renderEmailTemplate
};
var exampleIn = {};
var exampleOut = {};

// http://localhost:8002/admin/auth/user/email-template

function renderEmailTemplate(req, res, next) {

    var templateName = 'register-welcome';
    if(req.query.templateName) {
        templateName = req.query.templateName;
    }

    var emailData = {
        subject: "Welcome to GlassLab Games",
        to:   "test@test.com",
        user: {
            firstName: "First",
            lastName: "Last Name"
        },
        host: req.protocol+"://"+req.headers.host
    };
    var email = new Util.Email(
        this.options.auth.email,
        path.join(__dirname, "../email-templates"),
        this.stats);

    email.test(templateName, emailData)
        .then(function(data){
            res.writeHead(200, {
                "Content-Type": "text/html"
            });
            res.end( data );
        }.bind(this))

        // catch all errors
        .then(null, function(err){
            this.requestUtil.errorResponse(res, err);
        }.bind(this));
}
