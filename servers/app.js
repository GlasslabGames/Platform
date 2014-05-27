/**
 * App Server
 */
var ServiceManager = require('./lib/core/service.manager.js');
var Auth           = require('./lib/auth/auth.js');
var LMS            = require('./lib/lms/lms.js');
var Data           = require('./lib/data/data.js');
var Dash           = require('./lib/dash/dash.js')
var Aeng           = require('./lib/aeng/assessment.js');
var manager = new ServiceManager("~/hydra.config.json");

// add all services
manager.add( Auth );
manager.add( LMS );
manager.add( Dash );
manager.add( Data );
manager.add( Aeng );

manager.start();
