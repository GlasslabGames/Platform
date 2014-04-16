/**
 * App Server
 */
var ServiceManager = require('./lib/service/service.manager.js');
var Auth           = require('./lib/auth/auth.js');
var LMS            = require('./lib/lms/lms.js');
var Data           = require('./lib/data/data.js');
var Dash           = require('./lib/dash/dash.js');
var manager = new ServiceManager();

// add all services
manager.add( Auth );
manager.add( LMS );
manager.add( Dash );
manager.add( Data );

manager.start();
