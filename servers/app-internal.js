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
// Research

var manager = new ServiceManager("~/hydra.config.json");

manager.setRouteMap('../routes.internal.map.js');
manager.setPort(8002);

// add all services
manager.add( Auth );
manager.add( LMS );
manager.add( Lic );
manager.add( Dash );
manager.add( Data );
manager.add( Admin );
// Research

manager.start();
//manager.start(8002);
