var fs = require("fs");
var data = '';

//可读流
var readerStream = fs.createReadStream('js/input.txt');

readerStream.setEncoding('UTF8');

readerStream.on('data',function(chunk){
   data+=chunk;
});
readerStream.on('end',function(){
    console.log(data);
});
readerStream.on('error',function(err){
    console.log(err.stack);
});
console.log('程序执行完毕！');

//写入流，但会删去以前的内容
var data_1='WEB H5 Hello World 管道流';
var wwriteStream = fs.createWriteStream('js/input.txt');
wwriteStream.write(data_1,'UTF8');
//标记文件末尾
wwriteStream.end();
wwriteStream.on('finish',function(){
    console.log('写入完成');
    var result='';
    var readerStream = fs.createReadStream('js/input.txt');//作为参数传入不对
    readerStream.on('data',function(d){
        result +=d;
    });
    readerStream.on('end',function(){
        console.log(result);
    });
});
wwriteStream.on('error',function(err){
    console.log(err.stack);
});

console.log('ending....');

//管道流
var readStream_1 = fs.createReadStream('js/input.txt');
var writeStream_1 = fs.createWriteStream('js/output.txt');
//管道读写
readStream_1.pipe(writeStream_1);
console.log('管道读写成功！');

//链式流
//文件压缩，文件解压只需要将两个文件位置调换一下即可
var zlib = require('zlib');
fs.createReadStream('output.txt')
    .pipe(zlib.createGzip())
    .pipe(fs.createWriteStream('output.txt.gz'));
console.log('文件压缩成功！');
