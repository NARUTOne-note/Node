/**
 * https模块与http模块极为类似，区别在于https模块需要额外处理SSL证书。
 * @example 以下代码均为示例
 */

var options = {
  key: fs.readFileSync('./ssl/default.key'), // 私钥
  cert: fs.readFileSync('./ssl/default.cer'), // 公钥
  rejectUnauthorized: false // 禁止有效证书检查
};

var server = https.createServer(options, function (request, response) {
  var tmp = request.url; // => "/foo/bar?a=b"
  url.parse(tmp); // url更多API， https://nodejs.org/api/url.html； querystring处理参数转换格式
    /* =>
    { protocol: null,
      slashes: null,
      auth: null,
      host: null,
      port: null,
      hostname: null,
      hash: null,
      search: '?a=b',
      query: 'a=b',
      pathname: '/foo/bar',
      path: '/foo/bar?a=b',
      href: '/foo/bar?a=b' }
    */
  // 处理压缩包
  var i = 1024,
  data = '';

  while (i--) {
    data += '.';
  }

  if ((request.headers['accept-encoding'] || '').indexOf('gzip') !== -1) {
    zlib.gzip(data, function (err, data) {
        response.writeHead(200, {
            'Content-Type': 'text/plain',
            'Content-Encoding': 'gzip'
        });
        response.end(data);
    });
  } else {
    response.writeHead(200, {
      'Content-Type': 'text/plain'
    });
    response.end(data);
  }
}).listen(80);

// NodeJS支持SNI技术，可以根据HTTPS客户端请求使用的域名动态使用不同的证书，因此同一个HTTPS服务器可以使用多个域名提供服务

server.addContext('foo.com', {
  key: fs.readFileSync('./ssl/foo.com.key'),
  cert: fs.readFileSync('./ssl/foo.com.cer')
});

server.addContext('bar.com', {
  key: fs.readFileSync('./ssl/bar.com.key'),
  cert: fs.readFileSync('./ssl/bar.com.cer')
});

// 发起客户端https请求
var options = {
  hostname: 'www.example.com',
  port: 443,
  path: '/',
  method: 'GET'
};

var request = https.request(options, function (response) {
  var body = [];

  response.on('data', function (chunk) {
      body.push(chunk);
  });

  response.on('end', function () {
      body = Buffer.concat(body);
      // 接收处理压缩包
      if (response.headers['content-encoding'] === 'gzip') {
          zlib.gunzip(body, function (err, data) {
              console.log(data.toString());
          });
      } else {
          console.log(data.toString());
      }
  });
});

request.end();