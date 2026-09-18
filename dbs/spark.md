# Spark

> Apache 的**统一大数据分析引擎**。一句话：用**内存计算 + DAG 调度**取代 MapReduce 的「每步落盘」，把批处理速度提升 10~100 倍，并且用同一套 API + 同一个引擎同时支撑 **批处理、SQL 查询、流处理、机器学习、图计算**。
>
> 如果说 Hadoop 定义了「用一堆机器存算海量数据」的范式，那 Spark 就是把这个范式**从能用做到了好用**：RDD 的抽象、DataFrame 的声明式 API、Catalyst 优化器、统一内存管理——今天几乎所有大数据处理代码，最终都跑在 Spark 上。
>
> 相关：[hadoop.md](./hadoop.md)（HDFS / YARN 底座）、[mapreduce.md](./mapreduce.md)（被取代者，先看它更好懂 Spark）、[hive.md](./hive.md)（Hive 表 / Metastore）、[flink.md](./flink.md)（流处理的主要竞争者）、[doris.md](./doris.md)、[database.md](./database.md)

## 一、背景与要解决的问题

### 背景

到 2010 年前后，Hadoop 生态已经回答了「海量数据能不能算」的问题：HDFS 存得下、MapReduce 算得动、Hive 让分析师也能写 SQL。**但「能算完」和「算得快」之间还差着几个数量级**——一个迭代式的机器学习任务在 MapReduce 上要跑十几小时，其中绝大部分时间花在反复读写磁盘上。

与此同时，需求形态也在变：除了 T+1 报表，还出现了**交互式数据探索、机器学习、图计算**这些 MapReduce 根本不擅长的负载。

### 要解决的问题：MapReduce 的五个痛点

| MapReduce 的痛点 | 具体表现 | Spark 的解法 |
| --- | --- | --- |
| **中间结果落盘** | 每个 Job 的中间数据都写 HDFS/磁盘，迭代算法（机器学习、PageRank）要反复读写磁盘 | **DAG + 内存计算**：中间结果尽量留在内存，只有 Shuffle 才落盘 |
| **算子太少** | 只有 map/reduce，复杂逻辑要串多个 Job，每次都有调度与启动开销 | 几十个算子，一个 DAG 表达完整流程，任务间流水线执行 |
| **调度开销大** | 每个 Job 单独申请资源、启动 task | 一次申请 Executor，长期驻留复用 |
| **API 笨重** | Java 手写，Streaming 慢 | Scala / Python / Java / R / **SQL**，DataFrame 声明式 API |
| **只能批处理** | 流处理要另起一套（Storm） | **统一引擎**做批、流、SQL、ML、图 |

### 它给出的答案

**内存计算 + DAG 调度 + 统一引擎**：让中间结果尽量留在内存而不是反复落盘，把完整流程表达成一张 DAG 一次性优化执行，并用同一套 API 同时支撑批处理、SQL、流处理、机器学习、图计算。

### 历史

2009 年诞生于 UC Berkeley AMPLab，论文 *Resilient Distributed Datasets: A Fault-Tolerant Abstraction for In-Memory Cluster Computing* 奠定了内存计算的理论基础；2013 年捐给 Apache，2014 年成为顶级项目。作者 Matei Zaharia 因此创立了 Databricks。

### 统一引擎的「一栈式」能力

```text
              ┌─────────────────────────────────────────┐
              │            Spark（统一引擎）              │
              ├──────────┬──────────┬──────────┬────────┤
              │ Spark SQL│ Structured│  MLlib   │ GraphX │
              │(SQL/DF)  │ Streaming │(机器学习) │(图计算) │
              └──────────┴──────────┴──────────┴────────┘
                          ▼
              ┌─────────────────────────────────────────┐
              │         Spark Core（RDD + DAG 调度）      │
              └─────────────────────────────────────────┘
                          ▼
       YARN / Kubernetes / Standalone / 本地模式
                          ▼
                  HDFS / S3 / Hive 表 / Kafka / JDBC
```

> **一个引擎解决所有问题**是 Spark 最大的卖点，也是它成为「大数据通用引擎」的原因。但在**低延迟真实时**场景下，它是微批模型，不如 [Flink](./flink.md)——两者是互补而非替代关系。

## 二、核心抽象

### RDD：一切的起点

**RDD（Resilient Distributed Dataset，弹性分布式数据集）** 是 Spark 最底层的抽象：

