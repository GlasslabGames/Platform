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
        chromebookgroup: {
            name: 'Chromebook/Web',
            description: 'Contains games playable on chromebooks',
            pricePerSeat: 2,
            size: "10 seats + 1 educator user",
            studentSeats: 10,
            educatorSeats: 1,
            browserGames: ['GOG','AW-1'],
            ipadGames: [],
            downloadableGames: []
        },
        chromebookclass: {
            name: 'Chromebook/Web',
            description: 'Contains games playable on chromebooks',
            pricePerSeat: 2,
            size: "30 seats + 1 educator user",
            studentSeats: 30,
            educatorSeats: 1,
            browserGames: ['GOG','AW-1'],
            ipadGames: [],
            downloadableGames: []
        },
        chromebookmulticlass: {
            name: 'Chromebook/Web',
            description: 'Contains games playable on chromebooks',
            pricePerSeat: 2,
            size: "120 seats + 4 educator users",
            studentSeats: 120,
            educatorSeats: 4,
            browserGames: ['GOG','AW-1'],
            ipadGames: [],
            downloadableGames: []
        },
        chromebookschool: {
            name: 'Chromebook/Web',
            description: 'Contains games playable on chromebooks',
            pricePerSeat: 2,
            browserGames: ['GOG','AW-1'],
            size: "500 seats + 15 educator users",
            studentSeats: 500,
            educatorSeats: 15,
            ipadGames: [],
            downloadableGames: []
        },
        ipadgroup: {
            name: 'Ipad',
            description: 'Contains games playable on ipads',
            pricePerSeat: 2,
            size: "10 seats + 1 educator user",
            studentSeats: 10,
            educatorSeats: 1,
            browserGames: [],
            ipadGames: ['AA-1','SLFR','WT','PVZ'],
            downloadableGames: []
        },
        ipadclass: {
            name: 'Ipad',
            description: 'Contains games playable on ipads',
            pricePerSeat: 2,
            size: "30 seats + 1 educator user",
            studentSeats: 30,
            educatorSeats: 1,
            browserGames: [],
            ipadGames: ['AA-1','SLFR','WT','PVZ'],
            downloadableGames: []
        },
        ipadmulticlass: {
            name: 'Ipad',
            description: 'Contains games playable on ipads',
            pricePerSeat: 2,
            size: "120 seats + 4 educator users",
            studentSeats: 120,
            educatorSeats: 4,
            browserGames: [],
            ipadGames: ['AA-1','SLFR','WT','PVZ'],
            downloadableGames: []
        },
        ipadschool: {
            name: 'Ipad',
            description: 'Contains games playable on ipads',
            pricePerSeat: 2,
            size: "500 seats + 15 educator users",
            studentSeats: 500,
            educatorSeats: 15,
            browserGames: [],
            ipadGames: ['AA-1','SLFR','WT','PVZ'],
            downloadableGames: []
        },
        pcmacgroup: {
            name: 'PC/MAC',
            description: 'Contains games playable on PCs/Macs.  Also contains all chromebook games',
            pricePerSeat: 3,
            size: "10 seats + 1 educator user",
            studentSeats: 10,
            educatorSeats: 1,
            browserGames: ['GOG','AW-1'],
            ipadGames: [],
            downloadableGames: ['SC']
        },
        pcmacclass: {
            name: 'PC/MAC',
            description: 'Contains games playable on PCs/Macs.  Also contains all chromebook games',
            pricePerSeat: 3,
            size: "30 seats + 1 educator user",
            studentSeats: 30,
            educatorSeats: 1,
            browserGames: ['GOG','AW-1'],
            ipadGames: [],
            downloadableGames: ['SC']
        },
        pcmacmulticlass: {
            name: 'PC/MAC',
            description: 'Contains games playable on PCs/Macs.  Also contains all chromebook games',
            pricePerSeat: 3,
            size: "120 seats + 4 educator users",
            studentSeats: 120,
            educatorSeats: 4,
            browserGames: ['GOG','AW-1'],
            ipadGames: [],
            downloadableGames: ['SC']
        },
        pcmacschool: {
            name: 'PC/MAC',
            description: 'Contains games playable on PCs/Macs.  Also contains all chromebook games',
            pricePerSeat: 3,
            size: "500 seats + 15 educator users",
            studentSeats: 500,
            educatorSeats: 15,
            browserGames: ['GOG','AW-1'],
            ipadGames: [],
            downloadableGames: ['SC']
        },
        allgamesgroup: {
            name: 'All Games',
            description: 'Contains all Glass Lab games',
            pricePerSeat: 5,
            size: "10 seats + 1 educator user",
            studentSeats: 10,
            educatorSeats: 1,
            browserGames: ['GOG','AW-1'],
            ipadGames: ['AA-1','SLFR','WT','PVZ'],
            downloadableGames: ['SC']
        },
        allgamesclass: {
            name: 'All Games',
            description: 'Contains all Glass Lab games',
            pricePerSeat: 5,
            size: "30 seats + 1 educator user",
            studentSeats: 30,
            educatorSeats: 1,
            browserGames: ['GOG','AW-1'],
            ipadGames: ['AA-1','SLFR','WT','PVZ'],
            downloadableGames: ['SC']
        },
        allgamesmulticlass: {
            name: 'All Games',
            description: 'Contains all Glass Lab games',
            pricePerSeat: 5,
            size: "120 seats + 4 educator users",
            studentSeats: 120,
            educatorSeats: 4,
            browserGames: ['GOG','AW-1'],
            ipadGames: ['AA-1','SLFR','WT','PVZ'],
            downloadableGames: ['SC']
        },
        allgamesschool: {
            name: 'All Games',
            description: 'Contains all Glass Lab games',
            pricePerSeat: 5,
            size: "500 seats + 15 educator users",
            studentSeats: 500,
            educatorSeats: 15,
            browserGames: ['GOG','AW-1'],
            ipadGames: ['AA-1','SLFR','WT','PVZ'],
            downloadableGames: ['SC']
        }
    }
};
