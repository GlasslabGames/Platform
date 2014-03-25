/**
 * App Server
 */
var ServiceManager = require('./lib/service/service.manager.js');
var Auth           = require('./lib/auth/auth.js');
var Data           = require('./lib/data/data.js');
var LMS            = require('./lib/lms/lms.js');
var manager = new ServiceManager();

// add all services
manager.add( Auth );
manager.add( Data );
manager.add( LMS );

manager.start();
