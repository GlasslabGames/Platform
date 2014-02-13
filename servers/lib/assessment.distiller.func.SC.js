/**
 * Assessment SimCity Distiller Module
 *
 * Module dependencies:
 *  lodash     - https://github.com/lodash/lodash
 *  redis      - https://github.com/mranney/node_redis
 *  couchnode  - https://github.com/couchbase/couchnode
 *
 */
// Third-party libs
var _       = require('lodash');
var when    = require('when');
var redis   = require('redis');
// Glasslab libs
var tConst;

module.exports = SC_Distiller;

function SC_Distiller(){
    // Glasslab libs
}

SC_Distiller.prototype.process = function(events){
    console.log("events:", events);

    // return distilled data
    return events;
}
