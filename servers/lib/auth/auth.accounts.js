/**
 * Authentication Account Module
 *
 *
 */

module.exports = {
    Manager: require('./auth.accounts.manager.js'),

    List : {
        Glasslab: require('./auth.account.glasslab.js'),
        Edmodo:   require('./auth.account.edmodo.js'),
        ICivics:  require('./auth.account.icivics.js'),
        Clever:   require('./auth.account.clever.js')
    }
};
