# LMS Service
========

The data service is built to handle the storage and retrieval of game telemetry data.

Directory Structure
========

* LMS Directory
    * Controller
       * course.js
    * lms.const.js
    * lms.datastore.mysql.js
    * lms.js
    * lms.README.md
    * lms.service.js

Controllers
========

All apis are available on the external server, and can be seen in the routes.external.map.js file.

## course.js

**getEnrolledCourses**

/api/v2/lms/courses

Gets all courses that a user is involved with.
If api called for an instructor user, also returns all students enrolled in each class.

**enrollInCourse**

/api/v2/lms/course/enroll

Enrolls a student in a course via the course's code.  Updates the license student seat count if course is premium.
If the course is locked or the license the course is on is full, the student is not enrolled.

**unenrollFromCourse**

/api/v2/lms/course/unenroll

API not currently in use.  Unenrolls a user from a course.  Unenroll-user contains this functionality.

**unenrollUserFromCourse**

/api/v2/lms/course/unenroll-user

Unenrolls a student from a course, based on the courseId.  If course is premium, the license seat count is updated.

**createCourse**

/api/v2/lms/course/create

Creates a course with at least one starting game.  Can only create course with games available on a user's subscription plan.

**getCourse**

/api/v2/lms/course/:courseId/info

Returns meta and game information for a course.  If api called for an instructor user, also returns the student list for the course.

**updateCourseInfo**

/api/v2/lms/course/:courseId/info

API can update a course in various ways. These include change the course name, grade,
archiving/unarchiving the course, locking the course, and enabling/disabling premium games on the course.
Can only enable premium games if the license the course is tied to has enough available student seats.
License student seats are updated whenever a premium class is disabled/enabled.

**updateGamesInCourse**

/api/v2/lms/course/:courseId/games

Updates the games in a course, allowing games to be added or removed.  Only can add games that are available via a user's license.
If the api removes all premium games from a course and the course is marked as enabled, then the course is changed to disabled.
If the api adds a premium game and the course is marked as disabled, then the course and all premium games in the course are enabled, if there are enough open student seats in the license.
The license student seat count is updated when a premium class is enabled or disabled.

**blockPremiumGamesBasicCourses**

/api/v2/lms/course/block/code/:code

Blocks all premium games in all basic courses.  API was called when we launched licensing, but may not need to be called again.

**verifyCode**

/api/v2/lms/course/code/:code/verify

Verifies if a course code is legitimate, and checks to see, if a course is premium, whether the student is eligible to enroll in it.

**verifyGameInCourse**

/api/v2/lms/course/:courseId/game/:gameId/verify-course

Checks whether a game is in a course.  If not, returns an error.

**verifyAccessToGameInCourse**

/api/v2/lms/course/:courseId/game/:gameId/verify-access

Determines if a game is assigned in a course.

**_updateCourseInfo**

Helper method version of the updateCourseInfo api.  Used in the currently incomplete delete user api.

**getGamesCourseMap**

/api/v2/lms/course/games/map

Admin API which describes, for each game in a list of games, all the glass lab courses that contain that game. Used for analytics purposes.
When called, will check these distributions in the environment the api was called in (prod, stage, dev, localhost, etc).
