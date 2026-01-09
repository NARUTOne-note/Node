# pm2

> 主要功能就是进程管理、日志管理、负载均衡、性能监控等等。

般都是 docker 镜像内安装 pm2 来跑 node

## 准备

```bash
npm install -g pm2

## 启动 node ./main.js，改为pm2 启动
pm2 start ./main.js

## 查看日志，~/.pm2/logs
pm2 logs [进程名、进程ID]

## 停止，重启
pm2 stop [ID]
pm2 restart [ID]

## 删除进程
pm2 delete [进程ID]
```

结合docker，例：

```docker
# build stage
FROM node:18 as build-stage

WORKDIR /app

COPY package.json .

RUN npm config set registry https://registry.npmmirror.com/

RUN npm install

COPY . .

RUN npm run build

# production stage
FROM node:18 as production-stage

COPY --from=build-stage /app/dist /app
COPY --from=build-stage /app/package.json /app/package.json

WORKDIR /app

RUN npm install --production

EXPOSE 3000

CMD ["node", "/app/main.js"]

```
