var servers = {
	local: 'http://localhost:8001',	// FIXME - port hardcode warning
	stage: "http://stage.playfully.org",
	prod: "http://playfully.org"
}

module.exports = {
	
	// e2e global server config
	serverAddress: servers.stage,

	user: {
		teacher: "build+teach@glasslabgames.org",
		student: "gl-test01"
	},
	classCode: {
		localhost: 'PQ7N2',
		stage: 'RJXYL'
	},
	classes: {
		localhost: [
			'AA-1',
			'SCE'
		],
		stage: [
			'AA-1',
			'SCE'
		]
	},
	pass: {
		teacher: "glasslab123",
		student: "glasslab321",
	}
	
}
