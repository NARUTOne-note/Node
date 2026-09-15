/**
 * JSON-RPC 2.0 Client —— TypeScript 伪代码
 *
 * 职责：
 *   - call(method, params)：发请求、按 id 匹配响应、超时拒绝
 *   - notify(method, params)：发通知，不等回包
 *   - on(method, cb)：注册服务端主动推送的通知处理（WebSocket 双工场景）
 *
 * 同样是伪代码，只表达结构与约定。
 */

import { RpcException } from './server';

/* ------------------------------------------------------------------ */
/* 1. 类型                                                              */
/* ------------------------------------------------------------------ */

type RpcId = string | number;

interface RpcResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  id: RpcId | null;
}

interface PendingEntry {
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

/* ------------------------------------------------------------------ */
/* 2. 抽象传输层：把"发"和"收"抽成两个钩子，HTTP/WS 都能套              */
/* ------------------------------------------------------------------ */

interface Transport {
  send(raw: string): void; // 发出一条序列化后的消息
  onMessage(cb: (raw: string) => void): void; // 收到消息时回调
}

/* ------------------------------------------------------------------ */
/* 3. Client 实现                                                       */
/* ------------------------------------------------------------------ */

class JsonRpcClient {
  private nextId = 1;
  private pending = new Map<RpcId, PendingEntry>();
  private handlers = new Map<string, ((params: unknown) => void)[]>(); // 服务端通知路由

  constructor(private transport: Transport) {
    transport.onMessage((raw) => this.handleIncoming(raw));
  }

  /** 调用：发请求、返回 Promise，结果按 id 匹配；超时拒绝 */
  async call(method: string, params?: unknown, timeoutMs = 5000): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      // 1. 登记待处理的 Promise + 超时
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`rpc timeout: ${method}`));
        }
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });

      // 2. 发请求
      this.transport.send(
        JSON.stringify({ jsonrpc: '2.0', method, params, id }),
      );
    });
  }

  /** 通知：不带 id，不等回包 */
  notify(method: string, params?: unknown): void {
    this.transport.send(JSON.stringify({ jsonrpc: '2.0', method, params }));
  }

  /** 注册服务端主动推送的通知处理（WS 双工场景） */
  on(method: string, cb: (params: unknown) => void): void {
    const list = this.handlers.get(method) ?? [];
    list.push(cb);
    this.handlers.set(method, list);
  }

  /** 处理一条进来的消息：按是否有 id 区分响应还是通知 */
  private handleIncoming(raw: string): void {
    let msg: unknown;
    try {
      msg = JSON.parse(raw);
    } catch {
      return; // 客户端侧一般忽略坏包
    }

    // 服务端 → 客户端 的"通知"：无 id，按 method 路由
    if (
      typeof msg === 'object' &&
      msg !== null &&
      (msg as any).jsonrpc === '2.0' &&
      typeof (msg as any).method === 'string'
    ) {
      const { method, params } = msg as any;
      this.handlers.get(method)?.forEach((cb) => cb(params));
      return;
    }

    // 响应：有 id，匹配 pending
    const res = msg as RpcResponse;
    if (res.id == null) return; // 不该出现，忽略
    const entry = this.pending.get(res.id);
    if (!entry) return; // 找不到匹配（已超时或重复），丢弃

    clearTimeout(entry.timer);
    this.pending.delete(res.id);

    if (res.error) {
      // 把 error 还原成可抛出的 RpcException
      entry.reject(
        new RpcException(res.error.code, res.error.message, res.error.data),
      );
    } else {
      entry.resolve(res.result);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 4. 传输层实现：HTTP / WebSocket                                       */
/* ------------------------------------------------------------------ */

/** HTTP 传输：每次 call 起一个 fetch；不支持服务端推送通知 */
class HttpTransport implements Transport {
  private msgCb: ((raw: string) => void) | null = null;
  constructor(private url: string) {}

  send(raw: string): void {
    // HTTP 下 call 是一问一答，这里用 fetch 同步拿到响应后回灌给 onMessage
    fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: raw,
    })
      .then((r) => r.text())
      .then((text) => this.msgCb?.(text))
      .catch((e) => this.msgCb?.(JSON.stringify({ error: { code: -32603, message: String(e) }, id: null })));
  }

  onMessage(cb: (raw: string) => void): void {
    this.msgCb = cb;
  }
}

/** WebSocket 传输：长连接，支持双工通知 */
// class WsTransport implements Transport {
//   private msgCb: ((raw: string) => void) | null = null;
//   constructor(private ws: WebSocket) {
//     ws.onmessage = (e) => this.msgCb?.(e.data as string);
//   }
//   send(raw: string): void { this.ws.send(raw); }
//   onMessage(cb: (raw: string) => void): void { this.msgCb = cb; }
// }

/** stdio 传输：spawn 服务端子进程，stdin/stdout 即协议通道（换行分帧） */
// import { spawn } from 'node:child_process';
// import * as readline from 'node:readline';
//
// class StdioTransport implements Transport {
//   private msgCb: ((raw: string) => void) | null = null;
//   private child;
//
//   constructor(cmd: string, args: string[]) {
//     // 拉起服务端子进程；stderr 直接继承父进程，日志不进协议流
//     this.child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'inherit'] });
//     // 子进程 stdout 按行读 → 回灌给 onMessage（→ handleIncoming）
//     const rl = readline.createInterface({ input: this.child.stdout });
//     rl.on('line', (line) => this.msgCb?.(line));
//   }
//
//   send(raw: string): void {
//     // 往子进程 stdin 写一行 JSON
//     this.child.stdin.write(raw + '\n');
//   }
//
//   onMessage(cb: (raw: string) => void): void {
//     this.msgCb = cb;
//   }
//
//   close(): void {
//     this.child.stdin.end(); // 发 EOF，服务端 readline 'close' → exit(0)
//   }
// }

/* ------------------------------------------------------------------ */
/* 5. 用起来：像调用本地函数一样                                          */
/* ------------------------------------------------------------------ */

async function main() {
  const client = new JsonRpcClient(new HttpTransport('http://localhost:3000/rpc'));

  // 一问一答
  const sum = await client.call('calc.add', { a: 1, b: 2 });
  console.log('1 + 2 =', sum); // 3

  const product = await client.call('calc.mul', [3, 4]);
  console.log('3 * 4 =', product); // 12

  // 鉴权失败 → 客户端拿到的是被 reject 的 RpcException
  try {
    await client.call('user.delete', { id: 'u9' });
  } catch (e: any) {
    console.log('调用失败:', e.code, e.message); // -32001 forbidden
  }

  // 通知：不等回包
  client.notify('log.push', { msg: 'hello from client' });

  // WS 场景下注册服务端推送
  // client.on('task.done', (params) => console.log('任务完成', params.id));

  // stdio 场景：spawn 一个本地服务端子进程当"传输"
  // const stdio = new StdioTransport('node', ['server.js']);
  // const local = new JsonRpcClient(stdio);
  // console.log('via stdio:', await local.call('calc.add', { a: 6, b: 7 })); // 13
  // stdio.close(); // 关 stdin，服务端退出
}

main();
