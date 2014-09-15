import string, random, json, re, time
from locust import Locust, HttpLocust, TaskSet, task
from random import randint


#baseLoadTestDateDir = "./loadtest_apis.local"
baseLoadTestDateDir = "./loadtest_apis.mgoaa.stage5"
#username = "jstudent"
#username = "jlt_test1_"
username = "build+teach@glasslabgames.org"
password = "glasslab123"

gameId = "AA-1"

port = 8001
hostname = "localhost:" + str(port)
#hostname = "stage.argubotacademy.org"

#maxLoopSeconds = 10
maxLoopSeconds = 10*60
displayInfo = False
displayPostError = True

startUserID = 1
userId = 0
minWaitTime = 1000
maxWaitTime = 1000


API_POST_LOGIN         = "/api/v2/auth/login/glasslab"
#	"/api/v2/auth/login"
API_POST_SESSION_START = "/api/v2/data/session/start"
API_POST_SESSION_END   = "/api/v2/data/session/end"
API_POST_EVENTS        = "/api/v2/data/events"

API_GET_COURSES        = "/api/v2/lms/courses"
API_GET_CONFIG         = "/api/v2/data/config/"+gameId
API_GET_PLAYERINFO     = "/api/v2/data/game/"+gameId+"/playInfo"
API_POST_SAVEGAME      = "/api/v2/data/game/"+gameId
API_POST_TOTALTIMEPLAYED = "/api/v2/data/game/"+gameId+"/totalTimePlayed"

def getUrlList():
    fh = open( baseLoadTestDateDir + "/get_urls" )
    x = []
    for line in fh.readlines():
        x.append( line[:-1] )
    fh.close()
    return x

def getAPIUrlList():
    fh = open( baseLoadTestDateDir + "/get_api_urls" )
    x = []
    for line in fh.readlines():
        x.append( line[:-1] )
    fh.close()
    return x

def postAPIUrlList():
    fh = open( baseLoadTestDateDir + "/post_api_urls" )
    x = {}
    for line in fh.readlines():
        postapi = line[:-1]

        # only add to map onece
        if postapi not in x:
            x[postapi] = []
            # remove first char a slash and replace all slashes with underscores
            pfh = open( baseLoadTestDateDir + "/post_api/" + postapi[1:].replace("/", "_"))
            if (postapi in [ 
                    API_POST_EVENTS, 
                    API_POST_SAVEGAME,
                    API_POST_TOTALTIMEPLAYED ] ):
                data = ""
                for pline in pfh.readlines():
                    data = data + pline
                fh.close()

                x[postapi] = data.split("&")[:-1]
                #print "x[" + str(postapi) + "] len: " + str( len(x[postapi]) )

                # try again, if not elements, split by "\n"
                if len(x[postapi]) == 0:
                    x[postapi] = data.split("\n")[:-1]
                #print "x[" + str(postapi) + "] len: " + str( len(x[postapi]) )

                #print "x[postapi]:" + str(x[postapi])
            else:
                for pline in pfh.readlines():
                    x[postapi].append( pline[:-1] )
                fh.close()

    fh.close()
    return x

def isJSON(data):
    offset = 0
    while data[offset] in ["\n", "\r", "\t", " "]:
        offset = offset + 1

    if data[offset] in ["{", "["]:
        return True
    else:
        return False

def replaceString(data, strname, strvalue):
    if displayInfo:
        print "replaceString before data: "+str(data)+", strname: "+str(strname)+", strvalue: "+str(strvalue)
    
    if isJSON(data):
        found = re.search(r'"' + re.escape(strname) + r'"[\s:]*"([a-zA-Z0-9_\-%]*)"', data)
    else:
        found = re.search(re.escape(strname) + r'=([a-zA-Z0-9_\-%]*)&', data)

    if found and len(found.groups()) > 0:
        oldVal = found.group(1)
        if displayInfo:
            print "replaceString oldVal: " + oldVal
        data = data.replace(oldVal, str(strvalue))
    
    if displayInfo:
        print "replaceString data after: " + data
    return data


