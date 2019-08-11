/**
 * CommonJS模块规范(CMD)，每个文件一个模块，独立作用域
id 模块的标识
filename 模块文件名（绝对路径）
loaded 布尔值，表示模块是否已经完成加载
parent 引用该模块的模块
children 一个数组，表示该模块要用到的其他模块
exports 表示模块对外输出的值
paths 引用当前模块时的搜寻路径
 */

// module.exports = 'hello';

module.exports = {name: 'hello'};
// var exports = module.exports, 两者存一
// modules.exports 最多的用途是替换当前模块的导出对象
exports.say = () => {
  // ...
}

console.log(module); // 模块信息
console.log(module.paths);

// ! 一个模块中的JS代码仅在模块第一次被使用时执行一次，并在执行过程中初始化模块的导出对象。之后，缓存起来的导出对象被重复利用

/*
var counter1 = require('./util/counter');
var    counter2 = require('./util/counter');

console.log(counter1.count()); // 1
console.log(counter2.count()); // 2
console.log(counter2.count()); // 3
*/

/**
 * NODE_PATH环境变量
 * 与PATH环境变量类似，NodeJS允许通过NODE_PATH环境变量来指定额外的模块搜索路径。
 * NODE_PATH环境变量中包含一到多个目录路径，路径之间在Linux下使用:分隔，在Windows下使用;分隔
 */