| 特性 | 含义 |
| --- | --- |
| **分布式** | 数据被切成多个**分区（Partition）**散布在集群各节点上，一个分区一个 Task |
| **不可变（Immutable）** | 一经创建不能修改，只能通过 Transformation 生成新 RDD——这让所有计算天然可并行、可重放 |
| **弹性 / 容错** | **血缘（Lineage）**：记录每个 RDD 由谁计算而来。某个分区数据丢了，**按血缘重算**即可，不需要像 HDFS 那样存多副本 |
| **惰性求值（Lazy）** | Transformation 只是记录「要做什么」，**遇到 Action 才真正执行** |

```text
sc.textFile("hdfs:///data/log.txt")      ← 只是记录：要读这个文件
  .flatMap(_.split(" "))                 ← 只是记录：要切词
  .map((_, 1))                           ← 只是记录：要变成 (word,1)
  .reduceByKey(_ + _)                    ← 只是记录：要聚合
  .saveAsTextFile("hdfs:///out")         ← Action！此刻才把上面全部「拼成 DAG」提交执行
```

**惰性求值的意义**：Spark 能看到**完整**的计算链路，才能做全局优化（合并算子、避免不必要的 Shuffle、调度数据本地性）。这也是 DataFrame 比手写 RDD 更快的原因之一。

### 算子：Transformation 与 Action

| 类别 | 特点 | 常用算子 |
| --- | --- | --- |
| **Transformation**（转换） | 惰性，返回新 RDD，不触发计算 | `map`、`filter`、`flatMap`、`mapPartitions`、`union`、`distinct`、`reduceByKey`、`groupByKey`、`join`、`sortBy`、`repartition`、`coalesce` |
| **Action**（行动） | 立即触发执行，返回结果或写存储 | `collect`、`count`、`take`、`first`、`reduce`、`foreach`、`saveAsTextFile`、`show` |

**Shuffle 算子**（性能敏感点，会跨节点重新分发数据）：`reduceByKey`、`groupByKey`、`join`、`distinct`、`repartition`、`sortBy`、`groupBy`。

### 宽依赖 / 窄依赖与 Stage 划分

```text
窄依赖（Narrow Dependency）          宽依赖（Wide Dependency / Shuffle）
父分区 ──▶ 子分区（一对一/多对一）    父分区 ──▶ 子分区（多对多）
map / filter / union / coalesce       reduceByKey / groupByKey / join / repartition
→ 可以流水线执行，不需要跨节点传输     → 必须等所有 map 完成，跨网络传输

┌─────────────────── Stage 1 ──────────────────┐   ┌── Stage 2 ──┐
│ map → filter → mapPartitions（流水线执行）      │──▶│ reduceByKey │
└──────────────────────────────────────────────┘   └─────────────┘
                                          ↑
                                   Shuffle 边界（Stage 分界）
```

**Stage 划分规则**：**遇到宽依赖（Shuffle）就切一刀**。

| 概念 | 定义 |
| --- | --- |
| **Application** | 一个 Spark 程序（一个 `SparkSession`） |
| **Job** | **每个 Action 触发一个 Job** |
| **Stage** | Job 内按 Shuffle 边界切分出的阶段；前面的叫 map stage，后面的叫 reduce stage |
| **Task** | **Stage 内按分区数切分出的最小执行单元，一个分区一个 Task** |

> 「**一个 Action 一个 Job，一个 Shuffle 一个 Stage，一个分区一个 Task**」——记牢这三句，Spark 的执行模型就清楚了。

### DataFrame / Dataset：更高层的抽象

| 抽象 | 类型安全 | 优化 | 说明 |
| --- | --- | --- | --- |
| **RDD** | ✅ 编译期 | ❌ 无（你不知道你的 lambda 里写了什么） | 底层，灵活但难优化 |
| **DataFrame** | ❌（Row 弱类型） | ✅ **Catalyst + Tungsten** | 带 schema 的分布式表，等价于 `Dataset[Row]`，**当前推荐** |
| **Dataset** | ✅ 编译期（Scala/Java） | ✅ | 类型安全的 DataFrame；Python 里没有 Dataset |

**为什么 DataFrame 比 RDD 快？** 因为 `df.filter($"age" > 18)` 对 Spark 来说是**结构化表达式**，它能看懂并优化；而 `rdd.filter(x => x.age > 18)` 是一段黑盒的 JVM 字节码，Spark 无从下手。

