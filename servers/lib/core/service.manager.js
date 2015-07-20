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

var TlsOptions = {
    //  key: fs.readFileSync('ssl-key/glas77-key.pem'),
    //  cert: fs.readFileSync('ssl-key/glas77-csr.pem')
    ca: fs.readFileSync('ssl-key/server/priv-root-ca.crt.pem'),
    key: fs.readFileSync('ssl-key/server/server.key.pem'),
    cert: fs.readFileSync('ssl-key/server/server.crt.pem')
}

// load at runtime
var Util;

module.exports = ServiceManager;

process.on('uncaughtException', function(err) {
    console.error("ServiceManager: Uncaught Error -", err, ", stack:", err.stack);
});

function ServiceManager(configFiles){
    Util              = require('../core/util.js');
    var ConfigManager = require('../core/config.manager.js');

    console.log('---------------------------------------------');
    console.log('Loading Configuration...');
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

    // always add the root config first
    configFiles.unshift("./config.json");
    this.options = config.loadSync(configFiles);

    if(!this.options.services) {
        this.options.services = {};
    }
    if(!this.options.services.session) {
        this.options.services.session = {};
    }

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
            this.version = data.toString();
            resolve(this.version);
        }
    }.bind(this));
}.bind(this));
// end promise wrapper
};

