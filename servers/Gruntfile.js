module.exports = function (grunt) {
    'use strict';

    grunt.initConfig({
        pkg: grunt.file.readJSON('./package.json'),

        mochaTest: {
            test: {
                options: {
									reporter: 'spec',
									timeout: 3000
                },
                src: ['supertest/*.js']
            }
        },

        "git-describe": {
            options: {
                cwd:       ".",
                commitish: "master",
                failOnError: false,
                template: "{%=tag%}-{%=since%}-{%=object%}{%=dirty%}",
                prop: 'meta.revision'
            },
            default: {}
        }

    });

    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-git-describe');

    grunt.registerTask('createVersionFile', 'Tag the current build revision', function () {
        grunt.event.once("git-describe", function(rev){
            //grunt.log.writeln("Git Revision: ", rev);
            grunt.file.write('./version.json', JSON.stringify({
                tag: rev.tag,
                since: rev.since,
                object: rev.object,
                revision: rev.toString(),
                date: grunt.template.today()
            }));
        });
        grunt.task.run('git-describe');
    });

    grunt.registerTask('default', ['createVersionFile']);
    grunt.registerTask('test', ['mochaTest']);

};