```python
# ❌ RDD 风格：Spark 看不出你在做过滤，无法下推
rdd.filter(lambda row: row.age > 18)

# ✅ DataFrame 风格：Spark 知道这是过滤，可以：
#    - 下推到数据源（只读需要的列 / 跳过不满足的 Parquet row group）
#    - 做谓词下推、列裁剪、代码生成
df.filter(F.col("age") > 18)
```

**结论：能用 DataFrame/SQL 就别用 RDD。** RDD 只在需要精细控制分区、或写非结构化逻辑时才用。

## 三、运行架构

```text
┌──────────────────────────────────────────────────────────────┐
│  Driver（驱动进程：main() 所在，负责 DAG 切分、调度、跟踪任务）  │
│  ├─ DAGScheduler   → 把 DAG 切成 Stage，生成 TaskSet            │
│  ├─ TaskScheduler  → 把 Task 派发给 Executor                    │
│  └─ SparkContext / SparkSession                                 │
└───────────────────────────┬──────────────────────────────────┘
                            │ ① 申请资源（YARN/K8s/Standalone）
                            │ ② 派发 Task
                            ▼
      ┌─────────────────────────────────────────────────┐
      │  Cluster Manager（YARN / Kubernetes / Standalone）│
      └───┬──────────────────┬──────────────────┬───────┘
          ▼                  ▼                  ▼
   ┌────────────┐     ┌────────────┐     ┌────────────┐
   │  Executor  │     │  Executor  │     │  Executor  │
   │  ├─ Task   │     │  ├─ Task   │     │  ├─ Task   │   ← JVM 进程，长期驻留
   │  ├─ Task   │     │  ├─ Task   │     │  ├─ Task   │      内含多个 CPU core
   │  └─ Cache  │     │  └─ Cache  │     │  └─ Cache  │      缓存数据、跑 Task
   └────────────┘     └────────────┘     └────────────┘
```

| 角色 | 职责 |
| --- | --- |
| **Driver** | 运行 `main()`，创建 `SparkContext`，把作业转成 DAG → Stage → Task，调度 Task 并跟踪状态。**Driver 挂了整个作业就没了**，所以 `collect()` 到 Driver 的数据要小 |
| **Executor** | 工作进程，**一个 Executor 内有 N 个 core = 可并行执行 N 个 Task**；负责实际计算、缓存数据、向 Driver 汇报 |
| **Task** | 最小执行单元，一个分区一个 Task，跑在一个 core 上。**Task 是线程，不是进程**（这是 Spark 比 MR 启动快的重要原因） |
| **Cluster Manager** | 提供资源：**YARN**（Hadoop 生态）、**Kubernetes**（当前新平台首选）、Standalone（Spark 自带）、Local（本机调试） |

### 部署模式

| 模式 | 说明 |
| --- | --- |
| **local** | 单机多线程，`--master local[*]`，开发调试首选，不涉及集群 |
| **Standalone** | Spark 自带的集群模式，需要自己起 Master/Worker 进程，配置简单但资源隔离弱 |
| **YARN** | Hadoop 生态标配：`--master yarn --deploy-mode cluster`。**cluster 模式** Driver 跑在集群里（生产推荐）；**client 模式** Driver 在本机（调试方便，但本机断网作业就挂） |
| **Kubernetes** | 当前新平台的主流选择：`--master k8s://...`，容器化、弹性伸缩、与业务服务共用基础设施 |
| **Mesos** | 已停止维护，不再使用 |

```bash
spark-submit \
  --master yarn \
  --deploy-mode cluster \
  --driver-memory 2g \
  --executor-memory 8g \
  --executor-cores 4 \
  --num-executors 20 \
  --conf spark.sql.shuffle.partitions=400 \
  --conf spark.serializer=org.apache.spark.serializer.KryoSerializer \
  --conf spark.dynamicAllocation.enabled=true \
  --jars /path/to/mysql-connector.jar \
  /path/to/myjob.py
```

**Web UI**：运行中 Driver 的 UI 默认在 **4040** 端口（可看 DAG、Stage、Task、Shuffle 读写、倾斜情况）；History Server 默认 **18080**（看已完成作业）。**排查 Spark 问题第一步永远是打开 UI**。

## 四、执行流程

