/**
 * Created by Joseph Sutton on 11/30/13.
 * Config file load
 *   - Multi file loading until success
 *   - Config
 */
var fs = require('fs');
var _  = require('lodash');
var StatsD = require('node-statsd').StatsD;

module.exports = Stats;

function Stats(options, root){
    this.options = _.merge(
        {
            statsd: {
                host: "localhost",
                port: 8125
            }
        },
        options
    );

    this.statsd = new StatsD(this.options.statsd);
    this.statsd.socket.on('error', function(err) {
        this.statsd = null;
        return console.error("StatsD: Error connecting to server. ", err);
    });

    this.root = root;
}

Stats.prototype.increment = function(level, key, count) {
    /*
    if(level == 'info') {
        console.log("Stats: ", this.root+"."+key);
    }
    else if(level == 'error') {
        console.error("Stats: ", this.root+"."+key);
    }
    */

    if(this.statsd) {
        if(!count) {
            count = 1;
        }

        level = level.toLowerCase();
        // Info.App.Loaded
        this.statsd.increment(level+"."+this.root+"."+key, count);
        // App.Info.Loaded
        this.statsd.increment(this.root+"."+level+"."+key, count);
        // Info.App
        this.statsd.increment(level+"."+this.root, count);
        // Info
        this.statsd.increment(level, count);
    }
};

Stats.prototype.gauge = function(level, key, value) {
    if(this.statsd) {
        level = level.toLowerCase();
        this.statsd.gauge(level+"."+this.root+"."+key, value);
    }
};
