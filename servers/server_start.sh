#!/bin/bash

npm install
grunt

./server_start_statsd.sh
./server_start_telemetry.sh
./server_start_auth.sh
./server_start_assessment.sh
