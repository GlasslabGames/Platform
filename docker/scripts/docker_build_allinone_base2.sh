#!/bin/bash

DIR="docker.tmp"

mkdir $DIR
cp docker.allinone.base2.df $DIR/Dockerfile
cp docker.allinone.base2.couchbase_install.sh $DIR/couchbase.sh

cd $DIR
docker build -t hydra/allinone_base2 .
cd ..
rm -rf $DIR
