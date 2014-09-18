var Routes = function (testData) {
	
	var teacher = testData.teacher;

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
		}
	}
  
  this.register = {
    teacher: {
      path: '/api/v2/auth/user/register'
    },
    student: {
      path: '/api/v2/lms/course/code/:code/verify'
    }
  }

	this.logout = {
		path: "/api/v2/auth/logout",
		post: {}
	}
}

module.exports = Routes;
