# Hadoop

> Apache 开源的**分布式基础平台**，大数据时代的起点。一句话：用一堆普通服务器，拼出一个「存得下 PB 级数据、算得动 PB 级数据」的集群——**HDFS 负责存、YARN 负责调度、MapReduce 负责算**。
>
> 理解 Hadoop 的价值不在会用它的命令行，而在于它奠定了整套大数据体系的思维方式：**移动计算而非移动数据、分而治之、水平扩展、容忍故障**。
>
> 相关：[mapreduce.md](./mapreduce.md)（计算模型）、[hive.md](./hive.md)（SQL on Hadoop）、[spark.md](./spark.md)、[flink.md](./flink.md)、[doris.md](./doris.md)、[database.md](./database.md)（大数据技术体系总览）、[s3.md](./s3.md)（云上存算分离的替代存储）

## 一、背景与要解决的问题

### 背景

2000 年代中期，互联网公司的数据量开始从 GB 级冲向 TB、PB 级——用户行为日志、点击流、爬虫抓取的网页、交易明细。**数据涨了三个数量级，但处理数据的技术栈还停留在「换一台更强的服务器」这个思路上**：关系数据库存不下、单机程序算不动，而买得起的小型机加高端存储又有物理上限。

几乎同一时间，Google 在 2003、2004 年发表了三篇论文，把「用廉价机器集群处理海量数据」的答案公开了出来：

| 论文 | 年份 | 对应开源实现 |
| --- | --- | --- |
| **GFS**（Google File System） | 2003 | **HDFS** |
| **MapReduce** | 2004 | **MapReduce** |
| **BigTable** | 2006 | **HBase** |

Doug Cutting 受此启发，在自己写的搜索引擎项目 Nutch 中实现了开源版本，2006 年捐给 Apache 成为 **Hadoop**（名字来自他儿子的大象玩具）。所以 Hadoop 从诞生起就是**「用廉价机器解决海量数据」**的工程答案。

### 要解决的问题

| 问题 | 之前怎么做 | 为什么失效 |
| --- | --- | --- |
| **单机存不下** | 加硬盘、换小型机 + 高端存储阵列（SAN） | 有物理上限；成本随容量指数上升，PB 级根本买不起 |
| **单机算不动** | 优化 SQL、加索引、换更强的 CPU | TB 级全量扫描是小时级，靠调优救不回来 |
| **只能纵向扩容** | 升级单机配置 | 无法「加机器就加能力」，且永远追不上数据增长 |
| **机器一定会坏** | 依赖硬件高可靠（RAID、双机热备、高端服务器） | 几百台普通机器的规模下，磁盘/节点故障是**日常**而非异常，系统必须**把故障当默认情况设计** |
| **非结构化数据没处放** | 用关系库存 BLOB | 存不下、读不动，schema 也不匹配 |

### 它给出的答案：三大核心

**用一堆便宜机器，拼出一个「存得下、算得动、坏了也不怕」的集群。** 具体落地为三层：

```text
┌─────────────────────────────────────────────┐
│  MapReduce（计算层，2.x 起被 YARN 托管）      │
├─────────────────────────────────────────────┤
│  YARN（资源调度层，2.x 新增）                 │
├─────────────────────────────────────────────┤
│  HDFS（分布式存储层，所有组件的公共底座）      │
└─────────────────────────────────────────────┘
```

| 组件 | 定位 | 一句话 |
| --- | --- | --- |
| **HDFS** | 分布式文件系统 | 把多台机器的磁盘拼成一个超大文件系统，多副本保证不丢 |
| **YARN** | 资源调度框架 | 集群的 CPU/内存统一池化，谁要资源就发 Container 给它 |
| **MapReduce** | 分布式计算模型 | 把大任务拆成小任务分到各节点跑，再汇总（详见 [mapreduce.md](./mapreduce.md)） |

**版本演进：**

| 版本 | 特点 |
| --- | --- |
| **Hadoop 1.x** | HDFS + MapReduce；JobTracker 同时管资源和任务，单点瓶颈、只能跑 MR |
| **Hadoop 2.x** | 引入 **YARN** 把资源调度独立出来，一个集群可同时跑 MR/Spark/Flink；HDFS 支持 **HA**（双 NameNode）与 **Federation** |
| **Hadoop 3.x** | HDFS **纠删码**（省存储）、支持多 NameNode（≥3）、YARN Timeline Service v2、**大量默认端口变更**、JDK 8+ |

