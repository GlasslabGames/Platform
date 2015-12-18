/**
 * Created by Joseph Sutton on 11/30/13.
 */
var fs = require('fs');
var _  = require('lodash');
var StatsD = require('node-statsd').StatsD;

module.exports = Stats;

var statsdInst = null;

function Stats(options, root){
    this.options = _.merge(
        {
            statsd: {
                graphiteHost: "localhost",
                graphitePort: 2003,
                graphite: {
                    legacyNamespace: false
                },
                port: 8125
            }
        },
        options
    );

    statsdInst = new StatsD(this.options.statsd);
    statsdInst.socket.on('error', function(err) {
        return console.errorExt("StatsD", "Error connecting to server. ", err);
    });

    this.sRoot = root;
    this.root  = root;
    this.env   = process.env.HYDRA_ENV || 'dev';    // env = 'prod', 'stage', or 'dev'
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

    if(statsdInst) {
        level = level.toLowerCase();

    //  statsdInst.increment(this.env+"."+this.root+"."+level+"."+key, count);      // dev.App.error.Loaded

        statsdInst.increment(this.env+"."+level+"."+this.root+"."+key, count);      // dev.error.App.Loaded
    //  statsdInst.increment("EnvALL."+level+"."+this.root+"."+key, count);         // EnvALL.error.App.Loaded
    //  statsdInst.increment(level+"."+this.root+"."+key, count);                   // error.App.Loaded

//      if(-1 < level.indexOf("err")){
            statsdInst.increment(this.env+"."+level+"."+this.root+"._total", count);    // dev.error.App._total
            statsdInst.increment(this.env+"."+level+"._total", count);                  // dev.error._total
//      }
    }
};

Stats.prototype.set = function(level, key, value) {

    if(statsdInst) {
        level = level.toLowerCase();
        statsdInst.set(this.env+"."+level+"."+this.root+"."+key, value);    // stage.info.ServiceManager.server_started_any
    //  statsdInst.set("EnvALL."+level+"."+this.root+"."+key, value);       // EnvALL.info.ServiceManager.();
    //  statsdInst.set(level+"."+this.root+"."+key, value);                 // info.ServiceManager.();
    }
};

Stats.prototype.gauge = function(level, key, value) {

    if(statsdInst) {
        level = level.toLowerCase();
        statsdInst.gauge(this.env+"."+level+"."+this.root+"."+key, value);      // prod.info.App.Loaded
    //  statsdInst.gauge("EnvALL."+level+"."+this.root+"."+key, value);         // EnvALL.info.App.Loaded
    //  statsdInst.gauge(level+"."+this.root+"."+key, value);                   // info.App.Loaded
    }
};

Stats.prototype.gaugeNoRoot = function(level, key, value) {

    if(statsdInst) {
        level = level.toLowerCase();
        statsdInst.gauge(this.env+"."+level+"."+key, value);      // prod.info.Loaded
    }
};
