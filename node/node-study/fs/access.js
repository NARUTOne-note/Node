/**
 * 文件是否存在
 * fs.exists()已经是deprecated状态，现在可以通过下面代码判断文件是否存在
 */

var fs = require('fs');

fs.access('./text.txt', function(err){
  if(err) throw err;
  console.log('text.txt存在');
});