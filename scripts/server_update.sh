#!/bin/bash

# verify ran as root
if [ "$(id -u)" != "0" ]; then
   echo "This script must be run as root" 1>&2
   exit 1
fi

./server_update_platform.sh
if [ $? -eq 0 ]; then
    exit 1
fi

./server_update_root.sh
if [ $? -eq 0 ]; then
    exit 1
fi
