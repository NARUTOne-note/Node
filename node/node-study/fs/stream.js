/**
 * stream 数据流
 * 基于事件机制工作，所有Stream的实例都继承于NodeJS提供的EventEmitter。
 */

var rs = fs.createReadStream(src);

rs.on('data', function (chunk) {
  if (ws.write(chunk) === false) { // 判断传入的数据是写入目标了，还是临时放在了缓存了
      rs.pause();
  }
});

rs.on('end', function () {
  ws.end();
});

ws.on('drain', function () {
  rs.resume();
});