> 现在谈 Hadoop，**默认指 Hadoop 2.x/3.x 生态**：HDFS 是绝对主力（几乎没人不用），YARN 是中坚（很多集群还在用），**MapReduce 已是历史**（被 Spark 取代，了解原理即可）。

## 二、HDFS

### 核心思想

HDFS（Hadoop Distributed File System）的设计取舍非常明确——**为「一次写入、多次读取」的大文件批处理而生**，因此：

- 牺牲低延迟（高吞吐优先，秒级起步）
- 牺牲小文件（元数据全压在 NameNode 内存里）
- 牺牲随机写（只支持追加，不支持任意位置修改）
- 换取：**超大文件、流式访问、容错、廉价机器**

### 架构

```text
                    ┌──────────────┐        ┌────────────────────┐
   Client ─────────▶│  NameNode    │◀──────▶│ SecondaryNameNode  │
   元数据操作        │ (Active)     │        │ (定期合并 fsimage)  │
                    └──────┬───────┘        └────────────────────┘
                           │ 管理 DataNode 心跳 / 块位置
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   ┌─────────┐        ┌─────────┐        ┌─────────┐
   │DataNode │        │DataNode │        │DataNode │
   │ blk1    │        │ blk2    │        │ blk1    │
   │ blk2    │        │ blk1    │        │ blk2    │   ← 每个块默认 3 副本
   └─────────┘        └─────────┘        └─────────┘
        客户端读写数据直接与 DataNode 交互，不经过 NameNode
```

| 角色 | 职责 | 关键点 |
| --- | --- | --- |
| **NameNode（NN）** | 命名空间 + 元数据：目录树、文件→块映射、块→DataNode 映射 | 元数据**常驻内存**（这是内存瓶颈与小文件问题的根源）；持久化靠 **fsimage**（快照）+ **edits**（操作日志）。**单点**，挂了整个 HDFS 就不可用 |
| **DataNode（DN）** | 实际存数据块；定期向 NN 发心跳（默认 3s）与块报告 | 心跳超时（默认 10.5 分钟）判定为死节点，其上副本会被重新复制 |
| **SecondaryNameNode** | **不是备份！** 定期把 fsimage + edits 合并成新 fsimage，减小 edits 体积、加快重启 | 2.x 起在 HA 架构中被 Standby NameNode 取代 |
| **Client** | 提供 `hdfs dfs` 命令与 API，读写时**直接连着 DataNode** 传数据 | NameNode 只回答「块在哪」，不搬运数据 |

**NameNode 是单点**，生产必须做 HA（见下文）。

### 数据块（Block）

- 文件被切成固定大小的 **Block** 分散存储，是 HDFS 的基本存储单位。
- **默认块大小：Hadoop 2.x/3.x 为 128 MB，1.x 为 64 MB**。
- 块大是有意为之：减少寻址开销、让 NameNode 元数据更少、适合流式顺序读。
- **副本因子默认 3**，`dfs.replication` 可调。副本不仅是容错，也能让计算就近读数据。

> 块大小的直觉：一个 1 GB 文件按 128 MB 切成 8 个块，每个块 3 副本 → 磁盘上占 3 GB。**HDFS 实际占用 = 文件大小 × 副本数**，做容量规划时必须算进去。

### 副本放置策略（机架感知）

默认 3 副本的放置规则：

1. **第一个副本**：如果客户端就在集群内，放在客户端所在节点；否则随机选一个节点。
2. **第二个副本**：放在**另一个机架**的节点（防整个机架断电/交换机故障）。
3. **第三个副本**：放在**与第二个同机架**的另一节点（省跨机架带宽）。

**为什么这样放？** 机架内带宽远大于跨机架带宽、也远便宜。这套策略在「容错」与「跨机架流量」之间取平衡：**至少一个副本在别的机架**保证机房级容灾，**其余副本尽量同机架**减少跨机架传输。

读取时，客户端会**优先读本地节点**的副本，其次同机架，最后才跨机架——这就是「移动计算不移动数据」的由来。

### 写流程（简化）

```text
1. Client 调 NN 的 create() 创建文件 → NN 记录元数据（此刻并不涉及数据）
2. Client 请求 addBlock() → NN 返回一组 DataNode 列表（按副本策略排序）
3. Client 以 pipeline 方式写入：
   Client ──▶ DN1 ──▶ DN2 ──▶ DN3
   数据以 packet（默认 64KB）为单位流式传递，逐级确认（ACK 反向回传）
4. 每个 packet 有校验和；某级失败则从 pipeline 中移除该节点、NN 补新副本
5. 全部写完 → Client 通知 NN complete()，NN 提交元数据
```

