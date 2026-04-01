# Docker

基于Go语言开发的开源应用容器引擎，属于对Linux容器技术（LXC）的一种封装（利用了Linux的namespace和cgroup技术），它提供了简单易用的容器使用接口，是目前最流行的 Linux 容器解决方案。Docker将应用程序与该程序的依赖打包在一个文件里面，运行这个文件，就会生成一个虚拟容器。程序在这个虚拟容器里运行，就好像在真实的物理机上运行一样

1. 提供一次性的环境。
2. 提供弹性的云服务（利用Docker很容易实现扩容和收缩）
3. 实践微服务架构（隔离真实环境在容器中运行多个服务）

Docker 的实现原理依赖 linux 的 Namespace、Control Group、UnionFS 这三种机制。**Namespace 做资源隔离，Control Group 做容器的资源限制，UnionFS 做文件系统的分层镜像存储、镜像合并**

**核心优势**

- 跨平台一致性：解决"在我机器上能跑"的问题，环境标准化，确保开发、测试、生产环境一致。
- 资源高效：容器直接共享主机内核，无需虚拟化整个操作系统，节省内存和 CPU。
- 快速部署：轻量、秒级启动容器，支持自动化扩缩容。
- 隔离性：每个容器拥有独立的文件系统、网络和进程空间。
- 可移植性：一次构建，到处运行

### 核心概念

- **容器**（Docker Container）：轻量化的运行实例，包含应用代码、运行时环境和依赖库。基于镜像创建，与其他容器隔离，共享主机操作系统内核（比虚拟机更高效）。
  - 容器是镜像的运行实例，是一个轻量级、可移植的执行环境。
  - 隔离性：每个容器都有自己的文件系统、网络和进程空间
  - 临时性：容器可以被创建、启动、停止、删除
  - 可写层：容器在镜像基础上添加了一个可写层
  - 进程级：容器内通常运行一个主进程
- **镜像**（Docker Image）：只读模板，包含了运行应用所需的所有内容：代码、运行时、库文件、环境变量和配置文件；
  - 定义了容器的运行环境（如操作系统、软件配置等）。
  - 通过分层存储（Layer）优化空间和构建速度，每一层代表一次修改。
  - 镜像就像是一个安装程序或者模板，它定义了应用运行所需的一切，但本身不能直接运行。
  - 同一个镜像可以创建多个容器。
- **仓库**（Docker Registry）：存储和分发镜像的平台，如 Docker Hub（官方公共仓库）、私有企业仓库（如 Harbor）、由软件官方维护的镜像仓库。
- **Dockerfile**：文本文件，描述如何自动构建镜像（例如指定基础镜像、安装软件、复制文件等）。

**Registry vs Repository**：
Registry：仓库注册服务器，如 Docker Hub
Repository：具体的镜像仓库，如 nginx、mysql

容器化遵循**不可变基础设施**的理念：

- 应用和环境被打包成不可变的镜像
- 每次部署都使用相同的镜像
- 配置通过环境变量或配置文件注入
- 问题修复通过重新构建镜像而非修改运行中的容器

### vs虚拟机

> 硬件级别虚拟化，每个VM需要完整OS，开销大，资源占用多，镜像大小GB级别

虚拟机适用场景：

- 需要完全隔离的环境
- 运行不同操作系统的应用
- 需要硬件级别的安全隔离

Docker容器适用场景：

- 微服务架构
- CI/CD流水线
- 应用快速部署和扩展
- 开发环境标准化

### 架构

![docker 架构](./imgs/docker-ss.png)

- Docker Client（客户端）：用户与Docker交互的主要方式，cli 命令
- Docker Daemon（守护进程）：核心服务进程；管理镜像、容器、网络和存储卷；监听Docker API请求并处理
- Docker Engine （引擎 API）：Docker Client + Docker Daemon + REST API，是Docker的核心组件，提供的 RESTful 接口，允许外部客户端与 Docker 守护进程进行通信
- Docker Registry：存储和分发Docker镜像、提供镜像的版本管理、支持公有和私有仓库
- Docker Hub：官方公共Registry（nginx、mysql等）、包含大量预构建镜像、支持自动构建功能、免费和付费服务
- Docker Compose：用于定义和运行多容器 Docker 应用的工具，可以使用一个 docker-compose.yml 配置文件定义多个容器（服务），并可以通过一个命令启动这些容器
- Docker Swarm：提供的集群管理和调度工具。它允许将多个 Docker 主机（节点）组织成一个集群，并通过 Swarm 集群管理工具来调度和管理容器，实现容器的负载均衡、高可用性和自动扩展等功能
- Docker Networks（网络）：允许容器之间相互通信，并与外部世界进行连接。Docker 提供了多种网络模式来满足不同的需求，如 bridge 网络（默认）、host 网络和 overlay 网络等。
- Docker Volumes（卷）：数据持久化机制，允许数据在容器之间共享，并且独立于容器的生命周期。与容器文件系统不同，卷的内容不会随着容器的销毁而丢失，适用于数据库等需要持久存储的应用。

