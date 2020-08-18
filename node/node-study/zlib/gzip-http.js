/**
 * 服务端gzip压缩
 * 1、判断accept-encoding 值为gzip
 */

var http = require('http');
var zlib = require('zlib');
var fs = require('fs');

const FILE_PATH = './text.txt';
// var responseText = 'hello world';

var server = http.createServer(function(req, res) {
  var acceptEncoding = req.headers['accept-encoding'];
  var gzip;
  
  if(acceptEncoding.indexOf('gzip')!=-1){ // 判断是否需要gzip压缩
    
    // const zipStr = zlib.gzipSync(responseText);
    gzip = zlib.createGzip();
    
    // 记得响应 Content-Encoding，告诉浏览器：文件被 gzip 压缩过
    res.writeHead(200, {
        'Content-Encoding': 'gzip'
    });
    fs.createReadStream(FILE_PATH).pipe(gzip).pipe(res);

    // res.end(zipStr);
  
  }else{
    fs.createReadStream(FILE_PATH).pipe(res);
  }
})

server.listen('3000');
