/**
 * 作为服务端使用时，创建一个HTTP服务器，监听HTTP客户端请求并返回响应。
 */

// 服务端  首先需要使用.createServer方法创建一个服务器，然后调用.listen方法监听端口
var http = require('http');

http.createServer(function (request, response) {
  var body = [];

  console.log(request.method);
  console.log(request.headers);

  response.writeHead(200, { 'Content-Type': 'text/plain' });
  request.on('data', function (chunk) {
    body.push(chunk);
    response.write(chunk);
  });

  request.on('end', function () {
    body = Buffer.concat(body);
    console.log(body.toString());
    response.end();
  });
}).listen(80);

// 查看 127.0.0.1:80
