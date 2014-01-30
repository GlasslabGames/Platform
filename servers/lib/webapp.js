/**
 * WebApp Module
 *
 *
 */
module.exports = {
    Const:      require('./webapp.const.js'),
    Datastore: {
        MySQL:  require('./webapp.datastore.mysql.js')
    }
}
