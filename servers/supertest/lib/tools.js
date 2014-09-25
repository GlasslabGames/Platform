// Imports
var fs           = require('fs'),
    MailListener = require("mail-listener2");

// Exports
module.exports = {

    zfill: zfill,
		tstamp: tstamp,
    
    genUser: genUser,
    genClass: genClass,
		requestAccess: requestAccess,
		listenForEmailsFrom: listenForEmailsFrom,
		setGame: setGame,
		setCourse: setCourse,
    conLog: conLog
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

// FUTURE - ok, emailOrCode is a bit funkadelic.  make more robust
function genUser(name, emailOrCode, passw, role) {

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
		email:email.replace(/[^\w\.\@\+]/gi, ''),
		school: 'glassLab',
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

// FUTURE - replace "console.log"s with conLog, once fixed
function listenForEmailsFrom(emailAddress, cb) {
	var mailListener = new MailListener({
		username: "build@glasslabgames.org",
		password: "glasslab",
		host: "imap.gmail.com",
		port: 993, // imap port
		tls: true,
    tlsOptions: {	rejectUnauthorized: false },
		mailbox: "INBOX", // mailbox to monitor
		markSeen: true, // all fetched email willbe marked as seen and not fetched next time
		attachments: false, // download attachments as they are encountered to the project directory
	});
	mailListener.start(); // start listening
	mailListener.on("server:connected", function () {
		console.log("imapConnected, checking for mail from " + emailAddress);		// DEBUG
	});
	mailListener.on("server:disconnected", function () {
		console.log("imapDisconnected");  
	});
	mailListener.on("error", function (err) {
    console.log('ERROR');
		console.log(err);
	});
  
	mailListener.on("mail", function (mail, seqno, attributes) {
		var newMail = {
				subject: mail['subject'],
				// FIXME - hmm, statref'ing '[0]' seems troublingly unrobust
				sender: mail['from'][0]['address'],
				userEmail: mail['to'][0]['address'],
				text: mail['text']  // FUTURE - add logging for verbose mode
			}
		
    // if email matches req'd
		if (emailAddress == newMail.sender) {
      mailListener.stop();
      cb(newMail); // Callback which will run the test upon
		} else {
			console.log('mismatch: ' + newMail.sender);  // DEBUG
			// keep waiting
		}
    
	});
}

function setGame(route, gameId) {
	return route.replace(":gameId", gameId);
}

function setCourse(route, courseId) {
	return route.replace(":courseId", courseId);
}

function conLog(flag, filename) {
  
  // Verbose
  function vLog(content, header) {
    
    // FUTURE - if filename, write to file instead of console
    var br = Array(header.length + 9).join("+");
    console.log(br);
    console.log("||  " + header + "  ||");
    console.log(br);
    console.log(content);
  }
  
  // Quiet
  function qLog () {
    // Do nothing, for now
  }
  
  return ((flag) ? vLog : qLog);
}
