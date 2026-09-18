# Doris

> Apache Doris，**基于 MPP 架构的高性能实时分析型数据库（OLAP）**。一句话：一个兼容 MySQL 协议的列式数据库集群，能在**万亿级数据**上做**亚秒级多维分析**，同时扛住**高并发点查**——把「实时数仓的服务层」这件事做得又简单又快。
>
> 它既不是 OLTP 数据库，也不是 NoSQL，而是**分析型数据库**：长得像个「MySQL 集群」，但面向的是聚合、报表、画像这类分析场景，而不是订单、支付这类高频小事务。
>
> 相关：[database.md](./database.md)（OLAP 分析型数据库总览）、[flink.md](./flink.md)（实时写入 Doris 的主力）、[spark.md](./spark.md)、[hive.md](./hive.md)（离线数仓）、[hadoop.md](./hadoop.md)、[s3.md](./s3.md)（存算分离）

## 一、背景与要解决的问题

### 背景

数据存得下了（HDFS）、算得动了（Spark/Flink），但**「算完的结果放在哪、谁来查」这个问题一直没解决好**：

- 放在 HDFS/Hive 上：查一次几十秒到几分钟，BI 自助分析和实时大屏根本用不了；
- 放在 MySQL 上：业务库被分析查询拖垮，千万行以上的 GROUP BY 也慢得没法用；
- 放在 ClickHouse 上：单表扫描极快，但多表 JOIN 弱、数据更新难、运维（分片 + ZooKeeper + 物化视图重建）复杂。

于是数仓里出现了一个断层：**上面算得出来，下面查不动**——中间缺一个专门为「分析查询」设计的服务层。

### 要解决的问题

| 场景 | 现状 | 后果 |
| --- | --- | --- |
| **BI 自助分析 / 实时大屏** | 查 Hive/Spark 要几十秒到几分钟 | 报表打不开，自助分析做不了 |
| **高并发报表** | ClickHouse 单点查询强，并发能力有限 | 几十个人同时刷报表就撑不住 |
| **多表 JOIN 分析** | ClickHouse 大表 JOIN 容易 OOM | 星型模型/宽表之外的场景用不了 |
| **数据需要更新** | Hive 只能整分区重写，ClickHouse 更新是异步 Mutation | 订单状态、用户维度这类会变的数据难维护 |
| **明细与汇总都要** | 预聚合之后明细就丢了 | 钻取分析做不了 |
| **运维成本** | 组件多、依赖 ZooKeeper、扩容要重分布数据 | 团队养不起 |

### 它给出的答案

Doris 的定位是**实时数仓的查询服务层 + BI 加速引擎**：用 MPP 架构 + 列式存储 + 向量化执行实现海量数据的亚秒级分析，同时兼容 MySQL 协议、支持主键 Upsert 与多表 JOIN——把「快」和「好用」两件事同时做到。

```text
业务库 / Kafka / 日志
        │  Flink CDC / Routine Load / Stream Load
        ▼
   ┌──────────────┐
   │ Apache Doris │  ← 既是存储，也是查询引擎；一份数据同时服务
   └──────────────┘      · 高并发报表（BI、大屏）
        │                · 明细查询（日志、行为）
        │                · 联邦查询（直接查 Hive/Iceberg 外表）
        ▼
   BI 报表 / 大屏 / 用户画像 / 自助分析 / 风控看板
```

### 历史与现状

- 前身是百度内部的 **Palo**（2013 年起自研，用于百度凤巢报表等场景），**2018 年 7 月捐给 Apache 基金会**，2022 年 6 月毕业为 **Apache 顶级项目**。
- 商业公司 **SelectDB** 主导开发，云上有 SelectDB Cloud。
- **版本里程碑**：
  - 1.1：**向量化执行引擎**（性能数量级提升）
  - 1.2：**Unique Key Merge-on-Write**（主键模型性能质变）、**Multi-Catalog** 多源联邦查询
  - 2.0：**Pipeline 执行引擎**、**倒排索引**、**异步物化视图**、存算分离试点
  - 2.1 / 3.x：**存算分离架构**成熟、湖仓能力增强、半结构化数据（VARIANT）支持

### 与同类产品的定位