```text
① 用户代码执行 Transformation → 只构建 RDD 血缘图（DAG），不计算
② 遇到 Action → Driver 的 DAGScheduler 提交 Job
③ 按「宽依赖（Shuffle）」切分 Stage（前面的叫 map stage，后面的叫 reduce stage）
④ 每个 Stage 按分区数生成 Task（一个分区一个 Task）
⑤ TaskScheduler 把 Task 分发到 Executor 的 core 上（尽量就近，数据本地性）
⑥ Executor 执行 Task，Shuffle 阶段写本地磁盘 + 拉取（对应磁盘上的 shuffle write / shuffle read）
⑦ 某个分区失败 → 按血缘重算该分区（不需要重算整个作业，这是 RDD 容错的核心）
⑧ 所有 Stage 完成 → Action 返回结果（或写存储）
```

## 五、Spark SQL 与优化器

### 三种写法，一个引擎

```python
# 1. DataFrame API
df = spark.read.parquet("/data/orders/dt=2026-09-18")
result = (df.filter(F.col("status") == 1)
            .groupBy("user_id")
            .agg(F.sum("amount").alias("gmv"))
            .orderBy(F.desc("gmv")))

# 2. SQL（先建临时视图）
df.createOrReplaceTempView("orders")
spark.sql("""
  SELECT user_id, SUM(amount) AS gmv
  FROM orders WHERE status = 1
  GROUP BY user_id ORDER BY gmv DESC
""")

# 3. 两者混用（拿 SQL 的结果继续做 DataFrame 操作）
```

**三种写法最终都走同一条路**：Catalyst 优化器 + Tungsten 执行引擎。

### Catalyst 优化器

```text
SQL / DataFrame
      ▼
① Analysis       解析：表名、列名、类型检查（靠 Catalog / Hive Metastore）
      ▼
② Logical Plan   逻辑计划
      ▼
③ Optimization   规则优化 + 代价优化（CBO）：
                  谓词下推、列裁剪、常量折叠、连接重排序、
                  合并相邻算子、子查询去关联…
      ▼
④ Physical Plan  物理计划：选算法（HashJoin / SortMergeJoin / BroadcastJoin…）
      ▼
⑤ Code Generation  整个 Stage 编译成 Java 字节码（Whole-Stage Codegen）
      ▼
      Executor 执行
```

### Tungsten 与 AQE

**Tungsten**（Spark 1.5+）：堆外内存管理 + 二进制格式存储 + 全阶段代码生成，绕开 JVM 对象开销与 GC 压力。

**AQE（Adaptive Query Execution，自适应查询执行，Spark 3.0+）**：**根据运行时统计信息动态调整执行计划**，是 Spark 3 最重要的进步：

| AQE 能力 | 说明 | 解决的问题 |
| --- | --- | --- |
| **动态合并 Shuffle 分区** | 把小分区合并成大分区 | 分区数设成 200 结果数据很小 → 200 个空任务浪费 |
| **动态切换 Join 策略** | 运行时发现某表其实很小 → 改用 Broadcast Join | 静态统计信息不准（比如一张表刚被过滤过） |
| **动态处理数据倾斜** | 自动把超大分区拆成多个子分区 | **数据倾斜**，以前必须手动加盐 |

```python
spark.conf.set("spark.sql.adaptive.enabled", "true")           # 3.2+ 默认已开启
spark.conf.set("spark.sql.adaptive.coalescePartitions.enabled", "true")
spark.conf.set("spark.sql.adaptive.skewJoin.enabled", "true")
```

> **实践建议**：Spark 3.x 上**打开 AQE**，能省掉大量手工调参（尤其是 `spark.sql.shuffle.partitions` 和加盐处理倾斜）。

### 数据源：Spark 是「数据世界的万能接口」

```python
spark.read.parquet("/data/x")          # 列存，最常用
spark.read.orc("/data/x")
spark.read.csv("/data/x.csv", header=True, inferSchema=True)
spark.read.json("/data/x.json")
spark.read.format("jdbc").option("url", "...").option("dbtable", "t").load()
spark.read.format("kafka").option("kafka.bootstrap.servers", "...").load()
spark.table("dw.dwd_order")            # Hive 表（需配置 Hive Metastore）
spark.read.load("/warehouse/tbl")      # Iceberg / Hudi / Delta 表格式

df.write.mode("overwrite").partitionBy("dt").parquet("/out")
df.write.saveAsTable("dw.dws_user_agg")         # 写成 Hive 表
df.write.mode("append").format("jdbc").option("url", "...").save()
```

## 六、Shuffle 与内存管理

### Shuffle

