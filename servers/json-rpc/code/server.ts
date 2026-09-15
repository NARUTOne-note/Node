/**
 * JSON-RPC 2.0 Server —— TypeScript 伪代码
 *
 * 拆成两层：
 *   - 协议内核（与本文件下半部分）：method 注册表 + dispatch + 批量处理，与传输无关
 *   - 传输外壳（HTTP / WebSocket）：把内核接到具体传输上
 *
 * 这是伪代码，侧重结构与约定，不处理所有边界，生产环境请用 jayson / @json-rpc-tools 等成熟库。
 */

/* ------------------------------------------------------------------ */
/* 1. 类型定义                                                          */
/* ------------------------------------------------------------------ */

type RpcId = string | number | null;

/** JSON-RPC 2.0 请求 */
interface RpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown> | unknown[];
  id?: RpcId; // 缺省 / null → 通知（Notification），服务端不回包
}

/** JSON-RPC 2.0 错误对象 */
interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

/** JSON-RPC 2.0 响应（成功带 result，失败带 error，二者互斥） */
interface RpcResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: RpcError;
  id: RpcId;
}

/** 标准错误码 */
const ERROR_CODE = {
  PARSE_ERROR: -32700, // 无法解析 JSON
  INVALID_REQUEST: -32600, // 不是合法的 2.0 请求
  METHOD_NOT_FOUND: -32601, // 方法未注册
  INVALID_PARAMS: -32602, // 参数类型/数量不对
  INTERNAL_ERROR: -32603, // 方法内部抛错
} as const;

/** 业务自定义错误基类，throw 后由 dispatch 兜底转成 error 响应 */
class RpcException extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
  }
}

/** 透传给 handler 的上下文：身份、传输类型、原始请求等 */
interface RpcContext {
  user?: { id: string; roles: string[] };
  transport: 'http' | 'ws' | 'stdio';
  meta?: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/* 2. 方法注册表                                                        */
/* ------------------------------------------------------------------ */

type Handler = (params: unknown, ctx: RpcContext) => Promise<unknown> | unknown;

const methods = new Map<string, Handler>();

/** 注册一个 RPC 方法 */
function register(name: string, handler: Handler): void {
  if (methods.has(name)) throw new Error(`method already registered: ${name}`);
  methods.set(name, handler);
}

/* ------------------------------------------------------------------ */
/* 3. 协议内核：校验 / 分发 / 归一错误                                    */
/* ------------------------------------------------------------------ */

/** 是否为合法的 JSON-RPC 2.0 请求对象 */
function isValidRequest(x: unknown): x is RpcRequest {
  return (
    typeof x === 'object' &&
    x !== null &&
    (x as RpcRequest).jsonrpc === '2.0' &&
    typeof (x as RpcRequest).method === 'string'
  );
}

/** 任意 throw 的值 → RpcError。原生 Error 归一成内部错误，别漏堆栈 */
function toRpcError(e: unknown): RpcError {
  if (e instanceof RpcException) {
    return { code: e.code, message: e.message, data: e.data };
  }
  // 其它未知错误一律当内部错误，不把堆栈暴露给客户端
  return {
    code: ERROR_CODE.INTERNAL_ERROR,
    message: 'Internal error',
    data: e instanceof Error ? e.message : String(e),
  };
}

/** 构造错误响应 */
function makeError(id: RpcId, code: number, message: string, data?: unknown): RpcResponse {
  const error: RpcError = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', error, id };
}

/**
 * 分发单条请求 → 返回响应；通知返回 null（表示不回包）
 *
 * 约定：
 *   - 有 id 且非 null → 必须回包（成功/错误）
 *   - 无 id 或 id=null → 通知，静默丢弃，连错误都不回
 */
async function dispatch(req: unknown, ctx: RpcContext): Promise<RpcResponse | null> {
  // 1. 基本校验：不是合法请求，id 只能设 null（没法信任请求里的 id）
  if (!isValidRequest(req)) {
    return makeError(null, ERROR_CODE.INVALID_REQUEST, 'Invalid Request');
  }
  const { method, params, id } = req;
  const isNotification = id === undefined || id === null;

  // 2. 路由：找不到方法 → -32601（通知也不回，仅记日志）
  const handler = methods.get(method);
  if (!handler) {
    if (isNotification) {
      console.warn('[rpc] notification to unknown method:', method);
      return null;
    }
    return makeError(id, ERROR_CODE.METHOD_NOT_FOUND, 'Method not found', `method=${method}`);
  }

  // 3. 执行 + 兜底：任何 throw 都转成 error 响应
  try {
    const result = await handler(params, ctx);
    if (isNotification) return null; // 通知：静默
    return { jsonrpc: '2.0', result, id };
  } catch (e) {
    if (isNotification) return null;
    const error = toRpcError(e);
    return { jsonrpc: '2.0', error, id };
  }
}

/**
 * 处理一个 payload（单条或批量）→ 返回需要回包的内容
 *   - 全是通知 → undefined，调用方应回 204 / 不发任何东西
 *   - 否则返回 RpcResponse | RpcResponse[]
 */
async function handlePayload(
  payload: unknown,
  ctx: RpcContext,
): Promise<RpcResponse | RpcResponse[] | undefined> {
  // 先做 parse error 兜底（调用方传进来前应已 JSON.parse，这里假设已解析）
  if (payload === null || typeof payload !== 'object') {
    return makeError(null, ERROR_CODE.INVALID_REQUEST, 'Invalid Request');
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return makeError(null, ERROR_CODE.INVALID_REQUEST, 'Invalid Request');
    }
    // 批量：并发分发，过滤掉通知（null）
    const results = await Promise.all(payload.map((r) => dispatch(r, ctx)));
    const nonNull = results.filter(Boolean) as RpcResponse[];
    return nonNull.length ? nonNull : undefined;
  }