关键点：**数据不经过 NameNode**，NN 只做「查地址」和「记账」，所以不会成为吞吐瓶颈，但会成为**元数据操作瓶颈**。

### 读流程（简化）

```text
1. Client 调 NN 的 open() → NN 返回该文件所有块及其副本所在的 DataNode 列表
2. Client 按「就近原则」选 DataNode（本地 > 同机架 > 跨机架）逐个读取块
3. 读取失败则换另一个副本重试
```

### HA 与 Federation

**HA（高可用）**——解决 NameNode 单点：

- **Active / Standby 两个 NameNode**，共享同一份元数据。
- 元数据同步靠 **JournalNode 集群（QJM）**：Active 写 edits 到多数派 JournalNode，Standby 读取并重放，保持内存状态一致。
- **ZKFC（ZooKeeper Failover Controller）** 监控 NN 健康，故障时通过 ZooKeeper 抢锁自动主备切换。
- 客户端通过 `dfs.nameservices` + nameservice ID 访问逻辑名，无需改地址。
- 切换期间通常需要几十秒（Standby 冷启动 + 重放 edits），**不等于零中断**。

**Federation（联邦）**——解决命名空间规模瓶颈：

- 多个独立的 NameNode 各自管理**一部分目录**（如 `/user`、`/logs`、`/warehouse`），**共享底层所有 DataNode 的存储**。
- 本质是**水平分片元数据**：把一个 NN 的内存压力拆到多个 NN。管理比多云更复杂，非超大集群一般不用。

### 纠删码（Erasure Coding，Hadoop 3.0+）

3 副本的存储开销是 300%。纠删码用**校验块代替副本**：典型策略 **RS-6-3-1024k** = 6 个数据块 + 3 个校验块，能容忍任意 3 块丢失，**存储开销降到 150%**。

代价：

- 读取需要并行读多个块做计算解码，**延迟高、CPU 开销大**；
- **不支持 `hflush`/`hsync`**，不能用于需要立刻可见写入的场景（如 HBase、正在写的日志）。

**结论：纠删码适合冷数据**（归档、历史分区），热数据仍用副本。

### 不适合什么（HDFS 的边界）

1. **海量小文件**：每个文件/目录/块在 NameNode 内存里约 **150 字节**。1 亿个小文件光元数据就要 ~15 GB 内存，且每次读取都要额外一次 NN 往返。解决：合并成大文件（打包成 HAR / SequenceFile / Parquet）、或改用对象存储。
2. **低延迟随机读写**：为高吞吐设计，毫秒级随机读请用 HBase、Redis、MySQL。
3. **任意位置修改**：**只能追加（append）**，不能改中间某个字节。要更新数据只能整个重写新文件。
4. **大量并发小写**：一次写入多次读取才是它的舒适区。

### 常用命令

```bash
# 语法形如 hdfs dfs -xxx，等价于 hadoop fs -xxx
hdfs dfs -ls /user/hive/warehouse            # 列目录
hdfs dfs -ls -R /path                        # 递归
hdfs dfs -mkdir -p /data/2026/09             # 建目录
hdfs dfs -put ./a.csv /data/2026/09/         # 本地上传
hdfs dfs -get /data/2026/09/a.csv ./         # 下载（还可 -copyToLocal）
hdfs dfs -cat /data/2026/09/a.csv | head     # 查看内容
hdfs dfs -text /data/x.gz                    # 自动解压查看（支持 gz/seq）
hdfs dfs -rm /data/a.csv                     # 删除（进回收站）
hdfs dfs -rm -r -skipTrash /data/dir         # 递归删除且不进回收站（危险）
hdfs dfs -du -h /data                        # 各目录占用
hdfs dfs -count -q /data                     # 文件数 + 空间配额
hdfs dfs -df -h /                            # 集群容量
hdfs dfs -setrep -w 2 /data/a.csv            # 改副本数为 2（-w 等待完成）
hdfs dfs -chown -R hive:hive /warehouse      # 改属主
hdfs dfs -chmod -R 755 /warehouse            # 改权限
hdfs dfs -expunge                            # 立即清空回收站（默认 6 小时延迟删除）

# 运维诊断
hdfs fsck /data -files -blocks -locations    # 检查文件块与副本状态
hdfs fsck / -list-corruptfileblocks          # 列出损坏块
hdfs balancer                                # 触发数据均衡（节点间磁盘不均时）
hdfs namenode -format                        # 格式化（只在初始化时执行一次！）
hdfs dfsadmin -report                        # 集群 DataNode 状态总览
hdfs dfsadmin -safemode get                  # 查看安全模式
```

