#!/bin/bash

DIR="docker.tmp"

mkdir $DIR
cp docker.allinone.app.df $DIR/Dockerfile
cp -r ../servers $DIR/servers

cd $DIR
docker build -t hydra/allinone_app .
cd ..
rm -rf $DIR