| | **Doris** | **ClickHouse** | **StarRocks** | **Hive/Spark** |
| --- | --- | --- | --- | --- |
| 架构 | MPP（FE + BE） | 单机引擎 + 集群分片 | MPP（FE + BE + CN） | 计算存储分离 |
| 多表 JOIN | ✅ 好（CBO + 分布式 Join） | ⚠️ 弱（大表 JOIN 易 OOM） | ✅ 好 | ✅ 好但慢 |
| **高并发点查** | ✅ **强项（万级 QPS）** | ❌ 不擅长 | ✅ 强 | ❌ |
| 主键更新 / Upsert | ✅ Unique 模型（MOW） | ⚠️ 弱（异步 Mutation） | ✅ 主键模型 | ❌ 整分区重写 |
| 运维复杂度 | **低**（组件少，MySQL 协议） | 高（分片、ZK、副本） | 中 | 高 |
| 延迟 | 亚秒~秒级 | **亚秒级（宽表最强）** | 亚秒~秒级 | 分钟级 |
| 适用 | 实时数仓服务层、BI、高并发 | 宽表极速分析、日志 | 同 Doris，湖仓加速 | T+1 离线数仓 |

> **一句话选型**：**要 JOIN、要更新、要高并发、要运维省心 → Doris**；**只要单表极速扫描 → ClickHouse**。

## 二、架构

```text
                    ┌──────────────────────────────────────────┐
   客户端            │        FE（Frontend，Java）                │
   MySQL 协议  ──────▶│  · 接收 SQL、解析、优化（CBO）、生成计划     │
   (端口 9030)        │  · 管理元数据（库表、分区、副本、权限）       │
   HTTP 8030         │  · 调度查询、协调导入、管理集群              │
                    └───────────────┬──────────────────────────┘
                     Follower 集群（≥3，BDB JE 类 Paxos 复制元数据）
                     Observer（只读扩展，不参与选举）
                                    │ 下发执行计划（Thrift/brpc）
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
 ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
 │  BE         │            │  BE         │            │  BE         │
 │ (C++ 执行引擎)│            │             │            │             │
 │ ┌───┬───┐   │            │             │            │             │
 │ │Tablet│      │            │             │            │             │
 │ │副本1 │      │            │             │            │             │
 │ └───┴───┘   │            │             │            │             │
 │ 列存 + LSM  │            │             │            │             │
 └─────────────┘            └─────────────┘            └─────────────┘
```

| 组件 | 职责 | 关键点 |
| --- | --- | --- |
| **FE（Frontend）** | 元数据管理、SQL 解析与优化、查询规划与调度、导入协调 | **Java 编写**。角色分 **Leader / Follower / Observer**：Follower 参与选举和元数据写入（**至少 3 个**才高可用），Observer 只同步元数据、扩展读能力。元数据用 **BDB JE** 做类 Paxos 的一致复制 |
| **BE（Backend）** | 数据存储 + 查询执行 | **C++ 编写**。数据以 **Tablet** 为单位（表的分片），每个 Tablet 多副本；底层列式存储 + LSM-Tree 结构，后台做 **Compaction** |
| **Broker** | 访问外部存储（HDFS/S3）的独立进程 | 用于 Broker Load 和备份恢复；**新版本可无 Broker 直接访问**（`WITH HDFS`/`WITH S3`），Broker 逐步可选 |

### 关键特性

| 特性 | 说明 |
| --- | --- |
| **兼容 MySQL 协议** | 直接用 MySQL 客户端、JDBC、任何 BI 工具连（端口 **9030**）。**接入成本几乎为零**，这是它相比 ClickHouse 最大的易用性优势 |
| **MPP + 向量化 + Pipeline 执行** | 查询并行分散到所有 BE；列式+向量化执行；Pipeline 引擎让算子流水线并行，提升 CPU 利用率与并发 |
| **CBO 优化器** | 基于代价的优化器，支持统计信息、Join 重排序、Runtime Filter（运行时把过滤条件下推到扫描端，**大幅减少扫描数据量**） |
| **高并发** | 存储与查询一体，无外部依赖，点查场景可支撑万级 QPS |
| **Multi-Catalog 联邦查询** | 直接查 **Hive / Iceberg / Hudi / Paimon / MySQL / ES / JDBC** 等外部数据源，无需导入 |
| **存算分离（2.1/3.x）** | 数据存对象存储（S3/OSS），计算节点无状态、弹性伸缩；**成本更低**，但延迟略高于存算一体 |

