#!/bin/bash

DIR="docker.tmp"

mkdir $DIR
cp docker.allinone.base1.df $DIR/Dockerfile
cp ../../local/glasslab_dev.sql $DIR/import.sql

cd $DIR
docker build -t hydra/allinone_base1 .
cd ..
rm -rf $DIR
