# 进程

> 进程（Process）是计算机中的程序关于某数据集合上的一次运行活动，是系统进行资源分配和调度的基本单位，是操作系统结构的基础，进程是线程的容器（来自百科）

[Node.js 进阶之进程与线程](https://zhuanlan.zhihu.com/p/94613627)

我们启动一个服务、运行一个实例，就是开一个服务进程。
多进程就是进程的复制（fork），fork 出来的每个进程都拥有自己的独立空间地址、数据栈，一个进程无法访问另外一个进程里定义的变量、数据结构，只有建立了 IPC 通信，进程之间才可数据共享。

```js
// process.js
const http = require('http');

http.createServer().listen(3000, () => {
    process.title = '测试进程 Node.js' // 进程进行命名
    console.log(`process.pid: `, process.pid); // process.pid: 20279, 电脑启动进程id
});
```

## 线程

线程是操作系统能够进行运算调度的最小单位，首先我们要清楚线程是隶属于进程的，被包含于进程之中。**一个线程只能隶属于一个进程，但是一个进程是可以拥有多个线程的**。
**同一进程中的多条线程将共享该进程中的全部系统资源，如虚拟地址空间**，文件描述符和信号处理等。但同一进程中的多个线程有各自的调用栈（call stack），自己的寄存器环境（register context），自己的线程本地存储（thread-local storage)，线程又有单线程和多线程之分，具有代表性的 JavaScript、Java 语言。

- **单线程** 就是一个进程只开一个线程

  - Node.js 虽然是单线程模型，但是其基于事件驱动、异步非阻塞模式，可以应用于高并发场景，避免了线程创建、线程之间上下文切换所产生的资源开销。
  - 如果你有需要大量计算，CPU 耗时的操作，开发时候要注意。

- **多线程** 就是一个进程可以开多个线程

  - 多线程的代价还在于创建新的线程和执行期上下文线程的切换开销，由于每创建一个线程就会占用一定的内存，当应用程序并发大了之后，内存将会很快耗尽。

## Nodejs的线程与进程

Node.js 是 Javascript 在服务端的运行环境，构建在 chrome 的 V8 引擎之上，基于事件驱动、非阻塞I/O模型，充分利用操作系统提供的异步 `I/O` 进行多任务的执行，适合于 I/O 密集型的应用场景，因为异步，程序无需阻塞等待结果返回，而是基于回调通知的机制，原本同步模式等待的时间，则可以用来处理其它任务，在 Web 服务器方面，著名的 Nginx 也是采用此模式（事件驱动），Nginx 采用 C 语言进行编写，主要用来做高性能的 Web 服务器，不适合做业务。Web业务开发中，如果你有高并发应用场景那么 Node.js 会是你不错的选择。

在单核 CPU 系统之上我们采用 单进程 + 单线程 的模式来开发。在多核 CPU 系统之上，可以通过 `child_process.fork` 开启多个进程（Node.js 在 v0.8 版本之后新增了Cluster 来实现多进程架构） ，即 多进程 + 单线程 模式。注意：开启多进程不是为了解决高并发，主要是解决了单进程模式下 Node.js CPU 利用率不足的情况，充分利用多核 CPU 的性能。

**关于 Node.js 进程的几点总结**:

- Javascript 是单线程，但是做为宿主环境的 Node.js 并非是单线程的。
- 由于单线程原故，一些复杂的、消耗 CPU 资源的任务建议不要交给 Node.js 来处理，当你的业务需要一些大量计算、视频编码解码等 CPU 密集型的任务，可以采用 C 语言。
- Node.js 和 Nginx 均采用事件驱动方式，避免了多线程的线程创建、线程上下文切换的开销。如果你的业务大多是基于 I/O 操作，那么你可以选择 Node.js 来开发。

## process 模块

> Node.js 中的进程 Process 是一个全局对象，无需 require 直接使用，给我们提供了当前进程中的相关信息

- process.env：环境变量，例如通过 process.env.NODE_ENV 获取不同环境项目配置信息
- process.nextTick：这个在谈及 Event Loop 时经常为会提到
- process.pid：获取当前进程id
- process.ppid：当前进程对应的父进程
- process.cwd()：获取当前进程工作目录
- process.platform：获取当前进程运行的操作系统平台
- process.uptime()：当前进程已运行时间，例如：pm2 守护进程的 uptime 值
- 进程事件：process.on('uncaughtException', cb) 捕获异常信息、process.on('exit', cb）进程推出监听
- 三个标准流：process.stdout 标准输出、process.stdin 标准输入、process.stderr 标准错误输出
- process.exit(code): 惯例做法是当程序成功执行时传递 0 ，当程序执行失败时传递 1 或比 1 大的值。

## child_process 模块

> Nodejs 创建子进程， 多进程架构解决了单进程、单线程无法充分利用系统多核 CPU 的问题

- child_process.spawn()：适用于返回大量数据，例如图像处理，二进制数据处理。
- child_process.exec()：适用于小量数据，maxBuffer 默认值为 200 * 1024 超出这个默认值将会导致程序崩溃，数据量过大可采用 spawn。
- child_process.execFile()：类似 child_process.exec()，区别是不能通过 shell 来执行，不支持像 I/O 重定向和文件查找这样的行为
- child_process.fork()： 衍生新的进程，进程之间是相互独立的，每个进程都有自己的 V8 实例、内存，系统资源是有限的，不建议衍生太多的子进程出来，通长根据系统 CPU 核心数设置。

child_process 模块提供了衍生子进程（以一种与 popen(3) 类似但不相同的方式）的能力。 此功能主要由 child_process.spawn() 函数提供：

```js
const spawn = require('child_process').spawn;
const ls = spawn('ls', ['-lh', '/usr']);

ls.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

ls.stderr.on('data', (data) => {
  console.log(`stderr: ${data}`);
});

ls.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});
```

## 进程守护

Node.js 开发的同学们可能熟悉，当我们打开终端执行 node app.js 开启一个服务进程之后，这个终端就会一直被占用，如果关掉终端，服务就会断掉，即前台运行模式。如果采用守护进程进程方式，这个终端我执行 node app.js 开启一个服务进程之后，我还可以在这个终端上做些别的事情，且不会相互影响。

- 创建一个进程A。
- 在进程A中创建进程B，我们可以使用fork方式，或者其他方法。
- 对进程B执行 setsid 方法。
- 进程A退出，进程B由init进程接管。此时进程B为守护进程。

setsid 主要完成三件事：

该进程变成一个新会话的会话领导。
该进程变成一个新进程组的组长。
该进程没有控制终端。

```js
// index.js, 创建子进程
const spawn = require('child_process').spawn;

function startDaemon() {
    const daemon = spawn('node', ['daemon.js'], {
        cwd: '/usr',
        detached : true, // 该属性为true，则会调用 setsid 方法
        stdio: 'ignore',
    });

    console.log('守护进程开启 父进程 pid: %s, 守护进程 pid: %s', process.pid, daemon.pid);
    daemon.unref();
}

startDaemon()

process.exit(0);

// /usr/daemon.js
const fs = require('fs');
const { Console } = require('console');

// custom simple logger
const logger = new Console(fs.createWriteStream('./stdout.log'), fs.createWriteStream('./stderr.log'));

// 开启一个定时器每 10 秒执行一次，使得这个资源不会退出，同时写入日志到子进程当前工作目录下
setInterval(function() {
  logger.log('daemon pid: ', process.pid, ', ppid: ', process.ppid);
}, 1000 * 10);

```