  return dispatch(payload, ctx) ?? undefined;
}

/* ------------------------------------------------------------------ */
/* 4. 注册业务方法                                                      */
/* ------------------------------------------------------------------ */

// 命名参数：{ a, b }
register('calc.add', (params) => {
  const { a, b } = params as { a: number; b: number };
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new RpcException(ERROR_CODE.INVALID_PARAMS, 'a and b must be numbers');
  }
  return a + b;
});

// 位置参数：[a, b]
register('calc.mul', (params) => {
  const [a, b] = params as [number, number];
  return a * b;
});

// 需要鉴权：从 ctx.user 拿身份
register('user.delete', async (params, ctx) => {
  if (!ctx.user?.roles.includes('admin')) {
    throw new RpcException(-32001, 'forbidden', 'only admin can delete user');
  }
  const { id } = params as { id: string };
  return { deleted: id };
});

// 通知用法示例：只收不回
register('log.push', (params) => {
  console.log('[log]', params);
  // 不需要 return，反正不回包
});

/* ------------------------------------------------------------------ */
/* 5. 传输外壳 A：HTTP（Express 风格）                                   */
/* ------------------------------------------------------------------ */

// import express from 'express';
// const app = express();
// app.use(express.json());
//
// // 鉴权中间件把 user 塞进 req
// app.use(authMiddleware);
//
// app.post('/rpc', async (req, res) => {
//   const ctx: RpcContext = { user: req.user, transport: 'http', meta: req.headers as any };
//   const reply = await handlePayload(req.body, ctx);
//   if (reply === undefined) return res.status(204).end(); // 纯通知，不回包
//   res.json(reply); // 单条回对象，批量回数组
// });
//
// app.listen(3000, () => console.log('json-rpc over http on :3000/rpc'));

/* ------------------------------------------------------------------ */
/* 6. 传输外壳 B：WebSocket（ws 库风格，支持双工 + 服务端推送）          */
/* ------------------------------------------------------------------ */

// import { WebSocketServer } from 'ws';
// const wss = new WebSocketServer({ port: 3001 });
//
// wss.on('connection', (ws, req) => {
//   const ctx: RpcContext = { transport: 'ws', meta: {} /* 从 req 拿鉴权 */ };
//
//   ws.on('message', async (raw) => {
//     let payload: unknown;
//     try {
//       payload = JSON.parse(raw.toString());
//     } catch {
//       ws.send(JSON.stringify(makeError(null, ERROR_CODE.PARSE_ERROR, 'Parse error')));
//       return;
//     }
//     const reply = await handlePayload(payload, ctx);
//     if (reply !== undefined) ws.send(JSON.stringify(reply));
//   });
//
//   // 服务端也能主动给客户端发"通知"——客户端靠 method 路由
//   setInterval(() => {
//     ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'task.done', params: { id: 't1' } }));
//   }, 5000);
// });

/* ------------------------------------------------------------------ */
/* 7. 传输外壳 C：stdio（LSP / 编辑器插件场景）                          */
/*    换行分帧（NDJSON）：每条 JSON 一行，stdout 只准写协议消息          */
/*    日志一律走 stderr，否则会污染协议流让对端 JSON.parse 失败           */
/*    生命周期：父进程拉起本进程 → stdin/stdout 双向收发 → stdin EOF 即结束 */
/* ------------------------------------------------------------------ */

// import * as readline from 'node:readline';
//
// // readline 自动按行切包，处理半行 / 粘包
// const rl = readline.createInterface({ input: process.stdin });
// const ctx: RpcContext = { transport: 'stdio' };
//
// rl.on('line', async (line) => {
//   let payload: unknown;
//   try {
//     payload = JSON.parse(line);
//   } catch {
//     // 坏 JSON 只能回 stderr 日志，别往 stdout 写非协议内容
//     console.error('[rpc] parse error:', line);
//     process.stdout.write(
//       JSON.stringify(makeError(null, ERROR_CODE.PARSE_ERROR, 'Parse error')) + '\n',
//     );
//     return;
//   }
//   const reply = await handlePayload(payload, ctx);
//   if (reply !== undefined) {
//     process.stdout.write(JSON.stringify(reply) + '\n'); // 一行一条
//   }
// });
//
// rl.on('close', () => process.exit(0)); // stdin EOF = 客户端走了
//
// // 对应客户端见 client.ts 的 StdioTransport：spawn 本进程 + 按行读 stdout

export { register, dispatch, handlePayload, RpcException, type RpcContext };
