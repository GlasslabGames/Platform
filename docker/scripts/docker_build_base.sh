#!/bin/bash

DIR="docker.tmp"

mkdir $DIR
cp docker.base.df $DIR/Dockerfile

cd $DIR
docker build -t hydra/base .
cd ..
rm -rf $DIR
