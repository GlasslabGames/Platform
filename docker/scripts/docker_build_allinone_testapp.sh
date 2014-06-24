#!/bin/bash

DIR="docker.tmp"

mkdir $DIR
cp docker.allinone.app.df $DIR/Dockerfile
cp -r ../testapp $DIR/servers

cd $DIR
docker build -t hydra/allinone_testapp .
cd ..
rm -rf $DIR
