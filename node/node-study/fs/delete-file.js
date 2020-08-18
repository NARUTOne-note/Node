/**
 * 删除文件 unlink/unlinkSync
 */

var fs = require('fs');

fs.unlink('./text.txt', function(err){
    if(err) throw err;
    console.log('文件删除成功');
});

fs.unlinkSync('./text.txt');
