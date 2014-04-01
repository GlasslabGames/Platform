var emailTemplates = require('email-templates');
var nodemailer     = require('nodemailer');

module.exports = EmailUtil;

function EmailUtil(options, templatesDir, stats){
    this.options = options;
    this.templatesDir = templatesDir;
    this.stats = stats;
}

EmailUtil.prototype.send = function(templateName, emailData, emailSubject, stats){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    emailTemplates(this.templatesDir, { open: '{{', close: '}}' }, function(err, template) {
        if(err) {
            if(this.stats) this.stats.increment("error", "Email."+templateName+".ReadingTemplates");
            console.err("Email: Error reading templates -", err);
            reject({error: "internal error, try again later"});
            return;
        }

        // Send a single email
        template(templateName, emailData, function(err, html, text) {
            if (err) {
                if(this.stats) this.stats.increment("error", "Email."+templateName+".BuildingEmail");
                console.err("Email: Error building email -", err);
                reject({error: "internal error, try again later"});
            } else {

                var transport = nodemailer.createTransport("SMTP", this.options.transport);
                var emailSettings = {
                    from: this.options.from,
                    to: emailData.user.email,
                    subject: emailSubject,
                    html: html,
                    // generateTextFromHTML: true,
                    text: text
                };

                transport.sendMail(emailSettings, function(err, responseStatus) {
                    if (err) {
                        if(this.stats) this.stats.increment("error", "Email."+templateName+".SendEmail");
                        console.err("Email: Error sending email -", err);
                        reject({error: "internal error, try again later"});
                    } else {
                        if(this.stats) this.stats.increment("info", "Email."+templateName+".SendEmail");
                        //console.log(responseStatus.message);
                        resolve(responseStatus);
                    }
                }.bind(this));

            }
        }.bind(this));
    }.bind(this));
// ------------------------------------------------
}.bind(this));
// end promise wrapper
}