**Shuffle 是 Spark 唯一的「重」操作**——它跨节点重新分发数据、写本地磁盘、通过网络拉取。**Spark 调优的 90% 都在减少或优化 Shuffle**。

| 算子 | 说明 | 建议 |
| --- | --- | --- |
| `reduceByKey` | **Map 端预聚合**后再 Shuffle（类似 MR 的 Combiner） | ✅ 优先使用 |
| `groupByKey` | 把所有数据 Shuffle 过去再聚合 | ❌ 数据量大时极易 OOM，除非确实需要完整列表 |
| `repartition` | 重新分区，**会 Shuffle**（可增可减） | 用于调大并行度 |
| `coalesce` | 减少分区，**默认不 Shuffle** | 用于减小文件数（写文件前常用） |
| `distinct` | 本质是 `groupBy + map` | 代价高 |
| `join` | 最重的算子 | 优先 Broadcast Join |

```python
# Shuffle 分区数：Spark SQL 默认 200（全公司最常被吐槽的默认值）
spark.conf.set("spark.sql.shuffle.partitions", "400")
# RDD 用 spark.default.parallelism（默认 = 总核数）

# 优化：能 Filter 就先 Filter，别把无用数据 shuffle 来 shuffle 去
df.filter("dt = '2026-09-18'").groupBy(...)     # ✅ 先过滤
df.groupBy(...).filter("dt = '2026-09-18'")     # ❌ 先 shuffle 全量再过滤
```

### Join 策略

| 策略 | 触发条件 | 特点 |
| --- | --- | --- |
| **Broadcast Hash Join** | 小表 < `spark.sql.autoBroadcastJoinThreshold`（默认 **10 MB**） | **最快，无 Shuffle，天然无倾斜**。小表广播到每个 Executor |
| **Shuffle Hash Join** | 一侧分区数据够小可放进内存 | 比 SMB 快但内存要求高 |
| **Sort Merge Join（SMJ）** | 两个大表 | **默认策略**：两侧按 join key 重分区排序后归并。代价是两次 Shuffle |

```python
from pyspark.sql.functions import broadcast
big.join(broadcast(small), "user_id")              # 手动广播（比调大阈值更可控）
spark.conf.set("spark.sql.autoBroadcastJoinThreshold", 50 * 1024 * 1024)  # 调到 50MB
```

### 缓存与持久化

```python
df.cache()                          # = persist(MEMORY_AND_DISK)
df.persist(StorageLevel.MEMORY_ONLY)
df.checkpoint()                     # 落盘到可靠存储，**切断血缘**（血缘过长时必须用）
df.unpersist()                      # 用完释放，否则占着内存
```

| 存储级别 | 说明 |
| --- | --- |
| `MEMORY_ONLY` | 只放内存，放不下就重算（RDD 的 `cache()` 默认） |
| `MEMORY_AND_DISK` | 内存放不下溢写到磁盘（**DataFrame 的 `cache()` 默认**，更稳） |
| `MEMORY_ONLY_SER` | 序列化后存（省内存、费 CPU） |
| `DISK_ONLY` | 只放磁盘 |
| 带 `_2` 后缀 | 存两份副本（如 `MEMORY_AND_DISK_2`） |

**什么时候该 cache？** 一个数据集被**多次 Action 使用**时（迭代算法、反复查询的中间表）。**只读一次就别 cache**，纯属浪费内存。

### 统一内存管理（Spark 1.6+）

```text
┌──────────────────── Executor JVM ────────────────────┐
│  用户数据结构（自定义对象）                            │
├─────────────────────── 统一内存区域 ──────────────────┤
│  Execution 内存          ←→    Storage 内存           │
│  （Shuffle、Join、排序） 互相借用  （Cache、广播变量）   │
│  spark.memory.fraction = 0.6（默认占堆的 60%）         │
│  spark.memory.storageFraction = 0.5                    │
└──────────────────────────────────────────────────────┘
```

Execution 可以**抢占** Storage 的内存（被挤掉的缓存下次重新算）；Storage 不能抢占 Execution（保证 Shuffle 不 OOM）。

### 共享变量

```python
# 广播变量：把只读数据分发给所有 Executor（只传一次，而非每个 Task 一份）
bc = spark.sparkContext.broadcast({"1": "北京", "2": "上海"})
df.rdd.map(lambda r: bc.value.get(r.id)).collect()

# 累加器：只能加、不能读（在 Driver 端读），用于统计计数
acc = spark.sparkContext.accumulator(0)
df.rdd.foreach(lambda r: acc.add(1))
```

