# Hive

> Apache 的数据仓库工具，**Hadoop 上的 SQL 引擎**。一句话：把 SQL 翻译成 MapReduce / Tez / Spark 作业跑在集群上，让不会写 Java 的人也能分析 HDFS 里的海量数据。
>
> 关键认知：**Hive 本身不存数据**——数据以文件形式躺在 HDFS 上，Hive 只维护一份「这些文件长什么样、在哪」的元数据。所以它更像「元数据服务 + SQL 编译器」，而不是一个数据库。这一点决定了它的所有特性：schema-on-read、改表加列是元数据操作、删除表可能只是删元数据。
>
> 相关：[hadoop.md](./hadoop.md)（HDFS / YARN）、[mapreduce.md](./mapreduce.md)（Hive 的执行基础）、[spark.md](./spark.md)（Hive 表最流行的查询方式）、[flink.md](./flink.md)、[doris.md](./doris.md)（实时数仓的查询服务层）、[database.md](./database.md)

## 一、背景与要解决的问题

### 背景

HDFS 解决了「存得下」，MapReduce 解决了「算得动」——**但这两样东西都是给工程师用的**。真正的数据需求来自业务方和分析师，他们只会写 SQL，不可能为了统计一个 GMV 去写 Java 的 Mapper 和 Reducer。

于是 Hadoop 集群里出现了一个巨大的断层：**数据在那儿、算力也在那儿，但能碰到它的只有会写 MR 的少数工程师。** 每一个数据分析需求都要排期等工程师开发、打包、提交，迭代周期以周计，数据探索根本无从谈起。

### 要解决的问题

| 问题 | 之前怎么做 | 为什么失效 |
| --- | --- | --- |
| **使用门槛太高** | 统计需求找工程师写 MapReduce 程序 | 一个 GROUP BY 要写几百行 Java，分析师无法自助 |
| **表达力太弱** | 用 map/reduce 两个原语拼复杂逻辑 | 多轮 JOIN、分组、排序要串成多个作业，难写难维护 |
| **重复造轮子** | 每个需求各写各的 MR | 统计口径、JOIN、排序这些通用操作本应由框架封装 |
| **迭代太慢** | 需求 → 排期 → 开发 → 测试 → 上线 | 周期以周计，业务等不起 |
| **数据资产被锁死** | 只有懂 Java + Hadoop 的工程师能碰 | 集群里存着大量数据，实际用起来的人极少 |

### 它给出的答案

**提供一套类 SQL 的语言（HQL），让用户声明「我要什么」，由 Hive 决定「怎么算」**：

```text
HQL（声明式）  ──编译──▶  执行计划  ──提交──▶  YARN 上的 MR/Tez/Spark 任务
```

代价是它继承了底层的延迟（T+1 批处理），以及「只维护元数据、不存数据」带来的 Schema-on-Read 约束——这些会在后面的章节逐一展开。

### 历史与定位

- 2007 年由 **Facebook** 开源（内部用来做数据仓库），2010 年成为 Apache 顶级项目。
- **Hive 不是数据库**，是**数据仓库基础设施**：本身不存储数据、不做事务（早期）、不支持行级更新，但在「用 SQL 分析 PB 级数据」这件事上做到了极致的简单。
- 历史地位：**离线数仓的事实标准**。今天很多公司的数仓分层（ODS/DWD/DWS/ADS）都是 Hive 表搭出来的。

## 二、架构

```text
┌─────────────────────────────────────────────────────────────┐
│  客户端：beeline（JDBC）/ Hive CLI / Hue / JDBC-ODBC / BI 工具 │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
              ┌────────────────────────┐
              │   HiveServer2 (HS2)    │  ← Thrift 服务，提供 JDBC/ODBC 接入
              │   含 Driver、会话管理     │     实现多客户端并发与鉴权
              └───────────┬────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   ┌─────────┐     ┌───────────┐     ┌──────────────┐
   │ Compiler│     │ Optimizer │     │  Executor    │  ← HQL 解析 → 逻辑计划
   │  (解析)  │     │  (CBO)    │     │  (提交作业)   │     → 物理计划 → 提交
   └────┬────┘     └─────┬─────┘     └──────┬───────┘
        │                │                  │
        │                ▼                  ▼
        │         ┌─────────────┐    ┌───────────────────────┐
        └────────▶│  Metastore  │    │  Hadoop 集群           │
                  │  (元数据服务) │    │  YARN（资源）+ HDFS（数据）│
                  └──────┬──────┘    └───────────────────────┘
                         ▼
                  ┌─────────────┐
                  │ 元数据库      │  ← MySQL / PostgreSQL（生产）
                  │ (Derby/MySQL) │     Derby 仅适合单机试用
                  └─────────────┘
```

