module.exports = {
    "auth": {
        "testUserPositive": {
            // good login credentials
        },
        "testUserNegative": {
            // bad login credentials
        }
    },

    "telemetry": {
        "session": {
            // mock session details
        },
        "telemEvent": {
            // mock telemetry event
            // from [ https://docs.google.com/a/instituteofplay.org/document/d/1gqUPJ6WpqGKiYbIMrQzykmyza_u169p2rbIBYeWU-1w/edit ]
                "timestamp": 63524832769,
                "name": "GL_Scenario_Score",
                "clientId": "SC",
                "clientVersion": "1.0.1058",
                "tags": {
                "userId": 25,
                    "gameSessionId": "de2e36a0-780f-11e3-a066-3b69aa042e3b"
            },
                "data": {
                "stars": "0",
                    "studentFeedback": "SFM1G1S01",
                    "teacherFeedback": "TFM1G1S01",
                    "text": "Enrollment: 70, Bus Stops: 0",
                    "scenarioTime": "00:40"
            }
        }
    },

    "assessment": {
        "assessmentEvent": {
            // supply mock data for independent test for integration
        }
    }
};