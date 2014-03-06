#!/bin/bash

# verify ran as root
if [ "$(id -u)" != "0" ]; then
   echo "This script must be run as root" 1>&2
   echo "run \"sudo -s\"" 1>&2
   exit 1
fi

export HOME="/root"
PLATFORM_DIR="/home/dev/github/Platform/"

# first arg is the branch name
if [ -n "$1" ]; then
    BRANCH=$1
else
    BRANCH="master"
fi

echo "--------------------------------------"
echo "Updating Platform..."
cd ${PLATFORM_DIR}
git checkout .
git pull origin $BRANCH
# if fail exit
if [ $? -ne 0 ]; then
    exit 1
fi

if [ -n "$(initctl list | grep hydra.service)" ]; then
    # copy haproxy config and restart service
    cp ${PLATFORM_DIR}/scripts/haproxy.cfg /etc/haproxy
    service hapoxy restart

    service hydra restart
else
    cd servers
    ./server_start.sh
fi
