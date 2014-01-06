#!/bin/bash

# verify ran as root
if [ "$(id -u)" != "0" ]; then
   echo "This script must be run as root" 1>&2
   exit 1
fi

if [ -n "$1" ]; then
    BRANCH=$1
else
    BRANCH="master"
fi

./server_update_platform.sh $BRANCH
if [ $? -ne 0 ]; then
    exit 1
fi

./server_update_root.sh $BRANCH
if [ $? -ne 0 ]; then
    exit 1
fi
