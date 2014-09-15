#!/bin/bash

TODAY=`date +'%Y_%m_%d-%H_%M_%S'`

if [ "$1" == "master" ]; then
	TYPE="--master"
	screen -S locust_master -d -m locust -f locustfile.py $TYPE
elif [ "$1" == "slave" ]; then
	TYPE="--slave"
	screen -S locust_slave_${2} -d -m locust -f locustfile.py $TYPE
else
	locust -f locustfile.py 2>&1 | tee ./reports/locust_report-${TODAY}.txt
fi

# --master
