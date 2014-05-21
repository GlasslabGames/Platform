/**
 * Research Server Module
 *
 * Module dependencies:
 *
 *
 */

var fs        = require('fs');
var path      = require('path');

var _         = require('lodash');
var when      = require('when');
var csv       = require('csv');

// load at runtime
var Util;

module.exports = ResearchService;

function ResearchService(options){
    try {
        var Research;

        this.options = _.merge(
            { },
            options
        );

        // Glasslab libs
        Util     = require('../core/util.js');
        Research = require('./research.js');

        this.requestUtil = new Util.Request(this.options);
        this.store       = new Research.Datastore.Couchbase(this.options.research.datastore.couchbase);
        this.stats       = new Util.Stats(this.options, "Research");
        this.parsedSchema = {};

    } catch(err) {
        console.trace("Auth: Error -", err);
        this.stats.increment("error", "Generic");
    }
}

ResearchService.prototype.start = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // test connection to Couchbase
    this.store.connect()
        .then(function(){
            console.log("ResearchService: Couchbase DS Connected");
            this.stats.increment("info", "Couchbase.Connect");
        }.bind(this),
        function(err){
            console.trace("ResearchService: Couchbase DS Error -", err);
            this.stats.increment("error", "Couchbase.Connect");
        }.bind(this))

        .then(function(){
            // load csv file

            var dir = __dirname+'/parser_schema/';
            //console.log("dir:", dir);
            fs.readdir(dir, function(error, files) {
                _.forEach(files, function(file){
                    var name = path.basename(file, path.extname(file));

                    if(!this.parsedSchema.hasOwnProperty(name)) {
                        this.parsedSchema[name] = { header: "", rows: {} };
                    }

                    console.log("Reading CSV file:", dir + file);
                    csv()
                        .from.path(dir + file, { delimiter: ',', escape: '"' })
                        .on('record', function(row, index){

                            // header
                            if(index == 0) {
                                row.shift(); // remove first column
                                this.parsedSchema[name].header = csv().stringifier.stringify(row);
                            } else {
                                this.parsedSchema[name].rows[ row[0] ] = csv().stringifier.stringify(row.slice(1));
                            }

                            //console.log('#'+index+' '+JSON.stringify(row));
                            //console.log(this.parsedSchema[name]);
                        }.bind(this))
                        .on('end', function(){
                            //console.log("Parsed Schema for", name, ":", this.parsedSchema[name]);
                            resolve();
                        }.bind(this))
                        .on('error', function(error){
                            reject(error);
                        }.bind(this));
                }.bind(this));
            }.bind(this));

        }.bind(this))

        .then(null, reject);
// ------------------------------------------------
}.bind(this));
// end promise wrapper
};
