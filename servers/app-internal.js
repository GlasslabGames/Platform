/**
 * App Server
 */
var path           = __dirname;
var ServiceManager = require(path + '/lib/core/service.manager.js');
var Auth           = require(path + '/lib/auth/auth.js');
var LMS            = require(path + '/lib/lms/lms.js');
var Lic            = require(path + '/lib/lic/lic.js');
var Data           = require(path + '/lib/data/data.js');
var Dash           = require(path + '/lib/dash/dash.js');
var Admin          = require(path + '/lib/admin/admin.js');
// Research
var Monitor        = require(path + '/lib/monitor/monitor.js');

var manager = new ServiceManager("~/hydra.config.json");

manager.setRouteMap(path + '/lib/routes.internal.map.js');
manager.setName('app-internal');
manager.setPort(8002);

// add all services
manager.add( Auth );
manager.add( LMS );
manager.add( Lic );
manager.add( Dash );
manager.add( Data );
manager.add( Admin );
// Research
manager.add( Monitor );

manager.start();
//manager.start(8002);
