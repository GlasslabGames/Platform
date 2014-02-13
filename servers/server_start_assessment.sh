#!/bin/bash

# install dependencies from package.json
npm install

LOG_DIR="/var/log/hydra"

mkdir -p $LOG_DIR

# stop then start
forever stop app-assessment.js
forever start \
-a \
-l ${LOG_DIR}/assessment.log \
app-assessment.js

# stop then start
forever stop app-assessment-distiller.js
forever start \
-a \
-l ${LOG_DIR}/assessment-distiller.log \
app-assessment-distiller.js
#-o >(logger -p local1.info -t assessment.distiller)
#-e >(logger -p local1.error -t assessment.distiller)
# 2>&1 | cat > /dev/null &
