# Flink

> Apache 的**分布式流处理引擎**，实时计算领域的事实标准。一句话：**把数据当成永不结束的流来处理**，用事件时间 + Watermark 处理乱序数据，用状态 + Checkpoint 实现**精确一次（Exactly-Once）**，延迟低到毫秒级。
>
> 与 Spark 的根本区别在于世界观：**Spark 认为「流是无限小的批」，Flink 认为「批是有界流」**。Flink 是原生的流式引擎，批只是流的一个特例——这决定了它在延迟、状态管理、事件时间处理上天然更专业。
>
> 相关：[hadoop.md](./hadoop.md)、[spark.md](./spark.md)（批处理主力，与 Flink 互补）、[mapreduce.md](./mapreduce.md)、[hive.md](./hive.md)、[doris.md](./doris.md)（实时数仓的查询层）、[database.md](./database.md)

## 一、背景与要解决的问题

### 背景

到 2010 年代中期，批处理这条线已经相当成熟：Hadoop 存得下、Spark 算得快。**但它们有一个共同前提——先把数据攒起来**：Hive 按天算，Spark 按小时/分钟算，延迟的下限由「攒多久」决定。

而越来越多的业务场景里，**数据的价值会随时间快速衰减**：

### 要解决的问题

| 场景 | 对延迟的要求 | 批处理做不到的原因 |
| --- | --- | --- |
| **实时风控** | 毫秒~秒 | 刷单、盗刷要当场拦截，事后统计毫无意义 |
| **实时监控告警** | 秒级 | 服务挂了 1 小时才告警不可接受 |
| **实时推荐 / 用户画像** | 秒级 | 推荐要基于「用户此刻正在看什么」 |
| **实时数仓大屏** | 秒级 | 老板要看实时 GMV |
| **实时特征工程** | 毫秒级 | 在线推理需要实时计算的用户特征 |

**但低延迟本身并不是全部的难点。** 早期的 **Storm**（2011）已经能做到毫秒级，可它有三个致命短板：

| 短板 | 后果 |
| --- | --- |
| **没有状态管理** | 7×24 运行的累计状态（如每个用户的历史行为）无处安放，重启即丢 |
| **没有事件时间** | 只能按「处理时刻」计算，数据一乱序结果就错，且重跑对不上账 |
| **只有 At-Least-Once** | 故障恢复后数据重复，对账类业务无法接受 |

### 它给出的答案

**原生流处理引擎**：把数据当成永不结束的流逐条处理（批只是「有界流」这一特例），用**事件时间 + Watermark** 解决乱序，用**状态 + Checkpoint** 解决 7×24 运行的可靠性与 Exactly-Once。

### 历史与核心信念

- 源自柏林工业大学 2010 年前后的研究项目 **Stratosphere**，2014 年捐给 Apache，2015 年成为顶级项目（名字在德语里是「敏捷、快速」的意思）。
- **核心信念：Everything is a stream.**

```text
传统视角：              Flink 视角：
批处理 ─┐                    流处理（无界流，实时数据）
流处理 ─┘ 两套系统           ├── 有界流 ← 批处理（历史数据）
                            （同一套 API、同一个引擎）
```

**流批一体的价值**：同一份业务逻辑代码（尤其是 Flink SQL），**既能跑历史数据回算，也能跑实时数据**——不用维护两套代码和两个引擎，口径也就不会对不上。

## 二、核心概念

### 1. 数据流（DataStream）

| 概念 | 说明 |
| --- | --- |
| **无界流（Unbounded）** | 有开始没有结束（Kafka 埋点、点击流、传感器上报）——**真实时处理** |
| **有界流（Bounded）** | 有明确的开始和结束（HDFS 上一天的历史文件）——**批处理** |
| **算子（Operator）** | `source → transformation → sink` 组成的数据流图 |
| **并行度（Parallelism）** | 每个算子可以拆成 N 个并行实例（subtask），同时处理不同的数据分片 |

```text
Source(Kafka, p=4) ──▶ map(p=4) ──▶ keyBy ──▶ window(p=4) ──▶ Sink(MySQL, p=2)
                          │                      │
                    算子链(Operator Chain)    一个 key 的所有数据必进同一个 subtask
```

### 2. 三种时间语义