class MainTaskSet(TaskSet):
    def on_start(self):
        global userId, startUserID
        self.c_id = userId + startUserID
        userId = userId + 1
        #self.c_id = randint(startUserID, endUserID)

        global get_urls
        global get_api_urls
        global post_api_urls
        self.get_urls = get_urls
        self.get_api_urls = get_api_urls
        self.post_api_urls = post_api_urls

        self.login()
        
    def login(self):
        # loop until login
        while True:
            self.client.headers = {"content-type": "application/json"}
#            r = self.client.post("/api/user/login", '{"username":"'+ username+str(self.c_id) +'","password":"'+ password+str(self.c_id) +'"}')
#            loginStr = '{"username":"'+ username+str(self.c_id) +'","password":"'+ password+str(self.c_id) +'"}'
            loginStr = '{"username":"'+ username + '","password":"'+ password +'"}'
            self.deviceId = str(self.c_id)+'-'+''.join(random.choice(string.lowercase) for x in range(5))
            
            if displayInfo:
                print "Login deviceId: " + str(self.deviceId)
                print "Login Info: " + str(loginStr)
            r = self.client.post(API_POST_LOGIN, loginStr)
            if r.status_code != 200:
                if displayInfo:
                    print "Error Login - " + str(r.content)
            else:
                res = json.loads(r.content)
                self.userSessionId = None
                if res.has_key('sessionId'):
                    self.userSessionId = res['sessionId']
                    
                    # wait before getting course id
                    time.sleep(0.5)

                    # get random course
                    # note: the user is only logged into one course
                    courseId = self.getCourseId()
                    if courseId:
                        self.courseId = courseId
                        if displayInfo:
                            print "Login ok - sessionId: " + str(self.userSessionId) + " , courseId: " + str(self.courseId)

                        # login ok, now get config info
                        self.getConfig()
                        self.getPlayInfo()

                        # all set
                        # stop while loop
                        break;
            # wait before trying to login again
            time.sleep(30)

        # logged in and got userSessionId and courseId
        time.sleep(0.5)

    def getCourseId(self):
        r = self.client.get(API_GET_COURSES)
        if r.status_code == 200:
            res = json.loads(r.content)
            if displayInfo:
                print "getCourseId content: " + str(r.content)
            
            courseId = res[0]['id']
            if displayInfo:
                print "getCourseId courseId: " + str(courseId)

            return courseId
        return None

    def getConfig(self):
        r = self.client.get(API_GET_CONFIG)
        if r.status_code == 200:
            if displayInfo:
                print "getConfig: " + str(r.content)
            return r.content
        return None

    def getPlayInfo(self):
        r = self.client.get(API_GET_PLAYERINFO)
        if r.status_code == 200:
            if displayInfo:
                print "getPlayInfo: " + str(r.content)
            return r.content
        return None

    def post(self, url, data, customType=None):
        if customType:
            contentType = customType
        else:
            if isJSON(data):
                if displayInfo:
                    print "post JSON"
                contentType = "application/json"
            else:
                contentType = "application/x-www-form-urlencoded"
        self.client.headers = {"content-type": contentType}
        r = self.client.post(url, data)
        if r.status_code != 200 and displayPostError:
            print "Post Error: " + str(r.content)
            print "Post Error Url: " + url
            print "Post Url: " + url
            print "Post Data: " + data

        return r

    # post TotalTimePlayed
    def postTotalTimePlayed(self):
        if displayInfo:
            print "Post Total Time Played"
        # pick random post data
        posturl = API_POST_TOTALTIMEPLAYED
        postdata = random.choice(self.post_api_urls[posturl])
        # post start session and get game session id
        r = self.post(posturl, postdata)

    # post Saved Game
    def postSavedGame(self):
        if displayInfo:
            print "Post Saved Game"
        # pick random post data
        posturl = API_POST_SAVEGAME
        postdata = random.choice(self.post_api_urls[posturl])
        # post start session and get game session id
        r = self.post(posturl, postdata)

    # start game session
    def startGameSession(self):
        if self.userSessionId:
            if displayInfo:
                print "Post Start Game Session"

            # pick random post data
            posturl = API_POST_SESSION_START
    
            postdata = random.choice(self.post_api_urls[posturl])

            # replace session
            postdata = replaceString(postdata, "userSessionId", self.userSessionId)
            # replace course ID
            postdata = replaceString(postdata, "courseId", self.courseId)
            # replace device ID
            postdata = replaceString(postdata, "deviceId", self.deviceId)
        
            # post start session and get game session id
            r = self.post(posturl, postdata)
            if r.status_code == 200:
                if displayInfo:
                    print "startGameSession content:" + str(r.content)

                res = json.loads(r.content)
                #print "Game Session Info: " + str(res)
                return res

        return None

    # post Game telemetry
    def postGameTelemetry(self, gameSessionId):
        #print "Post Game Telemetry"
        # pick random post data
        posturl = API_POST_EVENTS
    
        postdata = random.choice(self.post_api_urls[posturl])
        # replace game session
        if displayInfo:
            print "postGameTelemetry gameSessionId: " + str(gameSessionId)

        # replace game session ID
        postdata = replaceString(postdata, "gameSessionId", gameSessionId)
        # replace device ID
        postdata = replaceString(postdata, "deviceId", self.deviceId)

        r = self.post(posturl, postdata)

    # end game session
    def endGameSession(self, gameSessionId):
        # print "End Game Session"
        # pick random post data
        posturl = API_POST_SESSION_END
        # 
        postdata = random.choice(self.post_api_urls[posturl])
        # replace session
        if displayInfo:
            print "endGameSession gameSessionId: " + str(gameSessionId)
        postdata = replaceString(postdata, "gameSessionId", gameSessionId)

        r = self.post(posturl, postdata)


    # Start Challenge Session
    def startChallengeSession(self):
        #print "Start Challenge Session"

        if self.userSessionId:
            # pick random post data
            posturl = API_POST_SESSION_START
    
            postdata = random.choice(self.post_api_urls[posturl])

            # replace session
            postdata = replaceString(postdata, "userSessionId", self.userSessionId)
            # replace course ID
            postdata = replaceString(postdata, "courseId", self.courseId)

            # post start session and get game session id
            r = self.post(posturl, postdata)
            #print "post results: " + r.content
            if r.status_code == 200:
                res = json.loads(r.content)
                #print "Challenge Session Info: " + str(res)
                return res

        return None

    # Get Challenge Id
    def getChallengeSession(self):
        validurls = [k for k in self.get_api_urls if "challenge" in k]
        if len(validurls) > 0:
            url = random.choice(validurls)
            # remove everything after the last / and add user sessionID
            url = "/".join( url.split("/")[:-1] ) + "/" + self.userSessionId
            #print "challenge url: " + url
            r = self.client.get(url)
            #print "challenge response: " + r.content
            if r.status_code == 200:
                res = json.loads(r.content)
                #print "gameSessionId: " + res['gameSessionId']
                if res.has_key('template'):
                    return res['template']['challengeId']
                else:
                    print "url:" + url
                    print "template:" + r.content
        return None

    # End Challenge Session
    def endChallengeSession(self, gameSessionId, challengeId):
        #print "End Challenge Session"
        # pick random post data
        posturl = "/api/challenge/endsession"
        postdata = random.choice(self.post_api_urls[posturl])

        # replace gameSessionId
        postdata = replaceString(postdata, "gameSessionId", gameSessionId)
        postdata = replaceString(postdata, "challengeId", challengeId)
        
        # post start session and get game session id
        r = self.post(posturl, postdata)

