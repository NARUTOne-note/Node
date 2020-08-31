//  1、读取图片二进制数据 -> 2、转成base64字符串 -> 3、转成datauri。
var fs = require('fs');
var filepath = './1.png';

var bData = fs.readFileSync(filepath);
var base64Str = bData.toString('base64');
var datauri = 'data:image/png;base64,' + base64Str;

console.log(datauri);
