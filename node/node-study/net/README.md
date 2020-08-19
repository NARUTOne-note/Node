# net 模块

> net模块是同样是nodejs的核心模块。在http模块概览里提到，http.Server继承了net.Server，此外，http客户端与http服务端的通信均依赖于socket（net.Socket）。也就是说，做node服务端编程，net基本是绕不开的一个模块。

- net.Server：TCP server，内部通过socket来实现与客户端的通信。
- net.Socket：tcp/本地 socket的node版实现，它实现了全双工的stream接口。

```js
var net = require('net');
```
