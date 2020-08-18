/**
 * NodeJS通过fs内置模块提供对文件的操作
 * 
 */

const fs = require("fs");

// // 异步
// fs.readFile(pathname, function (err, data) {
//   if (err) {
//       // Deal with error.
//   } else {
//       // Deal with data.
//   }
// });

// // 同步
// try {
//   var data = fs.readFileSync(pathname);
//   // Deal with data.
// } catch (err) {
//   // Deal with error.
// }


// ? 文件写入，会先清空当前内容，再写入

// 异步
fs.writeFile('./text.txt', '异步写入内容', 'utf8', function(err){
  if(err) throw err;
  console.log('文件写入成功');
});

// 同步写入
try{
  fs.writeFileSync('./fileForWrite1.txt', '同步写入内容', 'utf8');
  console.log('文件写入成功');
}catch(err){
  throw err;
}

var data;

// 同步
try{
  data = fs.readFileSync('./text.txt', 'utf8');
  console.log('文件内容: ' + data);
}catch(err){
  console.error('读取文件出错: ' + err.message);
}

// 异步
fs.readFile('./text.txt', 'utf8', function(err, data){
  if(err){
    return console.error('读取文件出错: ' + err.message);
  }
  console.log('文件内容: ' + data);
});