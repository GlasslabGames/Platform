#!/bin/bash

npm install

LOG_DIR="/var/log/hydra"

mkdir -p $LOG_DIR

# stop then start
forever stop app-auth.js
forever start \
-a \
-l ${LOG_DIR}/auth.log \
app-auth.js

# stop then start
forever stop app-auth-validate.js
forever start \
-a \
-l ${LOG_DIR}/auth_validate.log \
app-auth-validate.js