**这是 Flink 最核心也最容易搞混的概念。**

| 时间语义 | 含义 | 特点 |
| --- | --- | --- |
| **事件时间（Event Time）** | **数据真正发生的时间**，通常携带在数据里（`ts` 字段） | ✅ **生产默认使用**。结果可重放、与处理速度无关，但必须处理乱序 |
| **摄入时间（Ingestion Time）** | 数据进入 Flink Source 的时间 | 少用，已被事件时间取代 |
| **处理时间（Processing Time）** | 数据被算子处理的机器时间 | 最简单、延迟最低，但**结果不可重放**，机器慢了结果就不一样 |

```text
真实发生顺序：  A(10:00:00)  B(10:00:05)  C(10:00:03)   ← C 比 B 晚到（网络延迟）
到达 Flink 顺序：A  B  C
处理时间窗口 [10:00:00~10:00:05) 会把 C 算进错误的窗口
事件时间窗口能正确把 C 归到它真正发生的时间窗口
```

**为什么必须用事件时间？** 因为真实数据**一定乱序**（网络抖动、重试、多数据源汇聚、移动端离线补传）。用处理时间算，同一个问题重跑两次结果可能不同，没法对账。

### 3. Watermark（水位线）

**问题**：事件时间窗口要等多久才能关窗？等太久延迟高，等太短数据不全。

**Watermark 的答案**：用一个单调递增的时间戳表示「**事件时间小于这个值的数据，我认为都已经到齐了**」。

```text
Watermark = 已观察到的最大事件时间 − 最大允许延迟（out-of-orderness）

数据：  A(10:00:10)  B(10:00:14)  C(10:00:09)
                                        ↑ C 迟到 5 秒

若设 maxOutOfOrderness = 5s：
  收到 B 时，Watermark = 10:00:14 − 5s = 10:00:09
  → 事件时间 ≤ 10:00:09 的窗口可以关闭并触发计算
  → C(10:00:09) 恰好还能进窗口；再晚就会落到「迟到数据」处理分支

窗口 [10:00:00, 10:00:10) 在 Watermark ≥ 10:00:10 时触发计算
```

**三个要点**：

1. **Watermark 只能递增**，不会回退。
2. **Watermark 会随数据流传播**，算子取所有上游 Watermark 的**最小值**（必须等所有上游都认为某个时间点到了）。
3. **迟到数据的两种处理**：
   - `allowedLateness`：窗口关闭后再等一段时间，迟到数据仍可触发窗口**更新**（会重新输出结果）；
   - `sideOutputLateData`：彻底迟到的数据输出到**侧输出流**，单独落库处理，不丢。

```java
WatermarkStrategy.<Event>forBoundedOutOfOrderness(Duration.ofSeconds(5))
    .withTimestampAssigner((event, ts) -> event.getTimestamp())
    .withIdleness(Duration.ofMinutes(1));   // 某个源长时间没数据时不阻塞整个 Watermark
```

> **坑**：多并行度的 Source，如果某个分片长期无数据，它的 Watermark 不推进，会导致整个作业的 Watermark 卡住、窗口永不触发。`withIdleness` 就是解药。

### 4. 窗口（Window）

| 窗口类型 | 说明 | 例子 |
| --- | --- | --- |
| **滚动窗口（Tumbling）** | 固定长度、**不重叠** | 每 5 分钟统计一次 PV |
| **滑动窗口（Sliding）** | 固定长度、**有重叠** | 每 1 分钟统计「过去 5 分钟」的 PV |
| **会话窗口（Session）** | 按**活动间隔**切分，间隔超过阈值就另起一个窗口 | 用户一次会话的行为分析 |
| **累计窗口（Cumulate）** | 固定长度、按步长**累积**（Flink 1.11+） | 每天累计到当前时刻的 GMV（1h/2h/4h…逐步累积） |
| **全局窗口（Global）** | 所有数据一个窗口，需自定义 Trigger | 自定义触发逻辑 |

窗口三件套：**WindowAssigner（怎么分）+ Trigger（何时触发）+ Evictor（何时清理）**。

### 5. 状态（State）

**有状态**是 Flink 区别于 Storm 的关键：跨多条记录保留中间结果。

