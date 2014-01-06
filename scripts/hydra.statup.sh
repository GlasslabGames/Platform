#!/bin/bash

## Fill in name of program here.
PROG="server_start.sh"
PROG_PATH="/home/dev/github/Platform/servers" ## Not need, but sometimes helpful (if $PROG resides in /opt for example).
PID_PATH="/var/run/"

start() {
    ## Change from /dev/null to something like /var/log/$PROG if you want to save output.
    $PROG_PATH/$PROG
    echo "$PROG started"
}

stop() {
    ## Program is running, so stop it
    forever stopall
    echo "$PROG stopped"
}

## Check to see if we are running as root first.
if [ "$(id -u)" != "0" ]; then
    echo "This script must be run as root" 1>&2
    exit 1
fi

case "$1" in
    start)
        start
        exit 0
    ;;
    stop)
        stop
        exit 0
    ;;
    reload|restart|force-reload)
        # start will kill old processes
        start
        exit 0
    ;;
    **)
        echo "Usage: $0 {start|stop|reload}" 1>&2
        exit 1
    ;;
esac
