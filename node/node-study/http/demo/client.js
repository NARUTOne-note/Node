/**
 * client 发起请求
 */

const http = require('http');

// res: http.IncomingMessage
const client = http.get('http://127.0.0.1:3000/hello?nick=chyingp&hello=world', function(res) {
  
  console.log('1、http版本：' + res.httpVersion);
  console.log('2、返回状态码：' + res.statusCode);
  console.log('3、返回状态描述信息：' + res.statusMessage);
  console.log('4、返回正文：');

  res.setEncoding('utf8');
  
  const body = null;
  res.on('data', function (chunk) {
    body = chunk;
  });

  res.on('end', function () {
    console.log(body);
  });

  setTimeout(function(){
    client.abort();  // 超时30s，取消请求
  }, 30000);   

  // 进程输出
  res.pipe(process.stdout);
})

// post request
var options = {
  protocol: 'http:',
  hostname: 'id.qq.com',
  port: '80',
  path: '/',
  method: 'GET'
};

var client = http.request(options, function(res){
  var data = '';
  res.setEncoding('utf8');
  res.on('data', function(chunk){
      data += chunk;
  });
  res.on('end', function(){
      console.log(data);
  });
});

client.end();