/**
 * License Module
 * Module dependencies:
 *  lodash - https://github.com/lodash/lodash
 *  when   - https://github.com/cujojs/when
 *
 */
// Third-party libs
var _      = require('lodash');
var moment = require('moment');
var when   = require('when');
var lConst = require('./lic.const.js');

// load at runtime
var MySQL;
var exampleOut = {};

module.exports = Lic_MySQL;

function Lic_MySQL(options){
    // Glasslab libs
    MySQL   = require('../core/datastore.mysql.js');

    this.options = _.merge(
        {
            host    : "localhost",
            user    : "glasslab",
            password: "glasslab",
            database: "glasslab_dev"
        },
        options
    );

    this.ds = new MySQL(this.options);
}

Lic_MySQL.prototype.connect = function(){
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    this.updateLicenseTable()
        .then(function(updated){
            if(updated) {
                console.log("Lic MySQL: Updated Course Table!");
            }
            resolve();
        }.bind(this),
        function(err){
            reject(err);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


// add lic map table and add game_id to license table
Lic_MySQL.prototype.updateLicenseTable = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    // IF NOT EXISTS
    var Q = "CREATE TABLE GL_LICENSE_MAP (" +
        "`id` BIGINT(20) NULL AUTO_INCREMENT," +
        "`user_id` BIGINT(20) NULL," +
        "`license_id` BIGINT(20) NULL," +
        "`institution_id` BIGINT(20) NULL," +
        " PRIMARY KEY (`id`)," +
        " INDEX `fk_license_id_idx` (`license_id` ASC)," +
        " INDEX `fk_institution_id_idx` (`institution_id` ASC)," +
        " INDEX `fk_user_id_idx` (`user_id` ASC)," +
        " UNIQUE INDEX `uq_user_lic_inst` (`user_id` ASC, `license_id` ASC, `institution_id` ASC)," +
        " CONSTRAINT `fk_user_id`" +
        "   FOREIGN KEY (`user_id`)" +
        "   REFERENCES `GL_USER` (`id`)" +
        "   ON DELETE NO ACTION" +
        "   ON UPDATE NO ACTION," +
        " CONSTRAINT `fk_license_id`" +
        "   FOREIGN KEY (`license_id`)" +
        "   REFERENCES `GL_LICENSE` (`ID`)" +
        "   ON DELETE NO ACTION" +
        "   ON UPDATE NO ACTION," +
        "   CONSTRAINT `fk_institution_id`" +
        "   FOREIGN KEY (`institution_id`)" +
        "   REFERENCES `GL_INSTITUTION` (`ID`)" +
        "   ON DELETE NO ACTION" +
        "   ON UPDATE NO ACTION)";

    // create user/institution/lic map
    this.ds.query(Q)
        .then(function(results) {
            if(results) {
                //console.log("updateLicenseTable create user/institution/lic map:", results);

                // get all license where they they have an insitution id and add them to the map
                Q = "SELECT l.ID as license_id, l.institution_id, u.id as user_id \
                     FROM GL_LICENSE l JOIN GL_USER u on l.institution_id = u.institution_id \
                     WHERE l.institution_id IS NOT NULL AND u.SYSTEM_ROLE != 'student'";
                return this.ds.query(Q);
            }
        }.bind(this),
        function(err) {
            if(err.code == "ER_TABLE_EXISTS_ERROR") {
                // already crated, all ok no more migration needed

                resolve(false);
            } else {
                reject(err);
            }
        }.bind(this))

        .then(function(results) {
            if(results) {
                //console.log("updateLicenseTable all license:", results);

                Q = [];
                for(var i = 0; i < results.length; i++){
                    Q.push(" ("+
                        this.ds.escape(results[i].license_id)+", "+
                        this.ds.escape(results[i].institution_id)+", "+
                        this.ds.escape(results[i].user_id)+")");
                }

                Q = "INSERT INTO GL_LICENSE_MAP (`license_id`, `institution_id`, `user_id`) VALUES\n"+Q.join(",\n");
                //console.log("updateLicenseTable Q:", Q);
                return this.ds.query(Q);
            }
        }.bind(this))

        .then(function(results) {
            if(results) {
                //console.log("updateLicenseTable added to map:", results);

                Q = "DESCRIBE GL_LICENSE";
                return this.ds.query(Q);
            }
        }.bind(this))

        .then(function(results) {
            if(results) {
                var updating = false;
                for(var i = 0; i < results.length; i++) {
                    if( results[i]['Field'] == 'institution_id' ) {
                        updating  = true;

                        // need to update
                        Q = "ALTER TABLE GL_LICENSE " +
                            "ADD COLUMN `game_id` VARCHAR(255) NOT NULL DEFAULT 'SC' AFTER `SEATS`";
                        this.ds.query(Q)
                            .then(function(results) {
                                if(results) {
                                    //console.log("updateLicenseTable ALTER TABLE GL_LICENSE:", results);
                                    resolve(true);
                                } else {
                                    resolve(false);
                                }
                            }.bind(this))

                            // catch all errors
                            .then(null, function(err) {
                                reject({"error": "failure", "exception": err}, 500);
                            }.bind(this));

                        // done exit loop
                        break;
                    }
                }

                if(!updating) {
                    resolve(false);
                }
            }
        }.bind(this))

        // catch all errors
        .then(null, function(err) {
            reject({"error": "failure", "exception": err}, 500);
        }.bind(this));

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

exampleOut.verifyLicense = true; // boolean true or false
Lic_MySQL.prototype.verifyLicense = function(licenseKey) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q =
        "SELECT \
            id, \
            license_key \
        FROM GL_LICENSE \
        WHERE enabled=1 AND \
        EXPIRATION_DATE > NOW() AND \
        REDEEMED=0 AND \
        license_key="+ this.ds.escape(licenseKey);

    this.ds.query(Q)
        .then(function(results) {
                resolve(results);
            }.bind(this),
            function(err) {
                reject({"error": "failure", "exception": err}, 500);
            }.bind(this)
        );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};


Lic_MySQL.prototype.getLicenses = function(userId) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q =
        "SELECT \
            l.license_key,\
            l.game_id, \
            l.partner_id,\
            l.last_updated as activition_date, \
            l.expiration_date,\
            l.seats \
        FROM GL_LICENSE l \
        JOIN GL_LICENSE_MAP lm on lm.license_id=l.id \
        WHERE l.enabled=1 AND \
        l.REDEEMED=1 AND \
        lm.user_id="+ this.ds.escape(userId);

    this.ds.query(Q)
        .then(function(results) {
            resolve(results);
        }.bind(this),
        function(err) {
            reject({"error": "failure", "exception": err}, 500);
        }.bind(this)
    );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Lic_MySQL.prototype.registerLicense = function(licenseId, userId) {
// add promise wrapper
    return when.promise(function(resolve, reject) {
// ------------------------------------------------

        var Q = "INSERT INTO GL_LICENSE_MAP (`license_id`, `user_id`) VALUES" +
            "("+
            this.ds.escape(licenseId)+", "+
            this.ds.escape(userId)+
            ")";

        this.ds.query(Q)
            .then(function(results) {
                resolve(results);
            }.bind(this),
            function(err) {
                reject({"error": "failure", "exception": err}, 500);
            }.bind(this)
        );

// ------------------------------------------------
    }.bind(this));
// end promise wrapper
};

Lic_MySQL.prototype.redeemLicense = function(licenseId, expirationDate) {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------

    var Q = "UPDATE GL_LICENSE SET REDEEMED=1, last_updated=NOW(), " +
        "expiration_date=FROM_UNIXTIME("+this.ds.escape(expirationDate)+") " +
        "WHERE id="+this.ds.escape(licenseId);

    this.ds.query(Q)
        .then(function(results) {
            resolve(results);
        }.bind(this),
        function(err) {
            reject({"error": "failure", "exception": err}, 500);
        }.bind(this)
    );

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};