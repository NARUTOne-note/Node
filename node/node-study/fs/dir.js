/**
 * 文件夹dir
 * fs.readdirSync(path[, options])
 */

var fs = require('fs');
var path = require('path');

// 递归遍历
var getFilesInDir = function(dir) {
  var results = [ path.resolve(dir) ];
  var files = fs.readdirSync(dir, 'utf8');
  files.forEach(function(file) {
    file = path.resolve(dir, file);

    var stats = fs.statSync(file); // 返回dirent类

    // 是否是普通文件
    if(stats.isFile()){
      results.push(file);
    }else if(stats.isDirectory()){
      results = results.concat(getFilesInDir(file));
    }
  })
  return results;
}

var files = getFilesInDir('../fs');
console.log(files);
