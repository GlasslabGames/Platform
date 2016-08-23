#!/bin/bash


# e.g.
#
# ./service_start.sh 5858 app-external "app-external.js"
# ./service_start.sh 5857 app-internal "app-internal.js"
# ./service_start.sh 5859 app-archiver "app-archiver.js"
# or
# ./service_start.sh 5858 external
# ./service_start.sh 5857 internal
# ./service_start.sh 5859 archiver

BRK="nobreak"

while getopts "d" opt; do
  case $opt in
    d) BRK="break";
    ;;
    \?) echo "Invalid option -$OPTARG" >&2
    ;;
  esac
done

PORT=${@:$OPTIND:1}
NAME=${@:$OPTIND+1:1}


if [ -n "${@:$OPTIND+2:1}" ]; then
    SCRIPT=${@:$OPTIND+2:1}
else
    SCRIPT="app-${NAME}.js"
fi

if [ "$BRK" = "break" ]; then
    DBGCMD="node --debug-brk=${PORT}"
else
    DBGCMD="node --debug=${PORT}"
fi

echo "${DBGCMD}"

# stop then start
#forever stop ${SCRIPT}
forever start \
--spinSleepTime 5000 \
-c "${DBGCMD}" \
-a \
-l ${LOG_DIR}/${NAME}.log \
${SCRIPT}
#-o >(logger -p local0.info -t ${NAME})
#-e >(logger -p local0.error -t ${NAME})
# 2>&1 | cat > /dev/null &
