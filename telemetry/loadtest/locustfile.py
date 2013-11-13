import random, json, re, time
from locust import Locust, TaskSet, task
from random import randint

hostname = "localhost:3000"
minWaitTime = 100
maxWaitTime = 1000
userId = 0

class MainTaskSet(TaskSet):
    def on_start(self):
        # do nothing
        self.batch_start()
    
    def batch_start(self):
    	global userId
        userId = userId + 1
        self.userId = userId
        
    	self.client.get("/api/telemetry/start/" + str(self.userId))

    def batch_end(self):
		self.client.get("/api/telemetry/end/" + str(self.userId))

    @task(80)
    def send_batch(self):
        self.client.get("/api/telemetry/batch/" + str(self.userId))
        time.sleep(0.1)

    @task(20)
    def batch_done(self):
        self.batch_end()
        self.batch_start()
        time.sleep(0.1)

class WebsiteUser(Locust):
    task_set = MainTaskSet
    host = "http://" + hostname
    min_wait = minWaitTime
    max_wait = maxWaitTime

