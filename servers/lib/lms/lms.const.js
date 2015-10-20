/**
 * LMS Consts
 *
 */

module.exports = {
    role: {
        admin:      		"admin",
        instructor: 		"instructor",
        student:    		"student",
        developer:  		"developer",
        reseller:			"reseller",
        reseller_candidate: "res-cand"
    },
    course: {
        type: {
            glasslab:   "glasslab",
            edmodo:     "edmodo",
            docent:     "docent",
            icivics:    "icivics",
            clever:     "clever"
        }
    },
    code: {
        length: 5,
        charSet: "1235789ABCDFGHJKLMNPQRSTUVWXYZ",
        type: {
            course: "course",
            institution: "institution"
        }
    },
    accessCode: {
        block: "12345"
    }
};
