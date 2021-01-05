# package

> 解析`package.json` 文件

[Node.js 进阶 - npm package.json](https://juejin.cn/post/6846687601982701575?utm_source=gold_browser_extension%3Futm_source%3Dgold_browser_extension)

```bash
# 创建，初始化
npm init -y
```

## 属性

> 属性，`npm script`, `npm config`等

- `devDependencies` 主要是存放用于本地开发的, `-D` 会添加到 `devDependencies` 里面, `--save-dev` 也会添加到`devDependencies`
- `dependencies` 会在我们开发的时候带到线上，`-S` 会添加到 `dependencies`, `--save` 会添加到 `dependencies`

```bash
# 添加到 devDependencies
npm install -D xxxx
# 添加到 dependencies
npm install -S xxxx
```

- `bin` 命令：指定了各个内部命令对应的可执行文件的位置
  - 如果全局安装模块报，npm 会使用符号链接把可执行文件链接到 `/usr/local/bin`，
  - 如果项目中安装，会链接到 `./node_modules/.bin/`。

- `main`: 指定程序的主入口文件

```json
{
  "main": "lib/index.js",
}
```

## npm script

> npm 脚本命令, 使用 `npm run xxx` 执行，系统都会自动新建一个`shell`(一般是Bash)，在这个shell里面执行指定的脚本命令。因此 **凡是能在 shell 中允许的脚本，都可以写在npm scripts中**。

```json
"scripts": {
  "test": "test.js",
  "build": "tsc",
}
```

- 并行任务(同时的平行执行)，使用 `&` 符号 `$ npm run script1.js & npm run script2.js`
- 串行任务(前一个任务成功，才执行下一个任务)，使用 `&&` 符号 `$ npm run script1.js && npm run script2.js`

## npm config

> npm cli 提供了 npm config 命令进行 npm 相关配置， 还可以通过 npmrc 文件直接修改配置。

[https://docs.npmjs.com/misc/config](https://docs.npmjs.com/misc/config)

- `npm config ls -l` 查看npm所有配置
- `npm config set <key> <value>` 修改配置的命令
- `npm config set registry https://registry.npm.taobao.org` 设置淘宝镜像