# ----------------------------------------
# Tasks (functions that are run during the load test)
# to disable a task, just comment out the @task(<probability this task is ran>)
# ----------------------------------------
    @task(7)
    def task_postSavedGame(self):
        self.postSavedGame()
        # wait more
        time.sleep( randint(1, 10) )

    @task(5)
    def task_postTotalTimePlayed(self):
        self.postTotalTimePlayed()
        # wait more
        time.sleep( randint(1, 10) )

    @task(82)
    # 1) start session
    # 2) send events
    # 3) end session
    def task_postGameTelemetry(self):       
        info = self.startGameSession()
        if info:
            print(info) # Fixme
            maxInterations = max(2, int( float(maxLoopSeconds)/float(info['eventsPeriodSecs']) ) )  # fixme <-- bad key
            numInterations = randint(2, maxInterations)
            #if displayInfo:
            #    print "maxInterations: " + str(maxInterations)
            #    print "numInterations: " + str(numInterations)

            for x in range(1, numInterations ):
                if displayInfo:
                    print "i:"+str(x)
                
                # if min telem, eat time, don't sent telem every X seconds
                if int(info['eventsDetailLevel']) != 1:
                    if displayInfo:
                        print "repeat eventsDetailLevel: " + str( int(info['eventsDetailLevel']) )
                    self.postGameTelemetry(info['gameSessionId'])

                if displayInfo:
                    print "eventsPeriodSecs: " + str( float(info['eventsPeriodSecs']) )
                time.sleep(float(info['eventsPeriodSecs']))

            # if min telem, only send one telemetry
            if int(info['eventsDetailLevel']) == 1:
                if displayInfo:
                    print "once eventsDetailLevel: " + str( int(info['eventsDetailLevel']) )
                self.postGameTelemetry(info['gameSessionId'])

            # wait
            time.sleep( float(info['eventsPeriodSecs']) )
            # done
            self.endGameSession(info['gameSessionId'])
            # wait more
            time.sleep( randint(10, 30) )
        else:
            time.sleep(30)