| 状态类型 | 说明 | 例子 |
| --- | --- | --- |
| **Keyed State** | **按 key 隔离**的状态（必须先 `keyBy`） | `ValueState`（每个用户上次登录时间）、`ListState`、`MapState`、`ReducingState`、`AggregatingState` |
| **Operator State** | 算子级别的状态，与 key 无关 | `ListState`（Kafka 消费位点）、`BroadcastState`（**广播规则表**，如风控规则热更新） |

```java
// Keyed State 示例：统计每个用户累计金额
public class SumAmount extends KeyedProcessFunction<String, Order, String> {
    private ValueState<Double> total;          // 只在 keyBy 之后可用

    @Override
    public void open(Configuration params) {
        total = getRuntimeContext().getState(
            new ValueStateDescriptor<>("total", Double.class));
    }

    @Override
    public void processElement(Order o, Context ctx, Collector<String> out) throws Exception {
        Double cur = total.value() == null ? 0.0 : total.value();
        total.update(cur + o.getAmount());
        out.collect(o.getUserId() + " 累计: " + total.value());
    }
}
```

**两个必须注意的点**：

1. **状态可能无限增长**：一个用户 ID 一个状态，用户量上亿就爆了。**必须配状态 TTL**：
   ```java
   StateTtlConfig ttl = StateTtlConfig.newBuilder(Duration.ofDays(7))
       .setUpdateType(StateTtlConfig.UpdateType.OnCreateAndWrite)
       .setStateVisibility(StateTtlConfig.StateVisibility.NeverReturnExpired)
       .cleanupInRocksdbCompactFilter(1000)
       .build();
   descriptor.enableTimeToLive(ttl);
   ```
2. **状态后端（State Backend）决定状态放哪**：
   | 后端 | 存储位置 | 适用 |
   | --- | --- | --- |
   | **HashMapStateBackend** | JVM 堆内存 | 状态小、要求极低延迟 |
   | **EmbeddedRocksDBStateBackend** | 本地 RocksDB（磁盘）+ 支持**增量 Checkpoint** | **状态大（TB 级）的标配**，生产推荐 |

### 6. Checkpoint 与 Savepoint

| | **Checkpoint** | **Savepoint** |
| --- | --- | --- |
| 谁触发 | Flink **自动周期性**触发 | **用户手动**触发（命令/API） |
| 目的 | **故障恢复** | 作业升级、扩缩容、迁移、A/B 版本切换 |
| 生命周期 | 默认作业取消后删除（可配置保留） | 一直保留直到手动删除 |

```java
StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

env.enableCheckpointing(60_000);                                    // 每 60 秒一次
env.getCheckpointConfig().setCheckpointingMode(CheckpointingMode.EXACTLY_ONCE);
env.getCheckpointConfig().setMinPauseBetweenCheckpoints(30_000);    // 两次之间至少间隔
env.getCheckpointConfig().setCheckpointTimeout(10 * 60_000);        // 超时放弃
env.getCheckpointConfig().setMaxConcurrentCheckpoints(1);           // 同时只允许 1 个
env.getCheckpointConfig().setTolerableCheckpointFailureNumber(3);   // 允许失败次数
env.getCheckpointConfig().setExternalizedCheckpointCleanup(
    ExternalizedCheckpointCleanup.RETAIN_ON_CANCELLATION);          // 取消作业后保留
env.getCheckpointConfig().enableUnalignedCheckpoints();             // 反压严重时开启
env.setStateBackend(new EmbeddedRocksDBStateBackend(true));         // 增量 checkpoint
env.getCheckpointConfig().setCheckpointStorage("hdfs:///flink/checkpoints");
```

```bash
# Savepoint 运维
flink savepoint <jobId> hdfs:///flink/savepoints        # 手动打快照
flink run -s hdfs:///flink/savepoints/savepoint-xxx job.jar   # 从 Savepoint 恢复
flink cancel -s hdfs:///flink/savepoints <jobId>        # 停止并先打 Savepoint
```

## 三、Checkpoint 原理（Chandy-Lamport 异步屏障快照）

理解这一节，就理解了 Flink 的「精确一次」从哪来。

