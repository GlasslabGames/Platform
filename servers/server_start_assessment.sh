#!/bin/bash

# if node_modules missing then install
if [ ! -d "node_modules" ]; then
    npm install
fi

LOG_DIR="/var/log/hydra"

mkdir -p $LOG_DIR

# stop then start
forever stop app-assessment.js
forever start \
-a \
-l ${LOG_DIR}/assessment.log \
app-assessment.js