| 组件 | 职责 |
| --- | --- |
| **Metastore（元数据服务）** | **Hive 的心脏**。存放表名、字段、分区、SerDe、HDFS 路径等元数据。生产必须用**独立元数据库（MySQL/PostgreSQL）+ 远程 Metastore 服务**，默认的 Derby 是单会话的内嵌库，**换个窗口就连不上**，只能用来跑 demo |
| **HiveServer2** | 对外提供 Thrift/JDBC/ODBC 服务，支持多客户端并发、用户鉴权、会话隔离。`beeline` 连的就是它（默认端口 **10000**） |
| **Driver** | 编译器（HQL → AST → 逻辑计划）+ 优化器（CBO 基于代价优化）+ 执行器（转成 MR/Tez/Spark 作业提交到 YARN） |
| **HDFS** | 真正存数据的地方。**一张表 = 一个目录，一个分区 = 一个子目录，数据 = 目录下的文件** |
| **YARN** | 提供计算资源 |

> **理解 Hive 的钥匙**：表在 HDFS 上的样子就是目录，比如 `dw.dwd_order` 表的数据在 `/user/hive/warehouse/dw.db/dwd_order/dt=2026-09-18/part-00000`。所以「加载数据」常常只是**把文件挪进这个目录**（`LOAD DATA`），根本不经过计算引擎。

## 三、Hive vs 传统关系数据库

这是理解 Hive 最重要的一张表：

| 维度 | RDBMS（MySQL） | **Hive** |
| --- | --- | --- |
| 定位 | OLTP：高频小事务读写 | **OLAP：海量数据批量分析** |
| 数据存储 | 自己的存储引擎（InnoDB） | **HDFS 上的文件**，Hive 只是「贴了一层表结构」 |
| 读写模式 | **Schema-on-Write**：写入时校验格式，不合规就拒 | **Schema-on-Read**：写入时不管，**查询时才按表定义解析** |
| 延迟 | 毫秒级 | **分钟级起步**（MR/Tez 作业启动开销） |
| 事务 | 完整 ACID | 早期无，3.0 起支持有限 ACID（需 ORC + 分桶表） |
| 索引 | 完善 | 基本没有（靠分区裁剪、ORC 的 stripe 索引、列存下推） |
| 更新/删除 | 任意行级 DML | 早期只能**整分区覆盖重写**（`INSERT OVERWRITE`） |
| 扩展性 | 单机，分库分表 | **水平扩展**（靠 HDFS/YARN） |
| 数据规模 | GB 级 | **TB ~ PB 级** |

**Schema-on-Read 的双刃剑**：好处是入库极快（文件丢进去就能查）、灵活（同一份数据可以用不同表结构读）；坏处是**脏数据在查询时才炸**，且写入时不校验意味着数据质量要靠上游保证。

> **别拿 Hive 当 MySQL 用**：想用它做点查询、实时更新、事务，都会非常失望。Hive 的定位就是**T+1 的离线批处理**。

## 四、数据模型

### 层次结构

```text
Database
  └── Table
        └── Partition（分区，HDFS 上是子目录）
              └── Bucket（分桶，HDFS 上是文件）
```

### 内部表 vs 外部表（最重要的区别）

