System Requirements:
Linux/Mac OS X

Dependencies
------------
Python
Locust (http://locust.io, load test framework)
http-proxy node module <= 0.10.4

Linux (Ubuntu 12.04 and compatible) Installation
------------
1. Install python and locust.io
 ```sh
 sudo apt-get install -y python-pip python-dev libzmq-dev python-lxml
 sudo pip install locustio pyzmq pyquery
 ```

2. Ensure that you have http-proxy 0.10.4 installed
 ```sh
 npm install http-proxy@0.10.4
 ```

One-time Setup
--------------
#### One-time prep
Open the create_users.js file
Modify the hostname and port to point to the webserver of the environment you want to populate
Ensure that the user "jlt_1@instituteofplay.org" is created.  (It should have been created as part of the inital database population)
Modify the number of classes and users you want to create (the last number of the 'jlt_class' and 'jlt_test' lines).  It represents the number of classes to create, and number of students per class to create.
Run the script
 ```sh
 node create_users.js
 ```
The script will take some time to complete depending on the class and user counts.  The playback script will use the classes and logins that are created in this step, so it is important that they match.  As long as you do not modify the prefix, class, or username variables, this should not be a problem.

Load Testing
------------
#### Recording user data.
Started Node.js script as a proxy (./start_proxy.sh)
Go to the browser enter http://localhost:9090
Logging in as a student and going though the site, play game sessions and challenges.

#### Preparing the playback environment
Copy the recorded data from the "proxy_capture" directory into "loadtest_apis", (or create a simlink named "loadtest_apis" to the directory with the proxy capture).
The login as part of the capture will be ignored and overwritten by the playback script to accomoate users.

#### Load testing
Start the load test script (./start_loadtest.sh)
Go to browser enter http://localhost:8089
Enter in the number of users you want to test and how fast you want them to spawn

Note that the script will honor the 'eventPeriodSecs' value returned from any 'api/v2/data/session/start' calls.  This could create descrepancies between different installations depending on the game configuration.
 
Staging Load Tests
------------------
I watched the Locust Report (average request latency, failure count), RDS (QPS, CPU, FreeStorage, Mem), System (CPU, Mem and thread count)
 
