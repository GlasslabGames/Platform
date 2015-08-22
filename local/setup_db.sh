#!/bin/bash

DIR=$(cd `dirname $0` && pwd)

echo "Adding 'glasslab' user, 'glasslab_dev' database and importing some data"
echo "Working out of $DIR"
echo "[Root User]"

cat $DIR/glasslab_dev.sql $DIR/create_users.sql | mysql -u root -p 
if [[ $? = 1 ]]; then
    echo "Error Occurred!"
else
    echo "Done!"
fi