### 端口速查

| 端口 | 服务 |
| --- | --- |
| **9030** | FE MySQL 协议（**客户端连这个**） |
| **8030** | FE HTTP（**Stream Load 打这里**、Web UI） |
| 9020 | FE Thrift RPC（FE 之间） |
| 8040 | BE HTTP（Stream Load 也可直连 BE） |
| 8060 | BE brpc（FE ↔ BE 通信） |
| 9050 | BE 心跳 |

## 三、数据模型（最重要的一节）

Doris 把表结构分两类列：**Key 列（维度/主键，用于排序与去重）** 和 **Value 列（指标，用于聚合）**。由这两类列的组合方式，派生出三种数据模型：

| 模型 | 语义 | 写入行为 | 适用场景 |
| --- | --- | --- | --- |
| **Duplicate（明细）** | Key 列**仅排序，不去重** | 追加，什么都不合并 | **日志、行为埋点、订单明细**——需要保留全部原始记录 |
| **Unique（主键）** | Key 列**唯一** | **新数据覆盖旧数据**（Upsert） | **维度表、订单状态更新、CDC 同步的业务表**——数据会变 |
| **Aggregate（聚合）** | Key 列唯一，Value 列**按指定函数聚合** | 写入时**预聚合**（SUM/MAX/MIN/REPLACE…） | **报表、指标汇总**——只要结果不要明细，查询极快 |

### 1. Duplicate 明细模型

```sql
CREATE TABLE dwd_user_event (
  event_time DATETIME NOT NULL COMMENT '事件时间',
  user_id    BIGINT   NOT NULL COMMENT '用户 ID',
  event      VARCHAR(64) COMMENT '事件名',
  device     VARCHAR(32) COMMENT '设备'
)
DUPLICATE KEY(event_time, user_id)          -- 前几列作为排序键（仅排序）
PARTITION BY RANGE(event_time) ()
DISTRIBUTED BY HASH(user_id) BUCKETS 16
PROPERTIES ("replication_num" = "3");
```

**要点**：`DUPLICATE KEY` 指定的列**只是排序键**（决定数据在文件中的物理顺序），不唯一约束。**前缀索引**会基于它建立，所以要把**最常用的过滤列放前面**。

### 2. Unique 主键模型

```sql
CREATE TABLE dim_user (
  user_id     BIGINT NOT NULL COMMENT '用户 ID',
  user_name   VARCHAR(64) REPLACE COMMENT '用户名',
  city        VARCHAR(32) REPLACE COMMENT '城市',
  level       TINYINT     REPLACE COMMENT '等级',
  update_time DATETIME    REPLACE COMMENT '更新时间'
)
UNIQUE KEY(user_id)                          -- 按 user_id 唯一，后写覆盖先写
DISTRIBUTED BY HASH(user_id) BUCKETS 16
PROPERTIES (
  "replication_num" = "3",
  "enable_unique_key_merge_on_write" = "true"    -- MOW，1.2+ 默认，务必开启
);
```

**Merge-on-Write（MOW）vs Merge-on-Read（MOR）**——这是 Unique 模型的关键：

| | **MOW（写时合并）** | **MOR（读时合并，旧）** |
| --- | --- | --- |
| 写入 | 写入时就标记旧数据删除，**代价在写入端** | 只追加新版本，**查询时才合并** |
| 查询 | **快**（无需合并） | 慢（每次读都要 merge） |
| 结论 | ✅ **1.2+ 默认，无脑开** | 仅存量系统 |

**Unique 模型是 Doris 做实时数仓的杀手锏**：CDC 同步的业务表可以被**高频 upsert**，同时保持查询性能——这是 Hive/ClickHouse 都做不到的。

### 3. Aggregate 聚合模型

```sql
CREATE TABLE dws_user_gmv (
  dt        DATE        NOT NULL COMMENT '日期',
  user_id   BIGINT      NOT NULL COMMENT '用户 ID',
  city      VARCHAR(32) REPLACE      COMMENT '城市（取最新）',
  order_cnt BIGINT      SUM DEFAULT '0' COMMENT '订单数',
  gmv       DECIMAL(20,2) SUM DEFAULT '0' COMMENT '成交额',
  last_time DATETIME    MAX          COMMENT '最后一次下单时间'
)
AGGREGATE KEY(dt, user_id, city)
PARTITION BY RANGE(dt) ()
DISTRIBUTED BY HASH(user_id) BUCKETS 16;
```

