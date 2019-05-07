/**
 * CommonJS模块规范，每个文件一个模块，独立作用域
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
exports.say = () => {
  // ...
}


console.log(module); // 模块信息
console.log(module.paths);