## 七、Structured Streaming

### 模型：把流当「不断追加的表」

```text
输入流（Kafka / 文件 / Socket）
        │  新数据到来 = 往「无界表」追加一行
        ▼
   无界表（Unbounded Table）
        │  与静态表（维表）做 join、聚合、窗口
        ▼
   结果表 ──▶ 每个触发周期只输出「新增/更新」的部分
        ▼
输出到 Kafka / 文件 / 数据库 / 控制台
```

**Structured Streaming = 微批（Micro-Batch）**：把流切成一批批小的批处理作业，用与批处理**完全相同**的 DataFrame API。

```python
from pyspark.sql import SparkSession, functions as F

spark = SparkSession.builder.appName("stream").getOrCreate()

# 1. 读 Kafka
df = (spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", "localhost:9092")
        .option("subscribe", "user_events")
        .load()
        .selectExpr("CAST(value AS STRING) AS json")
        .select(F.from_json("json", "user_id BIGINT, event STRING, ts TIMESTAMP").alias("d"))
        .select("d.*"))

# 2. 带 Watermark 的窗口聚合（容忍 10 分钟延迟数据）
result = (df.withWatermark("ts", "10 minutes")
            .groupBy(F.window("ts", "5 minutes"), "event")
            .count())

# 3. 输出（checkpointLocation 必填，用于故障恢复与 exactly-once）
query = (result.writeStream
           .outputMode("update")
           .format("console")
           .option("checkpointLocation", "/checkpoint/user_events")
           .trigger(processingTime="1 minute")
           .start())

query.awaitTermination()
```

### 关键概念

| 概念 | 说明 |
| --- | --- |
| **输出模式** | `append`（只输出新行，不支持聚合更新）、`update`（输出有变化的行）、`complete`（每次输出全量结果，用于聚合） |
| **Watermark** | 设定「最多容忍多久的乱序数据」，超时数据被丢弃；**也让状态可以过期清理**（否则状态无限增长） |
| **触发（Trigger）** | `processingTime`（微批周期，默认）、`once`（处理完已有数据就停）、`availableNow`（3.3+，处理完所有可用数据后停止，常用作定时增量跑）、`continuous`（实验性，毫秒级延迟） |
| **Checkpoint** | 记录处理进度（offset）与状态，**故障恢复必需**；也是 exactly-once 的基础 |
| **Exactly-Once** | 靠「可重放的数据源 + Checkpoint 记录 offset + 幂等/事务性 Sink」共同实现 |

### Structured Streaming vs Flink

| | **Structured Streaming** | **Flink** |
| --- | --- | --- |
| 模型 | **微批**（Spark 3.5+ 起有 Real-Time Mode，但仍是批优先） | **原生流**（事件驱动，逐条处理） |
| 延迟 | 秒级（触发间隔决定） | **毫秒级** |
| 事件时间/Watermark | ✅ 支持 | ✅ 支持，更完善 |
| 状态管理 | 较轻 | **强**：状态大、需精细控制、状态 TTL、Queryable State |
| 生态 | 与批处理/SQL/ML 一体，**写一次逻辑批流两用** | 流处理专精，CDC/实时数仓首选 |
| 选型 | 已有 Spark 体系、延迟要求秒级、批流统一代码 | 低延迟、复杂事件处理、状态密集（实时风控/实时特征） |

> 一句话：**要求毫秒级、状态复杂 → Flink；延迟秒级可接受、栈统一 → Spark Structured Streaming。**

## 八、代码示例

### WordCount（RDD / DataFrame 对照）

```python
from pyspark.sql import SparkSession, functions as F

spark = SparkSession.builder.appName("wordcount").getOrCreate()
sc = spark.sparkContext

# ---- RDD 风格 ----
counts = (sc.textFile("hdfs:///data/log.txt")
            .flatMap(lambda line: line.split())
            .map(lambda w: (w, 1))
            .reduceByKey(lambda a, b: a + b))      # 不是 groupByKey！
counts.take(10)

# ---- DataFrame 风格（推荐，更快）----
df = spark.read.text("hdfs:///data/log.txt")
result = (df.select(F.explode(F.split("value", " ")).alias("word"))
            .groupBy("word").count()
            .orderBy(F.desc("count")))
result.show(10)
```

### ETL 示例（典型的离线数仓写法）

