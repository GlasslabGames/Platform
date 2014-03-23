/**
 * Authentication - App Server
 */
var Auth           = require('./lib/auth/auth.js');
var ServiceManager = require('./lib/core/service.manager.js');

var manager = new ServiceManager();
manager.add(Auth);
