#!/bin/bash

DIR="docker.tmp"

mkdir $DIR
cp docker.app.df $DIR/Dockerfile

cd $DIR
docker build -t hydra/app .
cd ..
rm -rf $DIR
