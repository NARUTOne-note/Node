/**
 * 服务端启动服务监听
 */

const http = require('http');
var url = require('url');

// req: http.IncomingMessage
// res: http.ServerResponse
const server = http.createServer(function(req, res) {
  console.log( '1、客户端请求url：' + req.url );
  console.log( '2、http版本：' + req.httpVersion );
  console.log( '3、http请求方法：' + req.method );
  console.log( '4、http请求头部' + JSON.stringify(req.headers) );

  // 获取get参数
  var urlObj = url.parse(req.url);
  var query = urlObj.query;
  var queryObj = querystring.parse(query);
  console.log( JSON.stringify(queryObj) );

  // 获取post参数
  /**
   * var body = '';  
    req.on('data', function(thunk){
        body += thunk;
    });

    req.on('end', function(){
        console.log( 'post body is: ' + body );
        res.end('ok');
    }); 
   */

  res.writeHead(200, {'content-type': 'text/plain'});
  // 方法二
  // res.setHeader('Content-Type', 'text-plain');

  res.setTimeout(30000, function() {
    console.log('请求超时');
    res.end('timeout');
  })

  req.on('aborted', function(){
    console.log('客户端请求aborted');
  });

  req.on('close', function(){
      console.log('客户端请求close');
  });

  req.on('error', function(error){
    console.log('服务端：req error: ' + error.message);
  });

  res.end('ok');
  // res.write('ok', 'utf8')
});

server.listen(3000);
