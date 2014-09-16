// Imports
var fs           = require('fs'),
    MailListener = require("mail-listener2");

// Exports
module.exports = {

    zfill: zfill,
		tstamp: tstamp,
    
    genUser: genUser,
    genClass: genClass,
		requestAccess: requestAccess
}

function zfill(num, size) {
    var s = ''+num;
    while (s.length < size) s = "0" + s;
    return s;
}

function tstamp() {
	var date = (new Date());
	return zfill(date.getDate(),2) + '.' + zfill(date.getMonth()+1,2) +
		'.' + date.getFullYear() + '-' + zfill(date.getHours(),2) + ':' +
		date.getMinutes() + ':' + zfill(date.getSeconds(),2)
}

function genUser(name, emailOrCode, passw, role) { // FUTURE - ok, emailOrCode is a bit funkadelic.  make more robust

  if (role == 'student') {
    return JSON.stringify({
      username: name,
      password: passw,
      confirm: passw,

      firstName: "glTest",
      lastName: "Student",

      role: "student",

      regCode: emailOrCode,
      errors: [],
      isRegCompleted: false
    });
  } else {
    return JSON.stringify({
      firstName: name,
      lastName: "",
      email: "" + emailOrCode.replace(/[^\w\.\@\+]/gi, ''),
      password: passw,
      confirm: passw,
      role: "instructor",
      acceptedTerms: true,
      newsletter: false,
      errors: [],
      isRegCompleted: false
    });
  }

}

// NOTE - for closed beta registration flow
function requestAccess(name, email, passw) {
  return JSON.stringify({
		firstName:name,
		email:email,
		password:passw,
		role:"instructor"
	});
}


function genClass(name, grades, gameId) {   // FUTURE - support for multi-game classes
	
    // Template for new MGO class
    return JSON.stringify({
        title:name,
        grade:grades,
        games:[{"id":gameId}]
    })
		
}


function listenForEmailsFrom(emailAddress, cb) {
  
  var mailListener = new MailListener({
    username: "build@glasslabgames.org",
    password: "glasslab",
    host: "imap.gmail.com",
    port: 993, // imap port
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    mailbox: "INBOX", // mailbox to monitor
  //  searchFilter: ["UNSEEN", "FLAGGED"], // the search filter being used after an IDLE notification has been retrieved
    markSeen: true, // all fetched email willbe marked as seen and not fetched next time
  //  fetchUnreadOnStart: true, // use it only if you want to get all unread email on lib start. Default is `false`,
  //  mailParserOptions: {streamAttachments: true}, // options to be passed to mailParser lib.
    attachments: false, // download attachments as they are encountered to the project directory
  //  attachmentOptions: { directory: "attachments/" } // specify a download directory for attachments
  });

  mailListener.start(); // start listening

  mailListener.on("server:connected", function(){
    console.log("imapConnected");
  });

  mailListener.on("server:disconnected", function(){
    console.log("imapDisconnected");
  });

  mailListener.on("error", function(err){
    console.log(err);
  });

  mailListener.on("mail", function(mail, seqno, attributes){
    // do something with mail object including attachments

    var newMail = {
      subject: mail['subject'],

      // NOTE - hmm, statref'ing '[0]' seems troublingly unrobust
      sender: mail['from'][0]['address'],
      userEmail: mail['to'][0]['address'],

      text: mail['text']
    }
    
    // if email matches req'd
    if (emailAddress == newMail.sender) {
      
      cb(newMail);  // Callback which will run the test upon
      mailListener.stop();
      
    }
    
  });
  
}