```text
JobManager 中的 Checkpoint Coordinator 每 N 秒注入一个 Barrier（屏障）
        │
        ▼
  Source ──[1]──▶ map ──[1]──▶ keyBy/window ──[1]──▶ Sink
  Source ──[2]──▶ map ──[2]──▶ keyBy/window ──[2]──▶ Sink
        │
   Barrier 像「插入数据流中的标记」，把流切成「属于本次 Checkpoint 之前」和「之后」两段
        │
        ▼
算子收到【所有输入】的 Barrier 后 → 把当前状态异步快照到存储（HDFS/S3）
        │
        ▼
  所有算子完成 → JobManager 收到全部 ACK → 本次 Checkpoint 完成
```

**Barrier 对齐（Barrier Alignment）**：算子必须等所有输入的同一编号 Barrier 都到齐才能做快照，**先到的输入要等，阻塞了**。这是**反压严重时 Checkpoint 变慢甚至超时**的原因。

**非对齐 Checkpoint（Unaligned Checkpoint，Flink 1.11+）**：不再等对齐，**把缓冲区中的数据也一并快照**，Barrier 直接越过排队数据。代价是快照更大，但**在反压场景下能把 Checkpoint 时间从几分钟降到几秒**。

```java
env.getCheckpointConfig().enableUnalignedCheckpoints();
env.getCheckpointConfig().setAlignedCheckpointTimeout(Duration.ofSeconds(30));  // 超时后自动转非对齐
```

**故障恢复**：作业失败 → 从最近一次成功的 Checkpoint 恢复所有算子的状态 → **数据源回退到 Checkpoint 中记录的消费位点** → 重新处理。因此需要**可重放的数据源**（Kafka 的 offset 可以回退，Socket 就不行）。

## 四、Exactly-Once 是怎么做到的

Flink 的端到端精确一次（End-to-End Exactly-Once）需要**三部分共同保证**：

```text
① 数据源可重放     —— Kafka 的 offset 能回退到 Checkpoint 时的位置
        +
② 状态一致性       —— Checkpoint 保证算子状态与输入位点一致（上面的屏障快照）
        +
③ Sink 支持事务/幂等 —— 输出端不能重复写
        =
   端到端 Exactly-Once
```

**Sink 的两种实现**：

| 方式 | 说明 | 例子 |
| --- | --- | --- |
| **两阶段提交（2PC）** | Sink 先开启事务预写（如 Kafka 事务、未提交的文件），**Checkpoint 完成时才真正提交**；恢复时回滚未提交事务 | `KafkaSink`（带事务）、`FileSink` |
| **幂等写入** | 依靠业务主键 upsert，重复写不产生额外影响 | **JDBC/MySQL 的 upsert**、HBase、Redis、Doris 的聚合模型 |

> **重要认知**：**Kafka → Flink → Kafka** 是标准的 Exactly-Once 组合；但 **Kafka → Flink → MySQL** 通常是 **At-Least-Once + 幂等**（靠 upsert 兜住），因为 MySQL 事务与 Flink Checkpoint 的协调需要额外实现。**面试常考，实践更常踩。**

## 五、运行时架构

```text
┌───────────────────────────────────────────────────────────┐
│  JobManager（主节点，协调者）                                │
│  ├─ Dispatcher      接收作业提交、启动 JobMaster             │
│  ├─ JobMaster       管一个作业：调度 Task、协调 Checkpoint    │
│  └─ ResourceManager 管理 Slot（Flink 自己的资源抽象）         │
└────────────────────────────┬──────────────────────────────┘
                             │ 分配 Slot
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
 ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
 │ TaskManager │      │ TaskManager │      │ TaskManager │
 │ ┌───┬───┐   │      │ ┌───┬───┐   │      │ ┌───┬───┐   │
 │ │Slot│Slot│  │      │ │Slot│Slot│  │      │ │Slot│Slot│  │
 │ │ ▶Task  │  │      │ │ ▶Task  │   │      │ │ ▶Task  │  │
 │ └───┴───┘   │      │ └───┴───┘   │      │ └───┴───┘   │
 │ 内存 + 状态后端│      └─────────────┘      └─────────────┘
 └─────────────┘
```

