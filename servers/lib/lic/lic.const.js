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
            name: 'Chromebook/Web',
            description: 'Contains games playable on chromebooks',
            pricePerSeat: 2,
            browserGames: ['GOG','AW-1'],
            ipadGames: [],
            downloadableGames: []
        },
        ipad: {
            name: 'Ipad',
            description: 'Contains games playable on ipads',
            pricePerSeat: 2,
            browserGames: [],
            ipadGames: ['AA-1','SLFR','WT','PVZ'],
            downloadableGames: []
        },
        pcmac: {
            name: 'PC/MAC',
            description: 'Contains games playable on PCs/Macs.  Also contains all chromebook games',
            pricePerSeat: 3,
            browserGames: ['GOG','AW-1'],
            ipadGames: [],
            downloadableGames: ['SC']
        },
        allgamesmulticlass: {
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
    }
};
