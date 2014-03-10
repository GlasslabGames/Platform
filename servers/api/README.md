GLASSLAB API Documentation README

------------------

RUNNING API SERVER

1. >$ npm install
2. >$ redis-server

    (--THEN--)

# Windows users: #
3. >$ npm run-script startwin

    (--OR--)

# Mac OSX and *nix users: #
3. >$ npm start () (Windows)

    (--THEN--)

4. Point your browser to: localhost:3000


------------------------

DOCUMENTATION GENERATION

API Documentation is generated from the "glasslab.json" file located in "./public/data/".  It needs to be encoded without a BOM, the most successful encoding seemed to be
For more information on creating this JSON from Sublime Text 2 on Windows was "Western (Windows 1252)", though it may be better to use UTF-16 LE in the future.