ServiceManager.prototype.setRouteMap = function(str) {
    this.routesMap = require(str);
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
        var CouchbaseStore = require('./sessionstore.couchbase.js')(express);
        this.exsStore      = new CouchbaseStore(this.options.services.session.store);
        connectPromise = this.exsStore.glsConnect();
    } else {
        var MemoryStore = express.session.MemoryStore;
        this.exsStore   = new MemoryStore();
        connectPromise = Util.PromiseContinue();
    }

    console.log('SessionStore Connecting...');
    connectPromise
        .then(function(){
            console.log('SessionStore Connected');

            this.app = express();
            this.app.set('port', process.env.PORT || this.options.services.port);

            this.app.configure(function() {

                this.app.use(Util.GetExpressLogger(this.options, express, this.stats));
                this.app.use(express.compress()); // gzip compress, Need to disable for loadtest
                this.app.use(express.errorHandler({showStack: true, dumpExceptions: true}));

                this.app.use(express.cookieParser());
                this.app.use(express.urlencoded());
                this.app.use(express.json());
                this.app.use(express.methodOverride());
                var whitelist = [ "https://glgdev.firebaseapp.com", "http://new.wwf.local", "https://new.wwf.local", "http://www.wordswithfriendsedu.com", "http://edu.zwf-staging.zynga.com", "http://s3-us-west-1.amazonaws.com", "https://s3-us-west-1.amazonaws.com" ];
                var corsOptions = {
                    origin: function( origin, callback ) {
                        var originIsWhitelisted = whitelist.indexOf( origin ) !== -1;
                        callback( null, originIsWhitelisted );
                    },
                    credentials: true
                };
                this.app.use( cors(corsOptions) );

                this.app.use(express.session({
                  secret: this.options.services.session.secret || "keyboard kitty",
                    cookie: _.merge({
                        path: '/'
                        , httpOnly : false
                        //, maxAge: 1000 * 60 * 24 // 24 hours
                    }, this.options.services.session.cookie),
                    store:  this.exsStore
                }));
                resolve();
            }.bind(this))
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
        res.sendfile( fullPath );
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

            if(req.connection.encrypted){
                //  console.log(' https ok ... no need to redirect ...');
                res.sendfile( fullPath );
            }else{
                   console.log(' ');
                   console.log(' * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * ');
                   console.log('    ERROR -    HTTP request was not redirected. ');
                   console.log(' * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * ');
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
                        this.app[ m ](a.api, express.basicAuth(
                                function(user, pass){
                                    return ( user == a.basicAuth.user &&
                                             pass == a.basicAuth.pass
                                    );
                                }
                            )
                        );
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
    this.loadVersionFile()
        .then(function() {
            console.log('Loading Version File...');
        })
        .then(null,function(err) {
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
                    console.log('Services Started');

                    // undefined == port
                    // undefined == serverPort
                    var serverPort = port || this.app.get('port');

    console.log(" ");
    console.log(Util.DateGMTString()+" test point **************** ");

                    // app-internal or app-external ?
                    if( serverPort && 8002 == serverPort){  // internal server
                        updateUserCount(this.stats);        // update user count stats telemetry
                        setInterval( updateUserCount, 3*60*1000, this.stats);
                    }

                    console.log(" ");
                    console.log("Setting Up Routes...");

                    // serverPort = undefined
                    if( serverPort && 8002 == serverPort)
                    {
                        // internal server
                        // TODO - better test for is-internal-server
                    }else{
                        // external server

                        // first route - check for SSL
                        console.log(' The first route checks for non-SSL requests. ');
                        console.log(' ');

                        this.app.all("*", function(req, res, next) {
                            var host = req.get("host");
                            if (!host) {
                                console.log("  ****** req.host missing, sending 403 error  ******  ");
                                res.send(403);
                                return;
                            }

                            if(req.connection.encrypted){
                                //  console.log(' req.connection.encrypted - check next route ... ');
                                next();
                            }else{
                                var newUrl = "https://" + host.split(":")[0] + ":" + serverPort;
                                console.log("  ****** req.connection is not encrypted, rediriecting to " + newUrl + "  ******  ");

                                res.redirect(303, newUrl);
                                //res.redirect(302, newUrl);     // for pre-http/1/1 user agents
                            }

                        }.bind(this));
                    }

                    // setup routes
                    this.setupRoutes();
                    console.log('----------------------------');
                    console.log('Routes Setup done')

                    // start https server
                    console.log(Util.DateGMTString()+' Starting Server on port', serverPort, "...");
                    https.createServer(TlsOptions, this.app).listen(serverPort, function createServer(){
                        console.log('Server listening on port ' + serverPort);      // testing on port 9999
                        this.stats.increment("info", "server_started_port_"+serverPort);    // app-int and app-ext
                        this.stats.increment("info", "server_started_any");
                    }.bind(this));

                    if( serverPort && 8002 == serverPort)
                    {
                        // internal server node
                    }else{
                        // external server node -- will also listen on ports 80 and 8080 for http: requests.

                        var httpServerPort = this.options.services.portNonSSL || 80;
                        http.createServer(this.app).listen(httpServerPort, function createServer(){
                            this.stats.increment("info", "http_Server_Started_port_"+httpServerPort);
                            console.log('       listening on port ' + httpServerPort + '  ( redirect any http:// request to https:// ). ');
                        }.bind(this));
                    }

                    console.log('---------------------------------------------');
                    console.log('');

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

var updateUserCount = function(stats){
    var userId = 1;
    var userCount;

    var MySQL = require('../core/datastore.mysql.js');

    var options = {
        xtest: "xtest"
    };

    this.options = _.merge(
        {
            host    : "localhost",
            user    : "glasslab",
            password: "glasslab",
            database: "glasslab_dev"
        },
        options
    );

    this.ds = new MySQL(this.options);

if(MySQL){
    console.log("got MySQL ...");
    if(this.ds){
        console.log("got this.ds");
    }
}

    console.log(Util.DateGMTString()+" ****  updateUserCount() called ... --- debug ---");

    when.promise(function(resolve, reject){
        var Q = "SELECT COUNT(id) as num FROM GL_USER WHERE system_Role = 'instructor' OR system_Role = 'student'";

        this.ds.query(Q)
            .then(function(results){

                console.log(Util.DateGMTString()+" list SQL results ...    --- debug --- ");
                console.log(results);

                userCount = parseFloat(results[0].num);
                stats.gauge("info", "user_count", userCount);
                console.log(Util.DateGMTString()+" updateUserCount() -- found, "+userCount+
                        " students and instructors in the DB."+err);

                resolve(results[0]);
            })
            .then(null, function(err){
                    console.log("error ---- dbg "+err+" <<");
                reject(err);
            });
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
