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

    this.sRoot = root;
    this.root =  root;
}

Stats.prototype.saveRoot = function() {
    this.sRoot = this.root;
}

Stats.prototype.setRoot = function(root) {
    this.root = root;
}

Stats.prototype.restoreRoot = function() {
    this.root = this.sRoot;
}


Stats.prototype.increment = function(level, key, count) {
    if(!count) {
        count = 1;
    }

    /*
    if(ENV == "dev") {
        if(level == 'info') {
            console.log("Stats:", this.root+"."+key, ", count:", count);
        }
        else if(level == 'warn') {
            console.warn("Stats:", this.root+"."+key, ", count:", count);
        }
        else if(level == 'error') {
            console.error("Stats:", this.root+"."+key, ", count:", count);
        }
    }
    */

    if(this.statsd) {
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
    /*
    if(ENV == "dev") {
        if(level == 'info') {
            console.log("Stats:", this.root+"."+key, ", value:", value);
        }
        else if(level == 'warn') {
            console.warn("Stats:", this.root+"."+key, ", value:", value);
        }
        else if(level == 'error') {
            console.error("Stats:", this.root+"."+key, ", value:", value);
        }
    }
    */

    if(this.statsd) {
        level = level.toLowerCase();
        this.statsd.gauge(level+"."+this.root+"."+key, value);
    }
};
