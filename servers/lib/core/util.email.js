var fs             = require('fs');
var path           = require('path');
var _              = require('lodash');
var when           = require('when');
var nodemailer     = require('nodemailer');
var ejs            = require('ejs');
var qFS            = require('q-io/fs');

module.exports = EmailUtil;

ejs.open = '{{';
ejs.close = '}}';

function EmailUtil(options, templatesDir, stats){
    this.options = options;
    this.templatesDir = templatesDir;
    this.stats = stats;
}

EmailUtil.prototype.send = function(templateName, emailData){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var htmlFile = path.join(this.templatesDir, templateName, "html.ejs");
    var textFile = path.join(this.templatesDir, templateName, "text.ejs");
    var emailHtml, emailText

    emailData.$imageDir = path.join(this.templatesDir, templateName, "images");

    qFS.isFile(htmlFile)
        .then(function(fileExists){
            if(fileExists) {
                return qFS.read(htmlFile)
                    .then(function(htmlFileData){
                        //console.log("fileData:", htmlFileData);
                        emailHtml = ejs.render(htmlFileData, _.merge({
                                cache: true,
                                filename: htmlFile
                            }, emailData)
                        );
                    }.bind(this));
            }
        }.bind(this))

        .then(function(){
            return qFS.isFile(textFile);
        }.bind(this))
        .then(function(fileExists){
            if(fileExists) {
                return qFS.read(textFile)
                    .then(function(textFileData){
                        //console.log("fileData:", textFileData);
                        emailText = ejs.render(textFileData, _.merge({
                                cache: true,
                                filename: textFile
                            }, emailData)
                        );
                    }.bind(this));
            }
        }.bind(this))

        .then(function(){
            var transport = nodemailer.createTransport("SMTP", this.options.transport);
            var emailSettings = {
                from:    this.options.from,
                to:      emailData.to,
                subject: emailData.subject,
                html:    emailHtml,
                text:    emailText,
                generateTextFromHTML: true,
                forceEmbeddedImages: true
            };

            transport.sendMail(emailSettings, function(err, responseStatus) {
                if (err) {
                    if(this.stats) this.stats.increment("error", "Email."+templateName+".SendEmail");
                    console.error("Email: Error sending email -", err);
                    reject({error: "internal error, try again later"});
                } else {
                    if(this.stats) this.stats.increment("info", "Email."+templateName+".SendEmail");
                    //console.log(responseStatus.message);
                    resolve(responseStatus);
                }
            }.bind(this));
        }.bind(this))

        // errors
        .then(null, function(err){
            if(this.stats) this.stats.increment("error", "Email."+templateName+".ReadingTemplates");
            console.error("Email: Error reading templates -", err);
            reject({error: "internal error, try again later"});
        }.bind(this));

    /*
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
                    text: text,
                    generateTextFromHTML: true,
                    forceEmbeddedImages: true
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
    */

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}