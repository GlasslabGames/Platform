module.exports = {
    
    // Stem for supertest
    serverAddress: 'http://stage.playfully.org',

    // gameId for MGO
    testGameId: 'AA-1',

    // Template for new class
    newMGOClass: {"title":"newClass","grade":"6, 10, 8","games":[{"id":"AA-1"}]},

    // Manually generated test user
    teacher: {
        userId: 6689,
        email: 'build+teach@glasslabgames.org',
        pass:  'glasslab123',
        testClass: {
            id: 399,
            title: "STATIC_CLASSY",
            grade: "8, 11, 12",
            code: "759SS"
        }
    },
    student: {
		
			id: 6963,
			achievements: [{group: 'CCSS.ELA-Literacy.WHST.6-8.1', subGroup: 'a', item: 'Bot Champion', won: true},
										 {group: 'CCSS.ELA-Literacy.WHST.6-8.1', subGroup: 'a', item: 'Evidence Cadet', won: true},
										 {group: 'CCSS.ELA-Literacy.WHST.6-8.1', subGroup: 'b', item: 'Bot Defender', won: false},
										 {group: 'CCSS.ELA-Literacy.WHST.6-8.1',	subGroup: 'b', item: 'Core Champion', won: true},
										 {group: 'CCSS.ELA-Literacy.WHST.6-8.1',	subGroup: 'b', item: 'Core Cadet', won: false},
										 {group: '21st.Century.Skills', subGroup: 'a', item: 'Deliberate', won: true},
										 {group: '21st.Century.Skills', subGroup: 'a', item: 'Bold', won: true},
										 {group: '21st.Century.Skills', subGroup: 'a', item: 'Persistent', won: true},
										 {group: '21st.Century.Skills', subGroup: 'b', item: 'Curious', won: false},
										 {group: '21st.Century.Skills', subGroup: 'b', item: 'Empathetic', won: false}],
			sowo: {
					watchout: [{
						total: 2,
						overPercent: 0.5,
						timestamp: 1409689452919,
						id: 'wo3',
						name: 'Straggler',
						description: 'Struggling with identifying strengths and weaknesses of claim-data pairs.'
					}],
					shoutout: [{
						total: 3,
						overPercent: 0.3333333333333333,
						timestamp: 1409691323298,
						id: 'so1',
						name: 'Nailed It!',
						description: 'Outstanding performance at identifying weaknesses of claim-data pairs.'
					}]
			
			}
		
		}
}
