/**
 * @description 简单的静态文件合并服务器，该服务器需要支持类似以下格式的JS或CSS文件合并请求
 * @example http://assets.example.com/foo/??bar.js,baz.js   ||   http://assets.example.com/foo/bar.js
 * 
 * @desc ??是一个分隔符，之前是需要合并的多个文件的URL的公共部分，之后是使用,分隔的差异部分
 */

var fs = require('fs'),
    path = require('path'),
    http = require('http');

var MIME = {
'.css': 'text/css',
'.js': 'application/javascript'
};

// 串行读取数据， 多个文件，耗时
// function combineFiles(pathnames, callback) {
//   var output = [];

//   (function next(i, len) {
//       if (i < len) {
//           fs.readFile(pathnames[i], function (err, data) {
//               if (err) {
//                   callback(err);
//               } else {
//                   output.push(data);
//                   next(i + 1, len);
//               }
//           });
//       } else {
//           callback(null, Buffer.concat(output));
//       }
//   }(0, pathnames.length));
// }

// 数据流输出
function outputFiles(pathnames, writer) {
  (function next(i, len) {
      if (i < len) {
          var reader = fs.createReadStream(pathnames[i]);

          reader.pipe(writer, { end: false });
          reader.on('end', function() {
              next(i + 1, len);
          });
      } else {
          writer.end();
      }
  }(0, pathnames.length));
}

// 校验文件
function validateFiles(pathnames, callback) {
  (function next(i, len) {
      if (i < len) {
          fs.stat(pathnames[i], function (err, stats) {
              if (err) {
                  callback(err);
              } else if (!stats.isFile()) {
                  callback(new Error());
              } else {
                  next(i + 1, len);
              }
          });
      } else {
          callback(null, pathnames);
      }
  }(0, pathnames.length));
}

function parseURL(root, url) {
  var base, pathnames, parts;

  if (url.indexOf('??') === -1) {
      url = url.replace('/', '/??');
  }

  parts = url.split('??');
  base = parts[0];
  pathnames = parts[1].split(',').map(function (value) {
      return path.join(root, base, value);
  });

  return {
      // extname 扩展名
      mime: MIME[path.extname(pathnames[0])] || 'text/plain',
      pathnames: pathnames
  };
}

function main(argv) {
  var config = JSON.parse(fs.readFileSync(argv[0], 'utf-8')),
      root = config.root || '.',
      port = config.port || 80;
  var server;



  server = http.createServer(function (request, response) {
      var urlInfo = parseURL(root, request.url);

      // combineFiles(urlInfo.pathnames, function (err, data) {
      //     if (err) {
      //         response.writeHead(404);
      //         response.end(err.message);
      //     } else {
      //         response.writeHead(200, {
      //             'Content-Type': urlInfo.mime
      //         });
      //         response.end(data);
      //     }
      // });
      validateFiles(urlInfo.pathnames, function (err, pathnames) {
        if (err) {
            response.writeHead(404);
            response.end(err.message);
        } else {
            response.writeHead(200, {
                'Content-Type': urlInfo.mime
            });
            outputFiles(pathnames, response);
        }
      });
  }).listen(port);
  
  process.on('SIGTERM', function () {
    server.close(function () {
        process.exit(0);
    });
});
}

main(process.argv.slice(2));
