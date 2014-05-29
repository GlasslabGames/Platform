var fs = require('fs'),
    path = require('path'),
    http = require('http'),
    httpProxy = require('http-proxy');

var serverPort = 9080
//var hostname = "localhost";
//var port = 8081
var hostname = "stage.glgames.org";
//var hostname = "10.14.13.44";
var port = 80

var basePath = "." + path.sep + "proxy_capture" + path.sep;
// create dirs if they don't exist
if(!fs.existsSync(basePath))  { fs.mkdirSync(basePath); }
if(!fs.existsSync(basePath+"get_api"))  { fs.mkdirSync(basePath+"get_api"); }
if(!fs.existsSync(basePath+"post_api")) { fs.mkdirSync(basePath+"post_api"); }

//
// Create a proxy server with custom application logic
//
var prev = new Date();
var now = new Date();
var diff = now - prev;

var requestTime = new Date();
var request = 0;

var proxyServer = httpProxy.createServer(function (req, res, proxy) {
    prev = now;
    now = new Date();
    diff = now - prev;
    console.log("diff time:", diff);

    request++;
    requestDiff = (now - requestTime)/1000;
    if(requestDiff > 1){
        console.log("request per second:", request/requestDiff);
        // reset
        request = 0;
        requestTime = new Date();
    }

    var requestMethod = req.method.toLowerCase();
    console.log("method: %s, url: %s, headers: %s", requestMethod, req.url, JSON.stringify(req.headers));

    urlpath = req.url.split("/");
    urlpath.shift();

    if(urlpath[0] == "api") {
        // only record urls
        fs.appendFileSync(basePath + requestMethod + "_api_urls", req.url + "\n");

        file = urlpath.pop();
        fileParts = file.split("?");
        fname = fileParts.shift(); // remove just name
        args = fileParts.join();
        urlpath.push(fname); // add name back in
        file = urlpath.join("_");

        if(fname.length > 0) {
            var fullfile = basePath + requestMethod+"_api" +path.sep+ file;
            //console.log("fullfile:", fullfile);

            if(requestMethod == "post") {
                var data = "";
                req.on('data', function(chunk) {
                    data += chunk.toString();
                });

                req.on('end', function() {
                    data = data.toString('UTF8');

                    // if NOT json string then add & to end to make parsing work in load tester
                    console.log("Post Data:", data);

                    if(data.charAt(0) != '{'){ data = data+'&'; }
                    fs.appendFileSync(fullfile, data + "\n");
                });
            } else {
                // add & to end to make parsing work in load tester
                fs.appendFileSync(fullfile, args + "&\n");
            }
        }
    } else {
        // only record urls
        fs.appendFileSync(basePath + requestMethod + "_urls", req.url + "\n");
    }

    if(requestMethod == "post") {
        res.proxyWrite = res.write;
        res.write = function(data) {
            console.log("Proxyed Response Data:", data.toString('UTF8'));
            res.proxyWrite(data);
        }
    }

    proxy.proxyRequest(req, res, {
        host: hostname,
        port: port
    });
});

proxyServer.listen(serverPort);

console.log("Proxying localhost:"+serverPort + " -> " + hostname+":"+port);
