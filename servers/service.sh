#!/bin/bash

export LOG_DIR="/var/log/hydra"
mkdir -p $LOG_DIR

start() {
    # install dependencies from package.json
    npm install
    grunt

    ./service_start.sh statsd "node_modules/statsd/stats.js config.statsd.json"
    ./service_start.sh data-collector
    ./service_start.sh auth
    ./service_start.sh auth-validate
    ./service_start.sh assessment
    ./service_start.sh assessment-distiller
}

stop() {
    forever stopall
}

case "$1" in
    start)
        start
        exit 0
    ;;
    stop)
        stop
        exit 0
    ;;
    restart)
        # start will kill old processes
        stop
        start
        exit 0
    ;;
    **)
        echo "Usage: $0 {start|stop|reload}" 1>&2
        exit 1
    ;;
esac