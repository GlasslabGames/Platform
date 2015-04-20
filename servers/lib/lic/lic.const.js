module.exports = {
    "role": {
        "admin": "admin"
    },
    "licenseCodeTypes": {
        "GL-SC-001": "SimCityEDU Single License",
        "GL-SC-007": "SimCityEDU Lab/Family Pack",
        "GL-SC-031": "SimCityEDU Class Pack",
        "GL-SC-120": "SimCityEDU School Pack",
        "GL-SC-250": "SimCityEDU Site Unlimited"
    },
    "datastore": {
        "licenseKey": "lic"
    },
    "plan": {
        "chromebook": {
            "stripe_planId": "GLG_CHROMEBOOK_P03",
            "name": "Chromebook/Web",
            "description": "Games in this package are optimized to work on Chromebooks.",
            "pricePerSeat": 2.5,
            "browserGames": [
                "PRIMA",
                "WWF",
                "AW-1",
                "GOG",
                "SLFR"
            ],
            "iPadGames": [
                "AA-1",
                "PVZ"
            ],
            "downloadableGames": [
                "WARP"
            ],
            "planId": "chromebook"
        },
        "ipad": {
            "stripe_planId": "GLG_IPAD_P04",
            "name": "iPad",
            "description": "Games in this package are optimized to work on iPads.",
            "pricePerSeat": 3,
            "browserGames": [
                "PRIMA",
                "WWF"
            ],
            "iPadGames": [
                "AA-1",
                "PVZ",
                "WPLUS",
                "WT"
            ],
            "downloadableGames": [
                "WARP"
            ],
            "planId": "ipad"
        },
        "pcMac": {
            "stripe_planId": "GLG_PCMAC_P05",
            "name": "PC/MAC",
            "description": "Games in this package run on PC or Mac computers.",
            "pricePerSeat": 3.5,
            "browserGames": [
                "PRIMA",
                "WWF",
                "AW-1",
                "GOG",
                "SLFR"
            ],
            "iPadGames": [
                "AA-1",
                "PVZ"
            ],
            "downloadableGames": [
                "WARP",
                "SC"
            ],
            "planId": "pcMac"
        },
        "allGames": {
            "stripe_planId": "GLG_ALLGAMES_P06",
            "name": "All Games",
            "description": "This package includes all games available on this site.",
            "pricePerSeat": 5,
            "browserGames": [
                "PRIMA",
                "WWF",
                "AW-1",
                "GOG",
                "SLFR"
            ],
            "iPadGames": [
                "AA-1",
                "PVZ",
                "WPLUS",
                "WT"
            ],
            "downloadableGames": [
                "WARP",
                "SC"
            ],
            "planId": "allGames"
        },
        "trial": {
            "stripe_planId": "GLG_TRIAL_P01",
            "name": "Trial",
            "description": "This trial includes all games available on this site.",
            "pricePerSeat": 0.03333333333333333,
            "browserGames": [
                "PRIMA",
                "WWF",
                "AW-1",
                "GOG",
                "SLFR"
            ],
            "iPadGames": [
                "AA-1",
                "PVZ",
                "WPLUS",
                "WT"
            ],
            "downloadableGames": [
                "WARP",
                "SC"
            ],
            "planId": "trial"
        },
        "trialLegacy": {
            "stripe_planId": "GLG_LEGACYTRIAL_P02",
            "name": "Trial",
            "description": "This trial includes all games available on this site.",
            "pricePerSeat": 1,
            "browserGames": [
                "PRIMA",
                "WWF",
                "AW-1",
                "GOG",
                "SLFR"
            ],
            "iPadGames": [
                "AA-1",
                "PVZ",
                "WPLUS",
                "WT"
            ],
            "downloadableGames": [
                "WARP",
                "SC"
            ],
            "planId": "trialLegacy"
        }
    },
    "seats": {
        "group": {
            "size": "Group",
            "studentSeats": 10,
            "educatorSeats": 1,
            "discount": 0,
            "seatId": "group"
        },
        "class": {
            "size": "Class",
            "studentSeats": 30,
            "educatorSeats": 2,
            "discount": 20,
            "seatId": "class"
        },
        "multiClass": {
            "size": "Multi Class",
            "studentSeats": 120,
            "educatorSeats": 8,
            "discount": 25,
            "seatId": "multiClass"
        },
        "school": {
            "size": "School",
            "studentSeats": 500,
            "educatorSeats": 15,
            "discount": 30,
            "seatId": "school"
        },
        "trial": {
            "size": "Trial",
            "studentSeats": 30,
            "educatorSeats": 0,
            "discount": 0,
            "seatId": "trial"
        },
        "5": {
            "size": "Custom",
            "studentSeats": 5,
            "educatorSeats": 1,
            "discount": 0,
            "seatId": "5"
        },
        "15": {
            "size": "Custom",
            "studentSeats": 15,
            "educatorSeats": 1,
            "discount": 0,
            "seatId": "15"
        },
        "20": {
            "size": "Custom",
            "studentSeats": 20,
            "educatorSeats": 2,
            "discount": 0,
            "seatId": "20"
        },
        "25": {
            "size": "Custom",
            "studentSeats": 25,
            "educatorSeats": 2,
            "discount": 0,
            "seatId": "25"
        },
        "35": {
            "size": "Custom",
            "studentSeats": 35,
            "educatorSeats": 2,
            "discount": 0,
            "seatId": "35"
        },
        "40": {
            "size": "Custom",
            "studentSeats": 40,
            "educatorSeats": 3,
            "discount": 0,
            "seatId": "40"
        },
        "45": {
            "size": "Custom",
            "studentSeats": 45,
            "educatorSeats": 3,
            "discount": 0,
            "seatId": "45"
        },
        "50": {
            "size": "Custom",
            "studentSeats": 50,
            "educatorSeats": 3,
            "discount": 0,
            "seatId": "50"
        },
        "55": {
            "size": "Custom",
            "studentSeats": 55,
            "educatorSeats": 3,
            "discount": 0,
            "seatId": "55"
        },
        "60": {
            "size": "Custom",
            "studentSeats": 60,
            "educatorSeats": 4,
            "discount": 0,
            "seatId": "60"
        },
        "65": {
            "size": "Custom",
            "studentSeats": 65,
            "educatorSeats": 4,
            "discount": 0,
            "seatId": "65"
        },
        "70": {
            "size": "Custom",
            "studentSeats": 70,
            "educatorSeats": 4,
            "discount": 0,
            "seatId": "70"
        },
        "75": {
            "size": "Custom",
            "studentSeats": 75,
            "educatorSeats": 4,
            "discount": 0,
            "seatId": "75"
        },
        "80": {
            "size": "Custom",
            "studentSeats": 80,
            "educatorSeats": 5,
            "discount": 0,
            "seatId": "80"
        },
        "85": {
            "size": "Custom",
            "studentSeats": 85,
            "educatorSeats": 5,
            "discount": 0,
            "seatId": "85"
        },
        "90": {
            "size": "Custom",
            "studentSeats": 90,
            "educatorSeats": 5,
            "discount": 0,
            "seatId": "90"
        },
        "95": {
            "size": "Custom",
            "studentSeats": 95,
            "educatorSeats": 5,
            "discount": 0,
            "seatId": "95"
        },
        "100": {
            "size": "Custom",
            "studentSeats": 100,
            "educatorSeats": 6,
            "discount": 0,
            "seatId": "100"
        },
        "105": {
            "size": "Custom",
            "studentSeats": 105,
            "educatorSeats": 6,
            "discount": 0,
            "seatId": "105"
        },
        "110": {
            "size": "Custom",
            "studentSeats": 110,
            "educatorSeats": 6,
            "discount": 0,
            "seatId": "110"
        },
        "115": {
            "size": "Custom",
            "studentSeats": 115,
            "educatorSeats": 6,
            "discount": 0,
            "seatId": "115"
        }
    },
    "stripeTestCard": {
        "number": 4242424242424242,
        "exp_month": 1,
        "exp_year": 2020,
        "cvc": 123
    }
};
