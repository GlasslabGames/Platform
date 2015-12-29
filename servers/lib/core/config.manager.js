/**
 * Created by Joseph Sutton on 11/30/13.
 * Config file load
 *   - Multi file loading until success
 *   - Config
 */
var fs = require('fs');
var _  = require('lodash');

function ConfigManager(){
    this.config = {};
}

ConfigManager.prototype.loadSync = function(files, fileType) {
    if(_.isString(files)) {
        files = [files];
    }
    if(_.isEmpty(fileType)) {
        fileType = "json";
    }

    if(_.isArray(files)) {
        var data = "";
        var file = "";
        try {
            for(var i = 0; i < files.length; i++){
                file = files[i];
                file = file.replace("~", this.getUserHomeDir());

                if(fs.existsSync(file)) {
                    data = fs.readFileSync(file);

                    if(fileType == "json") {
                        // merge in next
                        console.log('  merging config file '+file);
                        this.config = _.merge(
                            this.config,
                            JSON.parse(data)
                        );
                    }
                } else {
                    console.infoExt("ConfigManager", "Loading file \"" + file + "\" failed");
                }
            }

            if(_.isElement(this.config)) {
                return null;
            } else {
                // return this.config;
                return this.modConfig(this.config);
            }
        } catch(err){
            console.errorExt("ConfigManager", "Error loading config files (",files,"):", err);
        }
    } else {
        console.errorExt("ConfigManager", "Files input not array or string");
    }

    return null;
};

ConfigManager.prototype.get = function() {
    return this.config;
}

ConfigManager.prototype.getUserHomeDir = function() {
    return process.env.HOME ||
           process.env.HOMEPATH ||
           process.env.USERPROFILE ||
           "/root";
};

ConfigManager.prototype.modConfig = function(oldConfig) {

    var configOut = oldConfig;
    var subConfig;

    if(oldConfig.configMod && oldConfig.configKeys) {

        var msectionss = Object.keys(oldConfig.configMod);  // mod section names
        var keyName;                                        // key name
        var m;

        console.log('  Using "configMod" sections to alter configuration...');

        msectionss.forEach(function(m,i) { // sectionA, buildEnv

            // is there a key section for this mod section ?
            if(oldConfig.configKeys.hasOwnProperty(m)) {
                keyName = oldConfig.configKeys[m];

                // if so, is there a matching modName in this section for the keyName?
                if(oldConfig.configMod[m].hasOwnProperty(keyName)) {
                    subConfig = oldConfig.configMod[m][keyName];
                    console.log('    merging configMod.' + m + '.' + keyName + ' into config...');
                    // console.log('    ---------------- ----------------');
                    // console.log(subConfig);
                    // console.log('    ---------------- ----------------');
                    configOut = _.merge( configOut, subConfig);
                } else {
                    console.warnExt("Config", 'There is a key for mod section ' + m + ' but there is no modName in the section that matches the keyName.');
                }
            }
        });

        // console.log('    wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww');
        // console.log(configOut);
        // console.log('    wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww');
    }

    return configOut;
};

module.exports = ConfigManager;
