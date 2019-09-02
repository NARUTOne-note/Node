/**
 * 为了解决简化JS 异步代码的异常处理
 * 域： 简单的讲，一个域就是一个JS运行环境，在一个运行环境中，如果一个异常没有被捕获，将作为一个全局异常被抛出
 */

// NodeJS官方文档里都强烈建议处理完异常后立即重启程序，而不是让程序继续运行。按照官方文档的说法，发生异常后的程序处于一个不确定的运行状态，
// 如果不立即退出的话，程序可能会发生严重内存泄漏，也可能表现得很奇怪  

// 使用uncaughtException或domain捕获异常，代码执行路径里涉及到了C/C++部分的代码时, 而JS的异常抛出机制可能会打断正常的代码执行流程，导致C/C++部分的代码表现异常，进而导致内存泄漏等问题

// 捕获全局异常

process.on('uncaughtException', function (err) {
  console.log('Error: %s', err.message);
});

setTimeout(function (fn) {
  fn();
});

// Error: undefined is not a function

// 域监控http异常

function async(request, callback) {
  // Do something.
  asyncA(request, function (data) {
      // Do something
      asyncB(request, function (data) {
          // Do something
          asyncC(request, function (data) {
              // Do something
              callback(data);
          });
      });
  });
}

http.createServer(function (request, response) {
  var d = domain.create();

  d.on('error', function () {
      response.writeHead(500);
      response.end();
  });

  d.run(function () {
      async(request, function (data) {
          response.writeHead(200);
          response.end(data);
      });
  });
});

