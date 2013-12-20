/**
 * Telemetry Dispatcher Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *
 */
// Third-party libs
var _         = require('lodash');
// load at runtime
var MySQL;

function TelemDS_Mysql(options){
    // Glasslab libs
    MySQL = require('./datastore.mysql.js');

    this.options = _.merge(
        {
            datastore: {}
        },
        options
    );

    this.ds = new MySQL(this.options);
    // Connect to data store
    this.ds.testConnection();
}

TelemDS_Mysql.prototype.saveEvents = function(jdata, done){
    var q = "";
    var qInsertData = [];

    for(var i in jdata.events){
        var row = [
            "NULL",
            0,
            this.ds.escape(JSON.stringify(jdata.events[i].eventData)),
            "NOW()",
            this.ds.escape(jdata.gameVersion),
            this.ds.escape(jdata.gameSessionId),
            "NOW()",
            this.ds.escape(jdata.events[i].name),
            "UNIX_TIMESTAMP(NOW())",
            "(SELECT user_id FROM GL_SESSION WHERE SESSION_ID="+this.ds.escape(jdata.gameSessionId)+")"
        ];
        qInsertData.push( "("+row.join(",")+")" );
    }

    q = "INSERT INTO GL_ACTIVITY_EVENTS (id, version, data, date_created, game, game_session_id, last_updated, name, timestamp, user_id) VALUES ";
    q += qInsertData.join(",");
    //console.log('q:', q);

    this.ds.addQuery(q, function(err) {
        done(err);
    }.bind(this));

    this.ds.sendQueries();
}

module.exports = TelemDS_Mysql;