```python
from pyspark.sql import SparkSession, functions as F

spark = (SparkSession.builder
         .appName("dws_user_gmv")
         .config("hive.metastore.uris", "thrift://metastore-host:9083")
         .config("spark.sql.adaptive.enabled", "true")
         .config("spark.sql.shuffle.partitions", "400")
         .enableHiveSupport()
         .getOrCreate())

DT = "2026-09-18"

orders = spark.table("dw.dwd_order").filter(F.col("dt") == DT)

# 大表 join 小表 → 广播
users = spark.table("dw.dim_user").filter(F.col("is_valid") == 1)

dws = (orders.join(F.broadcast(users), "user_id")
             .groupBy("user_id", "city", "level")
             .agg(F.countDistinct("order_id").alias("order_cnt"),
                  F.sum("amount").alias("gmv"),
                  F.max("create_time").alias("last_order_time")))

(dws.write.mode("overwrite")
    .format("orc")
    .partitionBy("dt")
    .saveAsTable("dw.dws_user_gmv"))    # 或用 insertInto + 动态分区
```

## 九、调优清单

### 1. 资源参数（`spark-submit`）

| 参数 | 建议 |
| --- | --- |
| `--executor-cores` | **2~5**（太多会导致每个 core 分到的内存少、HDFS 并发句柄打满） |
| `--executor-memory` | 单 Executor 建议 **不超过 64 GB**（GC 压力），并预留 10% 给堆外 |
| `--num-executors` | 或直接用 `spark.dynamicAllocation.enabled=true` 动态伸缩 |
| `--driver-memory` | 别 `collect()` 大结果，一般 2~4 GB 够用 |
| `spark.executor.memoryOverhead` | 容器模式下超出 JVM 堆的内存开销，OOM Killed 时调大 |

> **常见事故**：`--executor-memory 8g` 但集群容器上限是 4g → 任务全被 YARN kill，日志里只写 `Container killed by YARN for exceeding memory limits`，看不出所以然。

### 2. 并行度

- **Task 数太少** → 资源闲置；**太多** → 调度开销大、小文件多。
- 经验：**总 core 数的 2~3 倍**个分区比较合适。
- 调 `spark.sql.shuffle.partitions`（默认 200，几乎总是要改）、`repartition` / `coalesce` 调整。
- 打开 **AQE 的动态分区合并**，可以让这个参数不再敏感。

### 3. 数据倾斜

```python
# 表现：Spark UI 里某几个 Task 的 shuffle read / duration 远大于其他
# 处理顺序：
# 1. 优先用 Broadcast Join（小表广播，从根上没有 Shuffle）
# 2. 打开 AQE 自动倾斜处理
spark.conf.set("spark.sql.adaptive.skewJoin.enabled", "true")
spark.conf.set("spark.sql.adaptive.skewJoin.skewedPartitionFactor", "5")
spark.conf.set("spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes", "256m")

# 3. 手动加盐（AQE 处理不了时）
# 热点 key 打散到 N 个分区做局部聚合，再二次聚合
```

**其他诱因**：JOIN key 有大量 NULL（先过滤 NULL 或给 NULL 加随机后缀）；`groupByKey` 换成 `reduceByKey`；分区键选择不当（基数太低）。

### 4. 序列化与内存

```python
spark.conf.set("spark.serializer", "org.apache.spark.serializer.KryoSerializer")
spark.conf.set("spark.memory.fraction", "0.6")
# Python 侧：用 Arrow 加速 DataFrame ↔ pandas 转换
spark.conf.set("spark.sql.execution.arrow.pyspark.enabled", "true")
```

### 5. 写文件

```python
# 输出前 coalesce 减少文件数（避免一坨几 KB 的小文件压垮 HDFS）
df.coalesce(10).write.mode("overwrite").parquet("/out")

# 按分区写是常规操作（注意：分区列必须存在，且分区数别爆炸）
df.write.partitionBy("dt", "hour").parquet("/out")
```

### 6. 排查问题的固定套路

1. **打开 Spark UI（4040）**：看 DAG 图、Stage 耗时、**Task 的 duration / shuffle read 分布**（找倾斜）、GC 时间。
2. **看 `spark-submit` 日志**里的 `WARN` 与 `ERROR`。
3. **倾斜 → 找 shuffle read 最大的那几个 Task**；**OOM → 找内存参数与是否 `collect()` 大结果**。
4. **慢 → 看是不是 Shuffle 太多、还是数据读得太多（分区裁剪失效）**。

## 十、常见坑

