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
        var TelmStore, LmsStore, DashStore, DashDataStore, Errors;

        // Glasslab libs
        Util          = require('../core/util.js');
        TelmStore     = require('../data/data.js').Datastore.Couchbase;
        LmsStore      = require('../lms/lms.js').Datastore.MySQL;
        DashStore     = require('../dash/dash.js').Datastore.MySQL;
        DashDataStore = require('../dash/dash.js').Datastore.Couchbase;
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
        this.dashCBStore = new DashDataStore(this.options.lms.datastore.couchbase);

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
    this.telmStore.connect()
        /*.then(function(){
                // test connection to telemetry store
            return this._migrateGameFiles(true);
        }.bind(this))*/
        .then(function(){
            return this._loadGameFiles();
        }.bind(this))
        .then(function(){
                console.log("DashService: GameData DS Connected");
                this.stats.increment("info", "TelemetryDS.Connect");
            }.bind(this),
            function(err){
                console.trace("DashService: Data DS Error -", err);
                this.stats.increment("error", "TelemetryDS.Connect");
            }.bind(this))
        .then(function(){
                // test connection to couchbase dash store
                return this.dashCBStore.connect();
            }.bind(this))
        .then(function(){
                console.log("DashService: Dash DS Connected");
                this.stats.increment("info", "DashDataStore.Connect");
            }.bind(this),
            function(err){
                console.trace("DashService: Dash DS Error -", err);
                this.stats.increment("error", "DashDataStore.Connect");
            }.bind(this))
        .then(function(){
            _buildLicPackages.call(this);
        }.bind(this))
        .then(resolve, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

function _buildLicPackages(){
    return when.promise(function(resolve, reject){
        var games = this._games;
        var premiumGames = {
            browserGames: [],
            iPadGames: [],
            downloadableGames: []
        };
        var freeGames = {
            browserGames: [],
            iPadGames: [],
            downloadableGames: []
        };
        var gameInfo;
        _(games).forEach(function(game){
            gameInfo = game.info.basic;
            if(!gameInfo.packages){
                return;
            }
            var packages = gameInfo.packages.split(", ");
            var price = gameInfo.price;
            var release = gameInfo.release;
            packages.forEach(function(package){
                if(release === "live" || (release === "dev" && this.options.env !== "prod")){
                    if(price === "Premium"){
                        if(package === "Chromebook/Web Games"){
                            premiumGames.browserGames.push(gameInfo.gameId);
                        } else if(package === "iPad Games"){
                            premiumGames.iPadGames.push(gameInfo.gameId);
                        } else if(package === "PC/Mac Games") {
                            premiumGames.downloadableGames.push(gameInfo.gameId);
                        }
                    } else if(price === "Free"){
                        if(package === "Chromebook/Web Games"){
                            freeGames.browserGames.push(gameInfo.gameId);
                        } else if(package === "iPad Games"){
                            freeGames.iPadGames.push(gameInfo.gameId);
                        } else if(package === "PC/Mac Games") {
                            freeGames.downloadableGames.push(gameInfo.gameId);
                        }
                    }
                }
            }.bind(this));
        }.bind(this));
        var lConst = this.serviceManager.get("lic").lib.Const;
        //chromebook package
        lConst.plan.chromebook.browserGames = freeGames.browserGames.concat(premiumGames.browserGames);
        lConst.plan.chromebook.iPadGames = freeGames.iPadGames;
        lConst.plan.chromebook.downloadableGames = freeGames.downloadableGames;
        //ipad package
        lConst.plan.ipad.browserGames = freeGames.browserGames;
        lConst.plan.ipad.iPadGames = freeGames.iPadGames.concat(premiumGames.iPadGames);
        lConst.plan.ipad.downloadableGames = freeGames.downloadableGames;
        // pcMac package
        lConst.plan.pcMac.browserGames = freeGames.browserGames.concat(premiumGames.browserGames);
        lConst.plan.pcMac.iPadGames = freeGames.iPadGames;
        lConst.plan.pcMac.downloadableGames = freeGames.downloadableGames.concat(premiumGames.downloadableGames);
        //allGames package
        lConst.plan.allGames.browserGames = freeGames.browserGames.concat(premiumGames.browserGames);
        lConst.plan.allGames.iPadGames = freeGames.iPadGames.concat(premiumGames.iPadGames);
        lConst.plan.allGames.downloadableGames = freeGames.downloadableGames.concat(premiumGames.downloadableGames);
        //trial package
        lConst.plan.trial.browserGames = freeGames.browserGames.concat(premiumGames.browserGames);
        lConst.plan.trial.iPadGames = freeGames.iPadGames.concat(premiumGames.iPadGames);
        lConst.plan.trial.downloadableGames = freeGames.downloadableGames.concat(premiumGames.downloadableGames);
        //trialLegacy package
        lConst.plan.trialLegacy.browserGames = freeGames.browserGames.concat(premiumGames.browserGames);
        lConst.plan.trialLegacy.iPadGames = freeGames.iPadGames.concat(premiumGames.iPadGames);
        lConst.plan.trialLegacy.downloadableGames = freeGames.downloadableGames.concat(premiumGames.downloadableGames);

        //var file = "module.exports = " + JSON.stringify(lConst, null, 4) + ";\n";
        //var directory = __dirname + "/../lic/lic.const.js";
        //fs.writeFile(directory, file, function(err){
        //    if(err){
        //        console.log("Build Lic Packages Error -",err);
        //        reject(err);
        //    }
        //    resolve();
        //}.bind(this));
    }.bind(this));
}

// TODO: replace this with DB lookup, return promise
// promise transition complete.
// accepts a single id or array of game ids.  checks if all are valid
// 2 references in dash.service, 2 in dash _game, 5 in dash game, 2 in dash reports,
// 1 in data.services, 1 in data config, 1 in data _config, 1 in data game.js, 2 in lms.service
DashService.prototype.isValidGameId = function(gameId) {
    if(!_.isArray(gameId)){
        gameId = [gameId];
    }
    var promiseList = [];
    gameId.forEach(function(id){
        promiseList.push(this._isValidGameId(id));
    }.bind(this) );

    return when.all(promiseList)
        .then(function(){
            return true;
        })
        .then(null,function(){
            return false;
        });
};

DashService.prototype._isValidGameId = function(gameId){
    return when.promise(function(resolve, reject) {
            for (var g in this._games) {
                if (g == gameId &&
                    this._games[g] &&
                    this._games[g].info &&
                    this._games[g].info.basic) {
                    return resolve();
                }
            }
            reject();
    }.bind(this) );
};

// TODO: replace this with DB lookup, return promise
// returns an uppercase list of all game Ids, game Ids are ALWAYS uppercase
// promise transition complete
// 2 references in dash games, 1 in data events
DashService.prototype.getListOfVisibleGameIds = function() {
    return when.promise(function(resolve, reject){
        var gameIds = [];
        for(var g in this._games) {
            if( this._games[g].info &&
                this._games[g].info.basic &&
                this._games[g].info.basic.gameId &&
                this._games[g].info.basic.visible) {
                gameIds.push( this._games[g].info.basic.gameId.toUpperCase() );
            }
        }
        if(gameIds.length !== 0){
            resolve(gameIds);
        } else{
            reject();
        }
    }.bind(this) );
};

// TODO: replace this with DB lookup, return promise
// returns an uppercase list of all game Ids, game Ids are ALWAYS uppercase
// promise transition complete
// 2 references in dash games, 1 in data events
DashService.prototype.getListOfAllGameIds = function() {
    return when.promise(function(resolve, reject){
        var gameIds = [];
        for(var g in this._games) {
            if( this._games[g].info &&
                this._games[g].info.basic &&
                this._games[g].info.basic.gameId) {
                gameIds.push( this._games[g].info.basic.gameId.toUpperCase() );
            }
        }
        if(gameIds.length !== 0){
            resolve(gameIds);
        } else{
            reject();
        }
    }.bind(this) );
};

DashService.prototype.getListOfAllFreeGameIds = function(){
    return when.promise(function(resolve, reject){
        var gameIds = [];
        for(var g in this._games){
            if( this._games[g].info &&
                this._games[g].info.basic &&
                this._games[g].info.basic.gameId &&
                ( this._games[g].info.basic.price === "Free" || this._games[g].info.basic.price === "TBD" ) ) {
                gameIds.push( this._games[g].info.basic.gameId.toUpperCase() );
            }
        }
        if(gameIds.length !== 0){
            resolve(gameIds);
        } else{
            reject();
        }
    }.bind(this));
};

// TODO: replace this with DB lookup, return promise
// promise transition complete
// 1 reference in dash game
DashService.prototype.getGameReports = function(gameId) {
    return when.promise(function(resolve, reject) {
        if (this._games.hasOwnProperty(gameId) &&
            this._games[gameId].hasOwnProperty('info') &&
            this._games[gameId].info.hasOwnProperty('reports')) {
            resolve(this._games[gameId].info.reports);
        } else {
            reject([]);
        }
    }.bind(this));
};

// TODO: replace this with DB lookup, return promise
// promise transition complete
// 1 reference in dash.service
DashService.prototype.getGameAchievements = function(gameId) {
    return when.promise(function(resolve, reject){
        if( this._games.hasOwnProperty(gameId) &&
            this._games[gameId].hasOwnProperty('achievements') ) {
            resolve(this._games[gameId].achievements);
        } else {
            reject({});
        }
    }.bind(this) );
};

// TODO: replace this with DB lookup, return promise
// promise transition complete
// 1 reference in dash game, 1 reference in dash games
DashService.prototype.getGameDetails = function(gameId) {
    return when.promise(function(resolve, reject){
        if( this._games.hasOwnProperty(gameId) &&
            this._games[gameId].hasOwnProperty('info') &&
            this._games[gameId].info.hasOwnProperty('details') ) {
            resolve(this._games[gameId].info.details);
        } else {
            reject({});
        }
    }.bind(this) );
};

// TODO: replace this with DB lookup, return promise
// promise transition complete
// 1 reference in dash game, 1 in dash reports
DashService.prototype.getGameMissions = function(gameId) {
    return when.promise(function(resolve, reject){

        if( this._games.hasOwnProperty(gameId) &&
            this._games[gameId].hasOwnProperty('info') &&
            this._games[gameId].info.hasOwnProperty('missions') ) {
            resolve(this._games[gameId].info.missions);
        } else {
            reject(null);
        }
    }.bind(this) );
};

// TODO: replace this with DB lookup, return promise
// promise transition complete
// 2 references in dash games
DashService.prototype.getGameBasicInfo = function(gameId) {
    return when.promise(function(resolve, reject){
        if( this._games.hasOwnProperty(gameId) &&
            this._games[gameId].hasOwnProperty('info') &&
            this._games[gameId].info.hasOwnProperty('basic') ) {
            resolve(this._games[gameId].info.basic);
        } else {
            reject(null);
        }
    }.bind(this) );
};

// TODO: replace this with DB lookup, return promise
// promise transition complete
// 1 reference in dash _game, 2 references in dash reports
DashService.prototype.getGameAssessmentInfo = function(gameId) {
    return when.promise(function(resolve, reject){
        resolve(this._games[gameId].info.assessment);
    }.bind(this) );
};


// TODO: replace this with DB lookup, return promise
// promise transition complete
// 1 reference in dash reports
DashService.prototype.getGameReportInfo = function(gameId, reportId) {
    return when.promise(function(resolve, reject){
        var list = this._games[gameId].info.reports.list;
        for(var i = 0; i < list.length; i++) {
            if( _.isObject(list[i]) &&
                list[i].id == reportId) {
                resolve(list[i]);
            }
        }
        reject();
    }.bind(this) );
};

// TODO: replace this with DB lookup, return promise
// promise transition complete
// 1 reference in data game
DashService.prototype.getGameReleases = function(gameId) {
    return when.promise(function(resolve, reject){
        if( this._games.hasOwnProperty(gameId) &&
            this._games[gameId].hasOwnProperty('info') &&
            this._games[gameId].info.hasOwnProperty('releases') ) {
            resolve(this._games[gameId].info.releases);
        } else {
            reject({});
        }
    }.bind(this) );
};

// TODO: replace this with DB lookup
DashService.prototype.getListOfAchievements = function(gameId, playerAchievement, defaultStandards) {
    // if no player achievements then default to none
    if(!playerAchievement) {
        playerAchievement = {};
    }

    // if no default standards are set, then default to "CCSS"
    // also default to "CCSS" if there are no achievements associated with this standard
    // because we know "CCSS" will exist
    if( !defaultStandards || !this._games[gameId].achievements.groups[ defaultStandards ] ) {
        defaultStandards = "CCSS";
    }

    // if not game Id in games, then return empty object
    if(!this._games.hasOwnProperty(gameId)) {
        return [];
    }

    var achievementsList = [];
    var a = _.cloneDeep(this._games[gameId].achievements.achievements);
    //console.log("a:", a);

    for(var i = 0; i < a.length; i++) {
        // if not object skip to next
        if( !_.isObject(a[i]) ) continue;

        var itemId = a[i].id;

        var achievement = {
            "item":         itemId,
            "won":          false
        };

        // playerAchievement stored as tree
        // get won or not from tree
        for( var group in playerAchievement.groups ) {
            for( var subGroup in playerAchievement.groups[ group ].subGroups ) {
                if( playerAchievement.groups[ group ].subGroups[ subGroup ].items.hasOwnProperty( itemId ) ) {
                    achievement.won = true;
                    break;
                }
            }
            if( achievement.won == true ) {
                break;
            }
        }

        achievementsList.push(achievement);
    }

    return achievementsList;
};

// migrates info.json and achievement.json files to couchbase
// format is gi:gameId for info.json and ga:gameId for achievements.json
DashService.prototype._migrateGameFiles = function(forceMigrate) {
    return when.promise(function(resolve, reject){
        try {
            // checking to see if this particular key exists, as a sign for if migration has happened
            // if key does not exist, error will be thrown, but that's ok. Just means key needs to be created
            // if key exists, but is initialized to a default or empty value, run migration and populate the keys
            this.telmStore.getGameInformation('AA-1', true)
                .then(function(data){
                    if(forceMigrate || data === 'no object'){
                        return '{}';
                    }
                    return JSON.stringify(data);
                })
                .then(function(data){
                    if(data !== '{}' && data !== '{"click":"to edit","new in 2.0":"there are no reserved field names"}'){
                        // files have already been migrated, end process
                        return;
                    }
                    console.log("Migrating info.json and achievements.json files to Couchbase");
                    var dir = path.join(__dirname, "games");
                    var files = fs.readdirSync(dir);
                    var gameId;
                    var promiseList = [];
                    files.forEach(function(gameName){
                        if(gameName.charAt(0) !== '.'){
                            gameId = gameName.toUpperCase();

                            var gameFiles = fs.readdirSync( path.join(dir, gameName) );

                            gameFiles.forEach(function(file){
                                if(file.charAt(0) !== '.'){
                                    var name = path.basename(file, path.extname(file));
                                    var filePath = path.join(dir, gameName, file);
                                    var gameData;
                                    try {
                                        delete require.cache[filePath];
                                        gameData = require(filePath);
                                    } catch(err) {
                                        console.error("migrateGameFiles filePath:", filePath, ", Error:", err);
                                    }
                                    if(name === 'info'){
                                        promiseList.push(this.telmStore.createGameInformation(gameId, gameData));
                                    } else if(name === 'achievements'){
                                        promiseList.push(this.telmStore.createGameAchievements(gameId, gameData));
                                    }
                                }
                            }.bind(this));
                        }
                    }.bind(this));
                    return when.all(promiseList);
                }.bind(this))
                .then(function(){
                    resolve();
                }.bind(this))
                .then(null, function(err){
                    reject(err);
                }.bind(this));
        } catch(err) {
            console.error("DashService: Migrate Game Files Error -", err);
            reject(err);
        }
    }.bind(this));
};

// now builds up _games from couchbase gi and ga documents, instead of from json files
// couchbase logic contained in this function, building of _games abstracted to _buildGamesObject
DashService.prototype._loadGameFiles = function(){
    return when.promise(function(resolve, reject){
        this.telmStore.getAllGameInformationAndGameAchievements()
            .then(function(results){
                var ids;
                var type;
                var gameId;
                var gameInformation = {};
                var gameAchievements = {};
                _.forEach(results, function(data, couchId){
                    ids = couchId.split(':');
                    type = ids[0];
                    gameId = ids[1];
                    if(type === 'gi'){
                        gameInformation[gameId] = data;
                    } else{
                        gameAchievements[gameId] = data;
                    }
                }.bind(this));

                return this._buildGamesObject(gameInformation, gameAchievements);
            }.bind(this))
            .then(function(){
                console.log('DashService: Loaded Game Files');
                resolve();
            }.bind(this))
            .then(null, function(err){
                console.error("DashService: Load Game Files Error -", err);
                reject(err);
            }.bind(this));

    }.bind(this));
};

// receives information gained from couchbase gi and ga documents
// properly inserts data into _games object
DashService.prototype._buildGamesObject = function(gameInformation, gameAchievements){
    return when.promise(function(resolve, reject){
        try {
            var gameId;
            var index = 0;
            var achievements = [];
            var gameIds = [];
            _.forEach(gameInformation, function (data, gameId) {
                gameIds.push(gameId);
                this._games[gameId] = {};
                if(gameAchievements[gameId] !== undefined){
                    this._games[gameId].achievements = gameAchievements[gameId];
                }

                this.buildGameForGamesObject(data, gameId);

                var state = false;

                var list = this._games[gameId].info.reports.list;

                for (var i = 0; i < list.length; i++) {
                    if (_.isObject(list[i]) &&
                        list[i].id === 'achievements') {
                        state = true;
                        break;
                    }
                }
                if (state) {
                    achievements.push(this.getGameAchievements(gameId));
                }

            }.bind(this));
            when.all(achievements)
                .then(function (achievements) {
                    var index = 0;
                    var list;
                    gameIds.forEach(function (gameId) {
                        list = this._games[gameId].info.reports.list;

                        // add achievements to 'achievements' reports
                        for (var i = 0; i < list.length; i++) {
                            if (_.isObject(list[i]) &&
                                list[i].id === 'achievements') {
                                this._games[gameId].info.reports.list[i].achievements = achievements[index++];
                                break;
                            }
                        }
                    }.bind(this));

                    resolve();
                }.bind(this))
                .then(null, function(err){
                    reject(err);
                }.bind(this));
        } catch(err) {
            reject(err)
        }
    }.bind(this));
};

DashService.prototype.buildGameForGamesObject = function(data, gameId){
    this._games[gameId].info = data;

    //remove all enabled=false objects
    this._filterDisabledGameInfo(this._games[gameId]);

    // add game info(basic) to game details and reports
    if (this._games[gameId].info &&
        this._games[gameId].info.basic &&
        this._games[gameId].info.details &&
        this._games[gameId].info.reports) {

        this._games[gameId].info.details = _.merge(this._games[gameId].info.details, this._games[gameId].info.basic);
        this._games[gameId].info.reports = _.merge(this._games[gameId].info.reports, this._games[gameId].info.basic);
    }
};


// TODO: replace this with DB lookup
DashService.prototype._oldLoadGameFiles = function() {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        try {
            var dir = path.join(__dirname, "games");
            var files = fs.readdirSync(dir);
            var gameId;
            // game achievements initially is an array of promises
            var gameAchievements = [];
            files.forEach(function(gameName){
                // skip dot files
                if(gameName.charAt(0) != '.') {
                    gameId = gameName.toUpperCase();

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

                    // remove all enabled=false objects
                    this._filterDisabledGameInfo(this._games[gameId]);

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
                    var state = false;

                    var list = this._games[gameId].info.reports.list;

                    for(var i = 0; i < list.length; i++) {
                        if( _.isObject(list[i]) &&
                            list[i].id == 'achievements') {
                            state = true;
                            break;
                        }
                    }
                    if(state){
                        gameAchievements.push(this.getGameAchievements(gameId));
                    }
                }
            }.bind(this));
            when.all(gameAchievements)
                .then(function(gameAchievements){
                    var index = 0;
                    var list;
                    files.forEach(function(gameName){
                        if(gameName.charAt(0) != '.') {
                            gameId = gameName.toUpperCase();
                            list = this._games[gameId].info.reports.list;

                            // add achievements to 'achievements' reports
                            for(var i = 0; i < list.length; i++) {
                                if( _.isObject(list[i]) &&
                                    list[i].id == 'achievements') {
                                    this._games[gameId].info.reports.list[i].achievements = gameAchievements[index++];
                                }
                            }
                        }
                    }.bind(this));

                    console.log('DashService: Loaded Game Files');
                    resolve();
                }.bind(this))
                .then(null, function(err){
                    console.error("DashService: Load Game Files Error -", err);
                }.bind(this));
        } catch(err) {
            console.error("DashService: Load Game Files Error -", err);
        }

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

DashService.prototype._filterDisabledGameInfo = function(gameInfo) {
    var deleted = false;
    _.forEach(gameInfo, function(item, i) {
        if( _.isObject(gameInfo[i]) &&
            gameInfo[i].hasOwnProperty('enabled') &&
            (gameInfo[i].enabled == false) ) {
            //console.info("gameInfo removing disabled object:", gameInfo[i]);
            delete gameInfo[i];
            deleted = true;
        }

        if( _.isArray(gameInfo[i]) ){
            deleted = this._filterDisabledGameInfo(gameInfo[i]);
            if(deleted) {
                // re-index array, remove all null values
                var newArray = [];
                for(var j = 0; j < gameInfo[i].length; j++){
                    if(gameInfo[i][j]) newArray.push(gameInfo[i][j]);
                }
                gameInfo[i] = newArray;
            }
        }
        else if( _.isObject(gameInfo[i]) ) {
            this._filterDisabledGameInfo(gameInfo[i]);
        }

    }.bind(this));

    return deleted;
};

DashService.prototype._saveAssessmentResults = function(userId, gameId, assessmentId, data){

    return this.telmStore.getAssessmentResults(userId, gameId, assessmentId, data)
        .then(function(aeResults){

            var out = _.cloneDeep(aeResults);
            out.gameId = gameId;
            out.userId = userId;
            out.assessmentId = assessmentId;

            // merge results if they exist
            if( !out.results &&
                !_.isObject(out.results) ) {
                out.results = {};
            }

            // remove old data
            if( _.isArray(out.results.watchout) ||
                _.isArray(out.results.shoutout) ) {
                delete out.results.watchout;
                delete out.results.shoutout;
            }
            // merge results
            out.results = _.merge( out.results, data.results );

            //console.log("out:", out);
            return this.telmStore.saveAssessmentResults(userId, gameId, assessmentId, out);
        }.bind(this) );
};
