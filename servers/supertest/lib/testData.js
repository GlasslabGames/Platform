module.exports = {

    stage: {
        // Stem for supertest
        serverAddress: 'http://stage.playfully.org',
        
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
            userId: 6689,
            email: 'build+teach@glasslabgames.org',
            pass:  'glasslab123',
            testClass: {
                id: 363,
                dateCreated: 1408059337,
                // changeables below, not robust test data
                title: "GLTESTCLASS",
                grade: "7, 11",
                code: "ZTLLG"
            }
        },
        student: {}
    },
    
    local: {
        serverAddress: 'http://localhost:8001', // FIXME - port hardcode warning
        classCode: 'PQ7N2',
    },
    
    prod: {
        serverAddress: 'http://playfully.org',
    }
}
