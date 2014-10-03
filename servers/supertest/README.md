SUPERTEST API Testing
=========

##### Scope of testing

These tests, implemented in [Supertest](https://github.com/visionmedia/supertest), will cover the minimum viable featureset required for the normal performance of Playfully.org and MGO.

---

##### Configuration

If you run in the as-is state, the tests are configured to run against `stage.playfully.org`.  To point to localhost or prod, you will need to modify the confugration sections of both `./apiTest.js` and `./lib/routes`.

---

##### How to run

1. Make sure to have the latest version of Platform on your machine (*especially if testing locally*)

2. In the parent directory, run the following command in the terminal:
> `npm install`

3. Then to start the tests, run:
> `grunt test`