| | **内部表（Managed Table）** | **外部表（External Table）** |
| --- | --- | --- |
| 建表语句 | `CREATE TABLE` | `CREATE EXTERNAL TABLE` |
| 数据归谁管 | **Hive 管** | **HDFS 管，Hive 只借用** |
| `DROP TABLE` 时 | **删除元数据 + 删除 HDFS 数据**（数据真的没了！） | **只删元数据，HDFS 数据保留** |
| 适用场景 | 数仓中间层（ODS→DWD→DWS→ADS），数据由 Hive 自己生产 | **原始数据、外部数据源、共享数据**，多引擎共用（Spark/Flink/Trino 都读同一份文件） |

**实践准则：原始数据一律用外部表。** 数仓里最惨的事故之一，就是误把外部数据建成内部表然后 `DROP TABLE`，PB 数据瞬间蒸发。

```sql
-- 外部表：原始日志，指向已有的 HDFS 目录
CREATE EXTERNAL TABLE IF NOT EXISTS ods.user_log (
  user_id   BIGINT   COMMENT '用户 ID',
  event     STRING   COMMENT '事件类型',
  ts        BIGINT   COMMENT '时间戳(ms)'
)
COMMENT '用户行为日志原始表'
PARTITIONED BY (dt STRING COMMENT '日期分区', hour STRING COMMENT '小时分区')
ROW FORMAT DELIMITED FIELDS TERMINATED BY '\t'
STORED AS TEXTFILE
LOCATION '/data/logs/user_log';
```

### 分区表（Partition）

**分区 = 把数据按某个维度切成 HDFS 子目录**，查询时只扫描命中分区，避开全表扫描。这是 Hive 最有效的优化手段之一。

```text
/user/hive/warehouse/ods.db/user_log/
  ├── dt=2026-09-16/hour=00/part-00000
  ├── dt=2026-09-17/hour=00/part-00000
  └── dt=2026-09-18/hour=00/part-00000
                                            ← WHERE dt='2026-09-18' 只读这一个目录
```

```sql
-- 静态分区：手动指定
ALTER TABLE ods.user_log ADD IF NOT EXISTS PARTITION (dt='2026-09-18', hour='00');
INSERT OVERWRITE TABLE ods.user_log PARTITION (dt='2026-09-18', hour='00')
SELECT user_id, event, ts FROM tmp_raw WHERE ...

-- 动态分区：从数据里自动识别分区（必须开 nonstrict 模式）
SET hive.exec.dynamic.partition = true;
SET hive.exec.dynamic.partition.mode = nonstrict;
SET hive.exec.max.dynamic.partitions = 100000;        -- 默认 1000，按需调大
INSERT OVERWRITE TABLE ods.user_log PARTITION (dt, hour)
SELECT user_id, event, ts, dt, hour FROM tmp_raw;      -- 分区字段放 SELECT 最后

-- 查看分区
SHOW PARTITIONS ods.user_log;
SHOW PARTITIONS ods.user_log PARTITION (dt='2026-09-18');

-- 修复分区（直接往 HDFS 放文件后必须执行，否则元数据里没有）
MSCK REPAIR TABLE ods.user_log;
```

**分区的三个坑**：

1. **分区字段不能出现在表字段里**——分区列是「伪列」，从目录名解析而来。
2. **直接 `hdfs dfs -put` 文件进去，Hive 查不到**——元数据里没有分区记录，必须 `MSCK REPAIR`（或 `ALTER TABLE ADD PARTITION`）。
3. **分区过多也有害**：小分区（每个才几 KB）会让 NameNode 和任务调度不堪重负。按小时分区还是按天分区要权衡。

> **严格模式**（`hive.mapred.mode=strict`，Hive 3 中由 `hive.strict.checks.*` 分别控制）会**禁止不带分区过滤的查询**，防止有人手一抖扫了全表几小时。生产建议开启。

### 分桶表（Bucket）

分桶 = **对某列做 hash 取模，把数据分到固定数量的文件里**。

```sql
CREATE TABLE dw.dwd_order_bucket (
  order_id BIGINT, user_id BIGINT, amount DECIMAL(10,2)
)
CLUSTERED BY (user_id) INTO 8 BUCKETS       -- 按 user_id 分 8 桶
STORED AS ORC;
```

**用途**：

