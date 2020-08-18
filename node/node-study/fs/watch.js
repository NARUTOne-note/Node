/**
 * fs.watch()
 * 文件监听修改
 * fs.watch()比fs.watchFile()高效很多 ?
 */

var fs = require('fs');

// fs.watchFile()
// 实现原理：轮询。每隔一段时间检查文件是否发生变化。所以在不同平台上表现基本是一致的。

var options = {
  persistent: true,  // 默认就是true
  interval: 2000  // 多久检查一次
};

// curr, prev 是被监听文件的状态, fs.Stat实例
// 可以通过 fs.unwatch() 移除监听
fs.watchFile('./text.txt', options, function(curr, prev){
  console.log('修改时间为: ' + curr.mtime);
});

// fs.watch()
// 1 不同平台不一致表现；2、有些场景不可用：网络文件系统；3、recursive这个选项只在mac、windows下可用

var options2 = {
  persistent: true,
  recursive: true,
  encoding: 'utf8'
};

fs.watch('../', options2, function(event, filename){
  console.log('触发事件:' + event);
  if(filename){
      console.log('文件名是: ' + filename);
  }else{
      console.log('文件名是没有提供');
  }
});