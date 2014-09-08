module.exports = {
    
    serverAddress: 'http://www.playfully.org',		// NOTE - for now...

    // gameId for MGO
    testGameId: 'AA-1',

    // Template for new MGO class
    newMGOClass: {"title":"newClass","grade":"6, 11, 8","games":[{
        "gameId":"AA-1","enabled":true,"shortName":"Mars Generation One", "longName":"Mars Generation One - Argubot Academy",
        "description":"Put your powers of persuasion to the ultimate test, on a whole new planet! Argubot Academy is an adventure game for iOS tablets. Designed for students in grades 6-8, the game develops persuasion and reasoning skills for STEM &amp; 21st century careers.",
        "settings":{},"license":{"type":"free","valid":true},"thumbnail":{"small":"assets/thumb-game-AA-1.png","large":"assets/thumb-game-AA-1.png"},
        "developer":{"id":"GL","name":"GlassLab, Inc.","logo":{"small":"assets/glasslab-logo.png","large":"assets/glasslab-logo-2x.png"}},"id":"AA-1"}]
    },

    // Manually generated test user
    teacher: {
        userId: 6815,
        email: 'build+teacher@glasslabgames.org',
        pass:  'glasslab123',
        testClass: {
            id: 1574,
            title: "glTestClassSTATIC",
            grade: "5, 7, 11",
            code: "GXXGQ"
        }
    },
    student: {
		
//			id: 6539,
//			achievements: [{"group":"CCSS.ELA-Literacy.WHST.6-8.1","subGroup":"a","item":"Bot Champion","won":true},
//										 {"group":"CCSS.ELA-Literacy.WHST.6-8.1","subGroup":"a","item":"Evidence Cadet","won":true},
//										 {"group":"CCSS.ELA-Literacy.WHST.6-8.1","subGroup":"b","item":"Bot Defender","won":false},
//										 {"group":"CCSS.ELA-Literacy.WHST.6-8.1","subGroup":"b","item":"Core Champion","won":true},
//										 {"group":"CCSS.ELA-Literacy.WHST.6-8.1","subGroup":"b","item":"Core Cadet","won":false},
//										 {"group":"21st.Century.Skills","subGroup":"a","item":"Deliberate","won":true},
//										 {"group":"21st.Century.Skills","subGroup":"a","item":"Bold","won":true},
//										 {"group":"21st.Century.Skills","subGroup":"a","item":"Persistent","won":false},
//										 {"group":"21st.Century.Skills","subGroup":"b","item":"Curious","won":false},
//										 {"group":"21st.Century.Skills","subGroup":"b","item":"Empathetic","won":false}],
//			sowo: {
//					watchout: [{
//						"total": 2,
//						"overPercent": 0.5,
//						"timestamp": 1409955949471,
//						"id": "wo3",
//						"name": "Straggler",
//						"description": "Struggling with identifying strengths and weaknesses of claim-data pairs."
//					}],
//					shoutout: [{
//						"total": 3,
//						"overPercent": 0.3333333333333333,
//						"timestamp": 1409956849018,
//						"id": "so1",
//						"name": "Nailed It!",
//						"description": "Outstanding performance at identifying weaknesses of claim-data pairs."
//						}]
//				}
        
        
        id: 6823,
        achievements: [{"group":"CCSS.ELA-Literacy.WHST.6-8.1","subGroup":"a","item":"Bot Champion","won":true},
                       {"group":"CCSS.ELA-Literacy.WHST.6-8.1","subGroup":"a","item":"Evidence Cadet","won":true},
                       {"group":"CCSS.ELA-Literacy.WHST.6-8.1","subGroup":"b","item":"Bot Defender","won":false},
                       {"group":"CCSS.ELA-Literacy.WHST.6-8.1","subGroup":"b","item":"Core Champion","won":true},
                       {"group":"CCSS.ELA-Literacy.WHST.6-8.1","subGroup":"b","item":"Core Cadet","won":false},
                       {"group":"21st.Century.Skills","subGroup":"a","item":"Deliberate","won":true},
                       {"group":"21st.Century.Skills","subGroup":"a","item":"Bold","won":true},
                       {"group":"21st.Century.Skills","subGroup":"a","item":"Persistent","won":false},
                       {"group":"21st.Century.Skills","subGroup":"b","item":"Curious","won":false},
                       {"group":"21st.Century.Skills","subGroup":"b","item":"Empathetic","won":false}],
        sowo: {
            
            shoutout:[{
                "total": 3,
                "overPercent": 0.3333333333333333,
                "timestamp": 1409956849018,
                "id": "so1",
                "name": "Nailed It!",
                "description": "Outstanding performance at identifying weaknesses of claim-data pairs."
            }],
            watchout:[{
                "total": 2,
                "overPercent": 0.5,
                "timestamp": 1409955949471,
                "id": "wo3",
                "name": "Straggler",
                "description": "Struggling with identifying strengths and weaknesses of claim-data pairs."
            }]
        
        }
		
		}

}
