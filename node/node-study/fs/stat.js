/**
 * 文件状态
 * fs.stat() vs fs.fstat()：传文件路径 vs 文件句柄。
 * fs.stat() vs fs.lstat()：如果文件是软链接，那么fs.stat()返回目标文件的状态，fs.lstat()返回软链接本身的状态。
 */

var fs = require('fs');

var getTimeDesc = function(d){
    return [d.getFullYear(), d.getMonth()+1, d.getDate()].join('-') + ' ' + [d.getHours(), d.getMinutes(), d.getSeconds()].join(':');
};

fs.stat('./fileForStat.txt', function(err, stats){
    console.log('文件大小: ' + stats.size);
    console.log('创建时间: ' + getTimeDesc(stats.birthtime));
    console.log('访问时间: ' + getTimeDesc(stats.atime));
    console.log('修改时间: ' + getTimeDesc(stats.mtime));
});