1. **SMB Join（Sort Merge Bucket Join）**：两个表按同一列分同样数量的桶，JOIN 时可以**桶对桶**直接合并，避免整个 Shuffle——这是 Hive 最高效的 JOIN 方式。
2. **数据抽样**：`SELECT * FROM t TABLESAMPLE(BUCKET 1 OUT OF 8 ON user_id)` 快速取样本。
3. **ACID 事务的前提**：Hive 的 UPDATE/DELETE 要求表是 ORC 格式且已分桶。

### 四种「排序」

新手最容易混的四个关键字：

| 关键字 | 含义 | 特点 |
| --- | --- | --- |
| **ORDER BY** | 全局排序 | **只有一个 Reducer**，大数据量下极易 OOM 或跑几小时，慎用 |
| **SORT BY** | 每个 Reducer **内部**有序 | 不保证全局有序，但性能好 |
| **DISTRIBUTE BY** | 控制数据去哪个 Reducer | 按指定列 hash 分区，配合 SORT BY 使用 |
| **CLUSTER BY** | `DISTRIBUTE BY` + `SORT BY`（同一列） | 分区内有序，是分桶排序的简写 |

```sql
-- 典型组合：按 user_id 分发，每个 user 内按时间倒排，取每个用户最近 3 条
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY ts DESC) rn
  FROM ods.user_log WHERE dt = '2026-09-18'
) t WHERE rn <= 3;
```

## 五、数据类型与文件格式

### 数据类型

| 类别 | 类型 |
| --- | --- |
| 整型 | `TINYINT`(1B) / `SMALLINT`(2B) / `INT`(4B) / `BIGINT`(8B) |
| 浮点 | `FLOAT` / `DOUBLE` / `DECIMAL(p,s)`（**金额必须用 DECIMAL**，浮点会有精度误差） |
| 字符串 | `STRING`（最常用）/ `VARCHAR(n)` / `CHAR(n)` |
| 时间 | `DATE` / `TIMESTAMP` / `INTERVAL` |
| 复杂类型 | `ARRAY<T>` / `MAP<K,V>` / `STRUCT<...>` / `UNIONTYPE` |

复杂类型是 Hive 的特色（源数据常是 JSON）：

```sql
CREATE TABLE ods.event (
  user_id BIGINT,
  tags    ARRAY<STRING>,
  ext     MAP<STRING, STRING>,
  addr    STRUCT<province:STRING, city:STRING>
) STORED AS ORC;

SELECT tags[0], ext['channel'], addr.city FROM ods.event;
-- 展开数组：LATERAL VIEW explode
SELECT user_id, tag FROM ods.event LATERAL VIEW explode(tags) t AS tag;
```

### 文件格式（决定查询性能的关键）

| 格式 | 类型 | 特点 | 推荐场景 |
| --- | --- | --- | --- |
| **TEXTFILE** | 行式 | 默认格式，纯文本，可读可直接 put，但**无压缩优化、无列裁剪、读全表** | 原始数据落地、调试 |
| **SEQUENCEFILE** | 行式 | 二进制 KV，可压缩可切分 | 历史遗留 |
| **RCFILE** | 列式 | 早期列存，已被 ORC 取代 | 基本不用 |
| **ORC** | **列式** | **Hive 亲儿子**：列裁剪、谓词下推、stripe 级索引（min/max 统计跳过整块）、支持 ACID、压缩率高 | **数仓内部表首选** |
| **PARQUET** | **列式** | Spark 生态更通用，嵌套结构支持好 | 多引擎混用（Spark/Flink/Trino 都读）时的默认选择 |

**列式存储为什么快？**

1. **列裁剪（Column Pruning）**：`SELECT a, b` 只读 a、b 两列，不读整行——宽表场景 I/O 能降一个数量级。
2. **同列数据类型一致 → 压缩率极高**（常到 5~10 倍），因为相邻数据相似。
3. **谓词下推（Predicate Pushdown）**：ORC 在每个 stripe 存 min/max 统计，`WHERE dt > '2026-01'` 能直接跳过不含目标值的块，**根本不读**。