> **回收站**：`fs.trash.interval` 默认 0（关闭），开启后删除的文件先进 `/user/<user>/.Trash`，超时自动清理。**很多团队压根没开**，`-rm` 就是真删，操作前务必确认。

### HDFS 参数速查

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `dfs.blocksize` | 128 MB | 块大小 |
| `dfs.replication` | 3 | 副本数 |
| `dfs.namenode.name.dir` | 配置 | NameNode 元数据存放目录（建议多盘） |
| `dfs.datanode.data.dir` | 配置 | DataNode 数据目录（建议多盘，逗号分隔） |
| `dfs.namenode.heartbeat.recheck-interval` | 300000 ms | 与 `dfs.heartbeat.interval`（3s）共同决定死节点判定（默认 10.5 min） |
| `dfs.namenode.handler.count` | 10 | NN 处理 RPC 的线程数，大集群需调大（如 100） |
| `dfs.datanode.max.transfer.threads` | 4096 | DN 并发传输上限，HBase 场景常调大 |
| `dfs.permissions.enabled` | true | 权限开关（测试环境常关，生产必须开） |

## 三、YARN

### 要解决的问题

Hadoop 1.x 中 JobTracker 既管资源又管任务，导致：

1. **单点且压力大**：集群规模上不去（4000 节点左右到顶）。
2. **只支持 MapReduce**：要跑 Spark 得另建一个集群，资源无法共享。

YARN 把「**资源管理**」和「**任务调度**」拆开，把 Hadoop 从「一个计算框架」变成「**一个可以跑各种计算框架的操作系统**」。

### 架构

```text
                    ┌──────────────────────────────┐
      Client ──────▶│  ResourceManager (RM)        │
   提交应用          │  ├─ Scheduler（只分配资源）    │
                    │  └─ ApplicationsManager（管AM）│
                    └───────────┬──────────────────┘
                                │ 分配 Container
     ┌──────────────────────────┼──────────────────────────┐
     ▼                          ▼                          ▼
┌──────────┐              ┌──────────┐              ┌──────────┐
│NodeManager│             │NodeManager│             │NodeManager│
│ ┌────────┐│             │ ┌────────┐│             │ ┌────────┐│
│ │Container││            │ │Container││            │ │Container││
│ │(AppMaster)│           │ │ (Task)  ││            │ │ (Task)  ││
│ └────────┘│             │ └────────┘│             │ └────────┘│
└──────────┘              └──────────┘              └──────────┘
```

| 角色 | 职责 |
| --- | --- |
| **ResourceManager（RM）** | 全局资源仲裁者。**Scheduler** 只负责按策略分配 Container（**不做监控、不重试**）；**ApplicationsManager** 负责接受作业、启动并监控 ApplicationMaster（AM 挂了会重启） |
| **NodeManager（NM）** | 单节点代理：管本节点的 Container 生命周期、监控资源（内存/CPU）使用、向 RM 汇报心跳 |
| **ApplicationMaster（AM）** | **每个应用一个**，由 RM 在某个 NM 上启动。负责向 RM **申请资源**、与 NM 通信**启动 Task**、监控任务、失败重试、汇报进度。这是 YARN 最精妙的设计：**把「应用特有的调度逻辑」下放给应用自己**，YARN 保持通用 |
| **Container** | 资源抽象，= 一定量的内存 + vCPU（可加 GPU）。任务实际跑在 Container 里 |

> **两个「调度」不是一个东西**：RM 的 Scheduler 分配的是**资源（Container）**，AM 分配的是**任务（Task 跑在哪些 Container 上）**。理解这个二段式，YARN 就通了。

### 作业提交流程

```text
1. Client 向 RM 提交应用（含 AM 的启动信息和 jar）
2. RM 的 ApplicationsManager 在某个 NM 上分配第一个 Container 并启动 AM
3. AM 向 RM 注册，并向 Scheduler 申请后续资源（申请的是「几核几 G」）
4. Scheduler 按队列/容量策略返回一批 Container（在哪台 NM 上）
5. AM 直接联系对应 NM，把 Task 启动在 Container 中
6. Task 向 AM 汇报进度/状态；AM 向 RM 汇报应用状态
7. 全部完成 → AM 注销 → RM 回收资源
```

