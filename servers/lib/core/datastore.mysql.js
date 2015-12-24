/**
 * MySQL Module
 * Module dependencies:
 *  lodash - https://github.com/lodash/lodash
 *  when   - https://github.com/cujojs/when
 *  mysql  - https://github.com/felixge/node-mysql
 *
 */
// Third-party libs
var _     = require('lodash');
var when  = require('when');
var mysql = require('mysql');

module.exports = MySQL;

function MySQL(options){

    this.options = _.merge(
        {
            host    : "localhost",
            user    : "",
            password: "",
            database: "",
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit:      100000
        },
        options
    );

    this.pool = mysql.createPool(this.options);
}
MySQL.prototype.escape = function(value) {
    // todo: remove commented out Array section after testing, also update same file in Assessment
    // remove explicit array handling - mysql.escape already does something with arrays:
    // https://www.npmjs.com/package/mysql#escaping-query-values
    // > Arrays are turned into list, e.g. ['a', 'b'] turns into 'a', 'b'
    // use MySQL.prototype.escapeArray instead
    // actually not even that is necessary if you're just going to join(',') the results together

    // if array, escape all items in array
    //if(_.isArray(value)) {
    //    return _.map(value, function(item){
    //        return mysql.escape(item);
    //    });
    //} else {
        return mysql.escape(value);
    //}
};

MySQL.prototype.escapeId = mysql.escapeId;

MySQL.prototype.escapeArray = function(value) {
    if(_.isArray(value)) {
        return _.map(value, function(item){
            return mysql.escape(item);
        });
    }
    throw new Error("escapeArray called on non-Array");
}

MySQL.prototype.query = function(query) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    this.pool.getConnection(function(err, connection) {
        if(err) {
            console.errorExt("MySQL", "Query Failed getConnection -", query);
            reject(err);
            return;
        }

        connection.query(query, function(err, data) {
            connection.release();

            if(err) {
                console.errorExt("MySQL", "Query Failed -", query);
                reject(err);
                return;
            }

            resolve(data);
        });
    });

// ------------------------------------------------
}.bind(this));
// end promise wrapper
}
