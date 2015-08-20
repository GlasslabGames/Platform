GlassLab Game Service Platform (Hydra)
========
This is the Glasslab game service platform server.
It is a nodeJS web server. nodeJS servers is used for producing REST endpoints. Angular is used for frontend rendering and navigation.

Dependencies
------------
1. **Node.js**
2. **Forever** process manager
    * Use NPM to install forever process manager globally
    ```sh
    $ sudo npm install forever -g
    ```
3. **Redis** - Local or remote instance
    * Redis is the Job Q, so the platform and the assessment engine should use the same redis instance)
4. **MySQL** - Stage/Prod uses RDS
5. **Couchbase** - Stage/Prod uses separate instances


OSX Installation
------------
1. Install **Homebrew** and **Homebrew Services**
   * http://brew.sh/
    ```sh
    $ ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
    ```
   * https://github.com/Homebrew/homebrew-services
    ```sh
    $ brew tap homebrew/services
    ```  
2. Install **Node.js**
   1. We're using the latest v0.10 version of node.js; later versions introduce breaking changes.  Install nvm to manage which node.js version to use.
	   ```sh
	   $ curl https://raw.githubusercontent.com/creationix/nvm/v0.25.1/install.sh | bash
	   ```
   2. You'll need close your terminal window, then open it back up again for nvm to be active.  Then use it to setup node.js.
	   ```sh
	   $ . ~/.nvm/nvm.sh
	   $ nvm install 0.10
	   $ nvm use 0.10
	   $ nvm alias default 0.10
	   ```
	3. You'll need to activate nvm by sourcing it from your shell window for each new terminal instance.  Add
		. ~/.nvm/nvm.sh
	to your .bash_profile to do that automatically, or type that command in every time you create a new terminal instance.
3. Install **Forever** node process manager
  * Use NPM to install forever process manager globally
  ```sh
  $ sudo npm install forever -g
  ```
