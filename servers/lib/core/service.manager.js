/**
 * Manager for Services
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  when       - https://github.com/cujojs/when
 *  express    - https://github.com/visionmedia/express
 *  multiparty - https://github.com/superjoe30/node-multiparty
 *
 */

var fs         = require('fs');
var http       = require('http');
var https      = require('https');
var path       = require('path');
var url        = require('url');
// Third-party libs
var _          = require('lodash');
var when       = require('when');
var express    = require('express');
var couchbase  = require('couchbase');
var cors       = require('cors');

var compression = require('compression');
var errorhandler = require('errorhandler');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var expressSession = require('express-session');
var basicAuth = require('basic-auth');

// moving TLS key-file names to config.json
//
var TlsOptions = {
    ca: "",
    key: "",
    cert: ""
    /*
    //  key: fs.readFileSync('ssl-key/glas77-key.pem'),
    //  cert: fs.readFileSync('ssl-key/glas77-csr.pem')

    ca: fs.readFileSync('ssl-key/server/priv-root-ca.crt.pem'),
    key: fs.readFileSync('ssl-key/server/server.key.pem'),
    cert: fs.readFileSync('ssl-key/server/server.crt.pem')
    */
}

// load at runtime
var Util;

module.exports = ServiceManager;

process.on('uncaughtException', function(err) {
    console.error("ServiceManager: Uncaught Error -", err, ", stack:", err.stack);
});

function ServiceManager(configFiles){
    // called as:   new ServiceManager("~/hydra.config.json");
    // this == {}

    Util              = require('../core/util.js');
    var ConfigManager = require('../core/config.manager.js');

    var startScript = process.argv[1].split("servers/")[1];

    console.log(" **************************************** ");
    console.log("        " + startScript);
    console.log(" **************************************** ");

    console.log("ServiceManager()");

    console.log('    process.pid:         ' + process.pid);
    console.log('    process.platform:    ' + process.platform);
    console.log('    process.version:     ' + process.version);
    console.log('    process.execPath:    ' + process.execPath);
    console.log('    process.argv[1]:     ' + process.argv[1]);

    console.log('    process.env.SHLVL:   ' + process.env.SHLVL);
    console.log('    process.env.LOGNAME: ' + process.env.LOGNAME);
    console.log('    process.env.HOME:    ' + process.env.HOME);
    console.log('    process.env.PWD:     ' + process.env.PWD);
    console.log('    process.env._:       ' + process.env._);

    console.log(Util.DateGMTString()+' **** Loading Configuration...');

    var config        = new ConfigManager();
    // load config files from first to last until successful
    // if not set, then make array
    if(!configFiles) {
        configFiles = [];
    }

    // if string then make array
    if(_.isString(configFiles)) {
        configFiles = [configFiles];
    }

    // Add the base config (./config.json from Platform/servers/) at the front of the list.
    // Values in ./config.json will be replaced by newer values in eg. ~/hydra.config.json.
    // [ './config.json', '~/hydra.config.json' ]
    configFiles.unshift("./config.json");
    this.options = config.loadSync(configFiles);

    console.log('Configs loaded');
    console.log('    env: ' + this.options.env);
    console.log('    services.port: ' + this.options.services.port);
    console.log('    services.portSSL: ' + this.options.services.portSSL);
    console.log('    services.portNonSSL: ' + this.options.services.portNonSSL);
    console.log('    services.appExternalPort: ' + this.options.services.appExternalPort);
    console.log('    services.appInternalPort: ' + this.options.services.appInternalPort);
    console.log('    services.appAssessmentPort: ' + this.options.services.appAssessmentPort);
    console.log('    services.appArchiverPort: ' + this.options.services.appArchiverPort);

    if(!this.options.services.appExternalPort){
        console.log('');
        console.log('****************    Error -- expect services.appExternalPort in config.json');
        console.log('');
        return;
    }

    if(!this.options.services.appInternalPort){
        console.log('');
        console.log('****************    Error -- expect services.appInternalPort in config.json');
        console.log('');
        return;
    }

    if(!this.options.services.appArchiverPort){
        console.log('');
        console.log('****************    Error -- expect services.appArchiverPort in config.json');
        console.log('');
        return;
    }
    
    if(!this.options.services) {
        // TODO - error - this.options.services.appExternalPort must be set
        this.options.services = {};
    }
    if(!this.options.services.session) {
        this.options.services.session = {};
    }

    this.options.services.startScript = startScript;

    global.ENV            = this.options.env || 'dev';
    process.env.HYDRA_ENV = process.env.HYDRA_ENV || global.ENV;
    
    this.stats            = new Util.Stats(this.options, "ServiceManager");
    this.awss3            = new Util.S3Util(this.options);
    this.stripe           = new Util.StripeUtil(this.options);


    // test customer APIs
    /*this.stripe.createCustomer({
        card: "tok_15SG1TKpKFgczHmqa4GUNm7j",
        description: "Customer for ben@glasslabgames.org",
        email: "ben@glasslabgames.org"
    });*/
    /*this.stripe.createCustomer({
        //card: "tok_15SG1TKpKFgczHmqa4GUNm7j",
        card: {
            number: 4242424242424242,
            exp_month: 1,
            exp_year: 2020,
            cvc: 123
        },
        description: "Customer for Ben Dapkiewicz",
        email: "ben@glasslabgames.org",
        plan: 'test_chromebook',
        quantity: 12475
    });*/
    //this.stripe.retrieveCustomer( "cus_5soWj36tEnUT8x" );
    //this.stripe.retrieveSubscription( "cus_5soWj36tEnUT8x", "sub_5soW5S5k2b0Szt" );
    //this.stripe.retrieveCoupon( "TEST_AMOUNTOFF" );
    /*this.stripe.updateCustomer( "cus_5dvnWd0fs5Icru", {
        description: "Customer for Ben Dapkiewicz"
    });*/

    // test subscription APIs
    /*this.stripe.createSubscription("cus_5eBOgRMql5L1yF", {
        card: {
            number: 4242424242424242,
            exp_month: 1,
            exp_year: 2020,
            cvc: 123
        },
        plan: 'test_chromebook',
        quantity: 12475
    });*/

    /*this.stripe.listCustomers( { limit: 100 } )
        .then(function(data) {
            for( var i = 0; i < data.data.length; i++ ) {
                _deleteCustomer.call( this, data.data[i].id );
            }
        }.bind(this));*/

    // test plan APIs
    //this.stripe.listPlans();
    //this.stripe.retrievePlan( 'test_pcmac' );


    try{
        this.routesMap = require('../routes.map.js');
    } catch(err){
        console.log("ServiceManager: Could not find default routes map.");
    }

    this.services  = {};
    this.routeList = {};
}

