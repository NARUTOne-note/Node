/**
 * 作为客户端使用时，发起一个HTTP客户端请求，获取服务端响应。
 * .request方法创建了一个客户端，并指定请求目标和请求头数据
 */

var http = require('http');

// post
var options = {
  hostname: 'www.example.com',
  port: 80,
  path: '/upload',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
};

var request = http.request(options, function (response) {});

// get简易
http.get('http://www.example.com/', function (response) {
  var body = [];

  console.log(response.statusCode);
  console.log(response.headers);

  response.on('data', function (chunk) {
    body.push(chunk);
  });

  response.on('end', function () {
    body = Buffer.concat(body);
    console.log(body.toString());
  });
});

request.write('Hello World');
request.end();