| 角色 | 职责 |
| --- | --- |
| **JobManager** | 作业的「大脑」：把 DataStream 图转成执行图、调度 Task、协调 Checkpoint 与故障恢复、管理资源。**生产必须配 HA（多 JobManager + ZooKeeper/K8s）** |
| **TaskManager** | 工作节点：提供 **Slot**（资源单位），在 Slot 里跑 Task；内存管理、状态后端运行在这里 |
| **Slot** | TaskManager 的资源切片，**一个 Slot ≈ 一个 CPU 核 + 一部分内存**。一个 Slot 可串行跑多个 Task（算子是共享的） |
| **Operator Chain** | 把窄依赖的算子**串成一个 Task**（同一线程内传递对象，不序列化、不跨网络）——Flink 的关键优化，能在 Web UI 里看到 `Source → map → filter` 被合成一个链 |

### 部署模式

| 模式 | 说明 | 现状 |
| --- | --- | --- |
| **Session 模式** | 先起一个常驻集群，多个作业共享；资源隔离差，一个作业崩了可能影响别人 | 用于**交互式开发** |
| **Per-Job 模式** | 每个作业单独起一个集群，作业结束集群释放 | Flink 1.15 起被弃用 |
| **Application 模式** | **当前推荐**：`main()` 在集群上执行，客户端只负责提交，依赖与资源隔离好、启动快 | 生产标准 |
| **Kubernetes** | 当前最主流的部署方式（Application 模式 + K8s Operator） | ✅ |
| **YARN** | Hadoop 生态里的传统方式 | 存量集群 |

```bash
flink run-application -t kubernetes-application \
  -Dkubernetes.cluster-id=my-flink-job \
  -Dkubernetes.container.image=my-flink:1.19 \
  -Djobmanager.memory.process.size=2048m \
  -Dtaskmanager.memory.process.size=4096m \
  -Dtaskmanager.numberOfTaskSlots=4 \
  -Dparallelism.default=8 \
  local:///opt/flink/usrlib/myjob.jar
```

**Web UI**：JobManager 的 **8081** 端口，能看到 DAG、并行度、**反压（Backpressure）指示、Checkpoint 历史、各算子吞吐与延迟**——排查 Flink 问题的第一现场。

## 六、Flink SQL 与 Table API

**Flink SQL 是当前写 Flink 作业的主流方式**（而不是手写 DataStream）：声明式、易维护、且**天然流批一体**。

### 动态表模型

```text
流（Stream）  ⇄  动态表（Dynamic Table）

Kafka 消息不断到来   ==   表在不停地被 INSERT
Flink 的查询          ==   持续查询（Continuous Query），结果表不断更新
结果表的变更流写出去   ==   INSERT/UPDATE 事件流
```

**与 Spark Structured Streaming 的方向相反**：Spark 是「用批来模拟流」，Flink 是「**用流来执行 SQL**」。所以 Flink SQL 的语义是真正的流式语义（毫秒级），而不是微批。

### 完整示例：Kafka → 窗口聚合 → MySQL

```sql
-- 1. 源表：Kafka（带 Watermark 定义）
CREATE TABLE user_events (
  user_id BIGINT,
  event   STRING,
  amount  DECIMAL(10,2),
  ts      TIMESTAMP(3),
  WATERMARK FOR ts AS ts - INTERVAL '5' SECOND      -- 容忍 5 秒乱序
) WITH (
  'connector' = 'kafka',
  'topic' = 'user_events',
  'properties.bootstrap.servers' = 'kafka:9092',
  'properties.group.id' = 'flink-g1',
  'scan.startup.mode' = 'group-offsets',            -- 从 Checkpoint 的位点续读
  'format' = 'json'
);

-- 2. 结果表：MySQL（幂等 upsert，配合主键实现不重复写）
CREATE TABLE dws_event_5min (
  win_start TIMESTAMP(3),
  event     STRING,
  cnt       BIGINT,
  amount    DECIMAL(20,2),
  PRIMARY KEY (win_start, event) NOT ENFORCED
) WITH (
  'connector' = 'jdbc',
  'url' = 'jdbc:mysql://mysql:3306/dw',
  'table-name' = 'dws_event_5min',
  'username' = 'flink',
  'password' = '******'
);

-- 3. 窗口聚合（Windowing TVF，Flink 1.13+ 的推荐写法）
INSERT INTO dws_event_5min
SELECT
  window_start,
  event,
  COUNT(*)      AS cnt,
  SUM(amount)   AS amount
FROM TABLE(
  TUMBLE(TABLE user_events, DESCRIPTOR(ts), INTERVAL '5' MINUTES)
)
GROUP BY window_start, window_end, event;

-- 其他窗口 TVF：
--   HOP(TABLE t, DESCRIPTOR(ts), INTERVAL '1' MINUTE, INTERVAL '5' MINUTES)  滑动
--   CUMULATE(TABLE t, DESCRIPTOR(ts), INTERVAL '1' HOUR, INTERVAL '1' DAY)   累计
--   SESSION(TABLE t, DESCRIPTOR(ts), INTERVAL '30' MINUTES)                  会话
```

