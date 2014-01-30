#!/bin/bash

# if node_modules missing then install
npm install

./server_start_telemetry.sh
./server_start_auth.sh
./server_start_assessment.sh
