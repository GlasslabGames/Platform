var when    = require("when");
var express = require('express');
var redis   = require("redis");
var mysql   = require('mysql');

// Constants
var DEFAULT_PORT = 8080;
var PORT = process.env.PORT || DEFAULT_PORT;
console.log('env:', process.env);

// Redis
redisClient = redis.createClient();
redisClient.on("error", function (err) {
    console.log("Error " + err);
});

// App
var app = express();
app.get('/', function (req, res) {
    // run all tests on request
    tests(res.send);
});

app.listen(PORT);
console.log('Running on http://localhost:' + PORT);

// run all tests at start
tests(console.log);

function tests(done){
    test_Redis()
        .then(function(){
            return test_MySQL();
        })
        // TODO: couchbase test
        // all done
        .then(function(data){
            if(done) done(data);
        })
        // catch all errors
        .then(null, function(err){
            if(done) done(err);
        });
}

function test_Redis(){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        // Test Redis
        redisClient.set("string key", "string val", redis.print);
        redisClient.hset("hash key", "hashtest 1", "some value", redis.print);
        redisClient.hset(["hash key", "hashtest 2", "some other value"], redis.print);
        // read keys
        redisClient.hkeys("hash key", function (err, replies) {
            if(err) {
                reject(err);
                return;
            }

            var out = "-- Redis Test Start --\n";
            out += replies.length + " replies:\n";
            replies.forEach(function (reply, i) {
                out += "    " + i + ": " + reply +"\n";
            });
            out += "-- Redis Test Done --\n";
            redisClient.quit();

            // done
            resolve(out);
        });
// ------------------------------------------------
    }.bind(this));
// end promise wrapper
}

function test_MySQL(){
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------
        connectionPool = mysql.createPool({
            host     : 'localhost',
            user     : 'glasslab',
            password : 'glasslab'
        });

        if(connectionPool) {
            connectionPool.getConnection(function (err, connection) {
                connection.query('SELECT CONCAT("Hello", " World") as info', function (err, rows, fields) {
                    if (err) {
                        reject(JSON.stringify(err));
                        return;
                    }

                    var out = "-- MySQL Test Start --\n";
                    out += "Data:" + JSON.stringify(rows)+"\n";
                    out += "-- MySQL Test Done --\n";

                    resolve(out);
                });

                connection.release();
            });
        }

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
}