1. **滥用 `collect()`**：把海量数据拉到 Driver，直接 OOM。用 `take()`、`show()`、或直接写存储。
2. **在 Driver 侧做重活**：`for` 循环里操作 DataFrame 逐条处理，等于放弃了分布式。
3. **UDF 滥用**：Python UDF 要序列化数据往返 JVM ↔ Python，极慢。**优先用内置函数**，必须用则用 **pandas UDF（Arrow 向量化）**。
4. **`groupByKey` 而非 `reduceByKey`**：前者不预聚合，Shuffle 数据量与内存占用成倍增加。
5. **忘记 `spark.sql.shuffle.partitions` 默认 200**：数据小则 200 个空任务拖慢作业，数据大则单任务 OOM。
6. **cache 而不 unpersist**：长驻作业里内存被吃光，后续 Shuffle 反而溢写磁盘。
7. **血缘过长**：迭代几百轮后 DAG 巨大、容错重算代价极高。用 `checkpoint()` 切断血缘。
8. **小文件问题**：每个分区写一个文件，分区数 200 就是 200 个文件，长期积累会拖垮 HDFS。输出前 `coalesce`。
9. **时区/时间函数坑**：`to_date`、`date_format` 在不同时区下结果不同，涉及跨时区数据要显式指定。
10. **想用 Spark 做低延迟实时**：微批模型下延迟就是秒级起步，毫秒级请上 [Flink](./flink.md)。

## 十一、横向对比：Spark 站在哪

| | **MapReduce** | **Spark** | **Flink** |
| --- | --- | --- | --- |
| 定位 | 第一代批处理 | **统一批/流/SQL/ML 引擎** | **流处理专精** |
| 计算模型 | Map + Reduce | DAG（内存为主） | 原生流（数据流图） |
| 延迟 | 分钟级 | 秒级（批）；秒级（微批流） | **毫秒级** |
| 容错 | 任务重跑 | RDD 血缘重算（细粒度） | Checkpoint（分布式快照） |
| 状态管理 | 无 | 轻量 | **强（大状态、TTL、State Backend）** |
| 事件时间/Watermark | 无 | ✅ | ✅（更完善） |
| SQL | Hive 翻译 | **Spark SQL（Catalyst）** | Flink SQL |
| 现状 | 存量维护 | **离线大数据绝对主力** | **实时计算绝对主力** |

**选择原则**：

| 需求 | 选 |
| --- | --- |
| 离线批处理、ETL、数仓、机器学习 | **Spark** |
| 实时数仓、实时风控、实时监控、CDC | **Flink** |
| 交互式秒级查询、BI 报表 | Trino / **Doris** / ClickHouse（Spark SQL 在并发点上不占优） |

## 十二、核心要点速记

1. **Spark 的本质 = RDD（不可变、分区、血缘）+ DAG 调度 + 内存计算**，比 MapReduce 快在「不反复落盘」。
2. **惰性求值**：Transformation 只记录，Action 才触发执行。
3. **宽依赖（Shuffle）是 Stage 边界**：一个 Action 一个 Job，一个 Shuffle 一个 Stage，一个分区一个 Task。
4. **能用 DataFrame / SQL 就别用 RDD**——Catalyst 能看懂 DataFrame 但看不懂你的 lambda。
5. **Shuffle 是唯一的重操作**，调优的核心是「减少 Shuffle、让 Shuffle 均匀」。
6. **Broadcast Join 是最划算的 JOIN**，且**天然没有数据倾斜**。
7. **Spark 3 的 AQE 是免费的性能升级**，打开它就能自动合并分区、切换 Join、处理倾斜。
8. **`spark.sql.shuffle.partitions` 默认 200**，几乎总需要调整。
9. **Structured Streaming 是微批**，批流代码统一但延迟是秒级；毫秒级用 Flink。
10. **排查第一步永远是 Spark UI（4040）**，看 Task 耗时分布找倾斜。

## 参考资料

- [Apache Spark 官网](https://spark.apache.org/) / [Spark 文档](https://spark.apache.org/docs/latest/)
- 《Spark 权威指南》（Bill Chambers & Matei Zaharia）
- [Spark 调优指南](https://spark.apache.org/docs/latest/tuning.html)
- 本仓库相关笔记：[hadoop.md](./hadoop.md)、[mapreduce.md](./mapreduce.md)、[hive.md](./hive.md)、[flink.md](./flink.md)、[doris.md](./doris.md)、[database.md](./database.md)