/**
 * App Server
 */
var ServiceManager = require('./lib/service/service.manager.js');
var Research       = require('./lib/research/research.js');
var manager = new ServiceManager();

// add all services
manager.add( Research );

manager.start( manager.options.research.port );
