## How to update the staging and developer environments

With the exception of our production environment (https://www.glasslabgames.org) there are two other environments managed by our Ops team (BambeeQ) using AWS:

- stage.playfully.org
- developer.playfully.org

Our staging environment is mainly used for playtesting but it also serves as our staging point before we go to production. If we have changes we want to see on production, we first push them here and test thoroughly. Only once the tests are passed on staging do we release to production. The release to production is a separate process altogether.

Our developer environment is reserved for our 3rd-party developers. This is their space to muck around with their games, utilizing all of the same features that would be available on production. Additionally, any new developer being onboarded into the platform would primarily use this environment until we release to production.

In order to update these environments with latest changes, there are a few things to note.

1) The deployments are handled by BambeeQ (our Ops team). They use OpsWork module in AWS to do the deployments. We must communicate with them in order to deploy. They live in a HipChat room. If you don't have access to this room, let Ben know.

2) Staging points to "release-candidate" branch. Make sure the repo is up to date before attempting a deployment.

3) Developer points to "developer-sandbox" branch. Make sure the repo is up to date before attempting a deployment.

NOTE: currently, both environments already point to their respective branches, so no need to indicate that to the Ops team.

4) **Stack settings changes**: Each environment uses their own config.json file, which is visible in the OpsWork module of AWS. If there are ANY changes to the config.json file in your local repo, it MUST be communicated. That is the only file in the repository that is ignored, due to its specificity. Should a change to config.json be necessary, please communicate that to the Ops team with the JSON that should be updated.

NOTE: for example, if you change the *.sdk* object in the config.json root, simply paste the entire contents to them:
```javascript
"sdk": {
        "connect": "$host", "//": "$host is default, returns req.headers.host",
        "protocol": "http", "//": "https or http, :// will be appended automatically",
        "simcity": "https", "//": "for simcity testing only, remove me when done..."
    },
```

5) Each environment has two app servers, indicated by IP addresses. As the Ops team deploys each one, they will link the IP address to you so you can test. Essentially, the app servers are pulled from the load balancer one by one and reattached if acceptible. This is so we have zero downtime. So please be sure your tests pass before letting them know to move onto the next app server.

#####Typical Communication:
- "Hello. Can we update stage.playfully stack with same stack settings?"
- "Hello. Can we update developer.playfully stack with same stack settings?"
- "Hello. Can we update stage.playfully stack with following stack setting changes: {"sdk": { "connect": "$host" }"

NOTE: you can go through the HipChat history and see how I've communicated with them in the past.