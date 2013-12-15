#!/bin/bash

# if node_modules missing then install
if [ ! -d "node_modules" ]; then
	npm install
fi

./server_start_telemetry.sh
./server_start_auth.sh