```sql
CREATE TABLE dw.dws_user_agg (
  user_id BIGINT,
  order_cnt BIGINT
)
STORED AS ORC
TBLPROPERTIES ("orc.compress" = "SNAPPY");
```

### 压缩

| 算法 | 压缩率 | 速度 | 可切分 | 说明 |
| --- | --- | --- | --- | --- |
| **Snappy** | 中 | 快 | 否 | **数仓默认选择**，速度与体积平衡最好 |
| **Zlib/Gzip** | 高 | 中 | **否** | 压缩率高，但**不可切分** → 一个文件只能一个 map 读，并行度受损 |
| **Bzip2** | 最高 | 慢 | 是 | 冷数据归档 |
| **LZO** | 中 | 快 | 需建索引 | 已不常用 |

> **「可切分」为什么重要**：HDFS 上一个 1 GB 的 `.gz` 文件无法被切成多个 map 分片，只能由一个任务读完解压——**并行度直接归零**。所以中间数据要压缩就用 **Snappy 或 ORC/Parquet 内置压缩**，不要用 gzip。

## 六、HQL 常用操作

```sql
-- ========== DDL ==========
SHOW DATABASES;
CREATE DATABASE IF NOT EXISTS dw COMMENT '数仓' LOCATION '/user/hive/warehouse/dw.db';
USE dw;
SHOW TABLES;
DESC FORMATTED dw.dwd_order;      -- 看表结构 + 存储格式 + 位置（信息最全）
SHOW CREATE TABLE dw.dwd_order;   -- 看建表语句

-- 加列（只改元数据，老数据读出来是 NULL，秒级完成）
ALTER TABLE dw.dwd_order ADD COLUMNS (coupon_id BIGINT COMMENT '优惠券ID');
-- 改列类型 / 改名 / 换位置
ALTER TABLE dw.dwd_order CHANGE COLUMN amount total_amount DECIMAL(12,2);
-- 换文件格式（只对新写入的数据生效！）
ALTER TABLE dw.dwd_order SET FILEFORMAT ORC;

-- ========== 加载与写入 ==========
-- 1. 直接挪文件（不经过计算引擎，最快）
LOAD DATA LOCAL INPATH '/home/data/t.csv' INTO TABLE dw.dwd_order;        -- 从本地
LOAD DATA INPATH '/tmp/t.csv' OVERWRITE INTO TABLE dw.dwd_order;          -- 从 HDFS（会移动文件）

-- 2. 从查询写入（最常用）
INSERT OVERWRITE TABLE dw.dws_user_agg PARTITION (dt='2026-09-18')
SELECT user_id, COUNT(*) FROM dw.dwd_order WHERE dt='2026-09-18' GROUP BY user_id;

INSERT INTO TABLE dw.dws_user_agg            -- INSERT INTO 追加，OVERWRITE 覆盖
SELECT ... ;

-- 3. CTAS：建表并写入（方便，但别用于数仓正式表，不便于后续维护）
CREATE TABLE tmp.t1 STORED AS ORC AS SELECT * FROM dw.dwd_order WHERE dt='2026-09-18';

-- 4. 导出
INSERT OVERWRITE DIRECTORY '/tmp/out' ROW FORMAT DELIMITED FIELDS TERMINATED BY ','
SELECT * FROM dw.dws_user_agg;

-- ========== 查询 ==========
SELECT dt, COUNT(*) cnt, SUM(amount) gmv
FROM dw.dwd_order
WHERE dt BETWEEN '2026-09-14' AND '2026-09-18'    -- 分区裁剪：必须写！
  AND status = 1
GROUP BY dt
HAVING SUM(amount) > 100000
ORDER BY dt;

-- 窗口函数
SELECT user_id, amount,
       SUM(amount) OVER (PARTITION BY user_id ORDER BY create_time) AS cum_amount,
       ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY create_time DESC) AS rn,
       LAG(amount) OVER (PARTITION BY user_id ORDER BY create_time) AS prev_amount
FROM dw.dwd_order WHERE dt = '2026-09-18';
```

### 连接方式

