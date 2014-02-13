#!/bin/bash

# install dependencies from package.json
npm install

./server_start_data.sh
./server_start_auth.sh
./server_start_assessment.sh
