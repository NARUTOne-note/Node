/**
 * fs.rename(oldPath, newPath, callback)
 */

var fs = require('fs');

fs.rename('./hello', './world', function(err){
    if(err) throw err;
    console.log('重命名成功');
});

fs.renameSync('./world', './hello');