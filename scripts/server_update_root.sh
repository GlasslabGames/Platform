#!/bin/bash

# verify ran as root
if [ "$(id -u)" != "0" ]; then
   echo "This script must be run as root" 1>&2
   exit 1
fi

TODAY=`date +'%Y_%m_%d-%H_%M_%S'`
WEBAPP_DIR="/home/dev/webapps"
ROOT_DIR="/home/dev/github/Root"
START_TOMCAT="service tomcat7 start"
STOP_TOMCAT="service tomcat7 stop"

# first arg is the branch name
if [ -n "$1" ]; then
    BRANCH=$1
else
    BRANCH="master"
fi

echo "--------------------------------------"
echo "Updating WebApp(Root)..."
cd $ROOT_DIR
git checkout .
git pull origin $BRANCH
# if fail exit
if [ $? -ne 0 ]; then
    exit 1
fi

echo "--------------------------------------"
echo "Building web-app (Frontend) min/uglify files..."
cd web-app
# if node_modules missing then install
if [ ! -d "node_modules" ]; then
    npm install
fi
grunt prod --force

cd ..
grails prod war ${WEBAPP_DIR}/ROOT.war.${TODAY}

echo "--------------------------------------"
$STOP_TOMCAT
sleep 1

echo "--------------------------------------"
echo "Removing old ROOT dir/files..."
cd ${WEBAPP_DIR}
rm -rf ROOT
rm -f ROOT.war
if [ ! -d "../work" ]; then
    echo "Removing Working Dir..."
    rm -rf ../work/*
fi
ln -s ROOT.war.${TODAY} ROOT.war

echo "--------------------------------------"
$START_TOMCAT