**可用聚合函数**：`SUM`、`MIN`、`MAX`、`REPLACE`（保留最新）、`REPLACE_IF_NOT_NULL`、`HLL_UNION`（基数估算）、`BITMAP_UNION`（**精确去重**，`COUNT(DISTINCT)` 的加速利器）。

**代价**：**明细被永久合并掉了**。比如同一个 user 同一天下了两单，`order_cnt` 会是 2，但你看不到「具体是哪两单」。所以**聚合模型只用于确定不再需要明细的汇总层**。

> **Bitmap 精确去重**是 Doris 的招牌能力：把用户 ID 存成 Bitmap，`BITMAP_UNION` 后 `BITMAP_COUNT` 得到精确 UV，**比 `COUNT(DISTINCT)` 快得多**，且支持任意维度组合的 UV 计算。

### 4. 模型选择速查

| 你的数据 | 选 |
| --- | --- |
| 日志、埋点、明细，只追加不改 | **Duplicate** |
| 会变化的业务数据（订单、用户、商品） | **Unique（开 MOW）** |
| 只要汇总结果、指标，不要明细 | **Aggregate** |
| 既要明细又要高性能去重 | **Duplicate + Bitmap 列**，或 Unique |
| 不确定 | **Unique + MOW**（最通用，能覆盖 90% 场景） |

> **实践建议**：**拿不准就用 Unique 模型**——它既能 upsert 又保留明细，只是存储略大、写入稍慢。Duplicate 只在你确定数据永不更新时用。

## 四、分区与分桶（数据分布的两级切分）

```text
Table
 ├─ Partition（分区，按时间/范围切）      ← 分区裁剪：查询只扫命中的分区
 │    ├─ Tablet（分桶/分片，按 Hash 切）  ← 并行度：一个 Tablet 一个副本集
 │    │    └─ Replica（副本，默认 3）      ← 高可用
```

### 分区（Partition）

| 类型 | 说明 |
| --- | --- |
| **Range（范围分区）** | 最常用，一般是时间（年/月/日）。查询带 `WHERE dt = '...'` 时**分区裁剪**，只扫一个分区 |
| **List（枚举分区）** | 按枚举值分（如按城市、按业务线） |
| **动态分区（Dynamic Partition）** | **自动按时间创建新分区、删除过期分区**——数仓里必须开，否则每天要人工维护 |

```sql
CREATE TABLE dwd_order (
  order_id   BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  amount     DECIMAL(20,2) REPLACE,
  status     TINYINT REPLACE,
  dt         DATE NOT NULL
)
UNIQUE KEY(order_id, dt)                      -- 分区列必须包含在 Key 里
PARTITION BY RANGE(dt)()
DISTRIBUTED BY HASH(order_id) BUCKETS 16
PROPERTIES (
  "replication_num" = "3",

  -- 动态分区：自动创建未来 3 天、保留最近 30 天
  "dynamic_partition.enable" = "true",
  "dynamic_partition.time_unit" = "DAY",
  "dynamic_partition.start" = "-30",
  "dynamic_partition.end" = "3",
  "dynamic_partition.prefix" = "p",
  "dynamic_partition.buckets" = "16"
);
```

### 分桶（Bucket / Tablet）

| 方式 | 说明 |
| --- | --- |
| **Hash 分桶** | `DISTRIBUTED BY HASH(col) BUCKETS N`——按列 hash 打散，**同一 key 的数据落在同一个 tablet**，JOIN 时可做 bucket shuffle join |
| **Random 分桶** | `DISTRIBUTED BY RANDOM BUCKETS N`——随机打散，**2.0+ 在部分导入场景性能更好**（避免导入时的数据倾斜），代价是失去 bucket shuffle 优化的可能 |

**分桶数怎么定？** 这是 Doris 建表最容易犯错的地方。