/*function _deleteCustomer( custId ) {
    return when.promise(function(resolve, reject){
        this.stripe.deleteCustomer( custId )
            .then(function(results) {
                resolve();
            }.bind(this))
    }.bind(this));
}*/

ServiceManager.prototype.loadVersionFile = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
    fs.readFile('./version.json', 'utf8', function (err, data) {
        if (err) {
            reject(err);
        } else{
            this.version = data;
            resolve(data);
            // resolve(JSON.parse(data));
        }
    }.bind(this));
}.bind(this));
// end promise wrapper
};

ServiceManager.prototype.setRouteMap = function(str) {
    this.routesMap = require(str);
};

ServiceManager.prototype.setName = function(name) {
    this.options.services.name = name;
};

ServiceManager.prototype.setPort = function(port) {
    this.options.services.port = port;
};

ServiceManager.prototype.initExpress = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var connectPromise;
    if(this.options.services.session.store) {
        var CouchbaseStore = require('./sessionstore.couchbase.js')(expressSession);
        this.exsStore      = new CouchbaseStore(this.options.services.session.store);
        connectPromise = this.exsStore.glsConnect();
    } else {
        var MemoryStore = expressSession.MemoryStore;
        this.exsStore   = new MemoryStore();
        connectPromise = Util.PromiseContinue();
    }

    console.log('SessionStore Connecting...');
    connectPromise
        .then(function(){
            console.log('SessionStore Connected');

            this.app = express();
            this.app.set('port', process.env.PORT || this.options.services.port);
            // process.env.PORT not used here

            //this.app.configure(function() {

                this.app.use(function (req, res, next) {
                    res.removeHeader("X-Powered-By");
                    next();
                }); 

                this.app.use(Util.GetMorganLogger(this.options, this.stats));
                
                this.app.use(compression());
              this.app.use(function (req, res, next) { console.log("no-op"); next(); });
              
                this.app.use(cookieParser());
                this.app.use(bodyParser.urlencoded({limit: "500kb"}));
                this.app.use(bodyParser.json({limit: "500kb"}));
                this.app.use(methodOverride());
                
                var whitelist = [ "http://new.wwf.local", "https://new.wwf.local", "http://www.wordswithfriendsedu.com", "http://edu.zwf-staging.zynga.com", "http://s3-us-west-1.amazonaws.com", "https://s3-us-west-1.amazonaws.com" ];
                var corsOptions = {
                    origin: function( origin, callback ) {
                        var originIsWhitelisted = whitelist.indexOf( origin ) !== -1;
                        callback( null, originIsWhitelisted );
                    },
                    credentials: true
                };
                this.app.use( cors(corsOptions) );

                this.app.use(expressSession({
                  secret: this.options.services.session.secret || "keyboard kitty",
                    cookie: _.merge({
                        path: this.options.services.session.cookie.path || '/'
                        , httpOnly : this.options.services.session.cookie.httpOnly || false
                        //, maxAge: 1000 * 60 * 24 // 24 hours
                    }, this.options.services.session.cookie),
                    store:  this.exsStore
                }));

                resolve();
            //}.bind(this))
        }.bind(this))
        // catch all errors
        .then(null, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

ServiceManager.prototype.add = function(lib) {
    if(lib.ServiceName) {
        if( !this.services.hasOwnProperty(lib.ServiceName) ) {

            this.services[lib.ServiceName] = {
                lib: lib
            };
        } else {
            console.warn("ServiceManager: Service", lib.ServiceName, "Already added");
        }
    }
};

ServiceManager.prototype.get = function(name) {
    if( this.services.hasOwnProperty(name) ) {
        return this.services[name];
    } else {
        return undefined;
    }
};

ServiceManager.prototype.setupRoutes = function() {

    // api routes from map
    this.setupApiRoutes();

    // static routes from map
    this.setupStaticRoutes();

    // webapp routes
    this.setupWebAppRoutes();

    // final default routes
    this.setupDefaultRoutes();
};

ServiceManager.prototype.setupWebAppRoutes = function() {
    if( this.options &&
        this.options.webapp &&
        this.options.webapp.staticContentPath ) {
        var fullPath = path.resolve(this.options.webapp.staticContentPath);

        console.log("Static Dir Content -", fullPath);
        this.app.use( express.static(fullPath) );
    }
};

ServiceManager.prototype.setupDefaultRoutes = function() {

    // root
    this.app.get("/", function(req, res){
        //console.log("static root:", req.originalUrl);
        this.stats.increment("info", "Route.Static.Root");

        var fullPath = path.resolve(this.options.webapp.staticContentPath + "/" + this.routesMap.index);

        if(req.secure){
            res.sendfile( fullPath );   // eg. /index.html

            // console.log('****** https request for "/" was encrypted.  ( from setupDefaultRoutes ) ****** ');

        }else{

            // console.log('######## insecure http request for "/" ...  ( from setupDefaultRoutes() ) ');

            var host = req.get("host");

            if (!host) {
                console.log('                      ');
                console.log('  *   *  *****  ***** ');
                console.log('  *   *  *   *      * ');
                console.log('  *****  *   *  ***** ');
                console.log('      *  *   *      * ');
                console.log('      *  *****  ***** ');
                console.log('                      ');

                console.log('****** Request arrived with no "host" in header -- sending 403 error. ****** ');
                res.send(403);
                return;
            }


    // safe migration for release-candidate to develop branch
    res.sendfile( fullPath );


    // Test - Turn off the redirect to test catching static requests and file gets.
    //
    // if(this.options.services.name && 'app-external' == this.options.services.name){
    //     var sslServerPort = this.sslServerPort || 443;
    //     var newUrl = "https://" + host.split(":")[0] + ":" + sslServerPort + req.originalUrl;
    //     console.log('  ****** FAKE REDIRECT "/" http request  ****** ');
    //     console.log('  ****** (should redirect to ' + newUrl + ' ) ****** ');
    //     res.sendfile( fullPath );
    // }

            // // Redirecting this request also causes all the file gest for this page to redirect.
            // console.log('****** rediriecting "/" http request to ' + newUrl + ' ****** ');
            // res.redirect(303, newUrl);

        }
    }.bind(this));

    // all others -> DEFAULT
    this.app.use(function defaultRoute(req, res) {
        this.stats.increment("info", "Route.Default");

        // server up index
        //console.log("defaultRoute:", req.originalUrl);
        //res.redirect("/");

        // If the route ends with .png or .jpg, default to 404
        /*if( req.originalUrl.indexOf( ".png" ) != -1 || req.originalUrl.indexOf( ".jpg" ) != -1 ) {
            res.send( "File not found!", 404 );
        }*/
        //  else {

            var fullPath = path.resolve(this.options.webapp.staticContentPath + "/" + this.routesMap.index);

            if(req.secure){
                // console.log('****** default route -- connection is encryped -- ');
                res.sendfile( fullPath );
            }else{

                // console.log('****** default route -- connection is NOT encryped -- ');

                var host = req.get("host");

                if (!host) {
                    console.log("  ****** req.host missing, sending 403 error  ******  ");
                    res.send(403);
                    return;
                }

                // var serverPort = port || this.app.get('port');
                //
                // 8001  app_external
                // 8002  app_internal
                // 8003  app_assessment     (different source)
                // 8004  app_archiver
                var sslServerPort = this.sslServerPort || 443;

                var newUrl = "https://" + host.split(":")[0] + ":" + sslServerPort + req.originalUrl;


    res.sendfile( fullPath );   // safe migration for release-candidate to develop branch


    // console.log("  ****** fake rediriecting http request to " + newUrl + "  ******  ");
    // res.sendfile( fullPath );


                // // can't tell from the logs that this even works --
                // // says it's encrypted but logs an http://sssss:8001 path
                // //
                // console.log("  ****** req.connection is not encrypted,  ******  ");
                // console.log("  ******    rediriecting http request to " + newUrl + "  ******  ");
                // //
                // res.redirect(303, newUrl);
                // //res.redirect(302, newUrl);     // for pre-http/1/1 user agents

            }

        //  }
    }.bind(this));
}


ServiceManager.prototype.setupStaticRoutes = function() {
    // add static routes
    _.forEach(this.routesMap.statics, function(s){

        _.forEach(s.routes, function(route) {
            var file = "";

            if(s.file == 'index') {
                file = this.routesMap.index;
            } else {
                file = s.file;
            }
            var fullPath = path.resolve(this.options.webapp.staticContentPath + "/" + file);

            if(s.requireAuth) {
                console.log("Auth Static Route -", route, "->", file);

                this.app.get(route, function(req, res, next) {
                    this.stats.increment("info", "Route.AuthCheck");

                    // auth
                    if( req.isAuthenticated() ) {

    // console.log("SSSSSSSSSSSSSSSS  AAAAAAAA  Static Route - Auth required ");

                        this.stats.increment("info", "Route.Auth.Ok");
                        res.sendfile( fullPath );
                    } else {
                        //
                        this.stats.increment("error", "Route.Auth.Fail");
                        // error in auth, redirect back to login
                        //console.log("headers:", req.headers);
                        console.error("Not Authenticated");

                        res.clearCookie('connect.sid', { path: '/' });
                        res.redirect("/login");
                    }
                }.bind(this));

            } else {
                console.log("Static Route -", route, "->", file);

                this.app.get(route, function(req, res) {

    // // wont ever happen - no un-auth static routes in table
    // console.log("SSSSSSSSSSSSSSSS  NA-NA-NA-NA  Static Route - no auth ");
    // console.log('fullpath = '+fullpath);


                    res.sendfile( fullPath );
                }.bind(this));
            }
        }.bind(this));

    }.bind(this));
};


ServiceManager.prototype.setupApiRoutes = function() {
    // add apis routes
    _.forEach(this.routesMap.apis, function(a) {
        // does not include the min required
        if(!(a.api && a.service && a.controller && a.method)) { return; }

        // ignore services that are not added
        if( this.services.hasOwnProperty(a.service) ) {
            var service        = this.services[a.service].service;
            var ControllerList = this.services[a.service].lib.Controller;
            var controller     = {};

            if( ControllerList &&
                ControllerList.hasOwnProperty(a.controller) ) {
                controller = ControllerList[a.controller];
            }

            // save route in list for route lookup
            this.routeList[ a.api ] = {};

            // add each method
            _.forEach(a.method, function(funcName, m) {
                var func = function(){};

                if( controller &&
                    controller[ funcName ] ) {
                    func = controller[ funcName ];

                    // save route with method
                    this.routeList[ a.api ][m] = {
                        service: service,
                        func:    func
                    };

                    if(a.basicAuth) {
                        console.log("Basic Auth API Route -", a.api, "-> ctrl:", a.controller, ", method:", m, ", func:", funcName);

                      
                        // add wrapper function to check auth
                        this.app[ m ](a.api, function(req, res, next) {
                            var user = basicAuth(req);
                            if (!user || user.name != a.basicAuth.user || user.pass != a.basicAuth.pass) {
                                var realm = (a.basicAuth.realm ? a.basicAuth.realm : 'My Realm');
                                res.set('WWW-Authenticate', 'Basic realm="' + realm + '"');
                                return res.status(401).send();
                            }
                            return next();
                        });
                    }

                    // if require auth
                    if(a.requireAuth) {
                        console.log("Auth API Route -", a.api, "-> ctrl:", a.controller, ", method:", m, ", func:", funcName);

                        // add wrapper function to check auth
                        this.app[ m ](a.api, function(req, res, next) {
                            this.stats.increment("info", "Route.AuthCheck");

                            // Validate against requireHttps
                            /*if( a.requireHttps && this.options.env !== "dev" ) {
                                console.log( "-------- Request information ---------" );
                                console.log( "Request: " + req );
                                //console.log( "Request stringified: " + JSON.stringify( req ) );
                                console.log( "Request secure: " + req.secure );
                                console.log( "Request connection: " + req.connection );
                                //console.log( "Request connection stringified: " + JSON.stringify( req.connection ) );
                                console.log( "Request connection encrypted: " + req.connection.encrypted );
                                console.log( "--------------------------------------" );
                                if( !req.connection.encrypted ) {
                                    res.status(403).end();
                                    return;
                                }
                            }*/

                            // auth
                            if( req.isAuthenticated() ) {
                                this.stats.increment("info", "Route.Auth.Ok");
                                func.call(service, req, res, next, this);
                            } else {
                                //
                                this.stats.increment("error", "Route.Auth.Fail");
                                // error in auth, redirect back to login
                                //console.log("headers:", req.headers);
                                //console.error("Not Authenticated");

                                // if an api then return 401
                                if(req.originalUrl.indexOf("/api") != -1) {
                                    res.status(401).end();
                                } else {
                                    res.clearCookie('connect.sid', { path: '/' });
                                    res.redirect("/login");
                                }
                            }
                        }.bind(this));
                    } else {
                        console.log("API Route -", a.api, "-> ctrl:", a.controller, ", method:", m, ", func:", funcName);

                        // Validate against requireHttps
                        /*if( a.requireHttps && this.options.env !== "dev" ) {
                            if( !req.connection.encrypted ) {
                                res.status(403).end();
                                return;
                            }
                        }*/

                        // no login required
                        this.app[ m ](a.api, function(req, res, next) {
                            //this.stats.increment("info", "Route.Auth");
                            func.call(service, req, res, next, this);
                        }.bind(this));
                    }
                } else {
                    console.warn("Function \""+funcName+"\" not found in controller \""+a.controller+"\".");
                }
            }.bind(this));
        } else {
            console.warn("Service \""+a.service+"\" not found in services.");
        }
    }.bind(this));
};

ServiceManager.prototype.initServices = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    for(var s in this.services) {
        var service = new this.services[s].lib.Service(this.options,this);
        // save service
        this.services[s].service = service;

        // run app config if one exists
        if(service.appConfig) {
            service.appConfig(this.app);
        }
    }

    resolve();

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

ServiceManager.prototype.start = function(port) {
    console.log(Util.DateGMTString()+' ServiceManager start('+port+')');

    var portArg = port;

    if(!this.options.services.name){
        console.log('');
        console.log('****************    Error -- expect serverices.name set in e.g. app-external.js');
        console.log('****************             call manager.setName() in ' + this.options.services.startScript);
        console.log('');
        return;
    }

    console.log('Loading Version File...');
    this.loadVersionFile()
        .then(function(str) { // resolve(str)
            console.log('    --> date string from Version File = "'+str.split('"')[19]+'"');
            // var data = JSON.parse(str);
            // console.log('    --> date from Version File = '+data.date);
        }, function(err) { // reject(err)
            console.error("ServiceManager: Failed to Load Version File -", err);
        });

    // start express (session store,...), then start services
    this.initExpress()
        .then(function(){
            console.log('Initializing Services...');
            return this.initServices();
        }.bind(this))
        .then(function() {

            console.log('Starting Services...');
            console.log('----------------------------');
            // start all services
            var promiseList = [];
            for(var s in this.services) {
                if( this.services[s].service &&
                    this.services[s].service.start) {
                    promiseList.push( this.services[s].service.start(this) );
                }
            }

            // wait until all services are ready
            when.all(promiseList)
                .then(function(){
                    console.log('----------------------------');
                    console.log(Util.DateGMTString()+' **** Services Started');

                    TlsOptions = {
                        //  key: fs.readFileSync('ssl-key/glas77-key.pem'),
                        //  cert: fs.readFileSync('ssl-key/glas77-csr.pem')

                        ca: fs.readFileSync(this.options.services.TlsFiles.caName),
                        key: fs.readFileSync(this.options.services.TlsFiles.keyName),
                        cert: fs.readFileSync(this.options.services.TlsFiles.certName)
                    }

                    var serverPort = portArg || this.options.services.port || 8001;
                    //
                    // 8001  app_external
                    // 8002  app_internal
                    // 8003  app_assessment     (different source)
                    // 8004  app_archiver

                    // app-internal or app-external ?
                    // if( serverPort && 8002 == serverPort){  // internal server
                    if(this.options.services.name && 'app-internal' == this.options.services.name){

                        // update user count stats telemetry
                        updateTelemetryStats.call(this, this.stats);
                    }

                    //  console.log(" ");
                    console.log("Setting Up Routes...");

                    if(this.options.services.name && 'app-external' == this.options.services.name){

                        // external server

                        // console.log('SSL Redirect Gate - The first route checks request encryption status. ');
                        // console.log('                    It rejects [403] any request with no "host" in the header ');
                        // console.log('                    and may redirect [303] unencrypted requests. ');

                        console.log('SSL Redirect Gate - The first route checks request encryption status. ');
                        console.log('                    It rejects [403] any request with no "host" in the header. ');

                        this.app.all("*", function(req, res, next) {

                            this.stats.increment("info", "any.request");

                            var host = req.get("host");
                            if (!host) {
                                console.log("  ****** req.host missing, sending 403 error  ******  ");
                                res.send(403);
                                return;
                            }

                            // AWS says X-Forwarded-Proto and X-Forwarded-Port will be present if
                            // the request came to the EC2 server through the ELB.

                            var forwProto = req.get('X-Forwarded-Proto');
                            var forwPort = req.get('X-Forwarded-Port');

                            var reqPort = req.get('port') || host.split(":")[1];

                            // GLAS-88: use HTTP Strict Transport Security
                            res.set('Strict-Transport-Security', 'max-age=31536000');

                            if(req.secure){
                                // console.log("Connection status at SSL-Redirection-Gate - The http request is encrypted. " + req.originalUrl);
                                if(forwProto){
                                console.log(Util.DateGMTString()+' Secure Request -- '+forwProto+' port = '+reqPort+', fport = '+forwPort+'  -- host = '+host);
                                }else{
                                    console.log(Util.DateGMTString()+' Secure Request -- port = '+reqPort+'  -- host = '+host);
                                }
                                next();
                            }else{

                                if(forwProto){
                                console.log(Util.DateGMTString()+' INSECURE Request -- '+forwProto+' port = '+reqPort+', fport = '+forwPort+'  -- host = '+host);
                                }else{
                                    console.log(Util.DateGMTString()+' INSECURE Request -- port = '+reqPort+'  -- host = '+host);
                                }

                                // console.log("Connection status at SSL-Redirection-Gate - The http request is not encrypted. " + req.originalUrl);

                             //    var newUrl = "https://" + host.split(":")[0] + ":" + serverPort;
                             // // var newUrl = "https://" + host.split(":")[0] + ":" + sslServerPort + req.originalUrl;

                                next();

                                //  console.log("  ****** req.connection is not encrypted,  ******  ");
                                //  console.log("  ******   rediriecting to " + newUrl + "  ******  ");
                                //
                            //  res.redirect(303, newUrl);
                                //res.redirect(302, newUrl);     // for pre-http/1/1 user agents
                            }

                        }.bind(this));
                    }

                    // setup routes
                    this.setupRoutes();
                    console.log('----------------------------');
                    console.log('Routes Setup done')

                    // after routes set-up
                    this.app.use(errorhandler({showStack: true, dumpExceptions: true}));

                    console.log(Util.DateGMTString()+' Starting Server ... ');

                    console.log('        ----------------------------------------------------- ');
                    console.log('        (decoded and forwarded by ELB) ');
                    console.log(' ');
                    console.log('        8001 http  <- ELB <- 443  https     // secure web site - not enforced');
                    console.log('        -----------------------------------------------------    ');
                    console.log('        8001 http  <- ELB <- 80   http      // insecure web site ');
                    console.log('        8001 http  <- ELB <- 8080 http      //                   ');
                    // console.log('                                                                        ');
                    // console.log('        8001 http  <- ELB <- 8001 http          // these can be blocked ');
                    // console.log('        8002 http  <- ELB <- 8002 http          // if external access   ');
                    // console.log('        8003 http  <- ELB <- 8003 http          // is not allowed.      ');
                    // console.log('        8004 http  <- ELB <- 8004 http');
                    console.log('                                                                 ');
                    console.log('        8080 https  ( can work without ELB ) '); 
                    console.log('        8043 https  ( NOT decoded by ELB ) '); 
                    console.log('        ------------------------------------ ');

                    // 8001  app_external
                    // 8002  app_internal
                    // 8003  app_assessment     (different source)
                    // 8004  app_archiver

                    var httpServerPort = 8001;      // default app-external port
                    var httpServerPort_02 = 8080;   // second http port -- can work without ELB

                    // set services.portSSL = 8043 for local dev
                    // not used if services.sslDecodedByProxy == true
                    var sslServerPort = this.options.services.portSSL || 443;

                    console.log(Util.DateGMTString()+' attaching ports ... ');

                    if(this.options.services.name && 'app-external' == this.options.services.name){
                        // app-external
                        // 8001 primary http port - insecure
                        httpServerPort = this.options.services.appExternalPort || this.options.services.portNonSSL || 8001;

                        if((443 != serverPort) && (8043 != serverPort)){
                            httpServerPort = serverPort;
                        }

                        console.log('                        attempting to attach port '+httpServerPort+' ... ');
                        http.createServer(this.app).listen(httpServerPort, function createServer(){
                            this.httpServerPort = httpServerPort;
                            this.stats.increment("info", "http_Server_Started_port_"+httpServerPort);
                            console.log('                        listening on port '+httpServerPort+' (http). ');
                            // console.log('---------------------------------------------------------------------------------------');
                        }.bind(this));

                        if(this.options.services.portNonSSL && this.options.services.portNonSSL != httpServerPort){
                            httpServerPort_02 = this.options.services.portNonSSL;
                            // console.log('diag- httpServerPort_02 =', httpServerPort_02);
                        }

                        // second http port -- can work without ELB
                        if(httpServerPort != httpServerPort_02){
                            console.log('                        attempting to attach port '+httpServerPort_02+' ... ');
                            http.createServer(this.app).listen(httpServerPort_02, function createServer(){
                                this.httpServerPort_02 = httpServerPort_02;
                                console.log('                        listening on port '+httpServerPort_02+' (http). ');
                            }.bind(this));
                        }

                        // primary SSL port
                        if(!this.options.services.sslDecodedByProxy){

                            if((443 == serverPort) || (8043 == serverPort)){
                                sslServerPort = serverPort;
                            }

                            // insecure website requests will redirect to this port
                            console.log('                        attempting to attach port '+sslServerPort+' ... ');

                            https.createServer(TlsOptions, this.app).listen(sslServerPort, function createServer(){
                                    this.sslServerPort = sslServerPort;
                                console.log('                        listening on port '+sslServerPort+' (https). ');
                                this.stats.increment('info', 'server_started_port_'+sslServerPort);
                                // this.stats.increment('info', 'server_started_any');
                            }.bind(this));

                        }

                    } else if(this.options.services.name && 'app-internal' == this.options.services.name){
                        // app-internal
                        // 8002 primary http port - insecure
                        httpServerPort = this.options.services.appInternalPort || 8002;
                        console.log('                        attempting to attach port '+httpServerPort+' ... ');
                        http.createServer(this.app).listen(httpServerPort, function createServer(){
                            this.httpServerPort = httpServerPort;
                            this.stats.increment("info", "http_Server_Started_port_"+httpServerPort);
                            console.log('                        listening on port '+httpServerPort+' (http). ');
                        }.bind(this));
                    } else if(this.options.services.name && 'app-archiver' == this.options.services.name){
                        // app-aechiver
                        // 8004 primary http port - insecure
                        httpServerPort = this.options.services.appArchiverPort || 8004;
                        console.log('                        attempting to attach port '+httpServerPort+' ... ');
                        http.createServer(this.app).listen(httpServerPort, function createServer(){
                            this.httpServerPort = httpServerPort;
                            this.stats.increment("info", "http_Server_Started_port_"+httpServerPort);
                            console.log('                        listening on port '+httpServerPort+' (http). ');
                        }.bind(this));
                    }

                    console.log('---------------------------------------------------------------------------------------');

                }.bind(this))

                .then(null, function(err){
                    console.error("ServiceManager: Service Error -", err);
                }.bind(this));

        }.bind(this))
        // catch all
        .then(null, function(err){
            console.error("ServiceManager: Start Error -", err);
        }.bind(this));
};

var updateTelemetryStats = function(stats){

    console.log("updateTelemetryStats() called ...")

    var mysql_options = _.merge(
        {
            host    : "localhost",
            user    : "glasslab",
            password: "glasslab",
            database: "glasslab_dev",
        },

        this.options.auth.datastore.mysql
    );

    var MySQL = require('../core/datastore.mysql.js');
    var ds = new MySQL(mysql_options);

    this.options.services.ds_mysql = ds;

    var bindCountStudents = countStudents.bind(this, this.stats);   // with context
    bindCountStudents(this.stats);                                  // once, now
    setInterval( bindCountStudents, 2*60*1000, this.stats);         // then every 2 minutes

    var bindCountTeachers = countTeachers.bind(this, this.stats);
    bindCountTeachers(this.stats);
    setInterval( bindCountTeachers, 2*60*1000, this.stats);

    var boundUpUserCount = updateUserCount.bind(this, this.stats);
    boundUpUserCount(this.stats);
    setInterval( boundUpUserCount, 2*60*1000, this.stats);

    var bindCountDAU = countDailyActiveUsers.bind(this, this.stats);
    bindCountDAU(this.stats);
    setInterval( bindCountDAU, 30*1000, this.stats);                // 30 seconds
};

var countDailyActiveUsers = function(stats){

    var Q;
    var userCount;
    var first_login;
    // var first_login = this.options.services.first_login || '2015-09-03 23:59:02';

    if("dev" == this.options.env){
        first_login = this.options.env_dev.first_login;
    } else if("stage" == this.options.env){
        first_login = this.options.env_stage.first_login;
    } else if("prod" == this.options.env){
        first_login = this.options.env_prod.first_login;
    }

    first_login = first_login || '2015-09-03 23:59:02';

    this.ds = this.options.services.ds_mysql;

    when.promise(function(resolve, reject){

        Q = "SELECT COUNT(id) as num FROM GL_USER " +
            "WHERE ENABLED = 1 AND last_login IS NOT NULL " +
            "AND DATE_SUB(NOW(), INTERVAL 17 HOUR) <= last_login"        // over last 24 hours
        //  "AND DATE_SUB(CURDATE(), INTERVAL 17 HOUR) <= last_login"    // reset DAU at 11:59pm PDT
        //  "AND DATE_SUB(CURDATE(), INTERVAL 1 DAY) <= last_login"      // reset at 5pm PDT

        this.ds.query(Q)
            .then(function(results){

                userCount = parseFloat(results[0].num);
                stats.gaugeNoRoot("info", "dau_count", userCount);
                console.log(Util.DateGMTString()+" countDailyActiveUsers() -- found, "+userCount+" Daily Active Users in the DB.");

                resolve(results[0]);
            }, function(err){
                    console.log("error ---- dbg "+err+" <<");
                reject(err);
            })
    }.bind(this));

    when.promise(function(resolve, reject){

        Q = "SELECT COUNT(id) as num FROM GL_USER " +
            "WHERE ENABLED = 1 AND last_login IS NOT NULL " +
            "AND DATE_SUB(CURDATE(), INTERVAL 30 DAY) <= last_login"

        this.ds.query(Q)
            .then(function(results){

                userCount = parseFloat(results[0].num);
                stats.gaugeNoRoot("info", "mau_count", userCount);
                console.log(Util.DateGMTString()+" countDailyActiveUsers() -- found, "+userCount+" Monthly Active Users in the DB.");

                resolve(results[0]);
            }, function(err){
                    console.log("error ---- dbg "+err+" <<");
                reject(err);
            })
    }.bind(this));

    // tentative MAU - user has no login date in db ...

    when.promise(function(resolve, reject){

        Q = "SELECT COUNT(id) as num FROM GL_USER " +
            "WHERE " +
            "( ENABLED = 1 AND last_login IS NULL " +
            "AND DATE_SUB(CURDATE(), INTERVAL 30 DAY) <= TIMESTAMP('" + first_login + "') ) ";

            //  2015-09-03 23:59:01 == first day last_login was available on this platform ?
            // after 30 days all of the maybe MAU expire

        this.ds.query(Q)
            .then(function(results){

                userCount = parseFloat(results[0].num);
                stats.gaugeNoRoot("info", "maybe_mau_count", userCount);
                console.log(Util.DateGMTString()+" countDailyActiveUsers() -- found, "+userCount+
                    " (maybe) Monthly Active Users in the DB.");

                resolve(results[0]);
            }, function(err){
                    console.log("error ---- dbg "+err+" <<");
                reject(err);
            })
    }.bind(this));

    when.promise(function(resolve, reject){

        Q = "SELECT COUNT(id) as num FROM GL_USER " +
            "WHERE " +
            "( ENABLED = 1 AND last_login IS NOT NULL " +
            "AND DATE_SUB(CURDATE(), INTERVAL 30 DAY) <= last_login ) " +
            "OR " +
            "( ENABLED = 1 AND last_login IS NULL " +
            "AND DATE_SUB(CURDATE(), INTERVAL 30 DAY) <= TIMESTAMP('" + first_login + "') ) ";

        this.ds.query(Q)
            .then(function(results){

                userCount = parseFloat(results[0].num);
                stats.gaugeNoRoot("info", "mau_plus_maybe_count", userCount);
                console.log(Util.DateGMTString()+" countDailyActiveUsers() -- found, "+userCount+
                    " Monthly plus maybe Active Users in the DB.");

                resolve(results[0]);
            }, function(err){
                    console.log("error ---- dbg "+err+" <<");
                reject(err);
            })
    }.bind(this));

    when.promise(function(resolve, reject){

        Q = "SELECT COUNT(id) as num FROM GL_USER " +
            "WHERE ( ENABLED = 1 AND " +
            "DATE_SUB(CURDATE(), INTERVAL 1 DAY) <= date_created ) ";

        this.ds.query(Q)
            .then(function(results){

                userCount = parseFloat(results[0].num);
                stats.gaugeNoRoot("info", "new_users_today_count", userCount);
                console.log(Util.DateGMTString()+" countDailyActiveUsers() -- found, "+userCount+
                    " New users Today in the DB.");

                resolve(results[0]);
            }, function(err){
                    console.log("error ---- dbg "+err+" <<");
                reject(err);
            })
    }.bind(this));

    when.promise(function(resolve, reject){

        Q = "SELECT COUNT(id) as num FROM GL_USER " +
            "WHERE ( ENABLED = 1 AND system_Role = 'student' AND " +
            "DATE_SUB(CURDATE(), INTERVAL 1 DAY) <= date_created ) ";

        this.ds.query(Q)
            .then(function(results){

                userCount = parseFloat(results[0].num);
                stats.gaugeNoRoot("info", "new_students_today_count", userCount);
                console.log(Util.DateGMTString()+" countDailyActiveUsers() -- found, "+userCount+
                    " New Students Today in the DB.");

                resolve(results[0]);
            }, function(err){
                    console.log("error ---- dbg "+err+" <<");
                reject(err);
            })
    }.bind(this));

    when.promise(function(resolve, reject){

        Q = "SELECT COUNT(id) as num FROM GL_USER " +
            "WHERE ( ENABLED = 1 AND system_Role = 'instructor' AND " +
            "DATE_SUB(CURDATE(), INTERVAL 1 DAY) <= date_created ) ";

        this.ds.query(Q)
            .then(function(results){

                userCount = parseFloat(results[0].num);
                stats.gaugeNoRoot("info", "new_teachers_today_count", userCount);
                console.log(Util.DateGMTString()+" countDailyActiveUsers() -- found, "+userCount+
                    " New Teachers Today in the DB.");

                resolve(results[0]);
            }, function(err){
                    console.log("error ---- dbg "+err+" <<");
                reject(err);
            })
    }.bind(this));
};

var countStudents = function(stats){

    var Q;
    var userCount;

    this.ds = this.options.services.ds_mysql;

    when.promise(function(resolve, reject){
        Q = "SELECT COUNT(id) as num FROM GL_USER WHERE ENABLED = 1 AND system_Role = 'student'";

        this.ds.query(Q)
            .then(function(results){

                userCount = parseFloat(results[0].num);
                stats.gaugeNoRoot("info", "student_count", userCount);
                console.log(Util.DateGMTString()+" countStudents() -- found, "+userCount+" students in the DB.");

                resolve(results[0]);
            }, function(err){
                    console.log("error ---- dbg "+err+" <<");
                reject(err);
            })
    }.bind(this));
};

var countTeachers = function(stats){

    var Q;
    var userCount;

    this.ds = this.options.services.ds_mysql;

    when.promise(function(resolve, reject){
        Q = "SELECT COUNT(id) as num FROM GL_USER WHERE ENABLED = 1 AND system_Role = 'instructor'";

        this.ds.query(Q)
            .then(function(results){

                userCount = parseFloat(results[0].num);
                stats.gaugeNoRoot("info", "teacher_count", userCount);
                console.log(Util.DateGMTString()+" countTeachers() -- found, "+userCount+" teachers in the DB.");

                resolve(results[0]);
            }, function(err){
                    console.log("error ---- dbg "+err+" <<");
                reject(err);
            })
    }.bind(this));
};

var updateUserCount = function(stats){

    var Q;
    var userCount;

    this.ds = this.options.services.ds_mysql;

    when.promise(function(resolve, reject){
        Q = "SELECT COUNT(id) as num FROM GL_USER WHERE ENABLED = 1 AND (system_Role = 'instructor' OR system_Role = 'student')";

        this.ds.query(Q)
            .then(function(results){

                userCount = parseFloat(results[0].num);
                stats.gauge("info", "user_count", userCount);
                stats.gaugeNoRoot("info", "user_count", userCount);
                console.log(Util.DateGMTString()+" updateUserCount() -- found, "+userCount+
                        " students and teachers in the DB.");

                resolve(results[0]);
            }, function(err){
                    console.log("error ---- dbg "+err+" <<");
                reject(err);
            })
    }.bind(this));
};

ServiceManager.prototype.updateUserDataInSession = function(session){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        var data = _.cloneDeep(session);
        delete data.id;
        delete data.req;

        var key = this.exsStore.getSessionPrefix()+":"+data.passport.user.sessionId;
        this.exsStore.set(key, data, function(err) {
            if(err) {
                this.stats.increment("error", "UpdateUserDataInSession");
                reject({"error": "failure", "exception": err}, 500);
                return;
            }
            resolve();
        }.bind(this));
// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

ServiceManager.prototype.internalRoute = function(routePath, method, args){
    if( this.routeList.hasOwnProperty(routePath) &&
        this.routeList[routePath].hasOwnProperty(method)
      ) {

        var route = this.routeList[routePath][method];

        if(_.isArray(args)) {
            args.push(this);
        } else {
            args = [args, this];
        }

        return route.func.apply(route.service, args);
    }
    return when.reject('invalid route');
};
