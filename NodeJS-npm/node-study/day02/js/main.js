//阻塞代码
//var fs = require("fs");
//var data = fs.readFileSync("C:/Users/BFD_707/Desktop/node/day02/js/input.txt");
//console.log(data.toString());
//console.log("程序执行结束！");

//非阻塞代码，使用回调函数callback
// fs.readFile() 是异步函数用于读取文件
var fs = require("fs");
fs.readFile('C:/Users/BFD_707/Desktop/node/day02/js/input.txt',function(err,data){
    if(err){return console.error(err);}
    else{console.log(data.toString());}
});
console.log("程序执行结束！");

//总结：第一个实例在文件读取完后才执行完程序。
// 第二个实例我们呢不需要等待文件读取完，这样就可以在读取文件时同时执行接下来的代码，大大提高了程序的性能。
//阻塞按是按顺序执行的，而非阻塞是不需要按顺序的，所以如果需要处理回调函数的参数，我们就需要写在回调函数内。

