// FUTURE shortcut everything past "path," not needed

var Routes = function () {
	
	this.login = {
		path: "/api/v2/auth/login/glasslab"
	}

	this.events = {
		// number of learning events
		path: "/api/v2/data/eventsCount"
	}

	this.password_reset = {
		path: "/api/v2/auth/password-reset/send/"
	}

	this.classes = {
		info: {
			path: "/api/v2/lms/course/:courseId/info"
		},
		list: {
			path: "/api/v2/lms/courses?showMembers=1"
		},
		create: {
			path: "/api/v2/lms/course/create"
		}
	}

	this.reports = {
		achievements: {
			path: "/api/v2/dash/reports/achievements/game/:gameId/course/:courseId"
		},
		sowo: {
			path: "/api/v2/dash/reports/sowo/game/:gameId/course/:courseId"
		}
	}

	this.mission = {
		path: "/api/v2/dash/game/:gameId/missions"
	}

	this.sdk = {
		connect: {
			path: "/sdk/connect"
		},
		login: {
			path: "/sdk/login"
		},
        config: {
            path: "/api/config"
        },
        playInfo: {
            path: "/api/v2/data/game/:gameId/playInfo"
        },
        startSession: {
            path: "/api/v2/data/session/start"
        },
        endSession: {
            path: "/api/v2/data/session/end"
        },
        startPlaySession: {
            path: "/api/v2/data/playSession/start"
        },
        saveTelemEvent: {
            path: "/api/v2/data/events"
        },
        saveGame: {
            path: "/api/v2/data/game/:gameId"
        },
        saveAchievement: {
            path: "/api/v2/data/game/:gameId/achievement"
        }
	}
  
    this.user = {
        authStatus: {
            path: "/api/v2/auth/login/status"
        },
        info: {
            path: "/api/v2/auth/user/profile"
        }
    }
    
    this.register = {
        teacher: {
            path: "/api/v2/auth/user/register"
        },
        student: {
            path: "/api/v2/lms/course/code/:code/verify"
        }
    }

	this.logout = {
		path: "/api/v2/auth/logout"
	}
  
  this.verifyEmail = {
    path: "/api/v2/auth/register-verify/:code/verify"
  }
}

module.exports = Routes;
