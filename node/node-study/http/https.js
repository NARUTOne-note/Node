/**
 * https模块与http模块极为类似，区别在于https模块需要额外处理SSL证书。
 */

var options = {
  key: fs.readFileSync('./ssl/default.key'),
  cert: fs.readFileSync('./ssl/default.cer')
};

var server = https.createServer(options, function (request, response) {
  // ...
});