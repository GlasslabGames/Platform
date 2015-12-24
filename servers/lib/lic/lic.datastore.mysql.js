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

    resolve();
//    this.createLicensingTables()
//        .then(function(created){
//            if(created){
//                console.log("Lic MySQL: Created Licensing Tables!");
//            }
//            resolve();
//        })
//        .then(null, function(err){
//            reject(err);
//        });

// ------------------------------------------------
}.bind(this));
// end promise wrapper
};

Lic_MySQL.prototype.updatePOTable = function() {
	return when.promise(function(resolve, reject) {

    var Q = "DESCRIBE GL_PURCHASE_ORDER";
    this.ds.query(Q)
        .then(function(results) {
            var updating = false;

            var hasResllerLog = false;

            var promiseList = [];
            var Q = "";

            for (var i = 0; i < results.length; i++) {
                if (results[i]['Field'] == 'RESELLER_LOG') {
                    hasResllerLog = true;
                }
            }

            if ( ! hasResllerLog ) {
                updating = true;
                Q = "ALTER TABLE GL_PURCHASE_ORDER ADD COLUMN RESELLER_LOG TEXT NULL DEFAULT NULL AFTER date_created";
                console.log( "               ", Q );
                promiseList.push(this.ds.query(Q));
            }

            if (promiseList.length) {
                when.all(promiseList)
                    .then(function(results) {
                        resolve(true);
                    }.bind(this))
                    .then(null, function(err) {
                        reject({"error": "failure", "exception": err}, 500);
                    }.bind(this));
            }
            if (!updating) {
                resolve(false);
            }
        }.bind(this),
        function (err) {
            reject({"error": "failure", "exception": err}, 500);
        }.bind(this));

	}.bind(this));
};

