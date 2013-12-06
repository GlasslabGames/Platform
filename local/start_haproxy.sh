#!/bin/bash

screen -d -m -S haproxy haproxy -f ./haproxy.cfg
