var ConfigManager = require('../lib/config.manager.js'),
    config        = new ConfigManager(),
    options       = config.loadSync([
        "../config.json",
        "~/hydra.config.json"
    ]);

//global.ENV = options.env || 'dev';
module.exports = options;