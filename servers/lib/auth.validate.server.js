/**
 * Authentication Server Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  express    - https://github.com/visionmedia/express
 *
 */
var http       = require('http');
var path       = require('path');
// Third-party libs
var _          = require('lodash');
var express    = require('express');
var passport   = require('passport');
var request    = require('request');
var couchbase  = require('couchbase');
var CouchbaseStore = require('./sessionstore.couchbase.js')(express);

// Glasslab libs
var aConst     = require('./auth.const.js');
var rConst     = require('./routes.const.js');

module.exports = AuthValidateServer;

function errorResponce(res, errorStr){
    var error = JSON.stringify({ error: errorStr });
    res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": error.length
    });
    res.end( error );
}

function jsonResponce(res, obj){
    var json = JSON.stringify(obj);
    res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": json.length
    });
    res.end( json );
}

function AuthValidateServer(options){
    try {
        this.options = _.merge(
            {
                validate: { port: 8083},
                sessionstore: {
                    "host":     "localhost:8091",
                    "bucket":   "glasslab_webapp",
                    "password": "glasslab"
                }
            },
            options
        );

        this.app = express();

        this.sessionStore = new couchbase.Connection({
            host:     this.options.sessionstore.host,
            bucket:   this.options.sessionstore.bucket,
            password: this.options.sessionstore.password
        }, function(err) {
            console.error("CouchBase SessionStore: Error -", err);
            if(err) throw err;
        }.bind(this));

        // pass session store to express session store strategy, via options
        this.options.sessionstore.client = this.sessionStore;
        // express session store
        this.exsStore = new CouchbaseStore(this.options.sessionstore);

        this.app.configure(function() {
            this.app.set('port', this.options.validate.port);

            this.app.use(express.logger());
            this.app.use(express.errorHandler({showStack: true, dumpExceptions: true}));

            this.app.use(express.urlencoded());
            this.app.use(express.json());
            this.app.use(express.methodOverride());

            // setup app routes
            this.setupRoutes();
        }.bind(this));

        // start server
        http.createServer(this.app).listen(this.app.get('port'), function createServer(){
            console.log('AuthValidate: Server listening on port ' + this.app.get('port'));
        }.bind(this));

    } catch(err){
        console.trace("AuthValidate: Error -", err);
    }
}

AuthValidateServer.prototype.setupRoutes = function() {
    try {
        // GET
        this.app.get(rConst.api.session.validate, function validateSession(req, res, next){
            console.log("validateSession:", req.path);
            if(req.connection.remoteAddress == "127.0.0.1")
            {
                if( req.params.id ) {
                    // using proxy session get real session
                    this.sessionStore.get(aConst.proxySessionPrefix+":"+req.params.id, function(err, result) {
                        if(err) {
                            console.error("CouchBase validateSession: Error -", err);
                            errorResponce(res, err.toString());
                        }

                        if(result.value) {
                            console.log("CouchBase SessionStore: value:", result.value);

                            if(result.value.session) {
                                this.sessionStore.get(this.exsStore.getSessionPrefix()+":"+result.value.session, function(err, result) {
                                    if(err) {
                                        console.error("CouchBase validateSession: Error -", err);
                                        errorResponce(res, err.toString());
                                    }

                                    if(result.value.passport.user) {
                                        jsonResponce(res, result.value.passport);
                                    } else {
                                        errorResponce(res, "No user data");
                                    }
                                }.bind(this));

                            } else {
                                // request for missing session
                                res.end();
                            }

                        } else {
                            // request for missing session
                            res.end();
                        }

                    }.bind(this));
                } else {
                    errorResponce(res, "Missing ID");
                }
            } else {
                console.error("CouchBase validateSession invalid remoteAddress ", req.connection.remoteAddress);
                next();
            }
        }.bind(this));

        // DEFAULT
        this.app.use(function defaultRoute(req, res) {
            console.log("defaultRoute:", req.path);
            res.redirect(rConst.root);
        }.bind(this));

    } catch(err){
        console.trace("AuthValidate: setupRoutes Error -", err);
    }
};

