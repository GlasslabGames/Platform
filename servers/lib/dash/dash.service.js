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
        var TelmStore, LmsStore, DashStore;

        // Glasslab libs
        Util          = require('../core/util.js');
        TelmStore     = require('../data/data.js').Datastore.Couchbase;
        LmsStore      = require('../lms/lms.js').Datastore.MySQL;
        DashStore     = require('../dash/dash.js').Datastore.MySQL;

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
        this.dashStore   = new DashStore(this.options.webapp.datastore.mysql);

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
                console.log("DashService: Data DS Connected");
                this.stats.increment("info", "TelemetryDS.Connect");
            }.bind(this),
            function(err){
                console.trace("DashService: Data DS Error -", err);
                this.stats.increment("error", "TelemetryDS.Connect");
            }.bind(this))

        .then(resolve, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

// TODO: replace this with DB lookup, return promise
// returns a uppercase list of all game Ids, game Ids are ALWAYS uppercase
DashService.prototype.getListOfGameIds = function() {
    var gameIds = [];
    for(var g in this.games) {
        if( this.games[g].info &&
            this.games[g].info.basic &&
            this.games[g].info.basic.gameId) {
            gameIds.push( this.games[g].info.basic.gameId.toUpperCase() );
        }
    }
    return gameIds;
};

// TODO: replace this with DB lookup, return promise
DashService.prototype.getGames = function() {
    return this.games;
};


// TODO: replace this with DB lookup, return promise
DashService.prototype.getGameAssessmentInfo = function(gameId) {
    return this.games[gameId].info.assessment;
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
                var gameId = gameName.toUpperCase();

                // gameName is not case sensitive
                this.games[ gameId ] = {};

                var gameFiles = fs.readdirSync( path.join(dir, gameName) );

                gameFiles.forEach(function(file){
                    if(file.charAt(0) != '.') {
                        var name = path.basename(file, path.extname(file));
                        var filePath = path.join(dir, gameName, file);
                        this.games[gameId][name] = require(filePath);
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


DashService.prototype.getListOfAchievements = function(gameId, playerAchievement) {
    // if no player achievements then default to none
    if(!playerAchievement) {
        playerAchievement = {};
    }

    // if not game Id in games, then return empty object
    if(!this.games.hasOwnProperty(gameId)) {
        return [];
    }

    var achievementsList = [];
    var a = _.merge(_.cloneDeep(this.games[gameId].achievements), playerAchievement);
    //console.log("a:", a);

    for(var groupId in a.groups) {
        for(var subGroupId in a.groups[groupId].subGroups) {
            for(var itemId in a.groups[groupId].subGroups[subGroupId].items) {
                var achievement = {
                    "group":    groupId,
                    "subGroup": subGroupId,
                    "item":     itemId,
                    "won":      false
                };

                if(a.groups[groupId].subGroups[subGroupId].items[itemId].won) {
                    achievement.won = true;
                }

                achievementsList.push(achievement);
            }
        }
    }

    return achievementsList;
};