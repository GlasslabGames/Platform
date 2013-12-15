#!/bin/bash

# if node_modules missing then install
if [ ! -d "node_modules" ]; then
	npm install
fi

LOG_DIR="/var/log/glasslab/telemetry"

mkdir -p $LOG_DIR

# stop then start
forever stop app-telemetry-collector.js
forever start \
-a \
-l ${LOG_DIR}/collector.log \
app-telemetry-collector.js
#-o >(logger -p local0.info -t telemetry.collector)
#-e >(logger -p local0.error -t telemetry.collector)
# 2>&1 | cat > /dev/null &

# stop then start
forever stop app-telemetry-dispatcher.js
forever start \
-a \
-l ${LOG_DIR}/dispatcher.log \
app-telemetry-dispatcher.js
#-o >(logger -p local1.info -t telemetry.dispatcher)
#-e >(logger -p local1.error -t telemetry.dispatcher)
# 2>&1 | cat > /dev/null &
