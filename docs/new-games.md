## Configuring a developer's game to connect with the SDK

In order for new developers to connect their games to the SDK, they need a game Id. All games are located in /servers/lib/dash/games. Each game has its own directory with a file called "info.json".

The info.json file is what describes all of the content for the game, including text and images you would see on the game page, reporting structure, rules to use, and SDK flags. To make a new game that our SDK can connect with, copy the "template" folder in and rename it to the game Id of the new developer game. Game Ids tend to be just a few characters so use your best judgment.

Once copied, open up the info.json file and change the "gameId" flag to match the name of the directory. Since we don't want to see the developer games on the dashboard, mark the "visible" flag to false but "enabled" to true. Be absolutely sure that when changes are pushed to production (i.e. master branch) all games considered in development have BOTH flags set to false.

Rerun the app and look for lines in the console beginning with "_buildGamesObject for game:". If the game Id you created is listed there then everything should be set. Another helpful test is to navigate to "localhost:8001/api/v2/data/config/[gameId]" in the browser. Replace "[gameId]" with the game Id you created. You should see a JSON object that looks like this:

{
 "eventsMaxSize": 100,
 "eventsMinSize": 5,
 "eventsPeriodSecs": 30,
 "eventsDetailLevel": 10
}

If so, you are good to go!