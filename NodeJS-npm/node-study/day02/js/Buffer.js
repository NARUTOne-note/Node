//var buf = new Buffer(256);
//len = buf.write("www.baidu.com");
//console.log("写入字节数："+len);

var buf = new Buffer(26);
for(var i = 0;i<26;i++){
    buf[i]=i+97;
}
console.log(buf.toString('ascii'))//ascii,一种编码方式
console.log(buf.toString('ascii',0,5));
console.log(buf.toString('utf8',0,5));
console.log(buf.toString(undefined,0,5));//默认使用utf8编码


//JSON转换
buf = new Buffer("www.baidu.com");
var json = buf.toJSON(buf);
console.log(json);

//缓存区合并
var buf1 = new Buffer('火影忍者');
var buf2 = new Buffer('海贼王');
var buf3 = Buffer.concat([buf1,buf2]);
console.log("buf3的内容："+buf3.toString());

//缓存区比较
var buf4 = new Buffer("ABC");
var buf5 = new Buffer("ABCD");

var result1 = buf1.compare(buf2);
var result2 = buf4.compare(buf5);

console.log('buf1与buf2比较：'+result1+'  buf4与buf5比较：'+result2);

//缓存区拷贝
var buff1 = new Buffer("abc");
var buff2 = new Buffer(3);
buff1.copy(buff2);
console.log("buff2拷贝后的内容："+buff2.toString());

//裁剪
var buff3 = buff1.slice(0,2);
console.log('裁剪后buff3的内容：'+buff3.toString());
