```bash
# beeline（推荐，Hive 2.x 起 CLI 已不推荐）
beeline -u "jdbc:hive2://hiveserver2-host:10000/default" -n username -p password

# 非交互执行脚本
beeline -u "jdbc:hive2://host:10000" -e "SELECT COUNT(*) FROM dw.dwd_order"
beeline -u "jdbc:hive2://host:10000" -f /path/to/script.hql

# 设置参数：优先用 --hiveconf 或在脚本里 SET
beeline --hiveconf hive.exec.dynamic.partition=true ...
```

```sql
-- 会话内设参数（当前会话有效）
SET hive.exec.dynamic.partition.mode = nonstrict;
SET mapreduce.job.reduces = 50;
SET hive.exec.parallel = true;

-- 查看参数（强烈建议：不确定默认值时直接 SET -v 查）
SET -v;                  -- 列出所有参数与默认值
SET hive.exec.parallel;  -- 查某个参数
```

## 七、执行引擎

HQL 最终要变成分布式作业，谁来执行是可选的：

| 引擎 | 配置 | 特点 |
| --- | --- | --- |
| **MapReduce** | `hive.execution.engine=mr` | 最慢（中间结果落盘），但最稳、最省内存 |
| **Tez** | `hive.execution.engine=tez` | **Hortonworks 主导的 DAG 引擎**，把多个 MR 阶段合成一个 DAG，避免中间落盘，**快 2~5 倍**。曾是 Hive 上线的标配 |
| **Spark** | `hive.execution.engine=spark` | 用 Spark 作为执行引擎（Hive on Spark，需要单独的 Spark 版本适配，配置较麻烦） |

```sql
SET hive.execution.engine = tez;   -- 会话级切换
```

**LLAP（Live Long and Process，Hive 2.0+）**：常驻的守护进程，把数据缓存在内存、把计算下推到常驻进程，让 Hive 具备**亚秒级交互查询**能力，减少作业启动开销。相当于给 Hive 配了「温数据缓存层」。

### 与「Spark SQL 读 Hive 表」的区别

这是实践中非常重要的一个区分：

| | **Hive on Spark** | **Spark SQL 读 Hive 表** |
| --- | --- | --- |
| 驱动方 | Hive（HQL 语法、Hive 优化器） | **Spark**（Spark SQL、Catalyst 优化器） |
| 元数据 | Hive Metastore | **共用同一个 Hive Metastore** |
| 特点 | 受 Hive 版本绑定，配置复杂 | 更简单，性能通常更好，生态更活 |
| 现状 | 少数存量集群 | **当前主流**——所谓「还在用 Hive」，多数其实是「数据存在 Hive 表里，用 Spark SQL 查」 |

```sql
-- Spark SQL 直接访问 Hive 表（需把 hive-site.xml 放到 Spark 的 conf 目录）
SELECT * FROM dw.dwd_order WHERE dt = '2026-09-18';
-- 或者用 Spark 的 SQL 直接读 HDFS 上的位置，不依赖 Metastore
SELECT * FROM parquet.`/user/hive/warehouse/dw.db/dwd_order/dt=2026-09-18`;
```

## 八、优化与调优

### 1. 少读数据（最有效）

| 手段 | 说明 |
| --- | --- |
| **分区裁剪** | `WHERE dt = '...'` 一定要写在最外层、用常量或可推导的表达式，别用函数包住分区列（`WHERE substr(dt,1,7)='2026-09'` 会失效） |
| **列裁剪** | `SELECT` 只写需要的列，别 `SELECT *`（列存下 I/O 差一个数量级） |
| **谓词下推（PPD）** | `hive.optimize.ppd=true`（默认开），把过滤条件下推到存储层，ORC/Parquet 直接跳过整块 |
| **文件格式** | TEXTFILE 换 **ORC / Parquet** + Snappy |
| **合理分区粒度** | 按天分区而不是按小时/秒，避免海量小分区 |

### 2. JOIN 优化