注意第 5 步：**AM 与 NM 直接通信**，RM 只负责分配，不参与任务执行——这让 RM 的负载与集群规模解耦。

### 调度器

| 调度器 | 特点 | 适用 |
| --- | --- | --- |
| **FIFO** | 一个队列先来先服务，后面的作业会饿死 | 教学/测试，生产不用 |
| **Capacity Scheduler** | **Apache Hadoop 默认**。多队列，每队列有容量上限与弹性借用（空闲时可借用别队列资源，需时归还），支持优先级与抢占 | 多团队共享集群，保障各自最低资源 |
| **Fair Scheduler** | 公平分配：资源按「缺额」动态倾斜给用小资源少的作业；支持队列权重、最小资源 | 多用户交互式/混合负载 |

**关键配置**：`yarn.nodemanager.resource.memory-mb`（NM 可分配的总内存）、`yarn.scheduler.maximum-allocation-mb`（单个 Container 上限）、`yarn.nodemanager.resource.cpu-vcores`。

> **调优的常见坑**：`yarn.nodemanager.resource.memory-mb` 默认常是 8192，如果机器有 128G 内存，不改配置就等于浪费 90% 的资源。上线前必查。

### 常用命令

```bash
yarn application -list                        # 正在运行的应用
yarn application -list -appStates ALL         # 含已完成
yarn application -status application_1234_0001
yarn application -kill application_1234_0001  # 杀掉应用
yarn logs -applicationId application_1234_0001 # 拉取应用日志（跨节点聚合）
yarn node -list -all                          # 节点状态
yarn queue -status default                    # 队列状态
yarn top                                      # 实时资源使用（类似 top）
```

## 四、Hadoop 生态

Hadoop 只是一块地基，真正让它成为「体系」的是围绕它长出的生态：

```text
采集/同步          存储              计算              查询/服务
─────────         ─────            ─────            ─────────
Flume/DataX  ──▶  HDFS        ──▶  MapReduce    ──▶  Hive（SQL 离线）
Sqoop/FlinkCDC    HBase             Spark            Presto/Trino
Kafka             Kudu              Flink            Impala
                                        Tez          Doris/ClickHouse

协调：ZooKeeper      调度：Oozie/ Azkaban / DolphinScheduler
治理：Atlas / Ranger / Griffin        安全：Kerberos
```

| 生态组件 | 与 Hadoop 的关系 | 详见 |
| --- | --- | --- |
| **Hive** | 把 SQL 翻译成 MR/Tez/Spark 跑在 YARN 上，读 HDFS | [hive.md](./hive.md) |
| **HBase** | 基于 HDFS 的分布式列存，提供随机读写 | [database.md](./database.md) 列族数据库 |
| **Spark** | 新一代计算引擎，跑在 YARN 上，读 HDFS | [spark.md](./spark.md) |
| **Flink** | 流式计算引擎，也可跑在 YARN 上 | [flink.md](./flink.md) |
| **ZooKeeper** | 分布式协调：NameNode HA 选主、Kafka/HBase 元数据 | — |
| **Flume / DataX / Sqoop** | 数据进出 HDFS 的通道 | [database.md](./database.md) |
| **Oozie / Azkaban / DolphinScheduler** | 编排 HDFS 上的任务 | [database.md](./database.md) |
| **Atlas / Ranger** | 元数据血缘 / 权限管控 | [database.md](./database.md) |

> **一个常见误区**：把 Hadoop 等同于 MapReduce。**Hadoop 是「HDFS + YARN」这套基础设施**，至于上面跑什么引擎，是可替换的——今天大多数 Hadoop 集群上跑的其实是 Spark。

## 五、部署形态

| 模式 | 说明 | 用途 |
| --- | --- | --- |
| **单机模式（Local）** | 直接读写本地文件系统，无 HDFS/守护进程 | 本地调试 MR 代码 |
| **伪分布式（Pseudo-Distributed）** | 所有守护进程跑在一台机器上，但走完整的 HDFS/YARN 流程 | 学习、功能验证（面试环境常考） |
| **完全分布式（Fully Distributed）** | 多台机器，NN/RM 独立节点，生产形态 | 生产集群 |

**发行版选择：**

| 发行版 | 说明 |
| --- | --- |
| **Apache Hadoop** | 官方原版，配置最纯粹，但需自行集成与运维 |
| **CDH / CDP（Cloudera）** | 老牌商业发行版，Web 管理界面好；**CDH 6.3 之后不再免费**，转向付费 CDP |
| **HDP（Hortonworks）** | 已与 Cloudera 合并，HDP 停止维护 |
| **云托管（EMR / E-MapReduce）** | AWS EMR、阿里云 EMR 等，按需创建集群；**新项目更推荐这条路**，省运维 |

