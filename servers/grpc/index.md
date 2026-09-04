# gRPC

> gRPC 是 Google 开源的高性能、通用的 RPC（Remote Procedure Call，远程过程调用）框架，基于 **HTTP/2** 传输、**Protocol Buffers（protobuf）** 作为接口定义与序列化格式。

[gRPC 官网](https://grpc.io/) ｜ [Protocol Buffers](https://protobuf.dev/)

简单说：让你像调用本地函数一样，去调用另一台机器上的函数。客户端和服务端可以是用不同语言写的，只要共用同一份 `.proto` 合同，就能自动对上接口。

- **跨语言**：一份 `.proto` 可生成 Go / Java / Python / Node / C# 等多语言桩代码
- **高性能**：protobuf 二进制序列化，比 JSON 更小更快；HTTP/2 多路复用、低延迟
- **强类型合同**：接口、字段、类型都写在 `.proto` 里，自动生成，改了就重新生成
- **四种调用模式**：一元（Unary）、服务端流、客户端流、双向流
- **基于 HTTP/2**：一条连接可并发多个请求，支持头部压缩、双向流
- **生态完善**：拦截器、超时、元数据（metadata）、健康检查、负载均衡、gRPC-Web 等
- **应用场景**：微服务之间内部通信、移动端到后端、实时流（聊天/推送/股票行情）、取代内部 REST

## 准备

以 Node.js 为例。gRPC 在 Node 里分两套实现，推荐按场景选：

- `@grpc/grpc-js`：纯 JS 实现，无需编译原生模块，跨平台更省心，生产常用
- `@grpc/grpc-js-core` + `@grpc/proto-loader`：动态加载 `.proto`，开发期更灵活

```bash
# 初始化一个 demo 目录
mkdir grpc-demo && cd grpc-demo
npm init -y

# 安装核心库与 proto 动态加载器
npm install @grpc/grpc-js @grpc/proto-loader
```

此外还需要 **protoc**（Protocol Buffers 编译器）用来在需要静态生成代码时把 `.proto` 编译成目标语言。动态加载（`@grpc/proto-loader`）方式下可不装 protoc，开发够用。

```bash
# 安装 protoc（Windows 可去 release 页下载 exe 放进 PATH）
# https://github.com/protocolbuffers/protobuf/releases
protoc --version

# 也可用 docker 免装
docker run --rm -v "$PWD:/work" -w /work znly/protoc --version
```

## 基础使用

完整一次 gRPC 调用分四步：**写 proto → 加载 proto → 实现服务端 → 写客户端调用**。

### 1. 定义接口：`helloworld.proto`

```proto
syntax = "proto3";

// 包名：生成的代码会落到这个包/命名空间下
package helloworld;

// 服务：一组可以被远程调用的方法
service Greeter {
  // 一元调用：请求 HelloRequest，返回 HelloReply
  rpc SayHello (HelloRequest) returns (HelloReply) {}
}

message HelloRequest {
  string name = 1;   // 字段编号，序列化时用，不要随意改动
}

message HelloReply {
  string message = 1;
}
```

要点：
- `syntax = "proto3"` 是当前主流版本，语法比 proto2 更简洁
- `service` 定义服务（一组 RPC 方法），`message` 定义数据结构
- 每个字段后面的 `= 1` 是**字段编号**（不是数组下标），序列化后的二进制靠它识别字段，发布后别复用、别改

### 2. 服务端：`server.js`

```js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// 1. 加载 proto 文件
const PROTO_PATH = __dirname + '/helloworld.proto';
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDef).helloworld;

// 2. 实现服务方法：把入参变成返回值
function sayHello(call, callback) {
  // call.request 是反序列化后的 HelloRequest
  callback(null, { message: `Hello, ${call.request.name}!` });
}

// 3. 启动服务
function main() {
  const server = new grpc.Server();
  server.addService(proto.Greeter.service, { SayHello: sayHello });

  server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) throw err;
    console.log('gRPC server listening on :%d', port);
    server.start();
  });
}

main();
```

### 3. 客户端：`client.js`

```js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = __dirname + '/helloworld.proto';
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDef).helloworld;

// 1. 创建客户端桩，指定服务端地址
const client = new proto.Greeter(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// 2. 像调本地函数一样发起调用
client.SayHello({ name: 'Naruto' }, (err, response) => {
  if (err) return console.error(err);
  console.log('Got:', response.message); // Got: Hello, Naruto!
});
```

### 4. 跑起来

```bash
# 终端 1：起服务端
node server.js
# gRPC server listening on :50051

# 终端 2：跑客户端
node client.js
# Got: Hello, Naruto!
```

## 进阶片段

**元数据（metadata）**：类似 HTTP 头，传鉴权/追踪信息。

```js
// 客户端发
const meta = new grpc.Metadata();
meta.add('authorization', 'Bearer my-token');
client.SayHello({ name: 'Naru' }, meta, (err, res) => { /* ... */ });

// 服务端收
function sayHello(call, cb) {
  const token = call.metadata.get('authorization')[0];
  cb(null, { message: `Hello, ${call.request.name}! token=${token}` });
}
```

**服务端流**：一次请求、连续多条返回。

```proto
service Greeter {
  rpc SayHelloStream (HelloRequest) returns (stream HelloReply) {}
}
```

```js
// 服务端
function sayHelloStream(call) {
  // call.write 每调一次，客户端收到一条
  ['早上好', '中午好', '晚上好'].forEach(g => call.write({ message: `${g}, ${call.request.name}` }));
  call.end();
}

// 客户端
const stream = client.SayHelloStream({ name: 'Naru' });
stream.on('data', res => console.log(res.message));
stream.on('end', () => console.log('done'));
```

**超时与错误**：gRPC 用 status code 表达错误。

```js
const deadline = new Date();
deadline.setSeconds(deadline.getSeconds() + 2); // 2s 超时
client.SayHello({ name: 'x' }, { deadline }, (err, res) => {
  if (err) {
    // err.code: grpc.status.DEADLINE_EXCEEDED(4) / UNAVAILABLE(14) / ...
    console.error('调用失败:', err.code, err.details);
  }
});
```

## 与 REST 速查

| 对比点 | REST + JSON | gRPC + Protobuf |
| --- | --- | --- |
| 数据格式 | 文本 JSON | 二进制 protobuf（小且快） |
| 传输 | HTTP/1.1 为主 | HTTP/2 多路复用 |
| 接口合同 | 靠文档约定 | .proto 强类型、自动生成 |
| 调用模式 | 基本一问一答 | 一元 + 3 种流 |
| 浏览器直连 | 天然支持 | 需 gRPC-Web 网关 |
| 最适合 | 对外 API / 前端 | 服务间内部通话 |

## 小结

- gRPC = **自动化的远程函数调用**：`.proto` 当合同，protobuf 压数据，HTTP/2 飞
- 开发流程：写 proto →（动态加载或 protoc 生成）→ 服务端实现 → 客户端像本地函数一样调
- 配套可视化文档见同目录 [`index.html`](./index.html)
