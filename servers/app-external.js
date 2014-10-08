/**
 * App Server
 */
var ServiceManager = require('./lib/core/service.manager.js');
var Auth           = require('./lib/auth/auth.js');
var LMS            = require('./lib/lms/lms.js');
var Lic            = require('./lib/lic/lic.js');
var Data           = require('./lib/data/data.js');
var Dash           = require('./lib/dash/dash.js');
var Admin          = require('./lib/admin/admin.js');
var Research       = require('./lib/research/research.js');

var manager = new ServiceManager("~/hydra.config.json");
manager.setRouteMap('../routes.external.map.js');

// add all services
manager.add( Auth );
manager.add( LMS );
manager.add( Lic );
manager.add( Dash );
manager.add( Data );
manager.add( Admin );
manager.add( Research );

manager.start();
