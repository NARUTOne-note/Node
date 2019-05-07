/**
 * http 服务
 */

var http = require('http')
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')  
  res.setHeader('Access-Control-Allow-Methods', 'PUT')
  res.setHeader('Access-Control-Allow-Headers', 'token')
  res.setHeader('Access-Control-Max-Age', 60) // 1分钟有效请求1次
  res.write('ok')
  res.end()
}).listen(2000)