var fs = require('fs');

// 异步
fs.mkdir('./hello', function(err){
    if(err) throw err;
    console.log('目录创建成功');
});

// 同步
fs.mkdirSync('./hello');