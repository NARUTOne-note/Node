const http = require('http');
const iconv = require('iconv-lite');

// post gbk
const server = http.createServer(function(req, res) {
  let chunks = [];
  req.on('data', function(chunk) {
    console.log(chunk);
    chunks.push(chunk);
  });

  req.on('end', function() {
    chunks = Buffer.concat(chunks);
    // 对二进制进行解码
    var body = iconv.decode(chunks, 'gbk');
    console.log('req end');
    console.log(body);

    res.end('HELLO FROM SERVER');
  })
});

server.listen(3000);
