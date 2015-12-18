/*

 Copyright (c) 2014, GlassLab, Inc.
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 1. Redistributions of source code must retain the above copyright notice, this
 list of conditions and the following disclaimer.
 2. Redistributions in binary form must reproduce the above copyright notice,
 this list of conditions and the following disclaimer in the documentation
 and/or other materials provided with the distribution.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

 The views and conclusions contained in the software and documentation are those
 of the authors and should not be interpreted as representing official policies,
 either expressed or implied, of the FreeBSD Project.

 */

(function() {

    /*
     * Default SDK constructor.
     */
    function _GlassLabSDK() {
        // HTTP request object for server communication
        this._httpRequest = null;

        // SDK options
        this._options = this._getDefaultOptions();

        // Simple logging
        this._displayLogs = this._getDisplayLogsStore();

        // Output file and text for local telemetry logging
        this._outputFile = null;
        // Output html for live logging via separate window
        this._telemetryOutputTab = null;
        this._outputText = this._getTelemetryOutputStore();

        // Queue for non-on-demand messages
        this._dispatchQueue = [];
        this._dispatchQueueReady = [];
//      this._flushDispatchQueueIntervalHandle = setInterval( _flushDispatchQueue, this._options.dispatchQueueUpdateInterval );

console.log('_GlassLabSDK() ***************************************** line 58 ... ');

        // The following variables will undergo change as functions are performed with the SDK
        this._activeGameSessionId = "";
        this._activePlaySessionId = "";
        this._gameSessionEventOrder = 1;
        this._playSessionEventOrder = 1;
        this._totalTimePlayed = 0;

        // Update function for sending totalTimePlayed at certain intervals
        // Is only activated when getPlayerInfo is successful
        // Deactivated on logout
        this._isAuthenticated = false;
//      this._sendTotalTimePlayedIntervalHandle = setInterval( _sendTotalTimePlayed, this._options.sendTotalTimePlayedInterval );

        // Update function for polling matches at certain intervals
        this._matches = {};
//      this._pollMatchesIntervalHandle = setInterval( _pollMatches, this._options.pollMatchesInterval );

        // xdmessage class from https://github.com/kenhkan/xdmessage
        (function(){
            /*********************************
             Helper Messages
             *********************************/
            function getParameterByName(name) {
                name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
                var regexS = "[\\?&]" + name + "=([^&#]*)";
                var regex = new RegExp(regexS);
                var results = regex.exec(window.location.search);

                if (results === null) {
                    return null;
                } else {
                    return decodeURIComponent(results[1].replace(/\+/g, " "));
                }
            }

            function toParam(paramsObject) {
                var params=[];
                for(var key in paramsObject) {
                    if (paramsObject[key]) {
                        params.push(key + "=" + encodeURIComponent(paramsObject[key]))
                    }
                }
                return params.join('&');
            }

            /*********************************
             XDPost
             *********************************/
            var XDMessage = function(url, options) {
                if (typeof url === 'object') {
                    options = url;
                    url = null;
                }

                this.options        = options || {};
                this.events         = {};
                this.callbacks      = {};
                this.options.width  = this.options.width  || 720;
                this.options.height = this.options.height || 500;

                this.windowHostURL = this.options.windowHostURL || getParameterByName('opener');
                this.token         = this.options.token || getParameterByName('XDMessage_token');
                this.isChildWindow = !url;

                if (!this.isChildWindow) {
                    var opener = document.location.protocol + "//" + document.location.host;
                    this.token = ("" + Math.random()).replace('0.','');
                    this.frameURL     = url + (url.indexOf('?') === -1 ? '?' : '&') + toParam({ opener: opener, XDMessage_token: this.token });

                    this.frameHostURL = url.match(/\S+\/\/([^\/]+)/)[0];
                } else if (!this.windowHostURL) {
                    throw 'opener parameter required';
                }
            };

            XDMessage.prototype.open = function() {
                var self = this;
                this._startListening();

                if (this.frameURL) {
                    var iframe = document.createElement('iframe');
                    iframe.setAttribute('frameborder', '0');
                    iframe.src = this.frameURL;
                    iframe.style.overflow='auto';
                    iframe.style.width = "100%";
                    iframe.style.height = "100%";

                    iframe.onload = this._frameReady;

                    // Assign style
                    for (var key in (this.options.style || [])) {
                        iframe.style[key] = this.options.style[key];
                    }

                    if (this.options.target) {
                        this.options.target.appendChild(iframe);
                    } else {
                        document.body.appendChild(iframe);
                    }

                    this.iframe = iframe;

                } else {
                    this.invoke('_ready', function() {
                        self._ready();
                    });
                    this.on('_close', function(){

                    });
                }
                this.on('_ready', function(data, callback) {
                    callback();
                    self._ready();
                });
            };

            XDMessage.prototype.close = function() {
                if (this.iframe) {
                    this.iframe.parentNode.removeChild(this.iframe);
                }
                delete(this.events);
                delete(this.callbacks);
                this._stopListening();
            };

            XDMessage.prototype.on = function(event, callback) {
                if (typeof event === 'string' && typeof callback === 'function') {
                    this.events[event] = callback;
                }
            };

            XDMessage.prototype.send = function(data, callback, meta) {
                if (typeof callback === 'object') {
                    meta = callback;
                    callback = null;
                }

                var __xd_post_meta = meta || {};
                __xd_post_meta.token = this.token;

                if (callback) {
                    var random = "" + Math.random();
                    this.callbacks[random] = callback;
                    __xd_post_meta.callback = random;
                }

                var message = { __xd_post_meta: __xd_post_meta, body: data };

                this.log("Sending to" + (self.isChildWindow ? " parent " : " frame "));
                this.log(message);

                this._sendMessage(message);
            };

            XDMessage.prototype.invoke = function(method, data, callback, meta) {
                if (typeof data === 'function') {
                    callback = data;
                    data = undefined;
                }
                this.send(data, callback, { method: method });
            };

            /*********************************
             Private Methods
             *********************************/
            XDMessage.prototype._receiveMessage = function(event) {
                var allowedURL = this.isChildWindow ? this.windowHostURL : this.frameHostURL;

                if (event.origin === allowedURL) {
                    var message;

                    try {
                        message = JSON.parse(event.data)
                    } catch (ex) {
                        this.log('message data parsing failed, ignoring');
                    }

                    if (message && typeof message.__xd_post_meta !== 'undefined' && this.token === message.__xd_post_meta.token) {
                        if (typeof message.__xd_post_meta.callback_response === 'string') {
                            var callback = this.callbacks[message.__xd_post_meta.callback_response];
                            callback(message.body);
                            delete(callback);
                        } else {
                            var method;
                            if (message.__xd_post_meta.method) {
                                if (this.events[message.__xd_post_meta.method]) {
                                    method = this.events[message.__xd_post_meta.method]
                                }
                            } else if (this.events.data) {
                                method = this.events.data;
                            }

                            if (method) {
                                if (typeof message.__xd_post_meta.callback === 'string') {
                                    var self = this;
                                    method(message.body, function(data){
                                        self.send(data, { callback_response: message.__xd_post_meta.callback });
                                    });
                                } else {
                                    method(message.body);
                                }
                            }
                        }
                    }
                }
            };

            XDMessage.prototype._sendMessage = function(data) {
                if (this.isChildWindow) {
                    window.parent.postMessage(JSON.stringify(data), this.windowHostURL);
                } else {
                    this.iframe.contentWindow.postMessage(JSON.stringify(data), this.frameHostURL);
                }
            };

            XDMessage.prototype._startListening = function() {
                var self = this;
                self.listener = function(event) {
                    self._receiveMessage(event);
                }

                if (document.addEventListener){
                    window.addEventListener('message',  self.listener, false);
                } else {
                    window.attachEvent('onmessage', self.listener);
                }
            };

            XDMessage.prototype._stopListening = function() {
                if (document.removeEventListener){
                    window.removeEventListener('message', this.listener, false);
                } else {
                    window.detachEvent('onmessage', this.listener);
                }
            };

            XDMessage.prototype._frameReady = function() {
            };

            XDMessage.prototype._ready = function() {
                if (this.events.ready) {
                    this.events.ready();
                    // delete(this.events.ready);
                }
            };

            XDMessage.prototype.log = function(message) {
                if (this.options.verbose && typeof console !== 'undefined' && typeof console.log === 'function') {
                    console.log(message);
                }
            };

            this.XDMessage = XDMessage;


        }).call(this);
    }

    _GlassLabSDK.prototype.getOptions = function() {
        return this._options;
    };

    _GlassLabSDK.prototype.setOptions = function( options ) {
        if( isObject( options ) ) {
            if( options.hasOwnProperty( 'sdkVersion' ) ) {
                this._options.sdkVersion = options.sdkVersion;
            }

            if( options.hasOwnProperty( 'uri' ) ) {
                this._options.uri = options.uri;
            }

            if( options.hasOwnProperty( 'gameId' ) ) {
                this._options.gameId = options.gameId;
            }

            if( options.hasOwnProperty( 'gameVersion' ) ) {
                this._options.gameVersion = options.gameVersion;
            }

            if( options.hasOwnProperty( 'gameSecret' ) ) {
                this._options.gameSecret = options.gameSecret;
            }

            if( options.hasOwnProperty( 'deviceId' ) ) {
                this._options.deviceId = options.deviceId;
            }

            if( options.hasOwnProperty( 'gameLevel' ) ) {
                this._options.gameLevel = options.gameLevel;
            }

            if( options.hasOwnProperty( 'forceHttps' ) ) {
                this._options.forceHttps = options.forceHttps;
            }

            if( options.hasOwnProperty( 'dispatchQueueUpdateInterval' ) ) {
                this._options.dispatchQueueUpdateInterval = options.dispatchQueueUpdateInterval;
                clearInterval(this._flushDispatchQueueIntervalHandle);
//              this._flushDispatchQueueIntervalHandle = setInterval( _flushDispatchQueue, this._options.dispatchQueueUpdateInterval );
            }

            if( options.hasOwnProperty( 'sendTotalTimePlayedInterval' ) ) {
                this._options.sendTotalTimePlayedInterval = options.sendTotalTimePlayedInterval;
                clearInterval(this._sendTotalTimePlayedIntervalHandle);
//              this._sendTotalTimePlayedIntervalHandle = setInterval( _sendTotalTimePlayed, this._options.sendTotalTimePlayedInterval );
            }

            if( options.hasOwnProperty( 'pollMatchesInterval' ) ) {
console.log('pollMatchesInterval() was called ... this.options = ');
console.log( this.options);
console.log('\n\n\n');
                this._options.pollMatchesInterval = options.pollMatchesInterval;
                clearInterval(this._pollMatchesIntervalHandle);
//              this._pollMatchesIntervalHandle = setInterval( _pollMatches, this._options.pollMatchesInterval );
            }

            if( options.hasOwnProperty( 'eventsDetailLevel' ) ) {
                this._options.eventsDetailLevel = options.eventsDetailLevel;
            }

            if( options.hasOwnProperty( 'eventsPeriodSecs' ) ) {
                this._options.eventsPeriodSecs = options.eventsPeriodSecs;
            }

            if( options.hasOwnProperty( 'eventsMinSize' ) ) {
                this._options.eventsMinSize = options.eventsMinSize;
            }

            if( options.hasOwnProperty( 'eventsMaxSize' ) ) {
                this._options.eventsMaxSize = options.eventsMaxSize;
            }

            if( options.hasOwnProperty( 'localLogging' ) ) {
                this._options.localLogging = options.localLogging;
            }
        }
    };

    _GlassLabSDK.prototype._getDefaultOptions = function() {
        return {
            sdkVersion:   "0.4.0",

            uri:          window.location.protocol + "//" + window.location.host,
            gameId:       "TEST",
            gameVersion:  "VERSION_NOT_SET",
            gameSecret:   "SECRET_NOT_SET",
            deviceId:     generateDeviceId( "null" ),
            gameLevel:    "LEVEL_NOT_SET",

            forceHttps:   false,

            dispatchQueueUpdateInterval: 10000, // milliseconds
            sendTotalTimePlayedInterval: 5000,  // milliseconds
            pollMatchesInterval: 10000,         // milliseconds

            eventsDetailLevel: 10,
            eventsPeriodSecs: 30000,
            eventsMinSize: 5,
            eventsMaxSize: 100,

            localLogging: false
        };
    };


    function _pushToDispatchQueue( dispatchObject ) {
        // Status:
        // - ready (can be dispatched)
        // - pending (already dispatched, no response)
        // - failed (dispatch failed)
        // - success (dispatch successful)
        GlassLabSDK._dispatchQueue.push( dispatchObject );// { dispatch: dispatchObject, status: "ready" } );
    }

    function _dispatchNextRequest( status ) {
        // If the queue is empty, ignore
        if( GlassLabSDK._dispatchQueueReady.length == 0 ) {
            return;
        }

        /*// If the current request is pending, ignore
         if( GlassLabSDK._dispatchQueueReady[ 0 ].status == "pending" ) {
         return;
         }

         // If the current request is successful, remove it
         if( status && status == "success" ) {
         GlassLabSDK._dispatchQueueReady.shift();
         }*/

        // Get the next dispatch
        var dispatch = GlassLabSDK._dispatchQueueReady[ 0 ];//.dispatch;

        // Need to operate on gameSessionId for endSession and saveTelemEvent APIs
        if( !GlassLabSDK._options.localLogging ) {
            if( dispatch.apiKey == "endSession" || dispatch.apiKey == "saveTelemEvent" ) {
                // If the gameSessionId doesn't exist, exit the dispatch queue
                // We'll come back to the queue another time when the value exists
                if( GlassLabSDK._activeGameSessionId == "" ) {
                    return;
                }
                // The gameSessionId does exist, so we need to replace all instances of
                // "$gameSessionId$" with this new value
                else {
                    dispatch.data.gameSessionId = GlassLabSDK._activeGameSessionId;
                    dispatch.data.playSessionId = GlassLabSDK._activePlaySessionId;
                }
            }
        }

        // Perform the request
        GlassLabSDK.request( GlassLabSDK._dispatchQueueReady.shift() );
    }

    function _flushDispatchQueue() {
        // Splice the contents of the dispatch queue to the ready queue, then dispatch the next request
        while( GlassLabSDK._dispatchQueue.length > 0 ) {
            GlassLabSDK._dispatchQueueReady.push( GlassLabSDK._dispatchQueue.shift() );
        }

        // Begin the dispatch
        _dispatchNextRequest();
    }

    function _sendTotalTimePlayed() {
        // Only proceed if we're authenticated. We don't want to send requests we
        // know will return invalid.
        if( !GlassLabSDK._isAuthenticated ) {
            return;
        }

        // Update the new totalTimePlayed
        GlassLabSDK._totalTimePlayed += GlassLabSDK._options.sendTotalTimePlayedInterval;

        // Perform the sendTotalTimePlayed request
        GlassLabSDK.sendTotalTimePlayed(
            function( responseData ) {
                // The request was successful
                if( this._displayLogs ) {
                    console.log( "Server received new totalTimePlayed: " + responseData );
                }
            },
            function( responseData ) {
                // The request failed
                if( this._displayLogs ) {
                    console.log( "[REQUEST FAILED]: sendTotalTimePlayed, " + responseData );
                }
            });
    }

    function _pollMatches( status ) {
        // Only proceed if we're authenticated. We don't want to send requests we
        // know will return invalid.
        if( !GlassLabSDK._isAuthenticated ) {
            return;
        }

        // If the status is not set, set it to active by default
        if( status !== "complete" || status !== "all" ) {
            status = "active";
        }

        // Perform the pollMatches request
        GlassLabSDK.pollMatches( status,
            function( responseData ) {
                // Set the matches
                GlassLabSDK._matches = JSON.parse( responseData );

                /*
                 * Match format:
                 * matchId: {
                 *    players: {
                 *      playerId1: {
                 *        playerStatus: "active|complete"
                 *      },
                 *      playerId2: {
                 *        playerStatus: "active|complete"
                 *      },
                 *    },
                 *    status: "active|closed",
                 *    history: [],
                 *    meta: {}
                 * }
                 */

                // The request was successful
                if( this._displayLogs ) {
                    console.log( "Received match data from the server, " + responseData );
                }
            },
            function( responseData ) {
                // The request failed
                if( this._displayLogs ) {
                    console.log( "[REQUEST FAILED]: pollMatches, " + responseData );
                }
            });
    }


    _GlassLabSDK.prototype.connect = function( gameId, uri, success, error ) {
        // Set the game Id
        this.setOptions( { gameId: gameId } );

        // Set the URI if it is valid
        if( uri ) {
            this.setOptions( { uri: uri } );
        }

        // Perform the request
        this.request({
            method: "GET",
            apiKey: "connect",
            api: "/sdk/connect",
            contentType: "application/x-www-form-urlencoded",
            success: function( responseData ) {
                GlassLabSDK.getConfig( responseData, success, error )
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.getConfig = function( uri, success, error ) {
        // Set the URI and replace http with https if required
        if( this._options.forceHttps ) {
            uri = uri.replace(/^http:\/\//i, 'https://');
        }
        this.setOptions( { uri: uri } );

        // Perform the request
        this.request({
            method: "GET",
            apiKey: "getConfig",
            api: "/api/v2/data/config/" + this._options.gameId,
            contentType: "application/x-www-form-urlencoded",
            success: function( responseData ) {
                // Parse the throttle parameters
                var throttleOptions = JSON.parse( responseData );
                GlassLabSDK.setOptions({
                    eventsDetailLevel: throttleOptions.eventsDetailLevel,
                    eventsPeriodSecs: throttleOptions.eventsPeriodSecs,
                    eventsMinSize: throttleOptions.eventsMinSize,
                    eventsMaxSize: throttleOptions.eventsMaxSize
                });

                // Call the user's success callback
                defaultSuccessCallback( success, responseData );

                // Start the play session only if we haven't already
                if( GlassLabSDK._activePlaySessionId == "" ) {
                    GlassLabSDK.startPlaySession();
                }

                // Check to see if we're already authenticated
                GlassLabSDK.getAuthStatus();
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.deviceUpdate = function( success, error ) {
        // Perform the request
        this.request({
            method: "POST",
            apiKey: "deviceUpdate",
            api: "/api/v2/data/game/device",
            contentType: "application/x-www-form-urlencoded",
            data:
            {
                deviceId: this._options.deviceId,
                gameId: this._options.gameId
            },
            success: function( responseData ) {
                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.getAuthStatus = function( success, error ) {
        // Perform the request
        this.request({
            method: "GET",
            apiKey: "getAuthStatus",
            api: "/api/v2/auth/login/status",
            contentType: "application/x-www-form-urlencoded",
            success: function( responseData ) {
                // Get the status and check for success/fail
                var status = JSON.parse( responseData ).status;
                if( status == "ok" ) {
                    // Get player info if we haven't already
                    if( !GlassLabSDK._isAuthenticated ) {
                        GlassLabSDK.getPlayerInfo();
                    }
                }

                // Call the user's success callback
                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                // Make sure the totalTimePlayedUpdate is deactivated
                GlassLabSDK._isAuthenticated = false;

                // Call the user's failure callback
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.getPlayerInfo = function( success, error ) {
        // Perform the request
        this.request({
            method: "GET",
            apiKey: "getPlayerInfo",
            api: "/api/v2/data/game/" + this._options.gameId + "/playInfo",
            contentType: "application/json",
            success: function( responseData ) {
                // Retrieve the total time played for this user
                GlassLabSDK._totalTimePlayed = JSON.parse( responseData ).totalTimePlayed;

                // Indicate we are authenticated
                GlassLabSDK._isAuthenticated = true;

                // Poll the matches now that we're authenticated
                GlassLabSDK.pollMatches();

                // Call the user's success callback
                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                // Reset the total time played
                GlassLabSDK._totalTimePlayed = 0;

                // We are not authenticated
                GlassLabSDK._isAuthenticated = false;

                // Call the user's failure callback
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.getUserInfo = function( success, error ) {
        // Perform the request
        this.request({
            method: "GET",
            apiKey: "getUserInfo",
            api: "/api/v2/auth/user/profile",
            contentType: "application/x-www-form-urlencoded",
            success: function( responseData ) {
                // Retrieve the total time played for this user
                var userId = JSON.parse( responseData ).id;

                // Set the device Id
                GlassLabSDK.setOptions( { deviceId: generateDeviceId( userId ) } );

                // Call the user's success callback
                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                // Call the user's failure callback
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.login = function( username, password, success, error ) {
        if (!username || !password) {
            GlassLabSDK.getUserInfo(success, function() {
                var originalBodyOverflow = document.body.style.overflow;
                var overlay = document.getElementById("gl-sdk-overlay");
                if(!overlay) {
                    console.errorExt("SDK", "overlay not found");
                    return;
                }
                overlay.className = "enabled";
                document.body.style.overflow = "hidden";
                if(this.hostXDM) {
                    this.hostXDM.on("close-iframe", function() {
                        console.log("close-iframe", arguments);

                        var overlay = document.getElementById("gl-sdk-overlay");
                        if(!overlay) {
                            console.errorExt("SDK", "overlay not found");
                            return;
                        }
                        overlay.className = "";
                        document.body.style.overflow = originalBodyOverflow;
                        if(this.hostXDM && this.hostXDM.iframe) {
                            var iframe = this.hostXDM.iframe;
                            iframe.src = this.hostXDM.frameURL;
                        }
                        setTimeout(function() {
                            GlassLabSDK.getUserInfo(success, error)
                        }, 1000);
                    }.bind(this));
                }
            }.bind(this));
            return;
        }

        // Add the request to the queue
        this.request({
            method: "POST",
            apiKey: "login",
            api: "/api/v2/auth/login/glasslab",
            contentType: "application/json",
            data:
            {
                username: username,
                password: password
            },
            success: function( responseData ) {
                // Get player info if we haven't already
                if( !GlassLabSDK._isAuthenticated ) {
                    GlassLabSDK.getPlayerInfo();
                }

                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.logout = function( success, error ) {
        // Add the request to the queue
        this.request({
            method: "POST",
            apiKey: "logout",
            api: "/api/v2/auth/logout",
            contentType: "application/x-www-form-urlencoded",
            success: function( responseData ) {
                // TODO

                // Deactivate the totalTimePlayedUpdate
                GlassLabSDK._isAuthenticated = false;

                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };











    // can't use "/api/v2/auth/user/test0824esi" because it thinks test0824esi is a userId ...
    //
    // api: "/api/v2/auth/user/:userId",
    //
    //     {
    //         requireAuth: true,
    //         api: "/api/v2/auth/user/test0824esi",
    //         service: "auth",
    //         controller: "user",
    //         method: {
    //             post: "eraseStudentInfo"
    //         }
    //     },
    //
    //
    // {
    //     api: "/api/v2/zzzz/test0824esi",
    //     service: "auth",
    //     controller: "user",
    //     method: {
    //         post: "eraseStudentInfo"
    //     }
    // },
    //
    // API Route - /api/v2/zzzz/test0824esi -> ctrl: user , method: post , func: eraseStudentInfo
    //
    _GlassLabSDK.prototype.EraseStudentInfo = function( params, success, error ) {

        var params2 = {
            sak: "whoisit",
            blah: "blah"
        };

console.log('params', params);

        if(params && params.id){
            // console.log('xxxxxx', params.id);
            params2.userId = params.id;
        }else{
            // console.log(' xx fail xx');
            console.log('EraseStudentInfo() requires the userId of the student whose info is to be erased.');
            defaultErrorCallback( error, "boo hoo" );
            return;
        }

        // Add the request to the queue
        this.request({

            method: "POST",
            apiKey: "eraseStudentInfo",
            api: "/api/v2/zzzz/test0824esi",

            contentType: "application/json",
            data: params2,

            success: function( responseData ) {
                // Call the user's success callback
                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    //    {
    //        api: "/api/v2/zzzz/test0828eti",
    //        service: "auth",
    //        controller: "user",
    //        method: {
    //            post: "eraseInstructorInfo"
    //        }
    //    },

    _GlassLabSDK.prototype.EraseInstructorInfo = function( params, success, error ) {

        var params2 = {
        }
                              
        console.log('params', params);

        if(params && params.id){
            params2.userId = params.id;
        } else {
            console.log('EraseStudentInfo() requires the userId of the instructor whose info is to be erased.');
            defaultErrorCallback( error, "boo hoo" );
            return;
        }

        // Add the request to the queue
        this.request({
                   
           method: "POST",
           apiKey: "eraseInstructorInfo",
           api: "/api/v2/zzzz/test0828eti",
           
           contentType: "application/json",
           data: params2,
           
           success: function( responseData ) {
               // Call the user's success callback
               defaultSuccessCallback( success, responseData );
           },
           error: function( responseData ) {
               defaultErrorCallback( error, responseData );
           }
        });
    };



    // Auth API Route - /api/v2/lms/course/enroll -> ctrl: course , method: post , func: enrollInCourse
    //
    _GlassLabSDK.prototype.enroll = function( courseCode, success, error ) {
        // Add the request to the queue
        this.request({
            method: "POST",
            apiKey: "enroll",
            api: "/api/v2/lms/course/enroll",
            contentType: "application/json",
            data: { courseCode: courseCode },
            success: function( responseData ) {
                // TODO

                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    /* Not implemented.
     _GlassLabSDK.prototype.unenroll = function( courseId, success, error ) {
     // Add the request to the queue
     this.request({
     method: "POST",
     apiKey: "unenroll",
     api: "/api/v2/lms/course/unenroll",
     contentType: "application/json",
     data: { courseId: courseId },
     success: function( responseData ) {
     // TODO

     defaultSuccessCallback( success, responseData );
     },
     error: function( responseData ) {
     defaultErrorCallback( error, responseData );
     }
     });
     };
     */

    _GlassLabSDK.prototype.getCourses = function( showMembers, success, error ) {
        // Perform the request
        this.request({
            method: "GET",
            apiKey: "getCourses",
            api: "/api/v2/lms/courses?showMembers=" + showMembers + "&game=" + this._options.gameId,
            contentType: "application/json",
            success: function( responseData ) {
                // Call the user's success callback
                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.getCourse = function( courseId, showMembers, success, error ) {
        // Perform the request
        this.request({
            method: "GET",
            apiKey: "getCourse",
            api: "/api/v2/lms/course/" + courseId + "/info?showMembers=" + showMembers + "&game=" + this._options.gameId,
            contentType: "application/json",
            success: function( responseData ) {
                // Call the user's success callback
                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.startPlaySession = function() {
        // Perform the request
        this.request({
            method: "GET",
            apiKey: "startPlaySession",
            api: "/api/v2/data/playSession/start",
            contentType: "application/x-www-form-urlencoded",
            success: function( responseData ) {
                GlassLabSDK._activePlaySessionId = JSON.parse( responseData ).playSessionId;
                GlassLabSDK._playSessionEventOrder = 1;
            },
            error: function( responseData ) {
                console.log( "There was an error calling /api/v2/data/playSession/start: " + responseData );
            }
        });
    };

    _GlassLabSDK.prototype.startSession = function( success, error ) {
        // Reset the gameSessionEventOrder
        this._gameSessionEventOrder = 1;

        // Add the request to the queue
        _pushToDispatchQueue({
            method: "POST",
            apiKey: "startSession",
            api: "/api/v2/data/session/start",
            contentType: "application/json",
            data:
            {
                gameId: this._options.gameId,
                deviceId: this._options.deviceId,
                gameLevel: this._options.gameLevel,
                timestamp: +new Date()
            },
            success: function( responseData ) {
                GlassLabSDK._activeGameSessionId = JSON.parse( responseData ).gameSessionId;
                defaultSuccessCallback( success, responseData );

                // Send the next item in the message queue
                _dispatchNextRequest();
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });

        // Add the Game_start_unit_of_analysis telemetry event
        this.saveTelemEvent( "Game_start_unit_of_analysis", {} );
    };

    _GlassLabSDK.prototype.endSession = function( success, error ) {
        // Add the Game_end_unit_of_analysis telemetry event
        this.saveTelemEvent( "Game_end_unit_of_analysis", {} );

        // Add the request to the queue
        _pushToDispatchQueue({
            method: "POST",
            apiKey: "endSession",
            api: "/api/v2/data/session/end",
            contentType: "application/json",
            data:
            {
                gameSessionId: "$gameSessionId$",
                timestamp: +new Date()
            },
            success: function( responseData ) {
                // Reset the gameSessionId
                GlassLabSDK._activeGameSessionId = "";

                // Call the user's success callback
                defaultSuccessCallback( success, responseData );

                // Send the next item in the message queue
                _dispatchNextRequest();
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.endSessionAndFlush = function( success, error ) {
        // Add the Game_end_unit_of_analysis telemetry event
        this.saveTelemEvent( "Game_end_unit_of_analysis", {} );

        // Add the request to the queue
        _pushToDispatchQueue({
            method: "POST",
            apiKey: "endSession",
            api: "/api/v2/data/session/end",
            contentType: "application/json",
            data:
            {
                gameSessionId: "$gameSessionId$",
                timestamp: +new Date()
            },
            success: function( responseData ) {
                // Reset the gameSessionId
                GlassLabSDK._activeGameSessionId = "";

                // Call the user's success callback
                defaultSuccessCallback( success, responseData );

                // Send the next item in the message queue
                _dispatchNextRequest();
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });

        // Flush the queue
        _flushDispatchQueue();
    };

    _GlassLabSDK.prototype.saveTelemEvent = function( name, data, success, error ) {
        // Add the request to the queue
        _pushToDispatchQueue({
            method: "POST",
            apiKey: "saveTelemEvent",
            api: "/api/v2/data/events",
            contentType: "application/json",
            data:
            {
                clientTimeStamp: +new Date(),
                gameId: this._options.gameId,
                gameVersion: this._options.gameVersion,
                deviceId: this._options.deviceId,
                gameLevel: this._options.gameLevel,
                gameSessionId: "$gameSessionId$",
                playSessionId: "$playSessionId$",
                gameSessionEventOrder: this._gameSessionEventOrder++,
                playSessionEventOrder: this._playSessionEventOrder++,
                totalTimePlayed: this._totalTimePlayed,
                eventName: name,
                eventData: data
            },
            success: function( responseData ) {
                defaultSuccessCallback( success, responseData );

                // Send the next item in the message queue
                _dispatchNextRequest();
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.sendTotalTimePlayed = function( success, error ) {
        // Perform the request
        _pushToDispatchQueue({
            method: "POST",
            apiKey: "sendTotalTimePlayed",
            api: "/api/v2/data/game/" + this._options.gameId + "/totalTimePlayed",
            contentType: "application/json",
            data: { setTime: this._totalTimePlayed },
            success: function( responseData ) {
                defaultSuccessCallback( success, responseData );

                // Send the next item in the message queue
                _dispatchNextRequest();
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.getAchievements = function( success, error ) {
        // Perform the request
        this.request({
            method: "GET",
            apiKey: "getAchievements",
            api: "/api/v2/dash/game/" + this._options.gameId + "/achievements/user",
            contentType: "application/json",
            success: function( responseData ) {
                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.saveAchievement = function( item, group, subGroup, success, error ) {
        // Save this achievement as a telemetry event also
        this.saveTelemEvent( "Achievement", { item: item, group: group, subGroup: subGroup }, function( responseData ) {}, function( responseData ) {} );

        // Perform the request
        _pushToDispatchQueue({
            method: "POST",
            apiKey: "saveAchievement",
            api: "/api/v2/data/game/" + this._options.gameId + "/achievement",
            contentType: "application/json",
            data: { item: item, group: group, subGroup: subGroup },
            success: function( responseData ) {
                defaultSuccessCallback( success, responseData );

                // Send the next item in the message queue
                _dispatchNextRequest();
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.getSaveGame = function( success, error ) {
        // Perform the request
        this.request({
            method: "GET",
            apiKey: "getSaveGame",
            api: "/api/v2/data/game/" + this._options.gameId,
            contentType: "application/x-www-form-urlencoded",
            success: function( responseData ) {
                // Call the user's success callback
                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.getSaveGameForUser = function( success, error, userId ) {
        // Perform the request
        this.request({
            method: "GET",
            apiKey: "getSaveGameForUser",
            api: "/api/v2/data/game/" + this._options.gameId + "/user/" + userId,
            contentType: "application/x-www-form-urlencoded",
            success: function( responseData ) {
                // Call the user's success callback
                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.postSaveGame = function( data, success, error ) {
        // Perform the request
        _pushToDispatchQueue({
            method: "POST",
            apiKey: "postSaveGame",
            api: "/api/v2/data/game/" + this._options.gameId,
            contentType: "application/json",
            data: data,
            success: function( responseData ) {
                // Call the user's success callback
                defaultSuccessCallback( success, responseData );

                // Send the next item in the message queue
                _dispatchNextRequest();
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.postSaveGameBinary = function( binary, success, error ) {
        // Perform the request
        _pushToDispatchQueue({
            method: "POST",
            apiKey: "postSaveGame",
            api: "/api/v2/data/game/" + this._options.gameId,
            contentType: "application/json",
            data: binary,
            success: function( responseData ) {
                // Call the user's success callback
                defaultSuccessCallback( success, responseData );

                // Send the next item in the message queue
                _dispatchNextRequest();
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.createMatch = function( opponentId, success, error ) {
        // Perform the request
        this.request({
            method: "POST",
            apiKey: "createMatch",
            api: "/api/v2/data/game/" + this._options.gameId + "/create",
            contentType: "application/json",
            data: {
                invitedUsers: [opponentId]
            },
            success: function( responseData ) {
                // Get the match
                var match = JSON.parse( responseData );
                GlassLabSDK._matches[ match.id ] = match.data;

                // Call the user's success callback
                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.getMatch = function( matchId, success, error ) {
        // Perform the request
        this.request({
            method: "GET",
            apiKey: "getMatch",
            api: "/api/v2/data/game/" + this._options.gameId + "/match/" + matchId,
            contentType: "application/json",
            success: function( responseData ) {
                // Get the match
                var match = JSON.parse( responseData );
                console.log( "getMatch..." );
                console.log( match );
                GlassLabSDK._matches[ match.id ] = match.data;

                // Call the user's success callback
                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.updateMatch = function( matchId, data, nextPlayerTurn, success, error ) {
        // Perform the request
        this.request({
            method: "POST",
            apiKey: "updateMatch",
            api: "/api/v2/data/game/" + this._options.gameId + "/submit",
            contentType: "application/json",
            data: {
                matchId: matchId,
                turnData: data,
                nextPlayer: nextPlayerTurn
            },
            success: function( responseData ) {
                // Call the user's success callback
                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.pollMatches = function( status, success, error ) {
        // If the status was not passed in, default to "all"
        if( !status ) {
            status = "active";
        }

        // Perform the request
        this.request({
            method: "GET",
            apiKey: "pollMatches",
            api: "/api/v2/data/game/" + this._options.gameId + "/matches?status=" + status,
            contentType: "application/x-www-form-urlencoded",
            success: function( responseData ) {
                // Call the user's success callback
                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };

    _GlassLabSDK.prototype.completeMatch = function ( matchId, success, error ) {
        this.request({
            method: "POST",
            apiKey: "completeMatch",
            api: "/api/v2/data/game/" + this._options.gameId + "/complete",
            contentType: "application/json",
            data: {
                matchId: matchId
            },
            success: function( responseData ) {
                // Call the user's success callback
                defaultSuccessCallback( success, responseData );
            },
            error: function( responseData ) {
                defaultErrorCallback( error, responseData );
            }
        });
    };


    _GlassLabSDK.prototype.request = function( params ) {
        // If the user is logging data locally, no need to perform the request
        if( this._options.localLogging ) {
            // Only print telemetry
            if( params.apiKey == "saveTelemEvent" ) {
                // Store the data output locally
                var output = params.data.clientTimeStamp + "\t";
                output += params.data.gameSessionEventOrder + "\t";
                output += params.data.eventName + ": ";
                output += JSON.stringify( params.data.eventData );

                // Keep a record of all logs
                this._outputText += "<p>" + output + "</p>";
                this._updateTelemetryOutputStore();

                // If the telemetry tab is already open, simply append to it
                if( this._telemetryOutputTab != null ) {
                    this._telemetryOutputTab.document.write( "<p>" + output + "</p>" );
                }

                // Trigger the success callback
                params.success( "" );
            }
            // Trigger success callbacks for start session and end session
            else if( params.apiKey == "startSession" ) {
                params.success( "{ \"gameSessionId\": \"\" }" );
            }
            else if( params.apiKey == "endSession" ) {
                params.success( "" );
            }
            return;
        }

        if( window.location.href.indexOf(this._options.uri) === -1 ) {

            console.log( "GlassLabSDK CORS check fail",window.location.href,this._options.uri );

            var XDMReq = function() {
                this.hostXDM.invoke('api', params, function(responseData) {
                    if(responseData.hasOwnProperty("success")) {
                        params.success(responseData.success);
                    }
                    if(responseData.hasOwnProperty("error")) {
                        params.error(responseData.error);
                    }

                }.bind(this));
            }.bind(this);

            if (!this.hostXDM) {
                try {
                    var tmpDiv = document.createElement("div");
                    tmpDiv.innerHTML = '\
                <style>\
                #gl-sdk-overlay {\
                    position:fixed; top:0; left:-100000px; width:100%; height:100%;\
                    background:rgba(0,0,0,.5); z-index: 1010;\
                }\
                #gl-sdk-overlay.enabled { left: 0; }\
                #gl-sdk-overlay-content {\
                    position:absolute; top:10%; left:50%; margin-left:-400px; width:800px; height:500px;\
                    border-radius:6px; border: 1px solid rgba(0,0,0,.2); box-shadow: 0 3px 9px rgba(0,0,0,.5);\
                    overflow:hidden;\
                }\
                </style>\
                <div id="gl-sdk-overlay">\
                    <div id="gl-sdk-overlay-content"/>\
                </div>\
                ';
                    while(tmpDiv.firstElementChild) {
                        document.body.appendChild(tmpDiv.firstElementChild);
                    }
                    var url = this._options.uri+"/sdk/v2/game/"+this._options.gameId+"/login";
                    var options = {target: document.getElementById("gl-sdk-overlay-content"), id: "gl-sdk-overly-iframe"};

                    this.hostXDM = new this.XDMessage(url, options);
                    this.hostXDM.on("ready", function() {
                        this.hostXDM.on("ready", function() {});
                        XDMReq();
                    }.bind(this));
                    this.hostXDM.open();
                } catch(err) {

                }
            } else {
                XDMReq();
            }

            return;
        }

        // Display logs if enabled
        if( this._displayLogs ) {
            console.log( "GlassLabSDK request - params: ", params );
            console.log( "GlassLabSDK URI: ", this._options.uri );
        }

        // Create the XML http request for the SDK call
        this._httpRequest = new XMLHttpRequest();

        // Account for old versions of the SDK lib
        // Existing Flash SDK wrapper uses "api" and "key"
        if( params.api !== undefined && params.key !== undefined ) {
            this._httpRequest.withFlash = true;
        }
        else {
            this._httpRequest.withFlash = false;
        }

        /*
         * Set the object parameters and open the request
         * params example: { method: "GET", api: "/api/v2/data/events", contentType: "application/json", data: {} }
         * Last parameter in the open function is async: true (asynchronous) or false (synchronous)
         */
        if( this._httpRequest.withFlash ) {
            this._httpRequest.apiKey = params.key;
            this._httpRequest.open( params.method, params.api, true );
            this._httpRequest.setRequestHeader( "Content-type", params.contentType );
        }
        else {
            this._httpRequest.apiKey = params.apiKey;
            this._httpRequest.success = params.success;
            this._httpRequest.error = params.error;
            this._httpRequest.open( params.method, this._options.uri + params.api, true );
            this._httpRequest.setRequestHeader( "Content-type", params.contentType );
            this._httpRequest.setRequestHeader( "Accept", "*/*" );
            this._httpRequest.withCredentials = true;
            //this._httpRequest.setRequestHeader( "Game-Secret", this._options.gameSecret );
        }

        /*
         * Set the request callback: holds the status of the XMLHttpRequest (changes from 0 to 4)
         * 0: request not initialized
         * 1: server connection established
         * 2: request received
         * 3: processing request
         * 4: request finished and response is ready (SDK response occurs)
         */
        var _this = this;
        this._httpRequest.onreadystatechange = function() {
            _this.response( this );
        };

        // Make the request
        if( this._httpRequest.withFlash ) {
            this._httpRequest.send( params.data );
        }
        else {
console.log('_httpRequest.send()...');
            this._httpRequest.send( JSON.stringify( params.data ) );
        }
    }

    _GlassLabSDK.prototype.response = function( httpRequest ) {
        // Check for completed requests
        if( httpRequest.readyState === 4 ) {

            // Display logs if enabled
            if( this._displayLogs ) {
                console.log( "GlassLabSDK response code: " + httpRequest.status + ", apiKey: ", httpRequest.apiKey, ", responseText: ", httpRequest.responseText );
            }

            // OK status, send the success callback
            if( httpRequest.status === 200 || httpRequest.status == 204 || httpRequest.status === 304 ) {
                // Flash return
                if( httpRequest.withFlash ) {
                    document.getElementsByName( "flashObj" )[0].success( httpRequest.apiKey, httpRequest.responseText );
                }
                else {
                    httpRequest.success( httpRequest.responseText );
                }
            }
            // All other status codes will return a failure callback
            else {
                // Flash return
                if( httpRequest.withFlash ) {
                    document.getElementsByName( "flashObj" )[0].failure( httpRequest.apiKey, httpRequest.responseText );
                }
                else {
                    httpRequest.error( httpRequest.responseText );
                }
            }
        }
    };

    function defaultSuccessCallback( callback, data ) {
        if( callback && isFunction(callback)) {
            callback(data);
        }
        else if( GlassLabSDK._displayLogs ) {
            console.log( "[GlassLab SDK] default success callback: " + data );
        }
    }

    function defaultErrorCallback( callback, data ) {
        if( callback && isFunction(callback)) {
            callback(data);
        }
        else if( GlassLabSDK._displayLogs ) {
            console.log( "[GlassLab SDK] default error callback: " + data );
        }
    }


    _GlassLabSDK.prototype.displayLogs = function() {
        this._displayLogs = true;
        this._updateDisplayLogsStore();
    };

    _GlassLabSDK.prototype.hideLogs = function() {
        this._displayLogs = false;
        this._updateDisplayLogsStore();
    };

    _GlassLabSDK.prototype._updateDisplayLogsStore = function() {
        if( typeof( Storage ) !== "undefined" ) {
            localStorage.setItem( "glsdk_displayLogs", this._displayLogs ? 1 : 0 );
        }
    };

    _GlassLabSDK.prototype._getDisplayLogsStore = function() {
        var display = false;
        if( typeof( Storage ) !== "undefined" ) {
            if( localStorage.getItem( "glsdk_displayLogs" ) ) {
                display = parseInt( localStorage.getItem( "glsdk_displayLogs" ) );
                if( isNaN( display ) ) {
                    display = false;
                }
            }
        }
        return display;
    };

    _GlassLabSDK.prototype._updateTelemetryOutputStore = function() {
        if( typeof( Storage ) !== "undefined" ) {
            localStorage.setItem( "glsdk_telemetry", this._outputText );
        }
    };

    _GlassLabSDK.prototype._getTelemetryOutputStore = function() {
        var telemetry = "";
        if( typeof( Storage ) !== "undefined" ) {
            if( localStorage.getItem( "glsdk_telemetry" ) ) {
                telemetry = localStorage.getItem( "glsdk_telemetry" );
            }
        }
        return telemetry;
    };

    _GlassLabSDK.prototype.resetTelemetryOutputStore = function() {
        this._outputText = "";
        this._updateTelemetryOutputStore();
        this._telemetryOutputTab = null;
    }

    _GlassLabSDK.prototype.spawnTelemetryOutputTab = function() {
        // Only proceed if the user is locally logging data
        if( this._options.localLogging ) {
            // Spawn a separate window to intercept telemetry logs
            // Need to check if we already have it open
            if( !this._telemetryOutputTab ) {
                this._telemetryOutputTab = window.open();

                // Write existing telemetry output to this tab
                this._telemetryOutputTab.document.write( this._outputText);
            }
        }
    }

    _GlassLabSDK.prototype.generateOutputFile = function() {
        // Only proceed if the user is locally logging data
        if( this._options.localLogging ) {
            this.spawnTelemetryOutputTab();
            // Create the blob data with the html output (paragraph tags removed)
            var blobOutput = this._outputText.replace( /<p>/g, "" );
            blobOutput = blobOutput.replace( /<\/p>/g, "\n" );
            var data = new Blob( [blobOutput], { type: "text/plain" } );

            // If we are replacing a previously generated file we need to manually
            // revoke the object URL to avoid memory leaks (taken from fiddle example)
            if( this._outputFile ) {
                window.URL.revokeObjectURL( this._outputFile );
            }

            // Set the output file and return it
            this._outputFile = window.URL.createObjectURL( data );
            return this._outputFile;
        }
    };


    _GlassLabSDK.prototype.getMatches = function() {
        return this._matches;
    };

    _GlassLabSDK.prototype.getMatchIds = function() {
        // Get the match Ids using the keys in the _matches blob
        var matchIds = [];
        for( var key in this._matches ) {
            matchIds.push( parseInt( key ) );
        }

        // Return the match Ids
        return matchIds;
    };

    _GlassLabSDK.prototype.getMatchForId = function( matchId ) {
        // Only proceed if we're authenticated.
        if( !this._isAuthenticated ) {
            return;
        }

        // Return an error message if the match doesn't exist
        if( !this._matches.hasOwnProperty( matchId ) ) {
            return { error: "match does not exist" };
        }
        // Return the match
        else {
            return this._matches[ matchId ];
        }
    };


    function generateDeviceId( user ) {
        // OS detect
        var os = "";
        if( navigator.userAgent.indexOf( 'Android' ) > -1 )
            os = "Android";
        else if( navigator.userAgent.indexOf( 'iPhone' ) > -1 || navigator.userAgent.indexOf( 'iPad' ) > -1 )
            os = "iOS";
        else if( navigator.userAgent.indexOf( 'OS X' ) > -1)
            os = "OSX";
        else if( navigator.userAgent.indexOf( 'Windows' ) > -1)
            os = "Windows";
        else if( navigator.userAgent.indexOf( 'Linux' ) > -1)
            os = "Linux";

        // Browser detect
        var browser = "";
        if( navigator.userAgent.indexOf( 'CrMo' ) > -1 || navigator.userAgent.indexOf( 'Chrome' ) > -1 )
            browser = "Chrome";
        else if( navigator.userAgent.indexOf( 'Firefox' ) > -1 )
            browser = "Firefox";
        else if( navigator.userAgent.indexOf( 'Safari' ) > -1 )
            browser = "Safari";
        else if( navigator.userAgent.indexOf( 'MSIE ' ) > -1 )
            browser = "IE";

        // Return the Id
        return user + "_" + os + "_" + browser;
    }


    function isObject(obj) {
        return ( Object.prototype.toString.call( obj )  === '[object Object]' );
    }

    function isFunction(func)  {
        return ( func && Object.prototype.toString.call(func) === '[object Function]' );
    }

    // Make the SDK global
    window.GlassLabSDK = new _GlassLabSDK();
})();
