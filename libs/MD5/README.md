# md5

> MD5（Message-Digest Algorithm）是计算机安全领域广泛使用的散列函数（又称哈希算法、摘要算法），主要用来确保消息的完整和一致性。常见的应用场景有密码保护、下载文件校验等

- 运算速度快：对jquery.js求md5值，57254个字符，耗时1.907ms
- 输出长度固定：输入长度不固定，输出长度固定（128位）。
- 运算不可逆：已知运算结果的情况下，无法通过通过逆运算得到原始字符串。
- 高度离散：输入的微小变化，可导致运算结果差异巨大。
- 弱碰撞性：不同输入的散列值可能相同。

在nodejs中，crypto模块封装了一系列密码学相关的功能，包括摘要运算

```js
var crypto = require('crypto');

function cryptPwd(password) {
    var md5 = crypto.createHash('md5');
    return md5.update(password).digest('hex');
}

// 输出：0cc175b9c0f1b6a831c399e269772661
console.log(cryptPwd('a'));

var password = '123456';
var cryptedPassword = cryptPwd(password);
console.log(cryptedPassword);
// 输出：e10adc3949ba59abbe56e057f20f883e
```

**注意**：相同的明文密码，md5值也是相同的；彩虹表就是这么进行暴力破解的，将常用的明文密码进行暴力匹配

## 加盐

> 就是在密码**特定位置插入特定字符串**后，再对修改后的字符串进行md5运算

```js
var crypto = require('crypto');

function cryptPwd(password, salt) {
    // 密码“加盐”
    var saltPassword = password + ':' + salt;
    console.log('原始密码：%s', password);
    console.log('加盐后的密码：%s', saltPassword);

    // 加盐密码的md5值
    var md5 = crypto.createHash('md5');
    var result = md5.update(saltPassword).digest('hex');
    console.log('加盐密码的md5值：%s', result);
}

cryptPwd('123456', 'abc');
// 输出：
// 原始密码：123456
// 加盐后的密码：123456:abc
// 加盐密码的md5值：51011af1892f59e74baf61f3d4389092

cryptPwd('123456', 'bcd');
// 输出：
// 原始密码：123456
// 加盐后的密码：123456:bcd
// 加盐密码的md5值：55a95bcb6bfbaef6906dbbd264ab4531
```

## 随机盐

- 短盐值：需要穷举的可能性较少，容易暴力破解，一般采用长盐值来解决。
- 盐值固定：类似的，攻击者只需要把常用密码+盐值的hash值表算出来，就完事大吉了

```js
var crypto = require('crypto');

function getRandomSalt(){
    return Math.random().toString().slice(2, 5);
}

function cryptPwd(password, salt) {
    // 密码“加盐”
    var saltPassword = password + ':' + salt;
    console.log('原始密码：%s', password);
    console.log('加盐后的密码：%s', saltPassword);

    // 加盐密码的md5值
    var md5 = crypto.createHash('md5');
    var result = md5.update(saltPassword).digest('hex');
    console.log('加盐密码的md5值：%s', result);
}

var password = '123456';

cryptPwd('123456', getRandomSalt());
// 输出：
// 原始密码：123456
// 加盐后的密码：123456:498
// 加盐密码的md5值：af3b7d32cc2a254a6bf1ebdcfd700115

cryptPwd('123456', getRandomSalt());
// 输出：
// 原始密码：123456
// 加盐后的密码：123456:287
// 加盐密码的md5值：65d7dd044c2db64c5e658d947578d759
```
