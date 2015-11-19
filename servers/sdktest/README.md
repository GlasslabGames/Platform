SUPERTEST Game SDK Testing
=========

##### Scope of testing

These tests, implemented in [Supertest](https://github.com/visionmedia/supertest), will cover the game SDK.

---

##### Configuration

If you run in the as-is state, none of configurations (prod.js, stage.js, dev.js and local.js) are actually set-up correctly yet. The configuration for local probably needs to be modifed per develpepr anyway. You set which configurations to test against by modifying the testENVs arrays in sdkTest.js.

---

##### How to run

1. Make sure to have the latest version of Platform on your machine (*especially if testing locally*)

2. In the parent directory, run the following command in the terminal:
> `npm install`

3. Then to start the tests, run:
> `grunt sdktest`
