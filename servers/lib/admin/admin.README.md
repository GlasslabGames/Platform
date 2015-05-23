# Admin Service
========

The admin service allows the internal checking of our platform version.

Directory Structure
========

* Admin Directory
    * Controller
        * config.js
    * admin.js
    * admin.README.md
    * admin.service.js

Controllers
========

Apis in config.js can be accessed via the internal server and can be seen in the routes.internal.map.js.

## config.js

**version**

/admin/api/version

Returns the version value stored on the Service Manager.