### 常用能力

| 能力 | 说明 |
| --- | --- |
| **双流 JOIN** | `Regular Join`（保留全部状态，需配 TTL）、`Interval Join`（限定时间区间，状态可控）、**`Temporal Join`（维表随时间变化的正确关联，如按订单时间找当时的商品价格）**、`Lookup Join`（实时查外部维表，如查 MySQL/HBase） |
| **维表关联** | `FOR SYSTEM_TIME AS OF` + 外部表，或用 Lookup Join 缓存 |
| **Top-N / Dedup** | `ROW_NUMBER() OVER (...)` 取 top-n、去重（**CDC 入仓场景的高频需求**） |
| **CDC 全库同步** | Flink CDC 连接器直接读 MySQL binlog（见下节） |
| **自定义函数** | UDF / UDTF / UDAF，Python UDF 也支持 |

## 七、Flink CDC

**Flink CDC** 是 Flink 生态里最受欢迎的能力之一：**直接从一个数据库（MySQL/PG/Oracle/MongoDB…）读全量 + 增量数据，无需 Debezium + Kafka 中间层**。

```sql
CREATE TABLE mysql_orders (
  id     BIGINT,
  status INT,
  amount DECIMAL(10,2),
  PRIMARY KEY (id) NOT ENFORCED
) WITH (
  'connector' = 'mysql-cdc',
  'hostname' = 'mysql',
  'port' = '3306',
  'username' = 'flink',
  'password' = '******',
  'database-name' = 'biz',
  'table-name' = 'orders',
  'scan.startup.mode' = 'initial'          -- initial：先全量快照，再无缝转增量 binlog
);

-- 直接入湖 / 入仓 / 入 OLAP
INSERT INTO doris_orders SELECT * FROM mysql_orders;
```

**为什么好用**：

1. **全量 + 增量一体化**：启动时先快照全表，再自动无缝切换到 binlog 增量，**全程只用一个作业**（传统方案要 DataX 全量 + Canal 增量两套）。
2. **无锁读取**（基于 DBLog 框架，Flink CDC 2.x 起）：全量阶段不锁表，不影响线上业务。
3. **断点续传**：配合 Checkpoint，故障后从位点恢复。
4. **Flink CDC 3.0** 提供 YAML pipeline 模式，写几行配置就能搭一条数据库到数仓的同步链路。

**典型架构（实时数仓 ODS 层）**：

```text
MySQL ──Flink CDC──▶ Flink（清洗/打宽/聚合）──▶ Doris / ClickHouse / Iceberg / Paimon
                                                     ↑ 实时数仓的查询服务层
```

## 八、代码示例：DataStream 版 WordCount

```java
StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
env.setParallelism(2);
env.enableCheckpointing(60_000);

DataStream<String> lines = env.socketTextStream("localhost", 9999);

DataStream<Tuple2<String, Integer>> counts = lines
    .flatMap((String line, Collector<Tuple2<String, Integer>> out) -> {
        for (String w : line.split("\\s")) {
            out.collect(Tuple2.of(w, 1));
        }
    })
    .returns(Types.TUPLE(Types.STRING, Types.INT))
    .keyBy(t -> t.f0)                                   // 按单词分组（必做，状态按 key 隔离）
    .window(TumblingEventTimeWindows.of(Time.minutes(5)))
    .sum(1);

counts.print();
env.execute("word count");
```

Python（PyFlink）：

