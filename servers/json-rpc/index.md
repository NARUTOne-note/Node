# JSON-RPC

> JSON-RPC 是一个**无状态、轻量级的远程过程调用（RPC）协议**，以 **JSON** 作为数据格式。它只规定请求/响应的结构，不绑定传输方式——HTTP、WebSocket、stdio、消息队列都能跑。

[JSON-RPC 官方规范（2.0）](https://www.jsonrpc.org/specification)

简单说：双方约定一组方法名，客户端发一条 JSON `{ method, params, id }`，服务端回一条 JSON `{ result, id }` 或 `{ error, id }`。没有 WSDL / `.proto` 之类的合同文件，**约定即是合同**。

- **协议级**：只是消息结构规范，传输层随便挑（HTTP、WS、stdio、TCP、MQ）
- **纯 JSON**：人可读、调试友好，前后端通吃
- **无状态**：每个请求自带 `id`，可乱序可批量，不依赖会话
- **双向**：两端都能发请求/通知，天然适合 WebSocket 双工通信
- **批量调用**：一次发一个数组，服务端并行处理、批量返回
- **通知（Notification）**：不带 `id` 的请求即"只管发不管回"，适合事件推送
- **应用场景**：区块链节点接口（ETH/Lisk）、语言服务器协议（LSP）、编辑器插件、内部微服务、浏览器↔扩展通信

## 消息结构

JSON-RPC 2.0 的请求和响应长这样：

```jsonc
// 请求（Request）：带 id，需要响应
{
  "jsonrpc": "2.0",
  "method": "calc.add",      // 方法名，点号分层是社区约定不是规范
  "params": { "a": 1, "b": 2 }, // 命名参数；也可用数组 [1, 2]
  "id": 1                     // 调用标识，响应要原样带回
}

// 通知（Notification）：不带 id，服务端不回包
{ "jsonrpc": "2.0", "method": "user.kicked", "params": { "id": "u9" } }

// 成功响应
{ "jsonrpc": "2.0", "result": 3, "id": 1 }

// 错误响应：result 变成 error 对象
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,          // 见下表
    "message": "Method not found",
    "data": "calc.add 未注册"  // 可选，任意附加信息
  },
  "id": 1
}
```

错误码规范预定义了几个，业务可自定义（`-32000 ~ -32099` 留给 server error）：

| code | 含义 | 触发场景 |
| --- | --- | --- |
| -32700 | Parse error | 服务端无法解析 JSON |
| -32600 | Invalid Request | 不是合法的 JSON-RPC 2.0 请求 |
| -32601 | Method not found | 方法没注册 |
| -32602 | Invalid params | 参数类型/数量不对 |
| -32603 | Internal error | 方法内部抛错 |
| -32000~-32099 | Server error | 业务自定义 |

## 设计要点

实现一个 JSON-RPC Server，核心就三件事：

1. **路由分发**：按 `method` 名找到对应处理函数，把 `params` 传进去
2. **错误归一**：处理函数 throw 出来的任何东西，都要转成 `{ code, message, data }` 结构，别把 JS 堆栈漏给客户端
3. **传输适配**：上面的逻辑与传输无关。HTTP 用一个 `POST /rpc` 端点收一条 JSON；WebSocket 用 `on('message')`；stdio 用 `stdin`。同一段处理内核套不同壳即可

另外几个常踩的点：

- **`id` 的语义**：有 `id` → 必须回包；没 `id`（通知）→ 绝对不能回包。批量请求时 `id` 是匹配请求与响应的唯一线索，且可乱序返回
- **参数形态**：`params` 可以是对象（命名参数）或数组（位置参数），分发时要兼容两种
- **通知的幂等性**：通知没回执、可能丢失/重复，别拿它干关键写操作
- **校验放在分发前**：`jsonrpc` 字段、`method` 类型、`id` 类型先校验，不合格统一回 `-32600`

## 基础使用（TypeScript 伪代码）

把实现拆成两块：**协议内核**（与传输无关）+ **传输外壳**（HTTP / WebSocket）。客户端再写一个最小调用方。

- 协议内核与 HTTP 外壳：[`server.ts`](./server.ts)
- 客户端调用方：[`client.ts`](./client.ts)

### 1. 协议内核：`server.ts`（节选）

```ts
// 类型定义
type RpcId = string | number | null;

interface RpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown> | unknown[];
  id?: RpcId;            // 缺省 = 通知
}

interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

interface RpcResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: RpcError;
  id: RpcId;
}

// 方法注册表：方法名 → 处理函数
type Handler = (params: unknown, ctx: RpcContext) => Promise<unknown>;
const methods = new Map<string, Handler>();

// 分发单条请求 → 返回响应（通知返回 null，表示不回包）
async function dispatch(req: unknown, ctx: RpcContext): Promise<RpcResponse | null> {
  // 1. 基本校验
  if (!isValidRequest(req)) {
    return makeError(null, -32600, 'Invalid Request');
  }
  const { method, params, id } = req as RpcRequest;
  const isNotification = id === undefined || id === null;

  // 2. 找方法
  const handler = methods.get(method);
  if (!handler) {
    return isNotification ? null : makeError(id, -32601, 'Method not found');
  }

  // 3. 执行，统一兜底错误
  try {
    const result = await handler(params, ctx);
    // 通知：静默丢弃，不回包
    return isNotification ? null : { jsonrpc: '2.0', result, id };
  } catch (e) {
    if (isNotification) return null;          // 通知连错都不回
    const err = toRpcError(e);               // 任意 throw → 归一成 RpcError
    return { jsonrpc: '2.0', error: err, id };
  }
}

// 批量：数组就并发分发，过滤掉 null（通知）
async function handlePayload(payload: unknown, ctx: RpcContext) {
  const list = Array.isArray(payload) ? payload : [payload];
  const results = await Promise.all(list.map(r => dispatch(r, ctx)));
  const nonNull = results.filter(Boolean);
  // 全是通知 → 什么都不回；否则回非 null 的响应数组
  return nonNull.length ? nonNull : undefined;
}
```

### 2. HTTP 外壳（Express 风格）

```ts
app.post('/rpc', async (req, res) => {
  const ctx = { user: req.user, transport: 'http' };
  const reply = await handlePayload(req.body, ctx);
  if (reply === undefined) return res.status(204).end(); // 纯通知
  res.json(reply);
});
```

### 3. 客户端：`client.ts`（节选）

```ts
// 一次调用：发请求、按 id 匹响应、超时就 reject
async function call(method: string, params: unknown, timeoutMs = 5000) {
  const id = nextId();
  const pending = new Promise((resolve, reject) => {
    timers.set(id, { resolve, reject });
    setTimeout(() => {
      if (timers.has(id)) {
        timers.delete(id);
        reject(new Error('timeout'));
      }
    }, timeoutMs);
  });
  send({ jsonrpc: '2.0', method, params, id });
  return pending;
}

// 用起来像本地函数
const sum = await call('calc.add', { a: 1, b: 2 }); // 3

// 通知：不等回包
notify('user.kicked', { id: 'u9' });
```

## 进阶片段

**批量调用**：一个数组塞多条，省往返。

```ts
// 一次发 3 条，服务端 Promise.all 并行处理
await send([
  { jsonrpc: '2.0', method: 'calc.add', params: [1, 2], id: 1 },
  { jsonrpc: '2.0', method: 'calc.mul', params: [3, 4], id: 2 },
  { jsonrpc: '2.0', method: 'log.push', params: { msg: 'hi' } }, // 通知，无 id
]);
// 返回顺序可与请求不同，靠 id 匹配
```

**WebSocket 双工 + 通知**：服务端也能主动给客户端发通知。

```ts
// 服务端：某个事件发生，push 一条通知给客户端
ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'task.done', params: { id: taskId } }));

// 客户端：注册一个 method 处理器，收通知时触发
client.on('task.done', (params) => console.log('任务完成', params.id));
```

**版本协商与解析错误**：`jsonrpc` 不是 `'2.0'` 或 body 不是合法 JSON，统一回 `-32700 / -32600`，`id` 设为 `null`（因为没法信任请求里的 id）。

```ts
let body;
try { body = JSON.parse(raw); } catch { return makeError(null, -32700, 'Parse error'); }
```

## JSON-RPC over stdio

stdio 是 JSON-RPC 最"原生"的传输之一：**客户端把服务端作为子进程拉起，用它的 stdin/stdout 收发 JSON 消息**，日志走 stderr。没有端口、没有 HTTP 开销，父子进程间一条管道直连，编辑器/CLI 工具最爱这套。

- **典型场景**：语言服务器协议（LSP，VSCode/Sublime/Vim 都用）、CLI 嵌入式服务、本地插件宿主
- **无端口**：不开 TCP，省去端口冲突与鉴权；子进程就是能力边界
- **关键约束：stdout 是协议通道，只能写 JSON 消息**。`console.log` 的调试输出会污染流、让对端解析失败；所有日志必须打到 `stderr`
- **消息分帧（framing）**：stdio 是字节流不是消息流，要自己切包。两种主流方案：
  - **换行分隔（NDJSON）**：每条 JSON 一行，最简单，社区工具链多
  - **Content-Length 头**：LSP 规范用，`Content-Length: 42\r\n\r\n<42 字节 JSON>`，二进制安全但解析更繁
- **生命周期**：客户端拉起子进程 → 双向收发 → stdin `EOF` / SIGTERM 即结束

### stdio 服务端外壳（`server.ts` 节选，换行分帧）

```ts
import * as readline from 'node:readline';

// readline 自动按行切包，处理半行 / 粘包
const rl = readline.createInterface({ input: process.stdin });
const ctx: RpcContext = { transport: 'stdio' };

rl.on('line', async (line) => {
  let payload: unknown;
  try {
    payload = JSON.parse(line);
  } catch {
    // 坏 JSON 只能回 stderr 日志，别往 stdout 写非协议内容
    console.error('[rpc] parse error:', line);
    process.stdout.write(JSON.stringify(makeError(null, -32700, 'Parse error')) + '\n');
    return;
  }
  const reply = await handlePayload(payload, ctx);
  if (reply !== undefined) {
    process.stdout.write(JSON.stringify(reply) + '\n'); // 一行一条
  }
});

rl.on('close', () => process.exit(0)); // stdin 关闭 = 客户端走了
```

### stdio 客户端：spawn 子进程 + 收发

```ts
import { spawn } from 'node:child_process';
import * as readline from 'node:readline';

// 拉起服务端子进程，接管它的 stdin/stdout
const child = spawn('node', ['server.js'], { stdio: ['pipe', 'pipe', 'inherit'] });

const rl = readline.createInterface({ input: child.stdout });
// 服务端 stdout 的每一行 → 进 onMessage 分发
rl.on('line', (line) => client.handleIncoming(line));

// transport.send 就是往子进程 stdin 写一行
const transport = {
  send: (raw: string) => child.stdin.write(raw + '\n'),
  onMessage: () => {},
};
const client = new JsonRpcClient(transport);
client.call('calc.add', { a: 1, b: 2 }).then((v) => console.log(v));
```

### 完整 stdio 收发示例（终端手搓）

```bash
# 启动服务端，stdin/stdout 即协议通道
$ node server.js
{"jsonrpc":"2.0","method":"calc.add","params":{"a":1,"b":2},"id":1}
# 服务端 stdout 回：
{"jsonrpc":"2.0","result":3,"id":1}
```

> 踩坑提示：`console.log` 默认写 `stdout`。在 stdio 服务端里**任何**不经协议封装的 stdout 输出都会让对端 `JSON.parse` 失败。开发期务必把日志重定向到 `stderr`（`console.error` 或 `process.stderr.write`），对端用 `stderr` 单独收日志展示。

## 接入使用流程

1. **选传输层**：内部服务挑 HTTP（`POST /rpc` 一端点足够）；需要服务端推送/双工挑 WebSocket；编辑器插件走 stdio
2. **注册方法**：在服务端把业务函数挂到 `methods` 注册表，约定方法名（如 `user.create`、`order.pay`）
3. **统一错误**：业务函数 `throw new RpcError(code, msg)`，由 `dispatch` 兜底转成 error 响应；别把原生 Error 的堆栈漏出去
4. **客户端封装**：把 `call(method, params)` 包成 Promise，按 `id` 匹配响应 + 超时；通知用单独的 `notify()`
5. **鉴权**：放在传输外壳（HTTP 头 / WS 握手），把身份塞进 `ctx` 透传给 handler，协议层不关心
6. **可观测**：在 `dispatch` 外层加日志/埋点，记录 method、耗时、是否 error；通知也要记，因为它没回包无从感知

## 与 REST / gRPC 速查

| 对比点 | REST + JSON | gRPC + Protobuf | JSON-RPC |
| --- | --- | --- | --- |
| 数据格式 | JSON | 二进制 protobuf | JSON |
| 接口合同 | 靠文档约定 | `.proto` 强类型 | 方法名约定 |
| 传输 | HTTP/1.1 为主 | HTTP/2 | 任意（HTTP/WS/stdio） |
| 调用模型 | 资源 + 动词 | 远程函数 + 四种流 | 远程函数（请求/通知/批量） |
| 浏览器直连 | 天然支持 | 需 gRPC-Web | 天然支持 |
| 最适合 | 对外 API | 服务间内部通话 | 双工通信、语言服务器、节点接口 |

## 小结

- JSON-RPC = **一个消息结构约定 + 一个分发内核**：`{method, params, id}` 进，`{result/error, id}` 出
- 实现要点：方法注册表分发 → 错误归一 → 传输外壳换皮，内核与传输解耦
- 通知（无 id）和批量是它区别于 REST 的两把刷子，WebSocket 场景尤其香
- 完整 TS 伪代码见 [`server.ts`](./code/server.ts) 与 [`client.ts`](./code/client.ts)
