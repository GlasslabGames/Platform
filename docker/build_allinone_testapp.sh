#!/bin/bash

# remove all containers and images
# docker rm `docker ps -a -q`
# docker images | awk '{print $3}' | xargs docker rmi

# run
# docker run -t -i hydra/allinone_testapp /bin/bash

cd scripts
./docker_build_base.sh
./docker_build_allinone_base.sh
./docker_build_allinone_testapp.sh