4. Install **MySQL**
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
        * Note: If you did not set your root password run the following:
         ```sh
         $ mysqladmin -u root password glasslab
         ```
   4. Optional [Install MySQL Workbench](http://dev.mysql.com/downloads/workbench)

5. Install **Redis**
   1. Use Brew to install redis
      ```sh
      $ brew install redis
      $ mkdir ~/Library/LaunchAgents
      $ ln -sfv /usr/local/opt/redis/*.plist ~/Library/LaunchAgents
      $ launchctl load ~/Library/LaunchAgents/homebrew.mxcl.redis.plist
      ```

      * Note: to restart the redis brew service, use the following command

      ```sh
      $ brew services restart redis
      ```

      * If the service does not start automatically, you can start manually by running:

      ```sh
      $ redis-server /usr/local/etc/redis.conf
      ```

      * You may need to kill extraneous redis process with:

      ```sh
      $ pkill -f redis
      ```

6. Install/Setup **Couchbase** Server
   1. Download: http://packages.couchbase.com/releases/2.2.0/couchbase-server-community_2.2.0_x86_64.zip
   2. Extract and Install App (install by dragging Couchbase from Zip into Applications on OS-X)
   3. Login into admin console [http://localhost:8091](http://localhost:8091)
   	 * Note If the login does not work (brings up a file not found), make sure that all of its services are allowed incoming connections, then quit couchbase (I used the Activity Monitor to close it) and start it again.  If it doesn't immediately get permission for incoming connections it can get confused.
   	 * Note Make sure to use the default paths for data.  If you change the path, it may not function, you'll have to uninstall and start over.
     * Note: If you do uninstall on OS-X, follow these instructions: http://docs.couchbase.com/admin/admin/Install/mac-uninstall.html
     * Note: You might see a different set of menus than (4) and (5), if so and assuming you see "Configure Server   Step 1 of 5" as your first window when logging into Admin Console after first install, follow (4.alt) and skip (4), (5), and (6):
   4.alt. 
      Step 1 of 5:
          * Leave disk storage paths and Server Hostname as is
          * Start a new cluster.  Leave the RAM Quota as is, as mentioned in (5) below, it is just a quota.
      Step 2 of 5:
          * Samples, do not install
      Step 3 of 5:
          * Use Bucket Type Couchbase
          * Leave quota as is
          * Relicas, make sure both setings are off (Enable, Index replicas)
          * Disk R-W, leave as is
          * Flush, leave disabled
      Step 4 of 5:
          * Leave notications as is
      Step 5 of 5:
          * As step (4) below, this is your admin account.

      Skip to step 7 (available in menu)
   4. Create user (remember the username/password this is your admin account) 
   5. Create Server (use default settings with a minimum of 512MB for the servers memory)
     * Note you can NOT edit the mem usage later, so it's recommended to leave it at default or all memory. The memory is a cap for all the buckets caps, it will not pre-allocat this memory so it's safe to put a high cap here.
     * Note I did not create a new server, but used an already created one at 127.0.0.1
   6. For the default bucket choose the 100MB (minimal size) for ram
     * You can delete this bucket later it's not used
   7. Add the required buckets
     * Select "Data Buckets" from the admin console.  Note that I HAD to delete the 'default' bucket, since it was using all of the ram (safe, the default isn't used).  You can delete the 'default' by selecting the arrow to the left of 'default', select 'edit', then 'delete'.
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
               1. Name: "glasslab_dashdata"
               2. RAM Quota: 100MB to 512MB this depends on how much ram you have free on your system. The higher the number the faster the data can be accessed.
               3. Access Control: Standard port password "glasslab"
               4. Replicas: uncheck "Enable"
               5. Click Create button at bottom of modal.
     8.  Open the Node to Client ports (Refer to http://docs.couchbase.com/couchbase-manual-2.2/#network-ports)

           1. 8091    Web Administration Port
           2. 8092    Couchbase API Port
           3. 11210   Internal/External Bucket Port
           4. 11211   Client interface (proxy)

7. Setup your config overrides and email access
   Copy 'Platform/scripts/sample.hydra.config.json' to '~/hydra.config.json'.

   In the 'hydra.config.json' you placed in your root dir '~/', change <user> to your user account name in auth.email.transport:
    "auth": {
        "email": {
             "from": "<accounts@glasslabgames.org>",
             "transportMethod": "PICKUP",
             "transport": "/Users/<user>/tmpmail"
         }
     }

8. Ensure that xcode is installed (used for building node_modules, must be up to date with OS-X)

9. Installation Complete

Linux (Ubuntu 12.04) Installation
------------
1. Setup windows-line-ending compatible bash script 
   1. Run the following command as root (or sudo bash'd)
    ```sh
    cat > $'/bin/bash\r' << "EOF"
    #!/usr/bin/env bash
    echo "Warning: Running CRLF bash script"
    script=$1
    shift
    exec bash <(tr -d '\r' < "$script") "$@"
    EOF
    ```
    * This is important because many of the scripts use the different line endings, and will otherwise a pain to modify en-mass.

2. Install **Node.js**
   1. Install nodejs and npm from the repository
    ```sh
    $ sudo apt-get install nodejs nodejs-legacy npm
    ```

3. Install **Forever** node process manager
  * Use NPM to install forever process manager globally
  ```sh
  $ sudo npm install forever -g
  ```

4. Install **MySQL**
   1. Install the mysql server from the repository 
    ```sh
    $ sudo apt-get install mysql-server
    ```
    * When prompted for the root password, use 'glasslab' (sans quotes).  Otherwise accept defaults. 
   2. (optional) Install the mysql client
    ```sh
    $ sudo apt-get install mysql-client
    ```
   3. Add MySQL user and Import SQL Schema data
      * See 4.3 for the OSX section and follow the instructions (running setup_db.sh)

5. Install **Redis**
   1. Use apt-get to install redis
      ```sh
      $ sudo apt-get install redis-server redis-tools
      ```
6. Install/Setup **Couchbase** Server
   1. Download: http://packages.couchbase.com/releases/2.2.0/couchbase-server-community_2.2.0_x86_64.deb
   2. install with dpkg
      ```sh
      $ sudo dpkg -i couchbase-server-community-2.2.0_x86_64.deb
      ```
   3. Continue to follow instructions for 6.3 in the OSX Installation instructions

7. Installation Complete

Running the app
---------------
1. Start/Stop/Restart servies
  * To start services run the following command:
  ```sh
  $ sudo ./service.sh start
  ```
  * To stop services run the following command:
  ```sh
  $ sudo ./service.sh stop
  ```
  * To restart services run the following command:
  ```sh
  $ sudo ./service.sh restart
  ```
  * Possible problems:
      * Permission denied error (```Error: EACCES, permission denied '/var/log/hydra/app-external.log```). This happened because hydra was under root instead of the user. To fix (insert your username instead of user):
      ```sh
      $ sudo chown -R user hydra
      ```
      * grunt missing error (`./service.sh: line 9: grunt: command not found`).  Install grunt
      ```sh
      $ sudo npm install -g grunt-cli
      ```

      Couchbase might not have built:
      It is important to check Platform/servers/node_modules/couchbase/builderror.log and confirm that it has no errors.  The npm scripts will SILENTLY fail if there are any errors building the couchbase interface and you will get errors launching and other issues.
      One Issue I encountered that kept Couchbase from being built properly was the failure of the gyp scripts to generate a proper config.h (Platform/servers/node_modules/couchbase/deps/lcb/src/config.h).  I think we're missing something here, since the prebuilt dirs (Platform/servers/node_modules/couchbase/prebuilt) are for windows only, which wouldn't make sense if this is configured for the existing platform (in my case OS-X).  One workable fix is to copy Platform/servers/node_modules/couchbase/deps/lcb/gyp_config/mac/x64/config.h to Platform/servers/node_modules/couchbase/deps/lcb/src/config.h, then do a 'sudo npm rebuild'.  Later I will investigate why we are not always getting couchbase setup correctly for build (works with warnings on one OSX system - 10.10.4 with a lot of existing developer tools, this particular error on 10.10.5 with only xcode and tools indicated in these readme's.  I suspect we're missing some tool dependencies.)
2. Confirm that the services started without errors by reviewing /var/log/hydra/app-external.log and /var/log/hydra/app-internal.log.  This is CRITICAL, as many errors are silent.  (should be fixed)
3. In a browser go to [http://localhost:8001](http://localhost:8001)


Configs
---------------
* A default config is stored in **"config.json"**
* If you place **"hydra.config.json"** in the home directory of the user running the platform server process. 
The server will load and override some or all configs in the default config file.
