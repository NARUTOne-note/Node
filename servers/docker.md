# Docker

基于Go语言开发的开源应用容器引擎，属于对Linux容器技术（LXC）的一种封装（利用了Linux的namespace和cgroup技术），它提供了简单易用的容器使用接口，是目前最流行的 Linux 容器解决方案。Docker将应用程序与该程序的依赖打包在一个文件里面，运行这个文件，就会生成一个虚拟容器。程序在这个虚拟容器里运行，就好像在真实的物理机上运行一样

1. 提供一次性的环境。
2. 提供弹性的云服务（利用Docker很容易实现扩容和收缩）
3. 实践微服务架构（隔离真实环境在容器中运行多个服务）

Docker 的实现原理依赖 linux 的 Namespace、Control Group、UnionFS 这三种机制。**Namespace 做资源隔离，Control Group 做容器的资源限制，UnionFS 做文件系统的分层镜像存储、镜像合并**

## 准备

[docker 官网](https://www.docker.com/)

## 构建镜像

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