```python
from pyflink.datastream import StreamExecutionEnvironment
from pyflink.common.typeinfo import Types

env = StreamExecutionEnvironment.get_execution_environment()
env.set_parallelism(2)
env.enable_checkpointing(60_000)

env.from_collection(["hello world", "hello flink"]) \
   .flat_map(lambda line: [(w, 1) for w in line.split()],
             output_type=Types.TUPLE([Types.STRING(), Types.INT()])) \
   .key_by(lambda t: t[0]) \
   .sum(1) \
   .print()

env.execute("word count")
```

> **注意**：PyFlink 的算子要经过 Python↔JVM 的数据序列化，性能不如 Java/Scala。**生产上更推荐用 Flink SQL**（无需关心语言性能，优化器统一处理）。

## 九、调优与运维

### 反压（Backpressure）

**反压是流处理最常见的问题**：下游处理不过来，上游必须减速，否则内存爆掉。Flink 用**基于信用的流控（Credit-Based Flow Control）** 实现，是**正常且必要的机制**——但持续反压意味着瓶颈。

**排查路径**：

```text
Web UI (8081) → 作业图 → 看哪个算子显示 "HIGH" 反压
  ├─ 反压在下游：下游算子慢（查外部存储慢、Sink 瓶颈、GC 频繁）
  └─ 反压在上游：Source 数据太快（加并行度、限流）
关键指标：busyTimeMsPerSecond、backPressuredTimeMsPerSecond、inPoolUsage/outPoolUsage
```

**常见对策**：

| 现象 | 对策 |
| --- | --- |
| Sink 慢（写 MySQL/ES 慢） | 批量写、增大并行度、加缓存、换更快的 Sink（Kafka/Doris） |
| 数据倾斜（某 subtask 忙） | **keyBy 的 key 分布不均**（热点 key），加盐打散 + 二次聚合 |
| Checkpoint 超时/慢 | 开启**非对齐 Checkpoint**；状态后端换 **RocksDB + 增量 Checkpoint**；降低 Checkpoint 频率 |
| 状态太大导致 OOM | RocksDB 状态后端；配 **TTL**；用 `AggregatingState` 代替存原始明细 |
| 消费 Kafka 延迟大 | 提高 Source 并行度（≤ 分区数，多了也白搭）；检查是否被下游反压 |

### 调优清单

| 方向 | 手段 |
| --- | --- |
| **并行度** | 算子级并行度；**Source 并行度不要超过 Kafka 分区数**；瓶颈算子单独调大（`map(...).setParallelism(16)`） |
| **算子链** | 默认自动链接；`disableChaining()` 打断有必要的链（如某个算子特别慢），`startNewChain()` 只断一处 |
| **内存** | TaskManager 内存模型：Framework Heap / Task Heap / **Managed Memory（RocksDB、批算子用）** / Network Memory（缓冲）；`taskmanager.memory.process.size` 总控，`taskmanager.memory.network.fraction` 管缓冲（反压时加大它） |
| **状态** | RocksDB + 增量 Checkpoint；**状态 TTL 必配**；能用 `AggregatingState` 就别用 `ListState` 存明细 |
| **序列化** | Flink 对 POJO 有内置高效序列化器，类要 `public` + 有默认构造器 + 字段 `public` 或有 getter/setter，否则退化成 Kryo（慢） |
| **Sink** | 批量/缓冲写入；JDBC Sink 用 upsert 保证幂等；高吞吐优先 Kafka/Doris |
| **Watermark** | `withIdleness` 防止空闲分片卡住窗口；`allowedLateness` 别设太大（状态会留很久） |

## 十、常见坑

1. **用处理时间**：结果不可重放，重跑对不上账。**生产一律用事件时间**。
2. **忘了配状态 TTL**：跑几天后状态爆掉 RocksDB / OOM。这是 Flink 生产事故的 Top 1。
3. **`keyBy` 的 key 有热点**：某些 subtask 长期 HIGH 反压，其他闲着。加盐打散。
4. **Checkpoint 一直失败**：常见原因是反压 + 状态太大 + 存储慢 + `maxConcurrentCheckpoints` 设置不当。先看 UI 的 Checkpoint 详情页里各阶段耗时。
5. **以为 Kafka→MySQL 是 Exactly-Once**：默认是 At-Least-Once，靠主键 upsert 兜幂等。要真 2PC 需要额外实现。
6. **Watermark 卡住**：多分片 Source 有空闲分区时，Watermark 不推进，窗口永不触发。加 `withIdleness`。
7. **Source 并行度 > Kafka 分区数**：多出来的 subtask 空转，白占资源。
8. **`allowedLateness` 设得很大**：窗口长期不释放，状态堆积。
9. **升级作业直接重启**：状态不兼容会失败。**必须先打 Savepoint，再用 Savepoint 恢复**。
10. **大数据量用 `print()` 调试**：输出到 stdout 会反压整条链路。用日志或侧输出流。
11. **拿 Flink 做大批量离线回算**：Flink 能跑批（有界流），但极端大的离线批处理仍是 Spark 更成熟。

