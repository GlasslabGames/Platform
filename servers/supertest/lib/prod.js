module.exports = {
    
    serverAddress: 'http://playfully.org',

    // gameId for MGO
    testGameId: 'AA-1',

    // Template for new MGO class
    newMGOClass: {"title":"newClass","grade":"6, 10, 8","games":[{
        "gameId":"AA-1","enabled":true,"shortName":"Mars Generation One", "longName":"Mars Generation One - Argubot Academy",
        "description":"Put your powers of persuasion to the ultimate test, on a whole new planet! Argubot Academy is an adventure game for iOS tablets. Designed for students in grades 6-8, the game develops persuasion and reasoning skills for STEM &amp; 21st century careers.",
        "settings":{},"license":{"type":"free","valid":true},"thumbnail":{"small":"assets/thumb-game-AA-1.png","large":"assets/thumb-game-AA-1.png"},
        "developer":{"id":"GL","name":"GlassLab, Inc.","logo":{"small":"assets/glasslab-logo.png","large":"assets/glasslab-logo-2x.png"}},"id":"AA-1"}]
    },

    // Manually generated test user
    teacher: {
        userId: 6779,
        email: 'build+teacher@glasslabgames.org',
        pass:  'glasslab123',
        testClass: {
            id: 1535,
            title: "glTestClassSTATIC",
            grade: "5, 7, 11",
            code: "GXXGQ"
        }
    },
    student: {
		
				id: 6539,	// FIXME - if cant add to static class
				achievements: [
						
				],
			sowo: {
					watchout: [],
					shoutout: []
				}
		
		}
	
	
}
