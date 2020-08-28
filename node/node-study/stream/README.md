# stream 流模块

> nodejs的核心模块，基本上都是stream的的实例，比如process.stdout、http.clientRequest。

对于大部分的nodejs开发者来说，平常并不会直接用到stream模块，只需要了解stream的运行机制即可（非常重要）。

## 分类

- Readable：用来读取数据，比如 fs.createReadStream()。
- Writable：用来写数据，比如 fs.createWriteStream()。
- Duplex：可读+可写，比如 net.Socket()。
- Transform：在读写的过程中，可以对数据进行修改，比如 zlib.createDeflate()（数据压缩/解压）。

```js
const fs = require('fs');

fs.createReadStream('./sample.txt').pipe(process.stdout);
```