## 十一、横向对比

| | **Storm** | **Spark Streaming** | **Structured Streaming** | **Flink** |
| --- | --- | --- | --- | --- |
| 模型 | 原生流 | 微批（DStream） | 微批（DataFrame） | **原生流** |
| 延迟 | 毫秒 | 秒级 | 秒级 | **毫秒级** |
| 事件时间/Watermark | ❌ | 部分 | ✅ | ✅ **最完善** |
| 状态管理 | ❌ 需自己做 | ❌ | 轻量 | ✅ **强（RocksDB、TTL、大状态）** |
| Exactly-Once | At-Least-Once | ✅（需幂等 Sink） | ✅ | ✅（Checkpoint + 2PC） |
| 生态 | 已淘汰 | 已被 Structured Streaming 取代 | 与 Spark 批/SQL/ML 一体 | 流处理专精，Table/SQL/CDC 完整 |
| 现状 | 存量维护 | 淘汰 | 主流之一 | **实时计算的标准答案** |

### 选型指南

| 需求 | 选 |
| --- | --- |
| 毫秒级延迟、复杂状态、实时风控/告警/CEP | **Flink** |
| 实时数仓、CDC 入仓入湖、实时 ETL | **Flink（CDC + SQL）** |
| 已有 Spark 体系，延迟秒级可接受，批流想统一代码 | Spark Structured Streaming |
| 离线批处理、T+1 数仓 | Spark / Hive |
| 实时数据的存储与查询 | Doris / ClickHouse / Paimon / Iceberg + Flink 写入 |

**构建实时数仓的典型组合**：

```text
MySQL/业务库 ──Flink CDC──▶ Flink SQL（清洗/打宽/聚合）──▶ Doris（查询服务层）──▶ BI/大屏
Kafka 埋点   ──Kafka──────▶                              └──▶ Paimon/Iceberg（湖仓明细）
```

## 十二、核心要点速记

1. **Flink 是原生流引擎**，批是有界流——这是它比 Spark 更适合实时的根本原因。
2. **事件时间 + Watermark** 是处理乱序数据的核心武器；**生产一律用事件时间**。
3. **Watermark 取上游最小值、单调递增**，空闲分片会卡住窗口（用 `withIdleness`）。
4. **Checkpoint = 异步屏障快照（Chandy-Lamport）**，Barrier 对齐会阻塞；反压严重时用**非对齐 Checkpoint**。
5. **端到端 Exactly-Once = 可重放 Source + 一致性状态 + 事务/幂等 Sink**，三者缺一不可。
6. **状态必须配 TTL**，否则就是定时炸弹；大状态用 **RocksDB + 增量 Checkpoint**。
7. **算子链（Operator Chain）** 把窄依赖算子合成一个线程执行，是 Flink 的重要优化。
8. **反压是正常机制**，持续反压才是问题；排查从 Web UI（8081）的算子图开始。
9. **Flink SQL 是写 Flink 的主流方式**，动态表模型让流批一体成为现实。
10. **Flink CDC 是实时数仓的入口**：全量 + 增量一体、无锁、断点续传。

## 参考资料

- [Apache Flink 官网](https://flink.apache.org/) / [Flink 中文文档](https://nightlies.apache.org/flink/flink-docs-stable/zh/)
- 《Flink 原理与实践》/ 《Stream Processing with Apache Flink》（Fabian Hueske）
- 论文：*Apache Flink™: Stream and Batch Processing in a Single Engine*
- 本仓库相关笔记：[spark.md](./spark.md)、[hadoop.md](./hadoop.md)、[mapreduce.md](./mapreduce.md)、[hive.md](./hive.md)、[doris.md](./doris.md)、[database.md](./database.md)