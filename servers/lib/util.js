/**
 * Util Module
 *
 *
 */
var when = require('when');

function promiseContinue(){
    return when.promise( function(resolve){
        resolve();
    });
}

module.exports = {
    Request: require('./util.request.js'),
    PromiseContinue: promiseContinue
};