Lic_MySQL.prototype.createLicensingTables = function(){
    return when.promise(function(resolve, reject){
        var Q = "CREATE TABLE GL_LICENSE\n" +
            "(\n" +
                "id BIGINT(20) NULL AUTO_INCREMENT,\n" +
                "user_id BIGINT(20) NULL,\n" +
                "license_key VARCHAR(20) NULL,\n" +
                "package_type VARCHAR(20) NULL,\n" +
                "package_size_tier VARCHAR(20) NULL,\n" +
                "expiration_date DATETIME,\n" +
                "active TINYINT(1),\n" +
                "educator_seats_remaining INT(10) NULL,\n" +
                "student_seats_remaining INT(10) NULL,\n" +
                "promo VARCHAR(20) NULL,\n" +
                "subscription_id VARCHAR(20) NULL,\n" +
                "auto_renew TINYINT(1) DEFAULT 1,\n" +
                "purchase_order_id BIGINT(20) NULL,\n" +
                "payment_type VARCHAR(20),\n" +
                "institution_id BIGINT(20) NULL,\n" +
                "date_created DATETIME NULL,\n" +
                "last_upgraded DATETIME NULL,\n" +
                "PRIMARY KEY (id),\n"+
                "INDEX fk_user_id_idx (user_id ASC),\n" +
                "INDEX fk_school_id_idx (institution_id ASC),\n" +
                "CONSTRAINT fk_owner_id\n" +
                    "FOREIGN KEY (user_id)\n" +
                    "REFERENCES GL_USER (id)\n" +
                    "ON DELETE NO ACTION\n" +
                    "ON UPDATE NO ACTION\n" +
                "CONSTRAINT fk_school_id\n" +
                    "FOREIGN KEY (institution_id)\n" +
                    "REFERENCES GL_INSTITUTION (id)\n" +
                    "ON DELETE NO ACTION\n" +
                    "ON UPDATE NO ACTION\n" +
            ");";
        this.ds.query(Q)
            .then(function(){
                Q = "CREATE TABLE GL_LICENSE_MAP\n" +
                    "(" +
                        "id BIGINT(20) NULL AUTO_INCREMENT,\n" +
                        "user_id BIGINT(20) NULL,\n" +
                        "license_id BIGINT(20) NULL,\n" +
                        "status VARCHAR(20) NULL,\n" +
                        "date_created DATETIME NULL,\n" +
                        "PRIMARY KEY (id),\n" +
                        "INDEX fk_user_id_idx (user_id ASC),\n" +
                        "INDEX fk_license_id_idx (license_id ASC),\n" +
                        "UNIQUE INDEX uq_user_license (user_id ASC, license_id ASC),\n" +
                        "CONSTRAINT fk_educator_id\n" +
                            "FOREIGN KEY (user_id)\n" +
                            "REFERENCES GL_USER (id)\n" +
                            "ON DELETE NO ACTION\n" +
                            "ON UPDATE NO ACTION,\n" +
                        "CONSTRAINT fk_license_id\n" +
                            "FOREIGN KEY (license_id)\n" +
                            "REFERENCES GL_LICENSE (id)\n" +
                            "ON DELETE NO ACTION\n" +
                            "ON UPDATE NO ACTION\n" +
                    ");";
                return this.ds.query(Q);
            }.bind(this))
            .then(function(){
                Q = "CREATE TABLE GL_PURCHASE_ORDER\n" +
                    "(\n" +
                        "id BIGINT(20) NULL AUTO_INCREMENT,\n" +
                        "user_id BIGINT(20) NULL,\n" +
                        "license_id BIGINT(20) NULL,\n" +
                        "status VARCHAR(20) NULL,\n" +
                        "purchase_order_number VARCHAR(20) NULL,\n" +
                        "purchase_order_key VARCHAR(50) NULL,\n" +
                        "phone VARCHAR(20),\n" +
                        "email VARCHAR(255),\n" +
                        "name VARCHAR(255),\n" +
                        "payment VARCHAR(20),\n" +
                        "current_package_type VARCHAR(20) NULL,\n" +
                        "current_package_size_tier VARCHAR(20) NULL,\n" +
                        "action VARCHAR(20) NULL,\n" +
                        "date_created DATETIME NULL,\n" +
                        "UNIQUE(purchase_order_key),\n" +
                        "PRIMARY KEY (id),\n" +
                        "INDEX fk_user_id_idx (user_id ASC),\n" +
                        "INDEX fk_license_id_idx (license_id ASC),\n" +
                        "CONSTRAINT fk_purchase_owner_id\n" +
                            "FOREIGN KEY (user_id)\n" +
                            "REFERENCES GL_USER (id)\n" +
                            "ON DELETE NO ACTION\n" +
                            "ON UPDATE NO ACTION,\n" +
                        "CONSTRAINT fk_purchase_license_id\n" +
                            "FOREIGN KEY (license_id)\n" +
                            "REFERENCES GL_LICENSE (id)\n" +
                            "ON DELETE NO ACTION\n" +
                            "ON UPDATE NO ACTION\n" +
                    ");";
                return this.ds.query(Q);
            }.bind(this))
            .then(function(){
                resolve(true);
            })
            .then(null, function(err){
                if(err.code === "ER_TABLE_EXISTS_ERROR"){
                    resolve(false);
                } else {
                    reject(err);
                }
            });
    }.bind(this));
};

