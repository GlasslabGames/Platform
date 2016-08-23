module.exports = {
    
    serverAddress: 'http://localhost:8001',

    // gameId for MGO
    testGameId: 'AA-1',
    
    // Manually generated test user
    teacher: {
        id: 286,
        email: 'louis_teacher@concentricsky.com',
        pass:  'Password1',
        testClass: {
            id: 97,
            title: "test class",
            grade: "6",
            code: "VH7K1"
        }
    },
    student: {
        id: 262,
        name: 'louis_student',
        pass:  'Password1',
        deviceId: '274_Windows_MSIE',
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
                "timestamp": 1410466528144,
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