**云上趋势——存算分离**：把 HDFS 换成对象存储（S3/OSS），计算集群随用随建、用完释放，存储独立且便宜。Spark/Hive/Presto 都原生支持 `s3a://`。这也是「新项目是否还要自建 HDFS」越来越倾向「不」的原因。

> 练习环境推荐：用 Docker（如 `big-data-europe/docker-hadoop`）或 `hadoop` 官方镜像起伪分布式，几分钟就能有一个可以跑 `hdfs dfs` 和 WordCount 的环境，不必装真集群。

## 六、端口速查（Hadoop 3.x）

Hadoop 3.x 大规模调整了默认端口，网上老教程多是 2.x 的，对不上时先怀疑版本。

| 服务 | 2.x | 3.x |
| --- | --- | --- |
| NameNode Web UI | 50070 | **9870** |
| NameNode RPC | 9000 / 8020 | **8020** |
| DataNode Web UI | 50075 | **9864** |
| DataNode 数据传输 | 50010 | **9866** |
| SecondaryNameNode Web UI | 50090 | **9868** |
| ResourceManager Web UI | 8088 | 8088 |
| NodeManager Web UI | 8042 | 8042 |
| JobHistory Server Web UI | 19888 | 19888 |

> 不同发行版/云厂商可能自行调整，以集群实际配置（`core-site.xml`、`hdfs-site.xml`）为准。

## 七、Hadoop 的局限与演进

| 局限 | 现状 |
| --- | --- |
| **MapReduce 太慢** | 中间结果反复落盘，迭代计算（机器学习）尤其痛苦。已被 **Spark**（内存计算）全面取代，MR 仅存于少量历史作业 |
| **HDFS 小文件/低延迟短板** | 元数据压内存、不支持随机写。随机读写交给 **HBase**，文件类交给**对象存储** |
| **NameNode 内存天花板** | 元数据全内存，集群规模受限于单机内存（Federation 缓解）。因此**存算分离上云**成为主流 |
| **运维重** | 一套 Hadoop 集群涉及 NN/DN/RM/NM/ZK/Hive/Metastore… 组件多、调优难、升级痛。云托管 EMR 或直接用 **Doris/ClickHouse + 对象存储** 的新架构，正在替代「什么都自己搭」 |
| **YARN 逐步被 K8s 分流** | 新平台倾向用 **Kubernetes** 统一调度大数据与业务服务，Spark/Flink 都有成熟的 K8s 模式 |

**但 Hadoop 的遗产不会消失**——追根究底，今天的 Spark、Flink、Hive、HBase、Presto 都还在读写 HDFS，都是「Hadoop 的孩子」。学 Hadoop 的意义是**理解分布式存储与调度的基本范式**，而不是背它的命令。

## 八、核心要点速记

1. **HDFS = 元数据（NN）+ 数据块（DN）**，块默认 128MB、3 副本，按机架感知放置；NN 是单点，靠 HA（双 NN + JournalNode + ZKFC）解决。
2. **移动计算而非移动数据**：任务调度到数据所在的节点执行，这是整个大数据体系的核心信条。
3. **YARN 把资源调度与计算框架解耦**：RM 分资源、AM 管任务、NM 管容器，一个集群可以跑 MR/Spark/Flink。
4. **HDFS 只为「一次写入、多次读取的大文件」优化**：小文件、随机写、低延迟都不适合。
5. **存储成本 = 数据量 × 副本数**，纠删码（3.0+）能把冷数据降到 1.5 倍。
6. **不要把 Hadoop 等同于 MapReduce**；今天它的价值是 HDFS + YARN 这套底座。
7. **新项目优先考虑存算分离（对象存储）或云托管 EMR**，自建 Hadoop 集群的性价比已明显下降。

## 参考资料

- [Apache Hadoop 官网](https://hadoop.apache.org/)：HDFS / YARN / MapReduce 文档
- Google 论文：GFS（2003）、MapReduce（2004）、BigTable（2006）
- 《Hadoop 权威指南》（Tom White）：体系最完整的教材
- 本仓库相关笔记：[mapreduce.md](./mapreduce.md)、[hive.md](./hive.md)、[spark.md](./spark.md)、[flink.md](./flink.md)、[doris.md](./doris.md)、[database.md](./database.md)、[s3.md](./s3.md)
