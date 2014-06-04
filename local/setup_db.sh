#!/bin/bash

echo "Adding 'glasslab' user, 'glasslab_dev' database and importing some data"
echo "[Root User]"
mysql -u root -p < ./glasslab_dev.sql
if [[ $? = 1 ]]; then
    echo "Error Occurred!"
else
    echo "Done!"
fi
