// How can this be generated on the fly?
// Or rather, how can we record and then use *that* data?

module.exports = {
    
    serverAddress: 'http://localhost:8001', // FIXME - port hardcode warning
	
    // gameId for MGO
    testGameId: 'TEST',

    // Manually generated test user
    teacher: {
        userId: 0000,	// FIXME
        email: 'build+teach@glasslabgames.org',
        pass:  'glasslab123',
        testClass: {
          id:0000,	// FIXME
          title: "",
          grades: "",
          code:""
        }
    },
    student: {
        id: 0000,	// FIXME
        name: 'gltest-01',
        pass:  'glasslab321',
        deviceId: '0000_Windows_MSIE',	// FIXME
        achievements: [
            {"group":"CCSS.ELA-Literacy.WHST.6-8.1","subGroup":"a","item":"Bot Champion","won":true}
            ],
        sowo: {
                watchout: [],
                shoutout: []
        }
    }
}