| 手段 | 说明 |
| --- | --- |
| **Map Join（小表广播）** | 小表加载进内存做 hash 表，各 map 本地完成 JOIN，**完全避免 Shuffle**。`hive.auto.convert.join=true`（默认开），小表阈值 `hive.mapjoin.smalltable.filesize`（默认约 25 MB） |
| **手动指定 Map Join** | `SELECT /*+ MAPJOIN(b) */ ... FROM big a JOIN small b ON ...`，大表 JOIN 小表（< 几百 MB）时最有效 |
| **SMB Join** | 两表按同一列、同数量分桶且已排序 → 桶对桶归并，避免全量 Shuffle。大数据量下最优 |
| **Bucket Map Join** | 小表分桶数是大表的整数倍时可在 Map 端做桶级 JOIN |
| **JOIN 顺序** | 大表放最后（老式 MR 的 reduce join 里，最后一个表是流式读取不缓存的那张） |
| **避免 JOIN 前不做过滤** | 能先 WHERE 就先 WHERE，别等 JOIN 完再过滤 |

### 3. 数据倾斜

**信号**：某个 reduce task 卡在 99% 几小时，其他早就完成。

```sql
-- 常用开关（缓解倾斜）
SET hive.optimize.skewjoin = true;          -- 对倾斜 key 单独处理（会多起一轮作业）
SET hive.skewjoin.key = 100000;             -- 超过该行数的 key 视为倾斜
SET hive.groupby.skewindata = true;         -- GROUP BY 倾斜：两阶段聚合（先随机打散预聚合）
SET hive.optimize.countdistinct = true;     -- COUNT(DISTINCT) 倾斜优化
```

**根治手段（人肉加盐）**：

```sql
-- 思路：把热点 key 加随机前缀打散到多个 reduce 做局部聚合，再二次聚合
WITH s1 AS (
  SELECT CONCAT(user_id, '_', CAST(FLOOR(RAND() * 10) AS INT)) AS salted_key, amount
  FROM dw.dwd_order WHERE dt = '2026-09-18' AND user_id = 0     -- 假定 user_id=0 是热点
)
SELECT ... -- 第二次去掉盐再去重聚合
```

**其他手段**：热点 key 单独捞出来算再 union 回去；大表小表 JOIN 优先用 Map Join（Map Join **天然没有倾斜问题**，因为没有 Shuffle）；NULL 值导致倾斜时先过滤 NULL。

### 4. 减少小文件与作业开销

```sql
-- 输出小文件合并（对分区表建议开启，否则每天一个分区产生几百个小文件）
SET hive.merge.mapfiles = true;                    -- 合并 Map-only 作业输出
SET hive.merge.mapredfiles = true;                 -- 合并 MapReduce 作业输出
SET hive.merge.smallfiles.avgsize = 134217728;     -- 平均小于 128MB 触发合并
SET hive.merge.size.per.task = 268435456;          -- 合并后每个文件目标大小 256MB

-- 并行执行无依赖的阶段（如多个 union 分支）
SET hive.exec.parallel = true;
SET hive.exec.parallel.thread.number = 8;

-- 控制 reduce 数量
SET mapreduce.job.reduces = 100;                   -- 别用默认的 1！

-- JVM 重用（小任务多时显著省启动开销）
SET mapreduce.job.jvm.numtasks = 10;

-- 容器内存（OOM 时调大）
SET mapreduce.map.memory.mb = 4096;
SET mapreduce.reduce.memory.mb = 8192;
SET mapreduce.map.java.opts = -Xmx3276m;
SET mapreduce.reduce.java.opts = -Xmx6553m;
```

### 5. 其他常用开关

```sql
SET hive.cbo.enable = true;              -- 基于代价的优化器（Hive 2.0+ 默认开）
SET hive.optimize.index.filter = true;   -- 自动使用索引
SET hive.fetch.task.conversion = more;   -- 简单查询不走 MR，直接本地取（如 SELECT * LIMIT 10）
SET hive.strict.checks.no.partition.filter = true;   -- 强制分区过滤
```

## 九、常见坑

