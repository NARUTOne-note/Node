/**
 * @description 简单的静态文件合并服务器，该服务器需要支持类似以下格式的JS或CSS文件合并请求
 * @example http://assets.example.com/foo/??bar.js,baz.js   ||   http://assets.example.com/foo/bar.js
 * 
 * @desc ??是一个分隔符，之前是需要合并的多个文件的URL的公共部分，之后是使用,分隔的差异部分
 */

var fs = require('fs'),
    path = require('path'),
    http = require('http');

var MIME = {
'.css': 'text/css',
'.js': 'application/javascript'
};
