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

function DashService(options, serviceManager){
    try{
        var TelmStore, LmsStore, DashStore, Errors;

        // Glasslab libs
        Util          = require('../core/util.js');
        TelmStore     = require('../data/data.js').Datastore.Couchbase;
        LmsStore      = require('../lms/lms.js').Datastore.MySQL;
        DashStore     = require('../dash/dash.js').Datastore.MySQL;
        Errors        = require('../errors.js');

        this.options = _.merge(
            {
                DashService: { port: 8084 }
            },
            options
        );

        this.requestUtil = new Util.Request(this.options, Errors);
        this.stats       = new Util.Stats(this.options, "Dash");

        this.telmStore   = new TelmStore(this.options.telemetry.datastore.couchbase);
        this.lmsStore    = new LmsStore(this.options.lms.datastore.mysql);
        this.dashStore   = new DashStore(this.options.webapp.datastore.mysql);

        this.serviceManager = serviceManager;

        this._games = {};

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
                // test connection to telemetry store
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
    for(var g in this._games) {
        if( this._games[g].info &&
            this._games[g].info.basic &&
            this._games[g].info.basic.gameId &&
            // only return games that are enabled
            this._games[g].info.basic.enabled) {
            gameIds.push( this._games[g].info.basic.gameId.toUpperCase() );
        }
    }
    return gameIds;
};

// TODO: replace this with DB lookup, return promise
DashService.prototype.isValidGameId = function(gameId) {
    for(var g in this._games) {
        if( g == gameId &&
            this._games[g] &&
            this._games[g].info &&
            this._games[g].info.basic &&
            // only return games that are enabled
            this._games[g].info.basic.enabled) {
            return true;
        }
    }
    return false;
};

// TODO: replace this with DB lookup, return promise
DashService.prototype.getGames = function() {
    return this._games;
};

// TODO: replace this with DB lookup, return promise
DashService.prototype.getGameReports = function(gameId) {
    if( this._games.hasOwnProperty(gameId) &&
        this._games[gameId].hasOwnProperty('info') &&
        this._games[gameId].info.hasOwnProperty('reports') ) {
        return this._games[gameId].info.reports;
    } else {
        return [];
    }
};

// TODO: replace this with DB lookup, return promise
DashService.prototype.getGameAchievements = function(gameId) {
    if( this._games.hasOwnProperty(gameId) &&
        this._games[gameId].hasOwnProperty('achievements') ) {
        return this._games[gameId].achievements;
    } else {
        return {};
    }
};

// TODO: replace this with DB lookup, return promise
DashService.prototype.getGameDetails = function(gameId) {
    if( this._games.hasOwnProperty(gameId) &&
        this._games[gameId].hasOwnProperty('info') &&
        this._games[gameId].info.hasOwnProperty('details') ) {
        return this._games[gameId].info.details;
    } else {
        return {};
    }
};

// TODO: replace this with DB lookup, return promise
DashService.prototype.getGameMissions = function(gameId) {
    if( this._games.hasOwnProperty(gameId) &&
        this._games[gameId].hasOwnProperty('info') &&
        this._games[gameId].info.hasOwnProperty('missions') ) {
        return this._games[gameId].info.missions;
    } else {
        return null;
    }
};

// TODO: replace this with DB lookup, return promise
DashService.prototype.getGameBasicInfo = function(gameId) {
    if( this._games.hasOwnProperty(gameId) &&
        this._games[gameId].hasOwnProperty('info') &&
        this._games[gameId].info.hasOwnProperty('basic') ) {
        return this._games[gameId].info.basic;
    } else {
        return null;
    }
};

// TODO: replace this with DB lookup, return promise
DashService.prototype.getGameAssessmentInfo = function(gameId) {
    return this._games[gameId].info.assessment;
};


// TODO: replace this with DB lookup, return promise
DashService.prototype.getGameReportInfo = function(gameId, reportId) {
    var list = this._games[gameId].info.reports.list;
    for(var i = 0; i < list.length; i++) {
        if(list[i].id == reportId) {
            return list[i];
        }
    }
};

// TODO: replace this with DB lookup, return promise
DashService.prototype.getGameReleases = function(gameId) {
    if( this._games.hasOwnProperty(gameId) &&
        this._games[gameId].hasOwnProperty('info') &&
        this._games[gameId].info.hasOwnProperty('releases') ) {
        return this._games[gameId].info.releases;
    } else {
        return {};
    }
};

// TODO: replace this with DB lookup
DashService.prototype.getListOfAchievements = function(gameId, playerAchievement) {
    // if no player achievements then default to none
    if(!playerAchievement) {
        playerAchievement = {};
    }

    // if not game Id in games, then return empty object
    if(!this._games.hasOwnProperty(gameId)) {
        return [];
    }

    var achievementsList = [];
    var a = _.cloneDeep(this._games[gameId].achievements);
    //console.log("a:", a);

    for(var i = 0; i < a.length; i++) {
        var groupId = a[i].id;

        for(var j = 0; j < a[i].subGroups.length; j++) {
            var subGroupId = a[i].subGroups[j].id;

            for(var k = 0; k < a[i].subGroups[j].items.length; k++) {
                var itemId  = a[i].subGroups[j].items[k].id;

                var achievement = {
                    "group":    groupId,
                    "subGroup": subGroupId,
                    "item":     itemId,
                    "won":      false
                };

                // playerAchievement stored as tree
                // get won or not from tree
                if( playerAchievement.groups &&
                    playerAchievement.groups.hasOwnProperty(groupId) &&
                    playerAchievement.groups[groupId].subGroups.hasOwnProperty(subGroupId) &&
                    playerAchievement.groups[groupId].subGroups[subGroupId].items.hasOwnProperty(itemId) &&
                    playerAchievement.groups[groupId].subGroups[subGroupId].items[itemId].won) {
                    achievement.won = true;
                }

                achievementsList.push(achievement);
            }
        }
    }

    return achievementsList;
};


// TODO: replace this with DB lookup
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
                    this._games[ gameId ] = {};

                    var gameFiles = fs.readdirSync( path.join(dir, gameName) );

                    gameFiles.forEach(function(file){
                        if(file.charAt(0) != '.') {
                            var name = path.basename(file, path.extname(file));
                            var filePath = path.join(dir, gameName, file);
                            try {
                                this._games[gameId][name] = require(filePath);
                            } catch(err) {
                                console.error("loadGameFiles filePath:", filePath, ", Error:", err);
                            }
                        }
                    }.bind(this));

                    // add developer to game details and reports
                    if( this._games[gameId].info &&
                        this._games[gameId].info.developer &&
                        this._games[gameId].info.basic &&
                        this._games[gameId].info.details &&
                        this._games[gameId].info.reports ) {
                        this._games[gameId].info.basic.developer = this._games[gameId].info.developer;
                    }

                    // add game info(basic) to game details and reports
                    if( this._games[gameId].info &&
                        this._games[gameId].info.basic &&
                        this._games[gameId].info.details &&
                        this._games[gameId].info.reports ) {
                        this._games[gameId].info.details = _.merge(this._games[gameId].info.details, this._games[gameId].info.basic);
                        this._games[gameId].info.reports = _.merge(this._games[gameId].info.reports, this._games[gameId].info.basic);
                    }

                    var list = this._games[gameId].info.reports.list;
                    // add achievements to 'achievements' reports
                    for(var i = 0; i < list.length; i++) {
                        if(list[i].id == 'achievements') {
                            this._games[gameId].info.reports.list[i].achievements = this.getGameAchievements(gameId);
                        }
                    }
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