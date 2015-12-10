# Monitor Service
========

The monitor service is built to handle mointoring aspects of a server environment.

Directory Structure
========

* monitor Directory
    * Controller
       * inspector.js
    * email-templates
    * monitor.const.js
    * monitor.datastore.couchbase.js
    * monitor.js
    * monitor.README.md
    * mponotr.service.js

Controllers
========

All apis are available through the archiver server, and can be seen in routes.archiver.map.js.

## inspector.js

**runMonitor**

/api/v2/monitor/run

Executed the monitoring job outside of cron.
