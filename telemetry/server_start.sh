#!/bin/bash

mkdir -p logs

cd server_collector
# if node_modules missing then install
if [ ! -d "node_modules" ]; then
	npm install
fi
# start
forever start app.js -o ../logs/server_collector.log -e ../logs/server_collector_error.log
cd ..

cd server_dispatch
# if node_modules missing then install
if [ ! -d "node_modules" ]; then
	npm install
fi
# start
forever start app.js -o ../logs/server_dispatch.log -e ../logs/server_dispatch_error.log
cd ..