| 原则 | 说明 |
| --- | --- |
| **单 Tablet 数据量控制在 1~10 GB** | 这是核心经验值。太小 → 元数据与 Compaction 压力大；太大 → 并行度不足、故障恢复慢 |
| **分桶数 ≈ 分区数据量 ÷ 目标 Tablet 大小** | 例：每天 100 GB 数据，想每个 tablet 5 GB → 20 个桶（配合副本数 3 → 共 60 个 tablet） |
| **分桶数是「每个分区内」的** | 分区 N 天 × 每分区 M 桶 × 3 副本 = Tablet 总数。**分区多 + 桶多 = tablet 爆炸** |
| **tablet 总数控制在 10 万以内** | 超过会拖慢 FE 元数据管理与 BE Compaction，是 Doris 集群最常见的「慢性病」 |

> **真实事故**：按天分区保留 3 年 = 1095 个分区 × 32 桶 × 3 副本 ≈ **10 万个 tablet**。建表时觉得无所谓，跑一年后集群就卡了。**要么按周/月分区，要么减少桶数**。

### 副本与 Compaction

- **副本数默认 3**，分布在不同的 BE 上；BE 宕机后副本自动补齐（`ADMIN REPAIR` 或自动调度）。
- **Compaction**：写入产生小版本文件（Rowset），后台合并成大文件。**Compaction 跟不上会导致「版本数过多」**，查询变慢甚至报 `-235 too many versions`——这是 Doris 高频导入场景的经典问题。对策：控制导入频率与单次批量大小、必要时调整 Compaction 参数。

## 五、索引与加速手段

| 手段 | 说明 |
| --- | --- |
| **前缀索引（Short Key Index）** | 自动创建：每 1024 行取排序键的前 36 字节建索引。**所以排序键（Key 列）的顺序决定了索引效果，最常用的等值/范围过滤列要放前面** |
| **ZoneMap 索引** | 自动创建：每块记录列的 min/max，**范围过滤时可跳过整块**（类似 ORC/Parquet 的统计信息） |
| **BloomFilter 索引** | 手动建：高基数、等值查询（如 `WHERE order_id = 'xxx'`），快速判断「这块里肯定没有」 |
| **BITMAP 索引** | 手动建：低基数、等值查询的列（如 `status`、`city`），加速过滤 |
| **倒排索引（2.0+）** | 支持**全文检索**、`LIKE`、等值、`MATCH_ANY`，部分场景可替代 Elasticsearch |
| **物化视图** | 见下 |
| **Runtime Filter** | 运行时动态把 JOIN 的过滤条件下推到扫描端，**大幅减少扫描数据量**——Doris 的重要优化，通常无需干预 |
| **统计信息 + CBO** | `ANALYZE TABLE` 收集统计信息，让 CBO 选出更好的执行计划 |

```sql
-- 建索引
ALTER TABLE dwd_order ADD INDEX idx_status (status) USING BITMAP;
ALTER TABLE dwd_order ADD INDEX idx_order (order_id) USING BLOOMFILTER;

-- 收集统计信息（JOIN 慢、计划不优时先做这个）
ANALYZE TABLE dwd_order;
```

### 物化视图

| 类型 | 说明 |
| --- | --- |
| **同步物化视图（Rollup）** | 单表、实时同步、**查询自动改写**；只能基于同表的 Key 列做上卷。适合固定的上卷维度 |
| **异步物化视图（2.0+）** | **支持多表 JOIN**、可指定刷新策略（定时/手动）、透明改写；**用于加速复杂查询**，是 2.x 的核心特性 |

```sql
-- 异步物化视图：多表 JOIN，每小时刷新，查询自动改写
CREATE MATERIALIZED VIEW mv_gmv_city
BUILD IMMEDIATE REFRESH AUTO ON SCHEDULE EVERY 1 HOUR
DISTRIBUTED BY HASH(city) BUCKETS 8
PROPERTIES ("replication_num" = "1")
AS
SELECT d.dt, u.city, SUM(d.amount) AS gmv, COUNT(*) AS cnt
FROM dwd_order d JOIN dim_user u ON d.user_id = u.user_id
GROUP BY d.dt, u.city;
```

## 六、数据导入

