/**
 * Telemetry Dispatcher Module
 *
 * Module dependencies:
 *  lodash - https://github.com/lodash/lodash
 *  when   - https://github.com/cujojs/when
 *
 */
// Third-party libs
var _    = require('lodash');
var when = require('when');
var uuid = require('node-uuid');
// load at runtime
var MySQL, tConst;

function TelemDS_Mysql(options){
    // Glasslab libs
    MySQL  = require('./datastore.mysql.js');
    tConst = require('./telemetry.const.js');

    this.options = _.merge(
        {
            "host"    : "localhost",
            "user"    : "root",
            "password": "",
            "database": ""
        },
        options
    );

    this.ds = new MySQL(this.options);
    // Connect to data store
    this.ds.testConnection();
}

TelemDS_Mysql.prototype.saveEvents = function(jdata){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var Q = "";
    var qInsertData = [];

    for(var i in jdata.events){
        var row = [
            "NULL",
            0,
            this.ds.escape(JSON.stringify(jdata.events[i].eventData)),
            "NOW()",
            this.ds.escape(jdata.gameVersion || ""),
            this.ds.escape(jdata.gameSessionId),
            "NOW()",
            this.ds.escape(jdata.events[i].name),
            "UNIX_TIMESTAMP()",
            this.ds.escape(jdata.userId)
        ];
        qInsertData.push( "("+row.join(",")+")" );
    }

    Q = "INSERT INTO GL_ACTIVITY_EVENTS (" +
        "id," +
        "version," +
        "data," +
        "date_created," +
        "game," +
        "game_session_id," +
        "last_updated," +
        "name," +
        "timestamp," +
        "user_id" +
        ") VALUES ";
    Q += qInsertData.join(",");
    //console.log('Q:', Q);

    this.ds.query(Q, function(err) {
        if(err) {
            reject(err);
            return;
        }
        resolve();
    }.bind(this));
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Mysql.prototype.getEvents = function(gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    var Q = "";

    Q = "SELECT * FROM GL_ACTIVITY_EVENTS WHERE game_session_id="+this.ds.escape(gameSessionId);
    //console.log('Q:', Q);

    this.ds.query(Q, function(err, result) {
        if(err) {
            reject(err);
            return;
        }

        if(result.length > 0) {
            var data = {
                gameSessionId: gameSessionId,
                userId:        result[0].USER_ID,
                gameVersion:   result[0].GAME,
                events:        []
            };

            for(var i in result){
                data.events.push({
                    name:      result[i].NAME,
                    data:      result[i].DATA,
                    timestamp: result[i].timestamp
                });
            }

            //console.log("data.events.length:", data.events.length);
            resolve(data);
        } else {
            reject(new Error("no events found"));
            return;
        }

    }.bind(this));
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


TelemDS_Mysql.prototype.startGameSession = function(userId, courseId, activityId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // create session ID
    var gameSessionId = uuid.v1();
    var values = [
        "NULL",
        0,
        this.ds.escape(activityId),
        this.ds.escape(courseId),
        "NOW()",
        "NULL",
        "NOW()",
        "NULL",
        this.ds.escape(gameSessionId),
        "UNIX_TIMESTAMP()",
        this.ds.escape(userId)
    ];
    values = values.join(',');

    var Q = "INSERT INTO GL_SESSION (" +
        "id," +
        "version," +
        "activity_id," +
        "course_id," +
        "date_created," +
        "end_time," +
        "last_updated," +
        "reason_ended," +
        "session_id," +
        "start_time," +
        "user_id" +
        ") VALUES("+values+")";

    this.ds.query(Q, function(err) {
        if(err) {
            reject(err);
            return;
        }
        resolve(gameSessionId);
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Mysql.prototype.cleanUpOldGameSessions = function(userId, activityId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "UPDATE GL_SESSION" +
        " SET" +
        "  end_time=UNIX_TIMESTAMP()," +
        "  reason_ended="+this.ds.escape(tConst.game.session.cleanup) +
        " WHERE" +
        "  user_id="+this.ds.escape(userId)+" AND" +
        "  activity_id="+this.ds.escape(activityId)+" AND" +
        "  end_time IS NULL";
    this.ds.query(Q, function(err) {
        if(err) {
            reject(err);
            return;
        }
        resolve();
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

TelemDS_Mysql.prototype.endGameSession = function(gameSessionId){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "UPDATE GL_SESSION" +
        " SET" +
        "  end_time=UNIX_TIMESTAMP()," +
        "  reason_ended="+this.ds.escape(tConst.game.session.ended) +
        " WHERE" +
        "  session_id="+this.ds.escape(gameSessionId);
    this.ds.query(Q, function(err) {
        if(err) {
            reject(err);
            return;
        }
        resolve();
    }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


module.exports = TelemDS_Mysql;