#    @task(10)
    def random_get_page(self):
        url = random.choice(self.get_urls)
        url = replaceString(url, "sessionId", self.userSessionId)
        r = self.client.get(url)

#   @task(10)
    def random_getapi_page(self):
        validurls = [k for k in self.get_api_urls if (
            "challenge" not in k and
            "session" not in k
            )]
        if len(validurls) > 0:
            url = random.choice(validurls)
            r = self.client.get(url)

#    @task(33)
    def challenge_api_page(self):
        info = self.startChallengeSession()
        if info:
            time.sleep(1)
            challengeId = self.getChallengeSession()
            if challengeId:
                maxInterations = max(2, int( float(maxLoopSeconds)/float(info['eventsPeriodSecs']) ) )
                numInterations = randint(2, maxInterations)
                #print "maxInterations: " + str(maxInterations)
                #print "numInterations: " + str(numInterations)

                for x in range(1, randint(2, maxInterations) ):
                    #print "eventsPeriodSecs: " + str( float(info['eventsPeriodSecs']) )
                    time.sleep(float(info['eventsPeriodSecs']))

                    # if min telem, eat time, don't sent telem every X seconds
                    if int(info['eventsDetailLevel']) != 1:
                        #print "repeat eventsDetailLevel: " + str( int(info['eventsDetailLevel']) )
                        self.postChallengeTelemetry(info['gameSessionId'])

                # if min telem, only send one telemetry
                if int(info['eventsDetailLevel']) == 1:
                    #print "once eventsDetailLevel: " + str( int(info['eventsDetailLevel']) )
                    self.postChallengeTelemetry(info['gameSessionId'])

                # wait more
                time.sleep( float(info['eventsPeriodSecs']) )
                # done
                self.endChallengeSession(info['gameSessionId'], challengeId)
                # wait more
                time.sleep( randint(10, 30) )
            else:
                time.sleep(30)
        else:
            time.sleep(30)

    # post telemetry
#    @task(33)
    def postChallengeTelemetry(self, gameSessionId):
        #print "Post Game Telemetry"
        # pick random post data
        posturl = API_POST_EVENTS
        
        postdata = random.choice(self.post_api_urls[posturl])
        # replace game session
        postdata = replaceString(postdata, "gameSessionId", gameSessionId)
        # post start session and get game session id
        r = self.post(posturl, postdata)
        #print "telemetry post:" + r.content


#    @task(20)
    def random_postapi_page(self):
        # get a url that does NOT contain "game" or "challenge"
        validurls = [k for k in self.post_api_urls.keys() if (
            "login" not in k and
            "challenge" not in k and
#            "game" not in k and
            "user" not in k
            )]
        if len(validurls) > 0:
            #print "Valid Urls: ", validurls
            posturl = random.choice(validurls)
            postdata = random.choice(self.post_api_urls[posturl])
            self.post(posturl, postdata)


# ----------------------------------------
# Init
# ----------------------------------------
get_urls = getUrlList()
get_api_urls = getAPIUrlList()
post_api_urls = postAPIUrlList()

class WebsiteUser(HttpLocust):
    task_set = MainTaskSet
    host = "http://" + hostname
    min_wait = minWaitTime
    max_wait = maxWaitTime

