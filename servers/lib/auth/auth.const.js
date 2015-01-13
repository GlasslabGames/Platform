/**
 * Authentication Const Module
 *
 *
 */

module.exports = {
    webappSessionPrefix: "wa_session",
    sessionCookieName:  "JSESSIONID",
    support: {
      email: "support@glasslabgames.org"
    },
    code: {
        type: {
            institution: "institution",
            course:      "course",
            license:     "license"
        }
    },
    encrypt: {
        type: {
            pdkdf2: "{X-PDKDF2}"
        },
        algo: {
            hmacsha1: "HMACSHA1"
        }
    },
    login: {
        type: {
            glassLabV1: "",
            glassLabV2: "glasslabv2",
            edmodo:     "edmodo",
            learning:   "learning.com",
            docent:     "docent",
            icivics:    "icivics",
            google:     "google",
            clever:     "clever"
        }
    },
    passwordReset: {
        expirationInterval: 10800000, // 3 hours in milliseconds
        status: {
            sent:       "sent",
            inProgress: "in progress"
        }
    },
    verifyCode: {
        expirationInterval: 6048000000, // 1 week in milliseconds
        status: {
            sent:       "sent",
            verified:   "verified",
            beta:       "beta",
            approve:    "approve"
        }
    },
    datastore: {
        keys: {
            user: "u",
            device: "d",
            developer: "di"
        }
    },
    permits: {
      instructor: {
          nav: {
              dashboard: true,
              games:     true,
              courses:   true,
              reports:   true,
              support:   true,
              parser:    false
          }
      },
      developer: {
          nav: {
              dashboard: true,
              games:     true,
              courses:   true,
              reports:   true,
              support:   true,
              parser:    true
          }
      },
      admin: {
          nav: {
              dashboard: true,
              games:     true,
              courses:   true,
              reports:   true,
              support:   true,
              parser:    true
          }
      }
    }
};
