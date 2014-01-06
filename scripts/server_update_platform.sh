#!/bin/bash

# verify ran as root
if [ "$(id -u)" != "0" ]; then
   echo "This script must be run as root" 1>&2
   exit 1
fi

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
cd servers
./server_start.sh