| 方式 | 数据源 | 特点 | 适用 |
| --- | --- | --- | --- |
| **Stream Load** | 本地文件 / 程序 HTTP PUT | **同步**（等待返回结果），单次建议 < 10 GB，简单直接 | **小批量高频写入、程序内写入** |
| **Broker Load** | HDFS / S3 / OSS | **异步**（提交后查进度），适合大批量、可指定并发 | **大批量历史数据导入** |
| **Routine Load** | **Kafka** | 常驻任务持续消费，支持 Exactly-Once（靠 Kafka offset + 事务） | **实时流数据入仓** |
| **INSERT INTO** | SQL | 通过 MySQL 协议插入，`INSERT INTO SELECT` 也可 | **小数据量、库内表间流转** |
| **Flink Connector** | Flink | Flink Doris Connector（Sink/Source），**实时数仓主力写入方式** | **Flink 实时作业写 Doris** |
| **Multi-Catalog** | 外部数据源 | 不导入，直接查询外表 | 联邦分析、湖上查询加速 |
| **外部表 / 数据湖** | Hive/Iceberg/Hudi | 挂载后直接查（可配合物化视图加速） | 湖仓一体 |

### Stream Load 示例

```bash
curl --location-trusted -u root:<password> \
  -H "label:order_20260918_001" \
  -H "column_separator:," \
  -H "columns:order_id,user_id,amount,status,update_time" \
  -T ./order.csv \
  http://fe_host:8030/api/dw/dwd_order/_stream_load

# 返回 {"Status": "Success", "NumberTotalRows": 100000, "NumberLoadedRows": 100000, ...}
```

**label 的作用**：**幂等去重**。同一个 label 重复提交只会生效一次——这是 Stream Load 实现「精确一次」的方式，**程序里重试时务必复用同一个 label**。

### Routine Load 示例（Kafka 入仓）

```sql
CREATE ROUTINE LOAD dw.orders_job ON dwd_order
COLUMNS TERMINATED BY ",",
COLUMNS(order_id, user_id, amount, status, update_time)
PROPERTIES (
  "desired_concurrent_number" = "3",      -- 并发消费任务数
  "max_batch_interval" = "20",            -- 最长 20 秒一批
  "max_batch_rows" = "300000",
  "max_batch_size" = "209715200",         -- 200MB
  "format" = "json",                      -- 支持 csv / json
  "jsonpaths" = "[\"$.order_id\",\"$.user_id\"]"
)
FROM KAFKA (
  "kafka_broker_list" = "kafka:9092",
  "kafka_topic" = "orders",
  "property.group.id" = "doris_orders"
);
```

### 导入的共同原则

1. **每个导入是一个事务**，成功即原子生效（这也是 Doris 支持「数据可见性可控」的基础）。
2. **批量比频率重要**：频繁小批量导入 → 版本过多 → Compaction 跟不上 → 查询变慢。**建议每次导入几十 MB 到几 GB，间隔秒级以上**。
3. **导入前尽量在源端压缩/合并**，别让 Doris 处理海量小文件。
4. **导入是异步可见的**：默认导入完成后即可见；高并发场景可用 `group_commit` 等模式优化。

## 七、查询与生态

### 标准 SQL，几乎零成本接入

```sql
-- 用 MySQL 客户端直连（端口 9030）
-- mysql -h fe_host -P 9030 -u root
SELECT dt, city,
       COUNT(DISTINCT user_id) AS uv,
       SUM(amount)             AS gmv
FROM dwd_order
WHERE dt BETWEEN '2026-09-14' AND '2026-09-18'
GROUP BY dt, city
ORDER BY dt, gmv DESC;

-- 窗口函数
SELECT * FROM (
  SELECT user_id, amount,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY amount DESC) rn
  FROM dwd_order WHERE dt = '2026-09-18'
) t WHERE rn <= 3;

-- Bitmap 精确去重（需建 bitmap 列）
SELECT dt, BITMAP_COUNT(BITMAP_UNION(user_bitmap)) AS uv FROM dwd_order GROUP BY dt;
```

### Multi-Catalog 联邦查询（湖仓一体）

```sql
-- 挂载 Hive Catalog（也可 Iceberg / Hudi / Paimon / MySQL / ES）
CREATE CATALOG hive_cat PROPERTIES (
  "type" = "hms",
  "hive.metastore.uris" = "thrift://hms:9083"
);

-- 直接查 Hive 表，不导入
SELECT * FROM hive_cat.dw.dwd_order WHERE dt = '2026-09-18' LIMIT 10;

-- 甚至可以把湖表的数据「写入」Doris 内表加速
INSERT INTO dw.dwd_order SELECT * FROM hive_cat.dw.dwd_order WHERE dt = '2026-09-18';
```

