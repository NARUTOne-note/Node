/**
 * http 服务
 * 127.0.0.1:2000
 */

var http = require('http');

http.createServer(function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT');
  res.setHeader('Access-Control-Allow-Headers', 'token');
  res.setHeader('Access-Control-Max-Age', 60) // 1分钟有效请求1次
  res.write('success');
  res.end();
}).listen(2000);