Lic_MySQL.prototype.insertToLicenseTable = function(values){
    return when.promise(function(resolve, reject){
        var Q = "INSERT INTO GL_LICENSE\n" +
            "(user_id,license_key,package_type,package_size_tier,expiration_date," +
            "active,educator_seats_remaining,student_seats_remaining,promo," +
            "subscription_id,auto_renew,payment_type,institution_id,date_created,last_upgraded)\n" +
            "VALUES (" + this.ds.escape(values) + ");";
        this.ds.query(Q)
            .then(function(results){
                resolve(results.insertId);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Insert To License Table Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.insertToLicenseMapTable = function(values){
    return when.promise(function(resolve, reject){
        var Q = "INSERT INTO GL_LICENSE_MAP (user_id,license_id,status,date_created)\n" +
            "VALUES (" + this.ds.escape(values) + ");";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Insert To License Map Table Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.getLicenseById = function(licenseId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT * FROM GL_LICENSE WHERE id = " + this.ds.escape(licenseId) + ";";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get License By Id Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.getCustomerIdByUserId = function(userId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT customer_id as customerId FROM GL_USER WHERE id = " + this.ds.escape(userId) + ";";
        this.ds.query(Q)
            .then(function(results){
                resolve(results[0].customerId);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get Customer Id By User Id Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.setCustomerIdByUserId = function(userId, customerId){
    return when.promise(function(resolve, reject){
        var Q = "UPDATE GL_USER SET customer_id = " + this.ds.escape(customerId) + " WHERE id = " + this.ds.escape(userId) + ";";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Set Customer Id By User Id Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.removeSubscriptionIdsByUserId = function(userId){
    return when.promise(function(resolve, reject){
        var Q = "UPDATE GL_LICENSE SET subscription_id = NULL where user_id = " + this.ds.escape(userId) + ";";
        this.ds.query(Q)
            .then(function(){
                resolve();
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Remove Subscription Ids By User Id Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.countEducatorSeatsByLicense = function(licenseId, seats){
    return when.promise(function(resolve, reject){
        var Q = "SELECT COUNT(*) FROM GL_LICENSE_MAP "+
            " WHERE status in ('active','pending','invite-pending','po-received')"+
            " AND license_id = " + this.ds.escape(licenseId) + ";";
        this.ds.query(Q)
            .then(function(results){
                resolve(results[0]["COUNT(*)"]);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Update Educator Sears Remaining Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.updateLicenseById = function(licenseId, updateFields){
    return when.promise(function(resolve, reject){
        var Q = "UPDATE GL_LICENSE SET " + this.ds.escape(updateFields) +
            " WHERE id = " + this.ds.escape(licenseId) + ";";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Update License By Id Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.getUsersByIds = function(ids){
    return when.promise(function(resolve, reject){
        var Q = "SELECT * FROM GL_USER WHERE id in (" + this.ds.escape(ids) + ");";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get Users BY Ids Error -",err);
                reject(err);
            });
    }.bind(this))
};

Lic_MySQL.prototype.getLicenseMapByInstructors = function(userIds){
    return when.promise(function(resolve, reject){
        var Q = "SELECT * FROM GL_LICENSE_MAP " +
            " WHERE status in ('active','pending','po-pending','po-received','po-rejected','invite-pending') " +
            " AND user_id in (" + this.ds.escape(userIds) + ");";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            }.bind(this))
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get License Map By Instructors Error -",err);
                reject(err);
            }.bind(this));
    }.bind(this));
};

// Might as well get the whole set for reference
Lic_MySQL.prototype.getLicenseMapByUser = function(userId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT * FROM GL_LICENSE_MAP as mp" +
            " INNER JOIN ( SELECT * FROM GL_LICENSE ) as lic" +
            " ON ( mp.user_id = lic.user_id AND mp.license_id = lic.id)" +
            " WHERE mp.user_id = " + this.ds.escape(userId) + ";";

        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            }.bind(this))
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get License Map By Instructors Error -",err);
                reject(err);
            }.bind(this));
    }.bind(this));
};

Lic_MySQL.prototype.userHasLicenseMap = function(userId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT * FROM GL_LICENSE_MAP WHERE user_id = " + this.ds.escape(userId) + ";";
        this.ds.query(Q)
            .then(function(results){
                var state = results.length > 0;
                resolve(state);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get License Map By User Error -",error);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.getInstructorsByLicense = function(licenseId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT u.id,u.first_name as firstName,u.last_name as lastName,u.email,lm.status FROM GL_USER as u\n" +
            "JOIN GL_LICENSE_MAP as lm\n" +
            "ON lm.user_id = u.id\n" +
            "WHERE lm.license_id = " + this.ds.escape(licenseId) +
            " and lm.status in ('active','pending','po-received','po-pending','invite-pending');";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get Instructors By License Error -",err);
                reject(err);
            })
    }.bind(this));
};

Lic_MySQL.prototype.getAllInstructorsNonCustomers = function(){
    return when.promise(function(resolve, reject){
        var Q = "SELECT * FROM GL_USER WHERE SYSTEM_ROLE ='instructor' and customer_id IS NULL";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get All Instructors Non Customers Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.getCoursesByInstructor = function(userId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT course_id FROM GL_MEMBERSHIP WHERE user_id = " + this.ds.escape(userId) + ";";
        this.ds.query(Q)
            .then(function(results){
                var output = [];
                var id;
                results.forEach(function(membership){
                    id = membership["course_id"];
                    output.push(id);
                });
                resolve(output);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get Courses By Instructor Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.getCourseTeacherMapByLicense = function(licenseId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT m.course_id,course.title,m.user_id,teachers.username,teachers.first_name,teachers.last_name FROM GL_MEMBERSHIP as m\n" +
            "JOIN\n" +
            "(SELECT id,username,first_name,last_name FROM GL_USER as u\n" +
                "JOIN\n" +
                    "(SELECT user_id FROM GL_LICENSE_MAP WHERE license_id = " + this.ds.escape(licenseId) + ") as lm\n" +
                    "ON lm.user_id = u.id\n" +
            ") as teachers\n" +
            "ON teachers.id = m.user_id\n" +
            "JOIN ( SELECT ID,TITLE FROM GL_COURSE ) as course ON course.ID = m.course_id;"
            ;

        this.ds.query(Q)
            .then(function(courses){
                var courseTeacherMap = {};
                var map;
                courses.forEach(function(course){
                    map = courseTeacherMap[course["course_id"]] = {};
                    map["userId"] = course["user_id"];
                    map["username"] = course["username"];
                    map["firstName"] = course["first_name"];
                    map["lastName"] = course["last_name"];
                    map["courseId"] = course["course_id"];
                    map["courseTitle"] = course["title"];
                });
                resolve(courseTeacherMap);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get Course Teacher Map By License Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.getUsersByEmail = function(emails){
    return when.promise(function(resolve, reject){
        var Q = "SELECT * FROM GL_USER WHERE email in (" + this.ds.escape(emails) + ");";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get Users By Email Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.multiInsertTempUsersByEmail = function(emails){
    return when.promise(function(resolve, reject){
        var Q = "INSERT INTO GL_USER (email,username,version,date_created,enabled,first_name,last_name,last_updated," +
            "password,system_role,collect_telemetry,login_type,verify_code_status) VALUES ";
        var values = [];
        emails.forEach(function(email){
            values.push(_insertTempUserValueWithEmail(email));
        });
        Q += values.join(",") + ";";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Multi Insert Temp Users By Email Error -",err);
                reject(err);
            });
    }.bind(this));
};

function _insertTempUserValueWithEmail(email){
    email = this.ds.escape(email.toLowerCase());
    var value = "(" + email + "," + email + ",0,NOW(),1,'temp','temp',NOW()," +
    "'pass','instructor',0,'glasslabv2','invited')";
    return value;
}

Lic_MySQL.prototype.multiInsertLicenseMap = function(licenseId, userIds, invite){
    return when.promise(function(resolve, reject){
        var inputs = [];
        var startValues;
        if(invite){
            startValues = "('invite-pending',NOW()," + this.ds.escape(licenseId) + ",";
        } else{
            startValues = "('pending',NOW()," + this.ds.escape(licenseId) + ",";
        }
        userIds.forEach(function(id){
            inputs.push(startValues + this.ds.escape(id) + ")")
        });
        var insertValues = inputs.join(',');

        var Q = "INSERT INTO GL_LICENSE_MAP (status,date_created,license_id,user_id) VALUES " + insertValues + ";";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            }.bind(this))
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Multi Insert License Map Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.multiGetLicenseMap = function(licenseId, userIds){
    return when.promise(function(resolve, reject){
        var Q = "SELECT * FROM GL_LICENSE_MAP WHERE user_id in (" + this.ds.escape(userIds) + ") " +
            " AND license_id = " + this.ds.escape(licenseId) + ";";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("Multi Get License Map Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.multiUpdateLicenseMapStatus = function(licenseId, userIds, status){
    return when.promise(function(resolve, reject){
        var Q = "UPDATE GL_LICENSE_MAP SET status = " + this.ds.escape(status) +
            " WHERE user_id in(" + this.ds.escape(userIds) + ") " +
            " AND license_id = " + this.ds.escape(licenseId) + ";";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("Multi Update License Map Error -",err);
                reject(err);
            })
    }.bind(this));
};

Lic_MySQL.prototype.getUserById = function(userId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT * FROM GL_USER WHERE id = " + this.ds.escape(userId) + ";";
        this.ds.query(Q)
            .then(function(results){
                resolve(results[0]);
            })
            .then(null, function(err){
                console.errorExt("Get User By Id Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.getUserByEmail = function(email){
    return when.promise(function(resolve, reject){
        var Q = "SELECT * FROM GL_USER WHERE EMAIL = " + this.ds.escape(email) + ";";
        this.ds.query(Q)
            .then(function(results){
                resolve(results[0]);
            })
            .then(null, function(err){
                console.errorExt("Get User By Id Error -",err);
                reject(err);
            });
    }.bind(this));
};


Lic_MySQL.prototype.updateLicenseMapByLicenseInstructor = function(licenseId, userIds, updateFields){
  return when.promise(function(resolve, reject){
      var Q = "UPDATE GL_LICENSE_MAP SET " + this.ds.escape(updateFields) +
          "WHERE user_id IN (" + this.ds.escape(userIds) + ") " +
          "AND license_id = " + this.ds.escape(licenseId) +";";
      this.ds.query(Q)
          .then(function(results){
              resolve(results);
          }.bind(this))
          .then(null, function(err){
              console.errorExt("DataStore MySQL", "Update License Map By License Instructor Error -",err);
              reject(err);
          });
  }.bind(this));
};

Lic_MySQL.prototype.assignPremiumCourse = function(courseId){
    return when.promise(function(resolve, reject){
        var Q = "UPDATE GL_COURSE SET premium_games_assigned = TRUE WHERE id = " + this.ds.escape(courseId) + ";";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Assign Premium Course Error -", err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.unassignPremiumCourses = function(courses){
    return when.promise(function(resolve, reject){
        var Q = "UPDATE GL_COURSE SET premium_games_assigned = FALSE WHERE id in (" + this.ds.escape(courses) + ");";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Unassign Premium Courses Error -", err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.getLicenseFromPremiumCourse = function(courseId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT * FROM GL_LICENSE AS l JOIN\n" +
            "(SELECT license_id FROM GL_LICENSE_MAP AS lm JOIN\n" +
                "(SELECT user_id FROM GL_MEMBERSHIP WHERE ROLE = 'instructor' and course_id = " + this.ds.escape(courseId) + ") AS m\n" +
            "ON m.user_id = lm.user_id WHERE status IN('active','pending','po-received')) AS lm\n" +
            "ON lm.license_id = l.id;";
        this.ds.query(Q)
            .then(function(results){
                // if courseId does not refer to a premium course, output will be false
                results = results[0] || false;
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get License From Premium Course Error -",err);
                reject(err);
            });
    }.bind(this));
};

// need to edit once table schema has been approved
Lic_MySQL.prototype.insertToPurchaseOrderTable = function(values){
    return when.promise(function(resolve, reject){
        var Q = "INSERT INTO GL_PURCHASE_ORDER " +
            "(user_id,license_id,status,purchase_order_number," +
            "purchase_order_key,phone,email,name,payment,current_package_type,current_package_size_tier,action,date_created) " +
            "VALUES (" + this.ds.escape(values) + ");";
        this.ds.query(Q)
            .then(function(results){
                resolve(results.insertId);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Insert to Purchase Order Table Error -",err);
                reject(err);
            })
    }.bind(this));
};

Lic_MySQL.prototype.getActivePurchaseOrderByUserId = function(userId){
    // an active purchase order is one that is in progress, either with a status of pending or received
    return when.promise(function(resolve, reject){
        var Q = "SELECT * FROM GL_PURCHASE_ORDER WHERE status IN ('pending', 'received') and user_id = " + this.ds.escape(userId) + ";";
        this.ds.query(Q)
            .then(function(results){
                if(results.length > 1){
                    var err = { status: "There should only be one purchase order with status pending or received"};
                    console.errorExt("DataStore MySQL", "Get Active Purchase Order By User Id Error -",err);
                    reject(err);
                }
                var order = results[0] || "no active order";
                resolve(order);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get Active Purchase Order By User Id Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.getOpenPurchaseOrders = function() {
	return when.promise(function(resolve, reject){
		var Q = "SELECT * FROM GL_PURCHASE_ORDER WHERE status IN ('pending', 'received', 'invoiced');";
		this.ds.query(Q)
		.then(function(results){
			resolve(results);
		})
		.then(null, function(err){
			console.errorExt("DataStore MySQL", "Get Open Purchase Orders Error -",err);
			reject(err);
		});
	}.bind(this));
};

Lic_MySQL.prototype.getNotOpenPurchaseOrders = function() {
	return when.promise(function(resolve, reject){
		var Q = "SELECT * FROM GL_PURCHASE_ORDER WHERE status NOT IN ('pending', 'received', 'invoiced');";
		this.ds.query(Q)
		.then(function(results){
			resolve(results);
		})
		.then(null, function(err){
			console.errorExt("DataStore MySQL", "Get Open Purchase Orders Error -",err);
			reject(err);
		});
	}.bind(this));
};

Lic_MySQL.prototype.getOpenPurchaseOrderForUser = function( userId ) {
	return when.promise(function(resolve, reject){
		var Q = "SELECT * FROM GL_PURCHASE_ORDER WHERE status IN ('pending', 'received', 'invoiced') AND user_id = " + this.ds.escape(userId) + ";";
		this.ds.query(Q)
		.then(function(results){
			resolve(results);
		})
		.then(null, function(err){
			console.errorExt("DataStore MySQL", "Get Open Purchase Order for User Error -",err);
			reject(err);
		});
	}.bind(this));
};

Lic_MySQL.prototype.getPurchaseOrderByPurchaseOrderKey = function(key){
    return when.promise(function(resolve, reject){
        var Q = "SELECT * FROM GL_PURCHASE_ORDER WHERE purchase_order_key = " + this.ds.escape(key) + ";";
        this.ds.query(Q)
            .then(function(results){
                if(results.length > 1){
                    var err = { status: "key should be unique"};
                    console.errorExt("DataStore MySQL", "Get Purchase Order By Purchase Order Key Error -",err);
                    reject(error);
                }
                var order = results[0] || "no active order";
                resolve(order);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get Purchase Order By Purchase Order Key Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.getPurchaseOrderById = function(purchaseOrderId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT * FROM GL_PURCHASE_ORDER WHERE id = " + this.ds.escape(purchaseOrderId) + ";";
        this.ds.query(Q)
            .then(function(results){
                resolve(results[0]);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get Purchase Order By Id Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.updatePurchaseOrderById = function(purchaseOrderId, updateFields){
    return when.promise(function(resolve, reject){
        var Q = "UPDATE GL_PURCHASE_ORDER SET " + this.ds.escape(updateFields) +
            " WHERE id = " + this.ds.escape(purchaseOrderId) + ";";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Update Active Purchase Order By User Id Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.logResellerActionForPO = function(purchaseOrderId, logJSON){
	this.getPurchaseOrderById( purchaseOrderId )
		.then( function( purchaseOrder ) {
            if( !purchaseOrder || purchaseOrder === "no purchase order" ) {
            	reject( "no purchase order" );
            	return;
            }

            var resellerLog = [];
            var logStr = '';
            if ( !purchaseOrder[ "RESELLER_LOG" ] ) {
            	resellerLog.push( logJSON );
            	logStr = JSON.stringify( resellerLog );
            } else {
            	resellerLog = JSON.parse( purchaseOrder[ "RESELLER_LOG" ] );
            	resellerLog.push( logJSON );
            	logStr = JSON.stringify( resellerLog );
            }

			var updateFields = [];
			var resellerLog = {RESELLER_LOG: logStr};
			updateFields.push(resellerLog);

			return this.updatePurchaseOrderById( purchaseOrderId, updateFields );
		}.bind(this))
		.then( null, function(err ) {
			reject( err );
		})
};

Lic_MySQL.prototype.updateLicenseByPurchaseOrderId = function(purchaseOrderId, updateFields){
    return when.promise(function(resolve, reject){
        var Q = "UPDATE GL_LICENSE SET " + this.ds.escape(updateFields) +
            " WHERE purchase_order_id = " + this.ds.escape(purchaseOrderId) + ";";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Update License By Purchase Order Id");
                reject(err);
            });
    }.bind(this));
};

// only update most recent license map entry for a user, so a trial will not be altered when we shut down a bad purchase order
Lic_MySQL.prototype.updateRecentLicenseMapByUserId = function(userId, updateFields){
    return when.promise(function(resolve, reject){
        var Q = "UPDATE GL_LICENSE_MAP SET " + this.ds.escape(updateFields) +
            " WHERE user_id = " + this.ds.escape(userId) + " ORDER BY id DESC LIMIT 1;";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Update License Map By User Id Status Error -",err);
                reject(err);
            });
    }.bind(this));
};

// discovers the institution id from a given set of keys
Lic_MySQL.prototype.getInstitutionIdByKeys = function(keys){
    return when.promise(function(resolve, reject){
        var keysString = this.ds.escapeArray(keys).join(" and ");
        var Q = "SELECT * FROM GL_INSTITUTION WHERE " + keysString + ";";
        this.ds.query(Q)
            .then(function(results){
                if(results && results.length > 0){
                    resolve(results[0].id);
                } else{
                    resolve();
                }
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get Institution Id By Keys Error -",err);
                reject(err);
            })
    }.bind(this));
};

Lic_MySQL.prototype.insertToInstitutionTable = function(values){
    return when.promise(function(resolve, reject){
        var Q = "INSERT INTO GL_INSTITUTION\n" +
            "(version,CITY,code,ENABLED,SECRET,SHARED,STATE,TITLE,ZIP,ADDRESS,DATE_CREATED,LAST_UPDATED)\n" +
            "VALUES (" + this.ds.escape(values) + ");";
        this.ds.query(Q)
            .then(function(results){
                resolve(results.insertId);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Insert To Institution Table Error -",err);
                reject(err);
            })
    }.bind(this));
};

Lic_MySQL.prototype.getLicensesForInspection = function(){
    return when.promise(function(resolve, reject){
        var Q = "SELECT lm.status, l.* FROM GL_LICENSE as l\n" +
        "JOIN (SELECT * FROM GL_LICENSE_MAP WHERE status in ('renew', 'active', 'po-received')) as lm\n" +
        "ON l.id = lm.license_id AND l.user_id = lm.user_id\n" +
        "WHERE (l.active = 1) OR (l.active = 0 AND lm.status = 'renew');";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get Licenses For Expire Renew Error -",err);
                reject(err);
            });
    }.bind(this));
};

Lic_MySQL.prototype.getLicenseMapByLicenseId = function(licenseId){
    return when.promise(function(resolve, reject){
        var Q = "SELECT * FROM GL_LICENSE_MAP WHERE license_id = " + this.ds.escape(licenseId) + ";";
        this.ds.query(Q)
            .then(function(results){
                resolve(results);
            })
            .then(null, function(err){
                console.errorExt("DataStore MySQL", "Get License Map By License Error -",err);
                reject(err);
            });
    }.bind(this));
};

///////////////////////////////////////////
/////////////OUTDATED METHODS/////////////
/////////////////////////////////////////

// add lic map table and add game_id to license table
Lic_MySQL.prototype.updateLicenseTable = function() {
// add promise wrapper
return when.promise(function(resolve, reject) {
// ------------------------------------------------
    resolve( {} );
    return;

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
                //resolve(false);
            } else {
                reject(err);
            }
        }.bind(this))

        .then(function(results) {
            if(!results) return;

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
        }.bind(this))

        .then(function() {
            //console.log("updateLicenseTable added to map:", results);

            // check that GL_LICENSE has game_id
            Q = "DESCRIBE GL_LICENSE";
            return this.ds.query(Q);
        }.bind(this))

        .then(function(results) {
            if(results) {

                var updating = true;
                for(var i = 0; i < results.length; i++) {
                    if (results[i]['Field'] == 'game_id') {
                        updating = false;
                        break;
                    }
                }

                if(updating) {
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
                } else {
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
