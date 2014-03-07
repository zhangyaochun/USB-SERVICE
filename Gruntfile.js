'use strict';
var fs = require('fs');
var rimraf = require('rimraf');

var lrSnippet = require('connect-livereload')();

var mountFolder = function (connect, dir) {
    return connect.static(require('path').resolve(dir));
};

module.exports = function (grunt) {
    // load all grunt tasks
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    // configurable paths
    var pathConfig = {
        app : 'app',
        dist : 'dist',
        tmp : 'tmp'
    };

    grunt.initConfig({
        paths : pathConfig,
        watch : {
            compass : {
                files : ['<%= paths.app %>/compass/{,*/}*/{,*/}*.{scss,sass,png,ttf}'],
                tasks : ['compass:server']
            },
            test : {
                files : ['<%= paths.app %>/javascripts/**/*.js'],
                tasks : ['jshint:test'],
                options : {
                    spawn : false
                }
            },
            livereload : {
                files : [
                    '<%= paths.app %>/*.html',
                    '<%= paths.app %>/javascripts/**/*.js',
                    '<%= paths.app %>/images/**/*.*',
                    '<%= paths.tmp %>/stylesheets/**/*.css',
                    '<%= paths.tmp %>/images/**/*.*'
                ],
                options : {
                    livereload : true,
                    spawn : false
                }
            }
        },
        connect : {
            options : {
                port : 9999,
                hostname : '0.0.0.0'
            },
            rules : [{
                from : '^/index',
                to : '/index.html'
            }],
            server : {
                options : {
                    middleware : function (connect) {
                        return [
                            lrSnippet,
                            rewriteRulesSnippet,
                            mountFolder(connect, pathConfig.tmp),
                            mountFolder(connect, pathConfig.app)
                        ];
                    }
                }
            }
        },
        open : {
            server : {
                path : 'http://127.0.0.1:<%= connect.options.port %>',
                app : 'Google Chrome Canary'
            }
        },
        clean : {
            i18n : ['usb-service'],
            dist : ['<%= paths.tmp %>', '<%= paths.dist %>'],
            server : '<%= paths.tmp %>'
        },
        useminPrepare : {
            html : ['<%= paths.app %>/**/*.html'],
            options : {
                dest : '<%= paths.dist %>'
            }
        },
        usemin : {
            html : ['<%= paths.dist %>/*.html'],
            options : {
                dirs : ['<%= paths.dist %>']
            }
        },
        htmlmin : {
            dist : {
                files : [{
                    expand : true,
                    cwd : '<%= paths.app %>',
                    src : ['*.html'],
                    dest : '<%= paths.dist %>'
                }]
            }
        },
        copy : {
            tmp : {
                files : [{
                    expand : true,
                    dot : true,
                    cwd : '<%= paths.app %>',
                    dest : '<%= paths.tmp %>',
                    src : [
                        'images/**/*.{webp,gif,png,jpg,jpeg}',
                        'compass/**/*.{sass,scss,png,ttf}',
                        'thirdparty/**/*'
                    ]
                }]
            },
            dist : {
                files : [{
                    expand : true,
                    dot : true,
                    cwd : '<%= paths.tmp %>',
                    dest : '<%= paths.dist %>',
                    src : [
                        'images/**/*.{webp,gif,png,jpg,jpeg}',
                        'stylesheets/**/*'
                    ]
                }]
            }
        },
        compass : {
            options : {
                sassDir : '<%= paths.app %>/compass/sass',
                cssDir : '<%= paths.tmp %>/stylesheets',
                imagesDir : '<%= paths.app %>/compass/images',
                fontsDir : '<%= paths.app %>/compass/fonts',
                relativeAssets : true
            },
            tmp : {
                options : {
                    sassDir : '<%= paths.tmp %>/compass/sass',
                    imagesDir : '<%= paths.tmp %>/compass/images',
                    generatedImagesDir : '<%= paths.tmp %>/images',
                    outputStyle : 'compressed',
                    relativeAssets : true
                }
            },
            dist : {
                options : {
                    cssDir : '<%= paths.dist %>/stylesheets',
                    generatedImagesDir : '<%= paths.dist %>/images',
                    outputStyle : 'compressed',
                    relativeAssets : false
                }
            },
            server : {
                options : {
                    cssDir : '<%= paths.tmp %>/stylesheets',
                    generatedImagesDir : '<%= paths.tmp %>/images',
                    debugInfo : true
                }
            }
        },
        rev : {
            dist : {
                files : {
                    src : [
                        '<%= paths.dist %>/javascripts/**/*.js',
                        '<%= paths.dist %>/stylesheets/**/*.css'
                    ]
                }
            }
        },
        imagemin : {
            dist : {
                files : [{
                    expand : true,
                    cwd : '<%= paths.dist %>/images',
                    src : '**/*.{png,jpg,jpeg}',
                    dest : '<%= paths.dist %>/images'
                }]
            }
        },
        requirejs : {
            dist : {
                options : {
                    optimize : 'uglify',
                    uglify : {
                        toplevel : true,
                        ascii_only : false,
                        beautify : false
                    },
                    preserveLicenseComments : true,
                    useStrict : false,
                    wrap : true
                }
            }
        },
        jshint : {
            test : ['<%= paths.app %>/javascripts/**/*.js']
        },
        bump : {
            options : {
                files : ['package.json', 'bower.json'],
                updateConfigs : [],
                commit : true,
                commitMessage : 'Release v%VERSION%',
                commitFiles : ['-a'],
                createTag : true,
                tagName : 'v%VERSION%',
                tagMessage : 'Version %VERSION%',
                push : false
            }
        }
    });

    grunt.registerTask('server', [
        'clean:server',
        'compass:server',
        'connect:server',
        'configureRewriteRules',
        'open',
        'watch'
    ]);

    grunt.registerTask('test', [
        'jshint:test',
    ]);

    grunt.registerTask('test:travis', [
        'jshint:test',
    ]);

    function getType(source){  
        return source.toLowerCase().substring(source.lastIndexOf('.')+1);  
    } 

    //递归复制
    function copyFolderRecursive(source,dist,nls){
        if(!fs.existsSync(source)){
            grunt.fail.warn('Cannot finde path: ' + source)
            return;
        }

        //如果是目录的化
        if(fs.statSync(source).isDirectory()){
            fs.readdirSync(source).forEach(function(file){

                var curPath = source + '/' + file,
                    distPath = dist + '/' + file;
                if(fs.statSync(curPath).isDirectory()){
                    copyFolderRecursive(curPath,distPath);
                }else{
                    //判断是否是html，如果是html只拷贝nls相关的
                    if(getType(file) == 'html' && !grunt.util._.include(file,nls)){
                        //do nothing
                    }else{
                        grunt.file.copy(curPath,distPath);
                    }
                    
                }

            });
        }else{
            //只是文件的化，直接copy
            //注意dist如果是目录，会：Unable to write "**" file (Error code: EISDIR)
            if(fs.statSync(dist).isDirectory()){
                grunt.file.copy(source,dist+'/'+source);
            }
            
        }
    }

    //在dist完成后去打包一份nls文件夹
    grunt.registerTask('processI18n',function(nls){
        
        var nlsPath = 'usb-service/' + nls;

        //如果一级不存在，就创建
        if(!fs.existsSync('usb-service')){
            fs.mkdirSync('usb-service');
        }

        //如果存在,删掉它
        if(fs.existsSync('usb-service') && fs.existsSync(nlsPath)){
            rimraf.sync(nlsPath);
        }
        //创建一级
        fs.mkdirSync(nlsPath);


        //多传一个nls，来copy不一样的文件把
        copyFolderRecursive(pathConfig.dist,nlsPath,nls);
        
        //copyFolderRecursive('install.sh','zh-cn');

    });


    //for i18n
    //@nls zh-cn,en-us  ...
    grunt.registerTask('build',function(nls){

        //考虑多个nls
        var nlss = nls ? nls.toLowerCase().split(',') : ['zh-cn'];
        console.log(nlss);

        var taskList = [
            'clean:dist',
            'copy:tmp',
            'compass:tmp',
            'copy:dist',
            'useminPrepare',
            'concat',
            'uglify',
            'imagemin',
            'htmlmin',
            'rev',
            'usemin',
            'clean:i18n'
        ];

        nlss.forEach(function(nls){
            taskList.push('processI18n:' + nls);
        });

        grunt.task.run(taskList);
    });
};
