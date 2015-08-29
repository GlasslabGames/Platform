# Auth Service
========

The auth service handles account creation, login, and system roles for users.  This service also populates the server user session.

Directory Structure
========

* Auth Directory
    * Controller
        * _user.js
        * login.js
        * newsletter.js
        * user.js
    * email-templates
    * auth.account.clever.js
    * auth.account.edmodo.js
    * auth.account.glasslab.js
    * auth.account.google.js
    * auth.account.icivics.js
    * auth.accounts.js
    * auth.accounts.manager.js
    * auth.const.js
    * auth.datastore.couchbase.js
    * auth.datastore.mysql.js
    * auth.js
    * auth.README.md
    * auth.service.js
    * auth.strategy.clever.js
    * auth.strategy.edmodo.js
    * auth.strategy.glasslab.js
    * auth.strategy.icivics.js

Controllers
========

The _user controler's api is accessed through the internal server, and can be seen in the routes.internal.map.js file to reference their apis.
All other controller apis are accessed via the external server and can be found in the routes.external.map.js file.

## _user.js

**renderEmailTemplate**

/admin/auth/user/email-template

## login.js

**logout**

/api/v2/auth/logout

Logs user out.

**glassLabLogin**

/api/v2/auth/login/glasslab

Authenticates a user's login request, creates the user session, sends user information to front end, and logs user in.

**loginStatus**

/api/v2/auth/login/status

Server check to see if user is properly logged in.  If not, throws an error.

## newsletter.js

**subscribe**

/api/v2/auth/newsletter/subscribe

Subscribes user to Glass Lab newsletter.

## user.js

**getUserProfileData**

/api/v2/auth/user/profile

Sends user information object that is used by front end.  Information retrieved from mysql on every api call.

**registerUserV1**

Vestigial user registration method.  No longer in use.

**registerUserV2**

/api/v2/auth/user/register

Registers user for an account.  Can register several different roles of users: student, instructor, developer.
For instructors and developers, the user registration process ends with clicking a verify link sent by email.

**verifyEmailCode**

/api/v2/auth/register-verify/:code/verify

API called when user clicks the verify link in their email after registering an instructor account.
This api looks up the code contained in the params and changes the associated user account to active, if the code is correct.

**verifyBetaCode**

/api/v2/auth/register-verify/:code/verifyBeta

API not currently in active use.  Part of an older user verification process when we had a closed beta.

**verifyDeveloperCode**

/api/v2/auth/register-verify/:code/verifyDeveloper

API called after a developer user clicks a verify link via email.  Code is checked against users in the db, and if there is a match, that user is verified.
Verify link is sent to developers after a Glass Lab admin has approved their request for access.

**registerManager**

API no longer in use and now removed.  Manager system role is deprecated.

**getUserDataById**

api/v2/auth/user/:userId

API that allows users with the correct access rights to view information concerning other users.
User permissions to see other user data is checked on each call.  Admin has access to any user's info.
Otherwise, one user can only access another user's info if that other user is in one of the first user's classes.

**updateUserData**

/api/v2/auth/user/:userId

Used to update account information for a user.

**resetPasswordSend**

/api/v2/auth/password-reset/send

If email exists in user table, sends a reset password email to user. If not, sends an alternate email, suggesting registration.
Does not reveal if email actually tied to an account, except by email.

**resetPasswordVerify**

api/v2/auth/password-reset/:code/verify

Email link leads to reset password modal on front end.  Contains reset code parameter.

**resetPasswordUpdate**

/api/v2/auth/password-reset/update

API contains a password parameter and a reset code parameter in the body.  Used by logged in user to reset password.

**requestDeveloperGameAccess**

/api/v2/auth/developer/game/:gameId/request

Developer users can request data/cms access for a particular game.
An email is sent to a Glass Lab admin, who will approve or deny the request.

**approveDeveloperGameAccess**

/api/v2/auth/developer/game/:gameId/request/:code/approve

API that approves a developer's request for game access.  Sent from an admin's email account with a unique code.

**deleteUser**

/api/v2/auth/delete/user

In development.  Not yet finished.  When done, will deletes user information for instructors or students.
Instructors and students have different delete email operations.
