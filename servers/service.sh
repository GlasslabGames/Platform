#!/bin/bash

export LOG_DIR="/var/log/hydra"
mkdir -p $LOG_DIR

start() {
    # install dependencies from package.json
    npm install
    grunt #create version file

    # using DataDog agent - don't start StatsD server
    # ./service_start.sh statsd "node_modules/statsd/stats.js config.statsd.json"
    ./service_start.sh app-external "app-external.js"
    ./service_start.sh app-internal "app-internal.js"
    ./service_start.sh app-archiver "app-archiver.js"

    if [ $(grep -c hydra ~/.log.io/harvester.conf) -eq 0 ]
        then
            cp logging/harvester.conf ~/.log.io/
    fi

    # explicitly use "-c node" to override how these two scripts usually start
    forever start -c node node_modules/log.io/bin/log.io-server
    forever start -c node node_modules/log.io/bin/log.io-harvester
}

stop() {
    # forever stop node_modules/statsd/stats.js
    forever stop app-external.js
    forever stop app-internal.js
    forever stop app-archiver.js

    forever stop node_modules/log.io/bin/log.io-harvester
    forever stop node_modules/log.io/bin/log.io-server
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
        echo "Usage: $0 {start|stop|restart}" 1>&2
        exit 1
    ;;
esac