1. **`DROP TABLE` 把数据删了**：内部表 drop 会删 HDFS 数据。**原始数据一律用 EXTERNAL TABLE**。
2. **Derby 元数据库**：默认内嵌 Derby，**只支持一个连接**，换个终端就连不上。生产必须换 MySQL/PostgreSQL 并启用远程 Metastore。
3. **分区列放进表字段**：建表时会报错，分区列只能写在 `PARTITIONED BY` 里。
4. **`hdfs dfs -put` 后查不到数据**：元数据没更新，需 `MSCK REPAIR TABLE` 或 `ADD PARTITION`。
5. **`ORDER BY` 导致单点**：全局排序只有一个 reducer，大表排序必炸。用 `SORT BY` 或窗口函数替代。
6. **`SELECT *` 拖垮集群**：列存下只读需要的列，宽表 `SELECT *` 可能多读几十倍数据。
7. **gzip 文件不可切分**：一个 gz 文件一个 map，并行度归零。
8. **元数据与文件不一致**：手动删 HDFS 目录后表还在，查询报 `File not found`；反之文件在但元数据没有就查不到。
9. **改文件格式对老数据无效**：`SET FILEFORMAT` 只影响新写入的数据，历史数据要 `INSERT OVERWRITE` 重写。
10. **`LOCATION` 指到已有目录要小心**：如果目录里已有数据、格式又不匹配，查询会得到诡异结果（Schema-on-Read 的代价）。
11. **Hive 不适合高频写入/点查**：每次写入都是整分区重写，做实时或点查请上 [doris.md](./doris.md) / [flink.md](./flink.md) 那套。

## 十、选型：Hive 放在什么位置

| 场景 | 选择 |
| --- | --- |
| **T+1 离线数仓**、海量数据批处理、复杂 ETL | **Hive 表 + Spark SQL 计算**（当前主流）或 Hive on Tez |
| 交互式即席查询、秒级响应 | Trino/Presto、**Doris/StarRocks**、ClickHouse |
| 实时数仓、分钟级延迟 | **Flink** + Doris/ClickHouse（或 Paimon/Iceberg 湖仓） |
| 报表 BI、高并发点查 | Doris / StarRocks |
| 机器学习、图计算 | Spark |

**一句话**：Hive 是**离线数仓的「存储格式与元数据标准」**，它的价值今天更多体现在「**Hive Metastore 作为元数据中心 + Hive 表格式作为数仓分层载体**」，而具体的计算与查询，已经交给了 Spark SQL / Trino / Doris 这些更快的引擎。

## 十一、核心要点速记

1. **Hive 不存数据**，只存元数据；数据是 HDFS 上的文件，表 = 目录，分区 = 子目录。
2. **Schema-on-Read**：写入不校验，查询才解析——灵活但数据质量要靠上游。
3. **Metastore 是心脏**，生产必须用 MySQL + 远程模式，不能用 Derby。
4. **内部表 DROP 会删数据，外部表不会**——原始数据永远用外部表。
5. **分区裁剪是头号优化**，其次是列裁剪 + ORC/Parquet 列存。
6. **Map Join 天然免疫数据倾斜**（无 Shuffle），大表 JOIN 小表优先用它。
7. **`ORDER BY` 全局排序只有一个 reducer**，大数据量下必炸。
8. **四种排序**：ORDER BY（全局）/ SORT BY（局部）/ DISTRIBUTE BY（分发）/ CLUSTER BY（前两者合一）。
9. **执行引擎可选** MR/Tez/Spark；今天更常见的是**「Hive 表 + Spark SQL」**而非 Hive on Spark。
10. Hive 定位 **T+1 离线批处理**，不要拿它做点查、实时与事务。

## 参考资料

- [Apache Hive 官网](https://hive.apache.org/) / [Hive 语言手册](https://cwiki.apache.org/confluence/display/Hive/LanguageManual)
- 《Hive 编程指南》（Edward Capriolo 等）
- [Hive 配置参数大全](https://cwiki.apache.org/confluence/display/Hive/Configuration+Properties)
- 本仓库相关笔记：[hadoop.md](./hadoop.md)、[mapreduce.md](./mapreduce.md)、[spark.md](./spark.md)、[flink.md](./flink.md)、[doris.md](./doris.md)、[database.md](./database.md)