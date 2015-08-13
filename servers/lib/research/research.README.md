# Research Service
========

The research service is built to handle the retrieval, processing, and archiving of telemetry data.

Directory Structure
========

* Research Directory
    * Controller
       * csv.js
       * events.js
    * email-templates
    * parser_schema
    * research.const.js
    * research.datastore.couchbase.js
    * research.js
    * research.README.md
    * research.service.js

Parser Schema
========

The parser schemas are cached/stored in couchbase under `glasslab_gamedata` key `g:XXX:parser-csv`.
They don't automatically pull from the source files and need to be updated manually after push.

Controllers
========

All apis are available through the external server, and can be seen in routes.external.map.js.

## csv.js

**getCsvParseSchema**

/api/v2/research/game/:gameId/parse-schema

Gets the csv schema that determines how game telemetry data is portrayed in the parser/archiver.

**updateCsvParseSchema**

/api/v2/research/game/:gameId/parse-schema

Updates the csv schema that determines how game telemetry data is portrayed in the parser/archiver.

## events.js

**getEventsByDate**

/api/v2/research/game/:gameId/events

Gets game telemetry data from couchbase for a game over a time range, formatted based on the csv schema, and returns an array of events.

**archiveEvents**

/api/v2/research/code/:code/archive

Accepts a query parameter indicating which game to archive, and how long the overall job should last.
Goes through game data in couchbase by day, and send collected data to be stored on S3.
Enforces a maximum size restriction on data, so if data is too big, breaks into separate s3 documents.
Updates Couchbase file to keep track of which events have been archived.

**stopArchive**

/api/v2/research/code/:code/archive/stop

Stops an archive job when the archive finishes its currently processing day.

**getSignedUrlsByDayRange**

/api/v2/research/game/:gameId/urls

For a certain gameId, grabs signed urls from s3 for all game data documents over a certain day range.
