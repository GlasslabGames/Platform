#!/bin/bash

# install dependencies from package.json
npm install

LOG_DIR="/var/log/hydra"

mkdir -p $LOG_DIR

# stop then start
forever stop app-data-collector.js
forever start \
-a \
-l ${LOG_DIR}/collector.log \
app-data-collector.js
#-o >(logger -p local0.info -t data.collector)
#-e >(logger -p local0.error -t data.collector)
# 2>&1 | cat > /dev/null &
