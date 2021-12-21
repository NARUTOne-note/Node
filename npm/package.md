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

## 非官方属性

- `yarn`相关

```json
{
  // 只允许给定依赖的一个版本，yarn install --flat 
  "flat": true,
  // 允许覆盖特定嵌套依赖项的版本
  "resolutions": {
    "transitive-package-1": "0.0.29",
    "transitive-package-2": "file:./local-forks/transitive-package-2",
    "dependencies-package-1/transitive-package-3": "^2.1.1"
  }
}
```

- `unpkg` npm 上所有的文件都开启 cdn 服务

```json
// jquery
{
  "unpkg": "dist/jquery.js"
}
```

```bash
# [latestVersion] 指最新版本号，pkg 指 package.json

# 定义了 unpkg 属性时
https://unpkg.com/jquery@[latestVersion]/[pkg.unpkg]
#未定义 unpkg 属性时，将回退到 main 属性
https://unpkg.com/jquery@[latestVersion]/[pkg.main] 
```

- `TypeScript`相关

```json
{
  // ts类型定义入口文件
  "types": "./lib/main.d.ts"
}
```

- browserslist 浏览器兼容

```json
{
  "browserslist": [
    "> 1%",
    "last 2 versions"
  ]
}
```

- 发行打包相关

```json
{
  // 定义es6+模块入口文件，构建工具（webpack/rollup）在构建项目的时候，如果发现了这个字段，会首先使用这个字段指向的文件，如果未定义，则回退到 main 字段指向的文件
  "module": "./es/index.js",
  // 供浏览器使用的入口文件, 未定义则回退到 main 字段指向的文件
  "browser": "./lib/index.b.js",
  // 使用 es 模块化规范，stage 4 特性的源代码。
  // "esnext": "main-esnext.js"
  "esnext": {
    "main": "main-esnext.js",
    "browser": "browser-specific-main-esnext.js"
  }
}
```

- `sideEffects` 副作用(webpack)

`false || string[]`

让 webpack 的 `tree-shaking` 更高效，以指示项目中哪些文件是“pure”的。false 表示所有代码都没有副作用，因此webpack可以安全地修剪未使用的导出。
如果代码确实有一些副作用，则可以提供一个数组，数组接受相关文件的相对，绝对和全局模式。
如果您在项目中使用类似`css-loader`的东西并 import 一个 CSS 文件，则需要将其添加到 side effect 列表中，这样就不会在生产模式中无意中将其删除
`side effect(副作用)` 的定义是，在导入时会执行特殊行为的代码，而不是仅仅暴露一个 export 或多个 export。举例说明，例如 polyfill，它影响全局作用域，并且通常不提供 export

```json
{
  "sideEffects": [
    "./src/some-side-effectful-file.js",
    "*.css"
  ]
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