Docker 架构的工作流程：

- 构建镜像：使用 Dockerfile 创建镜像。
- 推送镜像到注册表：将镜像上传到 Docker Hub 或私有注册表中。
- 拉取镜像：通过 docker pull 从注册表中拉取镜像。
- 运行容器：使用镜像创建并启动容器。
- 管理容器：使用 Docker 客户端命令管理正在运行的容器（例如查看日志、停止容器、查看资源使用情况等）。
- 网络与存储：容器之间通过 Docker 网络连接，数据通过 Docker 卷或绑定挂载进行持久化。

## 准备

[docker 官网](https://www.docker.com/) 下载客户端

window 使用 powershell 执行

基本命令

```bash
# 拉取镜像（如官方Nginx镜像）
docker pull nginx

# 运行容器（-d 后台运行，-p 映射端口）
docker run -d -p 80:80 nginx

# 查看运行中的容器
docker ps

# 构建镜像（基于当前目录的Dockerfile）
docker build -t my-app .

# 使用 ubuntu 镜像启动一个容器，参数为以命令行模式进入该容器（加上 -d 则不会进入容器）
docker run -it ubuntu /bin/bash

# 进入容器内部
docker exec -it <容器ID/name> /bin/bash

# 推出容器
exit

```

常用的 Docker 客户端命令：

| 命令 | 功能 | 示例 |
| --- | --- | --- |
| docker run | 启动一个新的容器并运行命令 | docker run -d ubuntu |
| docker ps | 列出当前正在运行的容器 | docker ps |
| docker ps -a | 列出所有容器（包括已停止的容器） | docker ps -a |
| docker build | 使用 Dockerfile 构建镜像，`.` 代表上下文路径  | docker build -t my-image . |
| docker images | 列出本地存储的所有镜像 | docker images |
| docker pull | 从 Docker 仓库拉取镜像 | docker pull ubuntu |
| docker push | 将镜像推送到 Docker 仓库 | docker push my-image |
| docker exec | 在运行的容器中执行命令 | docker exec -it container_name bash |
| docker stop | 停止一个或多个容器 | docker stop container_name |
| docker start | 启动已停止的容器 | docker start container_name |
| docker restart | 重启一个容器 | docker restart container_name |
| docker rm | 删除一个或多个容器 | docker rm container_name |
| docker rmi | 删除一个或多个镜像 | docker rmi my-image |
| docker logs | 查看容器的日志 | docker logs container_name |
| docker inspect | 获取容器或镜像的详细信息 | docker inspect container_name |
| docker exec -it | 进入容器的交互式终端（不会导致容器停止） | docker exec -it container_name /bin/bash |
| docker network ls | 列出所有 Docker 网络 | docker network ls |
| docker volume ls | 列出所有 Docker 卷 | docker volume ls |
| docker-compose up | 启动多容器应用（从 docker-compose.yml 文件） | docker-compose up |
| docker-compose down | 停止并删除由 docker-compose 启动的容器、网络等 | docker-compose down |
| docker info | 显示 Docker 系统的详细信息 | docker info |
| docker version | 显示 Docker 客户端和守护进程的版本信息 | docker version |
| docker stats | 显示容器的实时资源使用情况 | docker stats |
| docker login | 登录 Docker 仓库 | docker login |
| docker logout | 登出 Docker 仓库 | docker logout |

常用选项说明:

`-d`：后台运行容器，例如 docker run -d ubuntu。
`-it`：以交互式终端运行容器，例如 docker exec -it container_name bash。
`-t`：为镜像指定标签，例如 docker build -t my-image .。

### 构建镜像

- Docker镜像是由文件系统叠加而成的，系统的最底层是**bootfs**，相当于就是Linux内核的引导文件系统；
- 接下来第二层是**rootfs**，这一层可以是一种或多种操作系统（如Debian或Ubuntu文件系统），Docker中的rootfs是只读状态的；
- Docker利用联合挂载技术将各层文件系统叠加到一起，最终的文件系统会包含有底层的文件和目录，这样的文件系统就是一个镜像。

![docker-run](./imgs/docker-run.png)

**Dockerfile**使用DSL（Domain Specific Language）来构建一个Docker镜像，只要编辑好了Dockerfile文件，就可以使用`docker build`命令来构建一个新的镜像。

Dockerfile文件示例：

```Dockerfile
# 指定基础镜像
FROM python:3.7
# 指定镜像的维护者
MAINTAINER jackfrued "jackfrued@126.com"
# 将指定文件添加到容器中指定的位置
ADD api/* /root/api/
# 设置工作目录
WORKDIR /root/api
# 把容器外的内容复制到容器内
COPY . .
# 执行命令(安装Flask项目的依赖项)
RUN pip install -r requirements.txt -i https://pypi.doubanio.com/simple/
# 容器启动时要执行的命令
ENTRYPOINT ["./start.sh"]
# 暴露端口
EXPOSE 8000
# 容器启动的时候执行的命令
CMD ["http-server", "-p", "8000"]
```

**注意**：Dockerfile 的指令每执行一次都会在 docker 上新建一层。所以过多无意义的层，会造成镜像膨胀过大
上面新增了3层镜像：ADD、COPY、RUN

- `FROM`：定制的镜像都是基于 FROM 的镜像，这里的 nginx 就是定制需要的基础镜像。后续的操作都是基于 nginx。
- `RUN`：用于执行后面跟着的命令行命令，两种格式：`RUN ["./test.php", "dev", "offline"]` 等价于 `RUN ./test.php dev offline`

| Dockerfile 指令 | 说明 | 指令示例 |
| --- | --- | --- |
| FROM | 指定基础镜像，用于后续的指令构建。 | `FROM node:20-alpine` |
| MAINTAINER | 指定Dockerfile的作者/维护者。（已弃用，推荐使用LABEL指令） | `MAINTAINER name@example.com` |
| LABEL | 添加镜像的元数据，使用键值对的形式。 | `LABEL version="1.0" maintainer="me"` |
| RUN | 在构建过程中在镜像中执行命令。 | `RUN npm ci` |
| CMD | 指定容器创建时的默认命令。（可以被覆盖） | `CMD ["node", "app.js"]` |
| ENTRYPOINT | 设置容器创建时的主要命令。（不可被覆盖） | `ENTRYPOINT ["./entrypoint.sh"]` |
| EXPOSE | 声明容器运行时监听的特定网络端口。 | `EXPOSE 8080` |
| ENV | 在容器内部设置环境变量。 | `ENV NODE_ENV=production` |
| ADD | 将文件、目录或远程URL复制到镜像中。 | `ADD https://example.com/file.tar.gz /tmp/` |
| COPY | 将文件或目录复制到镜像中。 | `COPY package.json ./` |
| VOLUME | 为容器创建挂载点或声明卷。 | `VOLUME ["/data"]` |
| WORKDIR | 设置后续指令的工作目录。 | `WORKDIR /app` |
| USER | 指定后续指令的用户上下文。 | `USER node` |
| ARG | 定义在构建过程中传递给构建器的变量，可使用 "docker build" 命令设置。 | `ARG VERSION=latest` |
| ONBUILD | 当该镜像被用作另一个构建过程的基础时，添加触发器。 | `ONBUILD COPY . /app/src` |
| STOPSIGNAL | 设置发送给容器以退出的系统调用信号。 | `STOPSIGNAL SIGTERM` |
| HEALTHCHECK | 定义周期性检查容器健康状态的命令。 | `HEALTHCHECK --interval=30s CMD wget -qO- http://127.0.0.1/health` |
| SHELL | 覆盖Docker中默认的shell，用于RUN、CMD和ENTRYPOINT指令。 | `SHELL ["/bin/bash", "-c"]` |

### docker compose

> docker 桌面版（win/mac）不需要单独安装 docker compose

[docker compose 下载](https://github.com/docker/compose/releases)

示例：

```yaml
services:
  nest-app:
    build:
      context: ./
      dockerfile: ./Dockerfile
      # 依赖镜像，先启动这两
    depends_on:
      - mysql-container
      - redis-container
    ports:
      - '3000:3000'
  mysql-container:
    image: mysql
    ports:
      - '3306:3306'
    volumes:
      - /Users/guang/mysql-data:/var/lib/mysql
    environment:
      MYSQL_DATABASE: aaa
      MYSQL_ROOT_PASSWORD: guang
  redis-container:
    image: redis
    ports:
      - '6379:6379'
    volumes:
      - /Users/guang/aaa:/data

```

通信方式：

- 通过端口访问， nest 的容器里通过宿主机 ip 访问这两个服务的
- 通过 docker network create 创建一个桥接网络，然后 docker run 的时候指定 --network，这样 3 个容器就可以通过容器名互相访问了。

```bash
# 启动 compose
docker-compose up [-d]
```

**yml配置指令参考**

```yml
# compose版本
version: "3.7"
services:
  # 服务名
  webapp:
  # 构建镜像
    build:
    # 相对上下文，dockfile 位置
      context: ./dir
      # 指定名称
      dockerfile: Dockerfile-alternate
      # 添加构建参数，只能构建过程中访问的变量
      args:
        buildno: 1
      # 构建镜像的标签
      labels:
        - "com.example.description=Accounting webapp"
        - "com.example.department=Finance"
        - "com.example.label-with-empty-value"
      # 多层构建，可以指定构建哪一层
      target: prod
  # 为容器指定父 cgroup 组，意味着将继承该组的资源限制
    cgroup_parent: m-executor-abcd
  # 覆盖容器启动的默认命令
    command: ["bundle", "exec", "thin", "-p", "3000"]
  # 自定义容器名
    container_name: my-web-container
  # 依赖关系，顺序启动服务，先启动子依赖
    depends_on:
      - db
      - redis
    # 访问集群服务的方式，vip(虚拟IP), dnsrr(dns轮询)
    endpoint_mode: vip 
    # 从文件添加环境变量
    env_file:
      - ./common.env
      - ./apps/web.env
      - /opt/secrets.env
    # 添加环境变量
    environment:
      RACK_ENV: development
      SHOW: 'true'
    # 重启策略
    # restart: "no"
    # restart: always
    # restart: on-failure
    restart: unless-stopped
  # 服务
  redis:
  # 镜像
    image: redis
  db:
    image: postgres
    # 将主机的数据卷或者文件挂载到容器里
    volumes:
      - "/localhost/postgres.sock:/var/run/postgres/postgres.sock"
      - "/localhost/data:/var/lib/postgresql/data"
```

### 重启

Docker 是支持自动重启的，可以在 docker run 的时候通过 --restart 指定重启策略，或者 Docker Compose 配置文件里配置 restart。

有 4 种重启策略：

- no: 容器退出不自动重启（默认值）
- always：容器退出总是自动重启，除非 docker stop。
- on-failure：容器非正常退出才自动重启，还可以指定重启次数，如 on-failure:5
- unless-stopped：容器退出总是自动重启，除非 docker stop

重启策略为 always 的容器在 Docker Deamon 重启的时候容器也会重启，而 unless-stopped 的不会。

其实我们用 PM2 也是主要用它进程崩溃的时候重启的功能，而在有了 Docker 之后，用它的必要性就不大了。

当然，进程重启的速度肯定是比容器重启的速度快一些的，如果只是 Docker 部署，可以结合 pm2-runtime 来做进程的重启。

## hubs

常用的公共镜像

- Ubuntu：基于 Debian 的 Linux 操作系统。
- CentOS： Linux 发行版之一，它是来自于 Red Hat Enterprise Linux(RHEL) 依照开放源代码规定发布的源代码所编译而成
- Nginx: 一个高性能的 HTTP 和反向代理 web 服务器，同时也提供了 IMAP/POP3/SMTP 服务 
- Node.js: 基于 Chrome V8 引擎的 JavaScript 运行环境，是一个让 JavaScript 运行在服务端的开发平台
- MySQL: 最受欢迎的开源数据库。凭借其可靠性、易用性和性能，MySQL 已成为 Web 应用程序的数据库优先选择
- Python: python 版本镜像
- Redis： 是一个开源的使用 ANSI C 语言编写、支持网络、可基于内存亦可持久化的日志型、Key-Value 的 NoSQL 数据库，并提供多种语言的 API。
- MongoDB：是一个免费的开源跨平台面向文档的 NoSQL 数据库程序
