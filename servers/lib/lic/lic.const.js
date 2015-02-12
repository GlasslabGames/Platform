/**
 * License Consts
 *
 */

module.exports = {
    licenseCodeTypes: {
        'GL-SC-001': 'SimCityEDU Single License',
        'GL-SC-007': 'SimCityEDU Lab/Family Pack',
        'GL-SC-031': 'SimCityEDU Class Pack',
        'GL-SC-120': 'SimCityEDU School Pack',
        'GL-SC-250': 'SimCityEDU Site Unlimited'
    },
    datastore: {
        licenseKey: "lic"
    },
    plan: {
        chromebook: {
            stripe_planId: 'test_chromebook',
            name: 'Chromebook/Web',
            description: 'All Games in this package are optimized to work on Chromebooks.',
            pricePerSeat: 2.5,
            browserGames: ['AW-1','GOG','SLFR'],
            iPadGames: [],
            downloadableGames: [],
            planId: 'chromebook'
        },
        ipad: {
            stripe_planId: 'test_ipad',
            name: 'iPad',
            description: 'All Games in this package are optimized to work on iPads.',
            pricePerSeat: 3.5,
            browserGames: [],
            iPadGames: ['AA-1','PVZ','WT'],
            downloadableGames: [],
            planId: 'ipad'
        },

        pcMac: {
            stripe_planId: 'test_pcmac',
            name: 'PC/MAC',
            description: 'Games in this package run on PC or Mac computers.',
            pricePerSeat: 2.5,
            browserGames: ['AW-1','GOG','SLFR'],
            iPadGames: [],
            downloadableGames: ['SC'],
            planId: 'pcMac'
        },
        allGames: {
            stripe_planId: 'test_all',
            name: 'All Games',
            description: 'This package includes all games available on this site.',
            pricePerSeat: 5,
            browserGames: ['AW-1','GOG','SLFR'],
            iPadGames: ['AA-1','PVZ','WT'],
            downloadableGames: ['SC'],
            planId: 'allGames'
        },
        trial: {
            stripe_planId: 'test_trial',
            name: 'Trial',
            description: 'This trial includes all games available on this site.',
            pricePerSeat: 1/30,
            browserGames: ['AW-1','GOG','SLFR'],
            iPadGames: ['AA-1','PVZ','WT'],
            downloadableGames: ['SC'],
            planId: 'trial'
        }
    },
    seats: {
        group: {
            size: "Group",
            studentSeats: 10,
            educatorSeats: 1,
            discount: 0,
            seatId: 'group'
        },
        class: {
            size: "Class",
            studentSeats: 30,
            educatorSeats: 2,
            discount: 20,
            seatId: "class"
        },
        multiClass: {
            size: "Multi Class",
            studentSeats: 120,
            educatorSeats: 8,
            discount: 25,
            seatId: 'multiClass'
        },
        school: {
            size: "School",
            studentSeats: 500,
            educatorSeats: 15,
            discount: 30,
            seatId: 'school'
        }
    },
    stripeTestCard: {
        number: 4242424242424242,
        exp_month: 1,
        exp_year: 2020,
        cvc: 123
    }
};
