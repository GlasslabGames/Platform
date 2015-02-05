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
            strip_planId: 'test_chromebook',
            name: 'Chromebook/Web',
            description: 'Contains games playable on chromebooks',
            pricePerSeat: 2,
            browserGames: ['GOG','AW-1'],
            ipadGames: [],
            downloadableGames: []
        },
        ipad: {
            strip_planId: 'test_ipad',
            name: 'Ipad',
            description: 'Contains games playable on ipads',
            pricePerSeat: 2,
            browserGames: [],
            ipadGames: ['AA-1','SLFR','WT','PVZ'],
            downloadableGames: []
        },
        pcmac: {
            strip_planId: 'test_pcmac',
            name: 'PC/MAC',
            description: 'Contains games playable on PCs/Macs.  Also contains all chromebook games',
            pricePerSeat: 3,
            browserGames: ['GOG','AW-1'],
            ipadGames: [],
            downloadableGames: ['SC']
        },
        allgamesmulticlass: {
            strip_planId: 'test_all',
            name: 'All Games',
            description: 'Contains all Glass Lab games',
            pricePerSeat: 5,
            browserGames: ['GOG','AW-1'],
            ipadGames: ['AA-1','SLFR','WT','PVZ'],
            downloadableGames: ['SC']
        }
    },
    seats: {
        group: {
            size: "10 seats + 1 educator user",
            studentSeats: 10,
            educatorSeats: 1,
            discount: 0
        },
        class: {
            size: "30 seats + 1 educator user",
            studentSeats: 30,
            educatorSeats: 1,
            discount: 20
        },
        multiclass: {
            size: "120 seats + 4 educator users",
            studentSeats: 120,
            educatorSeats: 4,
            discount: 25
        },
        school: {
            size: "500 seats + 15 educator users",
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
