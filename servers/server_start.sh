#!/bin/bash

# install dependencies from package.json
npm install
grunt

./server_start_statsd.sh
./server_start_data.sh
./server_start_auth.sh
./server_start_assessment.sh
