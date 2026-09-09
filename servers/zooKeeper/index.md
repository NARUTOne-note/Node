# ZooKeeper

> ZooKeeper 是一个开源的**分布式协调服务**（coordination service）。它本身不存你的业务数据，而是帮分布式系统里的多台机器「对配置、选主、加锁、互相发现」。

[ZooKeeper 官网](https://zookeeper.apache.org/) ｜ [文档](https://zookeeper.apache.org/doc/current/)

简单说：一堆散落各处的机器各自为政会乱套——配置变了谁知道？谁是主？谁先动手？ZooKeeper 就是那块「大家都信、都看着」的公共看板。Hadoop、HBase、Kafka、Solr 这些大数据组件，都用它来做协调。

> 想看「它是什么、怎么工作」的图文版，打开同目录的 [`zookeeper.html`](./zookeeper.html)（浏览器直接打开即可）。

- **协调而非存储**：不存业务大数据，专管「元信息 / 配置 / 锁 / 选主 / 注册」这类小而关键的协调活
- **树状数据模型**：像 Unix 文件系统，路径一层层挂，每个节点（znode）存一小段数据
- **强一致**：写要过半节点同意才算成功，任意客户端读到的都是一致的数据
- **高可用**：自己也是集群，挂掉少数节点（不过半）照样对外服务
- **临时节点 + watch**：节点可设成「断线自动消失」，还能注册监听，变化即通知——选主/服务发现的核心武器
- **顺序节点**：创建节点时可自动追加递增编号，天然适合做分布式排队 / 锁

## 准备

ZooKeeper 是 Java 写的，需要 **JDK 8+**。本地学习用「单机模式」即可，生产要「集群模式」（≥3 台奇数台）。

```bash
# 1) 确认 JDK
java -version

# 2) 下载解压（以 3.8.x 为例，去 apache 镜像站取最新）
#    https://zookeeper.apache.org/releases.html
tar -xzf apache-zookeeper-3.8.4-bin.tar.gz
cd apache-zookeeper-3.8.4-bin

# 3) 复制一份配置
cp conf/zoo_sample.cfg conf/zoo.cfg

# 4) Docker 免安装（最省事，学习推荐）
docker run -d --name zk -p 2181:2181 zookeeper:3.8
```

默认客户端端口 **2181**。

## 基础使用

> 下面用自带的命令行客户端 `zkCli.sh`（Windows 是 `zkCli.cmd`）演示。连上后就能像操作目录一样读写那棵树。

### 连接

```bash
# 连本地单机
./bin/zkCli.sh -timeout 5000 -server 127.0.0.1:2181
# 连 docker 里的
docker exec -it zk ./bin/zkCli.sh -server 127.0.0.1:2181
```

### 基本操作（像操作目录）

```bash
# 查看根下有哪些节点
ls /
#  → [zookeeper]

# 创建节点 /app1/config，数据是 "db_url=mysql://..."（-s 顺序 -e 临时）
create /app1 "my app"
create /app1/config "db_url=mysql://127.0.0.1:3306"

# 读节点数据
get /app1/config
# 也能看元信息（版本号、子节点数、临时性、数据长度）
get -s /app1/config

# 改数据
set /app1/config "db_url=mysql://10.0.0.1:3306"

# 删节点（有子节点会失败，用 deleteall 递归）
delete /app1/config

# 注册监听：节点一变就触发通知（只触发一次，需重新注册）
get -w /app1/config
```

**四种节点类型**（理解这个就懂了它大半）：

| 类型 | 关键词 | 一句话 |
| --- | --- | --- |
| 持久节点 | `create` 默认 | 创建后一直存在，主动删才没 |
| 持久顺序 | `create -s` | 持久 + 名字自动追加递增编号，如 `lock-00000001` |
| 临时节点 | `create -e` | 客户端会话断开就自动消失，是选主/服务发现的关键 |
| 临时顺序 | `create -e -s` | 临时 + 顺序，分布式锁的标准做法 |

### 常见场景

**① 统一配置（一处改、全网知）**

```bash
# 把配置写进某节点
create /config/db_url "mysql://10.0.0.1:3306"
# 所有应用启动时 get /config/db_url 取值
# 变更时 set，盯梢的应用通过 watch 收到通知
```

**② 选主（谁当 Leader）**

```bash
# 每台都试着创建同一个临时节点 /leader，只能有一个成功
create -e /leader "node-A"
#  → Created /leader              ← 这台当上主
#  → Node already exists          ← 其余失败，去 get -w /leader 盯着
# 主挂了 → 临时节点消失 → 盯梢的被唤醒 → 大家再抢一轮
```

**③ 分布式锁（排队抢）**

```bash
# 都在 /lock 下创建「临时顺序」节点，得到 /lock/req-0001、req-0002 ...
create -e -s /lock/req "lock"
# 判断自己是不是最小编号：是 → 拿到锁；不是 → 盯住前一个节点 get -w
# 前一个释放/崩溃，自己被唤醒，依次推进
```

**④ 服务发现（谁在线）**

```bash
# 服务上线时在 /services 下创建临时节点
create -e /services/payment "10.0.0.5:8080"
# 调用方 ls -w /services 看有哪些在线；服务一挂，临时节点自动消失，调用方收到通知
```

## ACL 权限

ZooKeeper 的权限通过 `setAcl` 控制，用 `scheme:id:perm` 表示：

| 权限缩写 | 含义 | 白话 |
| --- | --- | --- |
| `c` | CREATE | 能建子节点 |
| `d` | DELETE | 能删子节点 |
| `r` | READ | 能读、能 ls |
| `w` | WRITE | 能改数据 |
| `a` | ADMIN | 能改权限 |

```bash
# 限制某节点只能被指定 IP 读写
setAcl /app1/config ip:10.0.0.1:crwad
# 用 digest（用户名:密码）认证
addauth digest username:password
setAcl /app1/config auth:username:crwad
```

## 常用配置（zoo.cfg）

| 名称 | 作用 | 默认 / 示例 |
| --- | --- | --- |
| `tickTime` | 基本时间单位（ms），心跳/超时都以它计 | `2000` |
| `initLimit` | 启动时 follower 同步 leader 的 tick 数 | `10` |
| `syncLimit` | 运行中 follower 与 leader 心跳超时 tick 数 | `5` |
| `dataDir` | 数据快照存储目录 | `/var/lib/zookeeper` |
| `clientPort` | 客户端连接端口 | `2181` |
| `server.N` | 集群成员，N 是 myid | `server.1=host1:2888:3888` |

集群模式额外要做：每台 `dataDir` 下放一个 `myid` 文件，内容是该台编号（对应 `server.N` 的 N）。

## 监控 / 可视化

- **四字母命令**（运维常用）：`echo stat | nc 127.0.0.1 2181`，看 `stat / ruok / conf / mntr`
- [PrettyZoo](https://github.com/vran-dev/PrettyZoo)：跨平台 GUI 客户端
- [ZooNavigator](https://github.com/elkozmon/zoonavigator)：Web 可视化

## 小结

- **一句话**：ZooKeeper 是分布式系统的「协调员」——一棵共享的树，过半写、watch 通知、临时节点自动消失。
- **适合**：统一配置、选主、分布式锁、服务发现、集群成员管理这种「小数据、强一致、要通知」的场景。
- **什么时候不该用**：
  - 存业务大数据 / 大文件——它每个节点默认只放约 1MB，吃不下。
  - 超高频写——每次写都要集群过半同步，扛不住高吞吐（那是 Redis / Kafka 的活）。
  - 海量节点——树太大会让 watch 和快照变慢。
- **Java 客户端**：原生 `org.apache.zookeeper.ZooKeeper` 偏底层；实际多用 Curator（提供了现成的 Leader 选举、分布式锁、缓存等 recipe，少踩很多坑）。
