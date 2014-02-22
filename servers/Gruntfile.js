module.exports = function(grunt){

    grunt.initConfig({
        pkg: grunt.file.readJSON('./package.json'),
    
        mocha: {
            all: {
                options: {
                    log: true,
                    reporter: 'Spec',
                    run: false,
                    timeout: 10000,
                    urls: ['http://localhost:<%= connect.test.options.port %>/index.html']
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-mocha');
    grunt.registerTask('default', ['mocha']);
};