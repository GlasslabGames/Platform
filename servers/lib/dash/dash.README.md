# Dash Service
========

The dash service handles game and messaging information that is displayed to users.  The games directory includes the
info.json and achievements.json files that control meta information, access rights, etc, for each game.
This game information is stored on the server in memory in the _games object in the dash.service file.

Directory Structure
========

* Dash Directory
    * Controller
        * _game.js
        * _reports.js
        * dash.js
        * game.js
        * games.js
        * reports.js
    * games
    * dash.const.js
    * dash.datastore.couchbase.js
    * dash.datastore.mysql.js
    * dash.js
    * dash.README.md
    * dash.service.js

Controllers
========

Controllers prefixed with _ are accessed via the internal server, and can be seen in the routes.internal.map.js.
All other apis are accessed through the external server and can be seen in the routes.external.map.js file.

## _game.js

**getAssessmentDefinitions**

/int/v1/dash/game/:gameId/assessment/definitions

**getAssessmentResults**

/int/v1/dash/game/:gameId/user/:userId/assessment/:assessmentId/results

**saveAssessmentResults**

/int/v1/dash/game/:gameId/user/:userId/assessment/:assessmentId/results

## _reports.js

**saveCompetencyResults**

Not currently listed as an api.

## dash.js

**getMessages**

/api/v2/dash/message-center/:messageId

Retrieves messages from Couchbase for display in the user's message center.

**postMessages**

Admin api for Glass Lab to add a message to Couchbase for display on the message center.

## game.js

**getUserGameAchievements**

/api/v2/dash/game/:gameId/achievements/user

Provides front end with list of game achievements, and mentions if the user has earned them or not.

**getGameDetails**

/api/v2/dash/game/:gameId

Provides game details from the _games object stored in the dash service.

**getGameReports**

/api/v2/dash/game/:gameId/reports/all

Provides game report information from the _games object stored in the dash service.

**getGameMissions**

/api/v2/dash/game/:gameId/missions

Provides game missions information from the _games object stored in the dash service.

**saveAssessmentResults**

/api/v2/dash/game/assessment/:assessmentId

Collects assessment results, merge them with prior assessment results, and saves to Couchbase.

## games.js

**getActiveGamesBasicInfo**

/api/v2/dash/games/active/basic

Returns basic game information to a user for all active games,

**getGamesBasicInfo**

/api/v2/dash/games

Gets basic info for all games.

*getPlanLicenseGamesBasicInfo*

/api/v2/dash/games/plan/basic

Get basic info for games based on a user's license plan.

**getAvailableGamesObj**

/api/v2/dash/games/available

Returns object of gameIds that are available for display/use on a user's license.

**getGamesBasicInfoByPlan**

/api/v2/dash/games/plan/:planId/basic

Accepts a plan id input.  Returns the basic game info of all games that exist on that plan.

**getActiveGamesDetails**

/api/v2/dash/games/active/details

Accesses the game details information for active games from the _games object in the dash service.

**getMyGames**

/api/v2/dash/myGames

Returns basic game info from all games that are currently in an instructor's courses.

**reloadGameFiles**

/api/v2/dash/reload/:code

Updates the _games object with the data stored in the Couchbase info (gi) and assessment (ga) documents, without needing to restart server.

**migrateInfoFiles**

/api/v2/dash/migrate/:code

Reads data from the info.json files, sends that information to couchbase, and repopulates the _games object without needing to restart server.

**migrateSingleGameInfoFiles**

/api/v2/dash/migrate/:gameName/:code

Reads data from the info.json files for the specified game only, sends that information to couchbase, and repopulates the _games object without needing to restart server.

**getDeveloperProfile**

/api/v2/dash/developer/profile

Returns list of gameIds that the developer has access to.  Will only show games with a verifyCodeStatus of "verified."

**getDeveloperGamesInfo**

/api/v2/dash/developer/info

Returns the game basic information from the _games object for all games a developer has access to.

**updateDeveloperGameInfo**

/api/v2/dash/developer/info/game/:gameId

Updates the game basic information based on developer input.
The updated game basic information is then saved in the info.json files, in couchbase, and in the _games object.

## reports.js

**getReport**

/api/v2/dash/reports/:reportId/game/:gameId/course/:courseId

Has params of reportId and courseId. Based on a certain report, gets all the report information for all students within a certain course.

**getReportInfo**

/api/v2/dash/reports/:reportId/game/:gameId/info

Has params of reportId and gameId. Retrieves information about a game report from the _games object in the dash service.


*getTotalTimePlayed**

/api/v2/dash/reports/totalTimePlayed

Accepts a userIds array and gameId parameter.  Returns a list of the total time played value for a game for each user.
