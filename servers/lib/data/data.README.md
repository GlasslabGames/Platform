# Data Service
========

The data service is built to handle the storage and retrieval of game telemetry data.

Directory Structure
========

* Data Directory
    * Controller
       * _config.js
       * _events.js
       * _gameSession.js
       * _queueSession.js
       * config.js
       * events.js
       * session.js
       * user.js
    * data.const.game_versions.js
    * data.const.js
    * data.datastore.couchbase.js
    * data.js
    * data.README.md
    * data.service.js

Controllers
========

Below is listed each controller in the data service, followed by a listing of all api methods.
APIs from controllers prefixed with _ are accessed through the routes.internal.map.js file.
All other controller api methods are contained in the routes.external.map.js file.
Use the below link to access more details about data apis.
https://docs.google.com/a/glasslabgames.org/spreadsheets/d/1u6Oo_UeJbNFXAkPEhYvetVsJ9GDby5iaVDM0D8p26Ag/edit#gid=0

## _config.js

**updateGameConfigs**

/api/v2/data/config/:gameId

Updates game config files in couchbase.

## _events.js

**getUserEvents**

/int/v1/data/game/:gameId/user/:userId/events

For a particular user and game, gets all telemetry events from couchbase, and returns the results

**setAllUsersActive**

/admin/data/user/setAllActive

Gets all active game sessions, and submits them to the activity queue on the assessment engine

**runDataMigration**

/admin/data/runMigration

## _gameSession.js

**getGameSessionEvents**

/int/v1/data/session/:gameSessionId/events

**getGameSessionsInfo**

/int/v1/data/session/game/:gameId/user/:userId/info

## _queueSession

**endQSession**

/int/v1/data/qsession/end

**cleanupQSession**

/int/v1/data/qsession/end

## config.js

**index**

/api/config

**connect**

/sdk/connect

## events.js

**sendBatchTelemetryV2**

/api/v2/data/events

**eventsCount**

/api/v2/data/eventsCount

## game.js
**saveGameData**

/api/v2/data/game/:gameId

saves a user's gameplay data to couchbase

**getGameData**

/api/v2/data/game/:gameId

gets a users's saved game data from couchbase

**deleteGameData**

/api/v2/data/game/:gameId

deletes a particular user's saved game data in couchbase. does not delete multiplayer matches

**updateDevice**

/api/v2/data/game/device

**getGamePlayInfo**

/api/v2/data/game/:gameId/playInfo

**postTotalTimePlayed**

/api/v2/data/game/:gameId/totalTimePlayed

updates a user's total time played value on couchbase

**postGameAchievement**

/api/v2/data/game/:gameId/achievement

**releases**

/api/v2/data/game/:gameId/releases:type

**createMatch**

/api/v2/data/game/:gameId/create

creates a multiplayer match in couchbase

**updateMatches**

/api/v2/data/game/:gameId/submit

updates a multiplayer match in couchbase

**pollMatches**

/api/v2/data/game/:gameId/matches

Gets all of a user's multiplayer matches for a particular game for a particular player status. player status is passed in via a query param, with values "active", "complete", or "all"

**completeMatch**

/api/v2/data/game/:gameId/complete

marks the user's player status in a match as complete.  If all players in the match are complete, the match is marked as complete

**deleteGameSaves**

/api/v2/data/game/saves/delete

admin limited api to delete all saved telemetry data for a paricular game. does not delete multiplayer match data.

## session.js

**startSessionV2**

/api/v2/data/session/start

**endSessionV2**

/api/v2/data/session/end

**startPlaySession**

/api/v2/data/playSession/start

## user.js

**saveUserPref**

no api route, not called in application

**getUserPref**

no api route, not called in application
