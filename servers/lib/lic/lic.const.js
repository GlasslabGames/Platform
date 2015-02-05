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
        chromeBook: {
            strip_planId: 'test_chromebook',
            name: 'Chromebook/Web',
            description: 'Contains games playable on chromebooks',
            pricePerSeat: 2,
            browserGames: ['GOG','AW-1'],
            iPadGames: [],
            downloadableGames: []
        },
        iPad: {
            strip_planId: 'test_iad',
            name: 'iPad',
            description: 'Contains games playable on ipads',
            pricePerSeat: 2,
            browserGames: [],
            iPadGames: ['AA-1','SLFR','WT','PVZ'],
            downloadableGames: []
        },
        pcMac: {
            strip_planId: 'test_pcmac',
            name: 'PC/MAC',
            description: 'Contains games playable on PCs/Macs.  Also contains all chromebook games',
            pricePerSeat: 3,
            browserGames: ['GOG','AW-1'],
            ipadGames: [],
            downloadableGames: ['SC']
        },
        allGames: {
            strip_planId: 'test_all',
            name: 'All Games',
            description: 'Contains all Glass Lab games',
            pricePerSeat: 5,
            browserGames: ['GOG','AW-1'],
            iPadGames: ['AA-1','SLFR','WT','PVZ'],
            downloadableGames: ['SC']
        }
    },
    seats: {
        group: {
            size: "group",
            studentSeats: 10,
            educatorSeats: 1,
            discount: 0
        },
        class: {
            size: "class",
            studentSeats: 30,
            educatorSeats: 1,
            discount: 20
        },
        multiclass: {
            size: "multiclass",
            studentSeats: 120,
            educatorSeats: 4,
            discount: 25
        },
        school: {
            size: "school",
            studentSeats: 500,
            educatorSeats: 15,
            discount: 30
        }
    },
    stripeTestCard: {
        number: 4242424242424242,
        exp_month: 1,
        exp_year: 2020,
        cvc: 123
    }
};
