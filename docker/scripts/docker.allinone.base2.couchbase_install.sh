#!/bin/bash

cd /opt/couchbase
mkdir -p var/lib/couchbase var/lib/couchbase/config var/lib/couchbase/data \
    var/lib/couchbase/stats var/lib/couchbase/logs var/lib/moxi

chown -R couchbase:couchbase var

/etc/init.d/couchbase-server start

# Initialize a cluster
/opt/couchbase/bin/couchbase-cli cluster-init -c 127.0.0.1:8091 \
  --cluster-init-username=glasslab \
  --cluster-init-password=glasslab \
  --cluster-init-ramsize=512

# Create a GameData bucket
/opt/couchbase/bin/couchbase-cli bucket-create -c 127.0.0.1:8091 \
      --bucket=glasslab_gamedata \
      --bucket-type=couchbase \
      --bucket-ramsize=100 \
      --bucket-replica=0 \
      -u glasslab \
      -p glasslab
# Create a WebApp bucket
/opt/couchbase/bin/couchbase-cli bucket-create -c 127.0.0.1:8091 \
      --bucket=glasslab_webapp \
      --bucket-type=couchbase \
      --bucket-ramsize=100 \
      --bucket-replica=0 \
      -u glasslab \
      -p glasslab

