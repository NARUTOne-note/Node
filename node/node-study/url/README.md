# URL 模块

> url解析

```js
var url = require('url');
```

- protocol：协议，需要注意的是包含了:，并且是小写的。
- slashes：如果:后面跟了两个//，那么为true。
- auth：认证信息，如果有密码，为usrname:passwd，如果没有，则为usrname。注意，这里区分大小写。
- host：主机名。注意包含了端口，比如ke.qq.com:8080，并且是小写的。
- hostname：主机名，不包含端口，并且是小写的。
- hash：哈希部分，注意包含了#。
- search：查询字符串，注意，包含了?，此外，值是没有经过decode的。
- query：字符串 或者 对象。如果是字符串，则是search去掉?，其余一样；如果是对象，那么是decode过的。
- path：路径部分，包含search部分。
- pathname：路径部分，不包含search部分。
- href：原始的地址。不过需要注意的是，protocol、host会被转成小写字母。

## querystring

> url查询参数的解析

```js
var querystring = require('querystring');

var str1 = 'nick=casper&age=24&extra=name-chyingp|country-cn';
var obj1 = querystring.parse(str1);
var obj2 = querystring.parse(obj1.extra, '|', '-');
console.log(JSON.stringify(obj2, null, 4));

var obj3 = {
    "nick": "casper",
    "age": "24"
};
var str2 = querystring.stringify(obj3);
console.log(str2);

var obj4 = {
    "name": "chyingp",
    "country": "cn"
};
var str3 = querystring.stringify(obj4, '|', '-');
console.log(str3);
```
