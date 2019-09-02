# nodeJS 进程

> 进程的使用场景

## 如何获取命令行参数

```js
function main(argv) {
    // ...
}

main(process.argv.slice(2));
```

## 如何退出程序

```js
try {
    // ...
} catch (err) {
    // ...
    process.exit(1);
}
```

## 控制输入输出

> 准输入流（stdin）、一个标准输出流（stdout）、一个标准错误流（stderr）分别对应process.stdin、process.stdout和process.stderr，
第一个是只读数据流，后边两个是只写数据流，对它们的操作按照对数据流的操作方式即可。

```js
function log() {
    process.stdout.write(
        util.format.apply(util, arguments) + '\n');
}
```

## 如何降权

> 在Linux系统下，我们知道需要使用root权限才能监听1024以下端口。但是一旦完成端口监听后，继续让程序运行在root权限下存在安全隐患，因此最好能把权限降下来

```js
http.createServer(callback).listen(80, function () {
    var env = process.env,
        uid = parseInt(env['SUDO_UID'] || process.getuid(), 10),
        gid = parseInt(env['SUDO_GID'] || process.getgid(), 10);

    process.setgid(gid);
    process.setuid(uid);
});
```

- 如果是通过sudo获取root权限的，运行程序的用户的UID和GID保存在环境变量SUDO_UID和SUDO_GID里边。如果是通过chmod +s方式获取root权限的，运行程序的用户的UID和GID可直接通过process.getuid和process.getgid方法获取。

- process.setuid和process.setgid方法只接受number类型的参数。

- 降权时必须先降GID再降UID，否则顺序反过来的话就没权限更改程序的GID了

## 创建子进程

```js
// parent

var child = child_process.spawn('node', [ 'child.js' ], , {
  stdio: [ 0, 1, 2, 'ipc' ]
});

child.kill('SIGTERM'); // 发送信号
child.on('message', function (msg) {
    console.log(msg);
});

child.send({ hello: 'hello' });

```

```js
// child
var child = child_process.spawn('node', [ 'xxx.js' ]);

child.stdout.on('data', function (data) {
    console.log('stdout: ' + data);
});

child.stderr.on('data', function (data) {
    console.log('stderr: ' + data);
});

child.on('close', function (code) {
    console.log('child process exited with code ' + code);
});

process.on('SIGTERM', function () {
    cleanUp();
    process.exit(0);
});

process.on('message', function (msg) {
    msg.hello = msg.hello.toUpperCase();
    process.send(msg);
});
```

## 守护进程

```js
function spawn(mainModule) {
    var worker = child_process.spawn('node', [ mainModule ]);

    worker.on('exit', function (code) {
        if (code !== 0) {
            spawn(mainModule); // 重启
        }
    });
}

spawn('worker.js');
```
