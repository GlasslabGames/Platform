/**
 * Authentication Const Module
 *
 *
 */

module.exports = {
    webappSessionPrefix: "wa_session",
    sessionCookieName:  "JSESSIONID",
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
            learning:   "learning.com"
        }
    }
};