**典型用法**：**冷数据在湖上（Hive/Iceberg）直接联邦查，热数据在 Doris 内表**（通过物化视图或定时导入），兼顾成本与性能。

### 从 Node.js / 应用连接

```js
import mysql from 'mysql2/promise'

// Doris 兼容 MySQL 协议，直接当 MySQL 连
const conn = await mysql.createConnection({
  host: 'fe_host',
  port: 9030,              // 注意：不是 3306，是 Doris 的 FE MySQL 端口
  user: 'root',
  password: '******',
  database: 'dw',
})

const [rows] = await conn.execute(
  'SELECT dt, city, SUM(amount) gmv FROM dwd_order WHERE dt = ? GROUP BY dt, city',
  ['2026-09-18']
)
```

## 八、运维与调优

### 数据分布与表设计

| 检查项 | 建议 |
| --- | --- |
| **分区粒度** | 按天/周/月视数据量而定；务必开**动态分区**自动管理 |
| **分桶数与 tablet 总数** | 单 tablet 1~10 GB；**tablet 总数 < 10 万** |
| **排序键（Key 列）顺序** | 最常用的过滤列放最前（前缀索引只认前缀） |
| **副本数** | 生产 3；测试可 1 |
| **数据模型** | 不确定用 Unique + MOW |

### 常见问题与排查

| 现象 | 原因与对策 |
| --- | --- |
| **查询变慢、报 `-235 too many versions`** | Compaction 跟不上（导入太频繁/太小）。降低导入频率、增大单次批量、调整 Compaction 参数 |
| **导入慢 / 频繁报错** | 单次数据太小太多、BE 磁盘满、tablet 过多 |
| **FE 内存高 / 元数据卡** | **tablet 数或分区数过多**。这是最常见的设计缺陷 |
| **数据倾斜（个别 BE 忙）** | 分桶键基数太低；换更高基数的分桶列，或用 Random 分桶 |
| **JOIN 慢** | 收集统计信息 `ANALYZE TABLE`；检查是否走了 Runtime Filter；考虑小表广播 / 物化视图预聚合 |
| **点查慢** | 确认走的是前缀索引/BloomFilter；点查建议用 Unique 模型 + 行存（`"store_row_column" = "true"`） |
| **副本异常** | `SHOW BACKENDS` 看状态，`ADMIN REPAIR` 触发修复 |

### 常用运维命令

```sql
SHOW BACKENDS;                                     -- BE 状态、磁盘、tablet 数
SHOW FRONTENDS;                                    -- FE 状态与角色
SHOW PROC '/statistic';                            -- 各库 tablet 数（找 tablet 大户）
SHOW DATA;                                         -- 各表数据量与副本数
SHOW PARTITIONS FROM dwd_order;                    -- 分区列表
SHOW TABLET FROM dwd_order;                        -- tablet 分布
SHOW LOAD WHERE LABEL = 'order_20260918_001';      -- 查导入状态
SHOW ROUTINE LOAD FOR dw.orders_job;               -- 查 Kafka 消费任务
SHOW MATERIALIZED VIEWS FROM dwd_order;
SHOW QUERY PROFILE '/path/to/profile';             -- 详细执行画像（排查慢查询必用）
SET enable_profile = true;                         -- 开启查询 profile 采集
```

## 九、常见坑

1. **分桶数拍脑袋**：分区数 × 桶数 × 副本 = tablet 总数，**上线前必须算一遍**。很多集群的性能问题根源在一张建错的表。
2. **排序键顺序随意**：前缀索引只对**排序键的最左前缀**有效。把 `dt` 这种高频过滤列放到 Key 的第一位。
3. **高频小批量导入**：是「版本过多」与 Compaction 灾难的直接原因。**攒批量、控频率**。
4. **拿 Aggregate 模型存明细**：明细被合并就永远找不回来了。想清楚这个汇总层是否还需要明细。
5. **Unique 模型不开 MOW**：老版本默认 MOR，查询要读时合并，性能差一个量级。**显式写 `enable_unique_key_merge_on_write = true`**。
6. **忘了分区列必须进 Key**：Range 分区列必须在 `UNIQUE KEY` / `AGGREGATE KEY` / `DUPLICATE KEY` 中。
7. **Stream Load 用随机 label**：重试会产生重复数据，**必须用固定 label 保证幂等**。
8. **拿 Doris 当 OLTP 用**：它支持点查但**不支持完整事务、不支持外键、不适合高频小写入**。订单交易还是 MySQL。
9. **不做物化视图/预聚合**：Doris 有预聚合能力，但每个报表都让它在原始明细上算，性能与成本都不划算。
10. **升级前不读版本说明**：Doris 迭代快，元数据格式与参数会变。**生产升级务必先在测试环境验证，并做好备份**。

