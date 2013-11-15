#!/bin/bash

mkdir -p logs
DIR=`pwd`

cd server_collector
# if node_modules missing then install
if [ ! -d "node_modules" ]; then
	npm install
fi
# stop then start
forever stop app-collector.js
forever start -o ${DIR}/logs/server_collector.log -e ${DIR}/logs/server_collector_error.log app-collector.js
cd ..

cd server_dispatch
# if node_modules missing then install
if [ ! -d "node_modules" ]; then
	npm install
fi
# stop then start
forever stop app-dispatch.js
forever start -o ${DIR}/logs/server_dispatch.log -e ${DIR}/logs/server_dispatch_error.log app-dispatch.js
cd ..
