/**
 * Dashboard Service Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  when       - https://github.com/cujojs/when
 *
 */
var fs      = require('fs');
var path    = require('path');
// Third-party libs
var _       = require('lodash');
var when    = require('when');

// load at runtime
var Util;

module.exports = DashService;

function DashService(options){
    try{
        var TelmStore;

        // Glasslab libs
        Util          = require('../core/util.js');
        TelmStore     = require('../data/data.js').Datastore.Couchbase;
        LmsStore      = require('../lms/lms.js').Datastore.MySQL;

        this.options = _.merge(
            {
                DashService: { port: 8084 }
            },
            options
        );

        this.requestUtil = new Util.Request(this.options);
        this.stats       = new Util.Stats(this.options, "Dash");

        this.telmStore   = new TelmStore(this.options.telemetry.datastore.couchbase);
        this.lmsStore    = new LmsStore(this.options.lms.datastore.mysql);

        this.games = {};

    } catch(err){
        console.trace("DashService: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

DashService.prototype.start = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    this._loadGameFiles()
        .then(function(){
                return this.telmStore.connect();
            }.bind(this))
        .then(function(){
                console.log("DashService: Telemetry DS Connected");
                this.stats.increment("info", "TelemetryDS.Connect");
            }.bind(this),
            function(err){
                console.trace("DashService: Telemetry DS Error -", err);
                this.stats.increment("error", "TelemetryDS.Connect");
            }.bind(this))

        .then(resolve, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

DashService.prototype.getListOfGameIds = function() {
    var gameIds = [];
    for(var g in this.games) {
        gameIds.push(this.games[g].info.gameId);
    }
    return gameIds;
};

DashService.prototype._loadGameFiles = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    try{
        var dir = path.join(__dirname, "games");
        var files = fs.readdirSync(dir);

        files.forEach(function(gameName){
            // skip dot files
            if(gameName.charAt(0) != '.') {
                this.games[gameName] = {};

                var gameFiles = fs.readdirSync( path.join(dir, gameName) );

                gameFiles.forEach(function(file){
                    if(file.charAt(0) != '.') {
                        var name = path.basename(file, path.extname(file));
                        var filePath = path.join(dir, gameName, file);
                        this.games[gameName][name] = require(filePath);
                    }
                }.bind(this));
            }
        }.bind(this));
    } catch(err) {
        console.error("DashService: Load Game Files Error -", err);
    }

    console.log('DashService: Loaded Game Files');
    resolve();
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};
