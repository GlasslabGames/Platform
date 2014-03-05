#!/bin/bash

npm install

LOG_DIR="/var/log/hydra"

mkdir -p $LOG_DIR

# stop then start
forever stop node_modules/statsd/stats.js
forever start \
-a \
-l ${LOG_DIR}/statsd.log \
node_modules/statsd/stats.js config.statsd.json
#-o >(logger -p local0.info -t statsd)
#-e >(logger -p local0.error -t statsd)
# 2>&1 | cat > /dev/null &
