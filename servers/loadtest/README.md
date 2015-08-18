System Requirements:
Linux/Mac OS X

Dependencies
------------
Python
Locust (http://locust.io, load test framework)

Linux (Ubuntu 12.04 and compatible) Installation
------------
1. Install python and locust.io
 ```sh
 sudo apt-get install -y python-pip python-dev libzmq-dev python-lxml
 sudo pip install locustio pyzmq pyquery
 ```

Load Testing
------------
#### Recording user data.
Started Node.js script as a proxy (./start_proxy.sh)
Go to the browser enter http://localhost:9090
Logging in as a student and going though the site, play game sessions and challenges.

#### Load Testing
Copy the recorded data from the "proxy_capture" directory into "loadtest_apis" (you may need to edit "locustfile.py" to change the directory it reads from)
Start the load test script (./start_loadtest.sh)
Go to browser enter http://localhost:8089
Enter in the number of users you want to test and how fast you want them to spawn
 
Staging Load Tests
------------------
I recorded the first two missions which includes two game sessions and 3 challenges.
I installed Locust on a small aws instance and copied all the data and script to the server.
I enter 10 user at first then 20, 50, 100, 200, 300 and finally 400.
I watched the Locust Report (average request latency, failure count), RDS (QPS, CPU, FreeStorage, Mem), System (CPU, Mem and thread count)
 
