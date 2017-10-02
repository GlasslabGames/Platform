CREATE TABLE GL_NOTE (
    id bigint(20) PRIMARY KEY NOT NULL AUTO_INCREMENT,
    user_id bigint(20) NOT NULL,
    course_id bigint(20) NOT NULL,
    skill_id VARCHAR(255) NOT NULL,
    date datetime NOT NULL,
    student_group VARCHAR(255) NOT NULL,
    students text,
    note text,
    last_updated datetime NOT NULL,
    FOREIGN KEY(user_id) REFERENCES `GL_USER` (`id`),
    FOREIGN KEY(course_id) REFERENCES `GL_COURSE` (`id`)
);