## 十、选型：Doris 放在哪一层

```text
                    ┌──────────────────────────────────────┐
   数据源            │  实时链路                              │
   MySQL  ──CDC──▶  │  Flink ──▶ Doris（内表）──▶ BI/大屏      │
   Kafka  ────────▶ │                          ↕             │
   日志   ────────▶ │  Doris 联邦查 Hive/Iceberg（冷数据）    │
                    └──────────────────────────────────────┘
```

| 需求 | 选择 |
| --- | --- |
| **实时数仓服务层、BI 报表、高并发分析** | **Doris** |
| 单表宽表极速扫描、日志分析（不需要 JOIN 和更新） | ClickHouse |
| 已有 StarRocks 体系 / 需要更强湖仓加速 | StarRocks（同源思路） |
| T+1 离线数仓、超大规模 ETL | **Hive + Spark**（Doris 作为其结果的服务层） |
| 订单、支付等 OLTP 事务 | MySQL / TiDB |
| 缓存、排行榜 | Redis |
| 全文检索、日志搜索 | Elasticsearch（或用 Doris 2.0+ 倒排索引替代部分场景） |

**四层架构里的位置**：

```text
ODS（原始，HDFS/对象存储）
  ↓  Spark/Flink 清洗
DWD（明细，Doris Unique/Duplicate 模型）
  ↓  聚合
DWS / ADS（汇总，Doris Aggregate 模型 + 物化视图）
  ↓
BI / 大屏 / 画像 / 自助分析（毫秒~秒级响应）
```

## 十一、核心要点速记

1. **Doris = MPP + 列存 + 向量化 + MySQL 协议**，定位是**实时数仓的查询服务层**，不是 OLTP 数据库。
2. **架构极简**：FE（元数据/规划，≥3 Follower 高可用）+ BE（存储/执行，Tablet 三副本）。
3. **三种数据模型**：Duplicate（明细，不去重）、**Unique（主键，Upsert，开 MOW）**、Aggregate（写入时预聚合）。**不确定就用 Unique + MOW**。
4. **两级数据切分**：Partition（分区裁剪）+ Bucket/Tablet（并行度）；**单 tablet 1~10 GB，总量 < 10 万**。
5. **排序键（Key 列）顺序决定前缀索引效果**，高频过滤列放最前。
6. **三种导入**：Stream Load（同步推送，用固定 label 保幂等）、Broker Load（大批量异步）、**Routine Load（Kafka 常驻）**；Flink Connector 是实时链路主力。
7. **别高频小批量导入**——会导致版本过多、Compaction 跟不上，是集群变慢的头号原因。
8. **物化视图 + Runtime Filter + Bitmap 去重**是三大加速利器；Bitmap 精确 UV 是招牌能力。
9. **Multi-Catalog 联邦查询**打通湖仓：冷数据查湖、热数据在 Doris。
10. **运维省心是它相对 ClickHouse 的最大优势**：组件少、MySQL 协议、接入成本几乎为零。

## 参考资料

- [Apache Doris 官网](https://doris.apache.org/zh-CN/) / [官方文档](https://doris.apache.org/zh-CN/docs/gettingStarted/what-is-apache-doris)
- [Doris 数据模型](https://doris.apache.org/zh-CN/docs/table-design/data-model/overview) / [分区分桶](https://doris.apache.org/zh-CN/docs/table-design/data-partition)
- 《Apache Doris 实战》/ SelectDB 技术博客
- 本仓库相关笔记：[database.md](./database.md)、[flink.md](./flink.md)、[spark.md](./spark.md)、[hive.md](./hive.md)、[hadoop.md](./hadoop.md)、[s3.md](./s3.md)
