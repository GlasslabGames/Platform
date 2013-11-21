#!/bin/bash

# if node_modules missing then install
if [ ! -d "node_modules" ]; then
	npm install
fi

mkdir -p /var/log/telemetry

# stop then start
forever stop app-collector.js
forever start \
-a \
-l /var/log/telemetry/collector.log \
app-collector.js
#-o >(logger -p local0.info -t telemetry.collector)
#-e >(logger -p local0.error -t telemetry.collector)
# 2>&1 | cat > /dev/null &

# stop then start
forever stop app-dispatcher.js
forever start \
-a \
-l /var/log/telemetry/dispatcher.log \
app-dispatcher.js
#-o >(logger -p local1.info -t telemetry.dispatcher)
#-e >(logger -p local1.error -t telemetry.dispatcher)
# 2>&1 | cat > /dev/null &
