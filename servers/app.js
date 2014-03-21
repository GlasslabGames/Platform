/**
 * App Server
 */
var ServiceManager = require('./lib/proxy/service.manager.js');
var Auth           = require('./lib/auth/auth.js');
var Data           = require('./lib/data/data.js');
var manager = new ServiceManager();

// add all services
manager.add( Auth );
manager.add( Data );

manager.start();
