var Routes = function (testData) {
	
	var teacher = testData.teacher;

	this.login = {
		path: "/api/v2/auth/login/glasslab",
		post: {
			"username": teacher.email,
			"password": teacher.pass
		}
	}

	this.events = {
		// number of learning events
		path: "/api/v2/data/eventsCount"
	}

	this.password_reset = {
		path: "/api/v2/auth/password-reset/send/",
		post: {
			"email": teacher.email
		}
	}

	this.classes = {
		info: {
			path: "/api/v2/lms/course/" + teacher.testClass.id + "/info"
		},
		list: {
			path: "/api/v2/lms/courses?showMembers=1"
		},
		create: {
			path: "/api/v2/lms/course/create",
			post: testData.newMGOClass,
		}
	}

	this.reports = {
		achievements: {
			path: "/api/v2/dash/reports/achievements/game/" + testData.testGameId + "/course/" + teacher.testClass.id
		},
		sowo: {
			path: "/api/v2/dash/reports/sowo/game/" + testData.testGameId + "/course/" + teacher.testClass.id
		}
	}

	this.mission = {
		path: "/api/v2/dash/course/" + teacher.testClass.id + "/game/" + testData.testGameId + "/missions"

	}

	this.sdk = {
		connect: {
			path: "/sdk/connect",
			expected: testData.serverAddress
		},
		login: {
			path: "/sdk/login"
		}
	}

	this.logout = {
		path: "/api/v2/auth/logout",
		post: {}
	}
}

module.exports = Routes;
