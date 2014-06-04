GlassLab Game Service Platform (Hydra)
========
This is the Glasslab game service platform server.
It is a nodeJS web server. nodeJS servers is used for producing REST endpoints. Angular is used for frontend rendering and navigation.


Installation
------------
1. Install Brew
   * http://brew.sh/
    ```sh
    $ ruby -e "$(curl -fsSL https://raw.github.com/mxcl/homebrew/go/install)"
    ```
2. Install Node.js
   * Use Brew to install node
   ```sh
   $ brew install node
   ```
3. Install MySQL
   1. Use Brew to install MySQL
    ```sh
    $ brew install mysql
    $ ln -sfv /usr/local/opt/mysql/*.plist ~/Library/LaunchAgents
    $ launchctl load ~/Library/LaunchAgents/homebrew.mxcl.mysql.plist
    ```
   2. Verify by running
      * List all Brew services
      ```sh
      $ brew services list
      ```
      * This should display "mysql      started..."
   3. Add MySQL user and Import SQL Schema data
        * Change to "local" dir and run setup_db.sh script
        ```sh
        $ cd local
        $ ./setup_db.sh
        ```
        * This will create a DB called **"glasslab_dev"** and a user named **"glasslab"** with password **"glasslab"**
4. Install/Setup Couchbase Server
   1. Download: http://packages.couchbase.com/releases/2.2.0/couchbase-server-community_2.2.0_x86_64.zip
   2. Extract and Install App
   3. Login into admin console (http://localhost:8091
   4. Create user (remember the username/password this is your admin account)
   5. For the default bucket choose the 100MB (minimal size) for ram
     * You can delete this bucket later it's not used
   6. Add the required buckets
     * Select "Data Buckets" from the admin console
        * Create two data buckets
           1. Click "Create New Data Bucket"
               1. Name: "glasslab_gamedata"
               2. RAM Quota: 100MB to 512MB this depends on how much ram you have free on your system. The higher the number the faster the data can be accessed.
               3. Access Control: Standard port password "glasslab"
               4. Replicas: uncheck "Enable"
               5. Click Create button at bottom of modal.
           2. Click "Create New Data Bucket" again
               1. Name: "glasslab_webapp"
               2. RAM Quota: 100MB to 512MB this depends on how much ram you have free on your system. The higher the number the faster the data can be accessed.
               3. Access Control: Standard port password "glasslab"
               4. Replicas: uncheck "Enable"
               5. Click Create button at bottom of modal.
           3. Click "Create New Data Bucket" again
               1. Name: "glasslab_webapp"
               2. RAM Quota: 100MB to 512MB this depends on how much ram you have free on your system. The higher the number the faster the data can be accessed.
               3. Access Control: Standard port password "glasslab"
               4. Replicas: uncheck "Enable"
               5. Click Create button at bottom of modal.
2. Install Redis

4. Installation COMPLETE

Running the app
---------------
2. Execute the following command to run the app: "grails run-app"
3. Access the app at the URL reported in the grails logs
    http://localhost:8080/

To start services run the following command:
```sh
$ cd servers
$ ./service.sh start
```
To stop services run the following command:
```sh
$ cd servers
$ ./service.sh stop
```
To restart services run the following command:
```sh
$ cd servers
$ ./service.sh restart
```
