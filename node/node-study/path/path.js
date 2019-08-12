/**
 * path内置模块，简化路径相关操作
 */

var cache = {};

function store(key, value) {
  cache[path.normalize(key)] = value;
}

store('foo/bar', 1);
store('foo//baz//../bar', 2);
console.log(cache);  // => { "foo/bar": 2 }

// *标准化之后的路径里的斜杠在Windows系统下是\，而在Linux系统下是/。如果想保证任何系统下都使用/作为路径分隔符的话，需要用.replace(/\\/g, '/')再替换一下标准路径。

path.join('foo/', 'baz/', '../bar'); // => "foo/bar"

path.extname('foo/bar.js'); // => ".js"


// path.resolve() 方法将路径或路径片段的序列解析为绝对路径。给定的路径序列从右到左进行处理，每个后续的 path 前置，直到构造出一个绝对路径
path.resolve('/foo/bar', '/tmp/file/');
// 返回: '/tmp/file'

path.resolve('wwwroot', 'static_files/png/', '../gif/image.gif');
// 如果当前工作目录是 /home/myself/node，
// 则返回 '/home/myself/node/wwwroot/static_files/gif/image.gif'