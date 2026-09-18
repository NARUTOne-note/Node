# MapReduce

> Hadoop 的第一代分布式计算模型，2004 年 Google 论文的开源实现。一句话：**把一个大任务拆成很多小任务，分发到多台机器上并行执行，再把结果汇总回来（分而治之）**。
>
> 今天它基本已退出生产一线（被 [Spark](./spark.md) 取代），但**它定义的「Map → Shuffle → Reduce」范式，是理解所有分布式计算引擎的钥匙**：Spark 的 shuffle、Flink 的 keyBy、Hive 的 JOIN 与 GROUP BY，底层都是这套思想的变体。
>
> 相关：[hadoop.md](./hadoop.md)（HDFS / YARN 底座）、[hive.md](./hive.md)（SQL 翻译成 MR）、[spark.md](./spark.md)（取代者）、[flink.md](./flink.md)、[database.md](./database.md)

## 一、背景与要解决的问题

### 背景

HDFS 让「存得下」有了答案——把上千台机器的磁盘拼成一个逻辑上近乎无限大的文件系统。但紧接着新的问题就来了：**数据分散在几百台机器上，怎么算？**

最朴素的做法是把数据全拉到一台机器上算，但 1 TB 数据跨网络搬一遍要几小时，单机内存也根本装不下。**存储方式变了，计算方式就必须跟着变**——这是 MapReduce 诞生的直接原因。

### 要解决的问题

| 问题 | 之前怎么做 | 为什么失效 |
| --- | --- | --- |
| **数据分散在几百台机器上** | 把数据集中到一台机器再计算 | 网络传输比本地磁盘慢几个数量级，1 TB 搬一次就是几小时 |
| **单机算不动全量数据** | 优化算法、加内存、换更强的 CPU | 全量扫描是 I/O 密集型，单机 I/O 有硬上限 |
| **故障是常态** | 出错就人工介入、整体重跑 | 几百台机器并行时，几乎每次作业都有节点出问题 |
| **并行程序难写** | 手写多线程 / MPI 程序 | 同步、容错、分发、重试全要自己实现，极易出错 |

### 它给出的答案

**分而治之 + 移动计算而非移动数据**：把一个任务切成互不依赖的小任务，分发到数据所在的节点并行执行，再把结果汇总；并行、分发、容错、重试全部由框架承担，程序员只写两段业务逻辑。下面展开这套思想的两个支点，以及它带来的设计取舍。

### 分而治之（Divide and Conquer）

单机处理 1 TB 数据要几小时，但如果切成 1000 份放到 1000 台机器上并行处理，理论上只要几分钟——**MapReduce 就是把「切分 → 并行 → 汇总」这套流程框架化**，让程序员只写两段业务逻辑，并行、容错、分发、重试全部由框架承担。

### 移动计算而非移动数据

**把计算程序发送到数据所在的节点执行，而不是把数据拉到程序所在的地方。**

在 Hadoop 里这个信条尤其重要：1 TB 数据跨网络传输要很久，而把几百 KB 的 jar 包分发到各节点几乎瞬间完成。每个 map 任务**优先调度到它要读的那个数据块所在的 DataNode**（数据本地性 / Data Locality），大部分读操作是本地的。

### 四个关键设计取舍

| 取舍 | 代价 | 收益 |
| --- | --- | --- |
| **中间结果落盘** | 慢（磁盘 I/O 是瓶颈） | 简单可靠的容错，任务失败重跑即可 |
| **无共享（shared-nothing）并行** | 无法做全局状态、迭代算法低效 | 线性扩展，加机器就加算力 |
| **批处理、有界数据** | 无法做实时流计算 | 吞吐量极高 |
| **面向高吞吐而非低延迟** | 分钟级起步 | 处理 PB 级数据的唯一现实方案 |

## 二、编程模型

### 两段式的世界

```text
输入数据（HDFS）
    │  ① 切分成多个 Split（默认与 HDFS Block 对齐，128MB）
    ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Map Task │  │ Map Task │  │ Map Task │   ② 每个 Split 一个 Map 任务，
│  (K1,V1) │  │          │  │          │      相互独立并行执行
│    ↓     │  │    ↓     │  │    ↓     │
│  (K2,V2) │  │  (K2,V2) │  │  (K2,V2) │      输出写本地磁盘（不是 HDFS！）
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │
     └──────③ Shuffle（按 Key 分区、排序、拉取、归并）──────┐
                  │                                      │
        ┌─────────▼─────────┐                  ┌─────────▼─────────┐
        │    Reduce Task    │                  │    Reduce Task    │
        │  按 Key 聚合/计算   │                  │                   │
        │      ↓  (K3,V3)   │                  │      ↓            │
        └─────────┬─────────┘                  └─────────┬─────────┘
                  │                                      │
                  └──────────────┬───────────────────────┘
                                 ▼
                          输出结果（HDFS）
```

### 四个泛型参数

```java
map(K1, V1) -> List<(K2, V2)>          // 一条输入记录 → 零到多条中间记录
reduce(K2, List<V2>) -> List<(K3, V3)> // 同一 Key 的所有 Value → 零到多条结果
```

以 WordCount 为例：`map` 把每行拆成 `(单词, 1)`；shuffle 把同一个单词的所有 `1` 送到同一个 reduce；`reduce` 把它们求和成 `(单词, 总数)`。

> **两个铁律**：
> 1. **Map 与 Reduce 之间只能通过 Key-Value 传递**——没有共享内存、没有全局变量。
> 2. **同一个 Key 一定进同一个 Reduce**——这是所有聚合、JOIN 能正确工作的前提。

### WordCount 示例（Java）

```java
import java.io.IOException;
import java.util.StringTokenizer;
import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.Path;
import org.apache.hadoop.io.IntWritable;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Job;
import org.apache.hadoop.mapreduce.Mapper;
import org.apache.hadoop.mapreduce.Reducer;
import org.apache.hadoop.mapreduce.lib.input.FileInputFormat;
import org.apache.hadoop.mapreduce.lib.output.FileOutputFormat;

public class WordCount {

  // Map：每一行 → 若干 (word, 1)
  public static class TokenizerMapper extends Mapper<Object, Text, Text, IntWritable> {
    private final static IntWritable one = new IntWritable(1);
    private Text word = new Text();

    @Override
    public void map(Object key, Text value, Context context)
        throws IOException, InterruptedException {
      StringTokenizer itr = new StringTokenizer(value.toString());
      while (itr.hasMoreTokens()) {
        word.set(itr.nextToken());
        context.write(word, one);       // 不是把结果 return，而是「发射」到 context
      }
    }
  }

  // Reduce：同一个 word 的所有 1 → 求和
  public static class IntSumReducer extends Reducer<Text, IntWritable, Text, IntWritable> {
    private IntWritable result = new IntWritable();

    @Override
    public void reduce(Text key, Iterable<IntWritable> values, Context context)
        throws IOException, InterruptedException {
      int sum = 0;
      for (IntWritable val : values) sum += val.get();
      result.set(sum);
      context.write(key, result);
    }
  }

  public static void main(String[] args) throws Exception {
    Configuration conf = new Configuration();
    Job job = Job.getInstance(conf, "word count");
    job.setJarByClass(WordCount.class);            // 打成 jar 提交，框架负责分发
    job.setMapperClass(TokenizerMapper.class);
    job.setCombinerClass(IntSumReducer.class);     // 关键优化：Map 端先本地聚合
    job.setReducerClass(IntSumReducer.class);
    job.setOutputKeyClass(Text.class);
    job.setOutputValueClass(IntWritable.class);
    FileInputFormat.addInputPath(job, new Path(args[0]));
    FileOutputFormat.setOutputPath(job, new Path(args[1]));   // 输出目录必须不存在
    System.exit(job.waitForCompletion(true) ? 0 : 1);
  }
}
```

跑起来：

```bash
# 编译打包
javac -classpath $(hadoop classpath) -d classes WordCount.java
jar -cvf wordcount.jar -C classes .

# 提交到 YARN
hadoop jar wordcount.jar WordCount /input /output

# 查看结果
hdfs dfs -cat /output/part-r-00000
```

**为什么是 Writable 而不是 Java 原生类型？** `IntWritable`、`Text` 是对 `int`/`String` 的封装，实现了 **序列化接口（Writable）与比较接口（WritableComparable）**。框架要在节点间传输和排序这些对象，原生 Java 序列化太重（带类信息、反射），自定义二进制格式更快更紧凑。

### Hadoop Streaming：用任何语言写 MR

不写 Java 也能用，通过标准输入输出约定：**每行一条记录，key 和 value 用 `\t` 分隔**。

```python
# mapper.py
import sys
for line in sys.stdin:
    for word in line.strip().split():
        print(f"{word}\t1")
```

```python
# reducer.py —— 注意：输入已按 key 排序，所以可以「遇到新 key 就输出上一个」
import sys

cur_word, cur_count = None, 0
for line in sys.stdin:
    word, count = line.strip().split("\t", 1)
    if word == cur_word:
        cur_count += int(count)
    else:
        if cur_word is not None:
            print(f"{cur_word}\t{cur_count}")
        cur_word, cur_count = word, int(count)
if cur_word is not None:
    print(f"{cur_word}\t{cur_count}")
```

```bash
hadoop jar $HADOOP_HOME/share/hadoop/tools/lib/hadoop-streaming-3.3.6.jar \
  -D mapreduce.job.reduces=2 \
  -files mapper.py,reducer.py \
  -mapper "python3 mapper.py" \
  -reducer "python3 reducer.py" \
  -input /input -output /output
```

**Streaming 的两个坑**：① reducer 必须**自己假设输入已排序**并按「key 变化」分组输出，而不是自己聚合成 map；② 调试时可以直接 `cat input | python3 mapper.py | sort | python3 reducer.py` 在本地跑通逻辑，这是最快验证方式。

## 三、执行流程详解

一次完整的 MR 作业包含这些阶段：

```text
① InputFormat → getSplits()       切分输入，一个 Split 一个 Map Task
② RecordReader                    把 Split 解析成 (K1,V1) 记录流（默认按行）
③ map()                           每条记录调用一次
④ 环形缓冲区（Map 端）             写内存，满 80% 溢写
⑤ Partition + Sort（溢写时）       按 reduce 分区，分区内按 Key 排序
⑥ Spill 落盘 + 最终 Merge          多个溢写文件归并成一个有序大文件
⑦ Reduce 端 Fetch（Shuffle）       从所有 Map 拉取属于自己分区的数据
⑧ Merge Sort + Group              归并排序，相同 Key 的 Value 归成一组
⑨ reduce()                        每个 Key 调用一次
⑩ OutputFormat / RecordWriter      写出结果（默认每 reducer 一个 part-r-xxxxx 文件）
```

### 各阶段的关键组件

| 组件 | 作用 | 默认实现 / 可定制点 |
| --- | --- | --- |
| **InputFormat** | 决定「怎么切分」和「怎么读」 | `TextInputFormat`（按行）；`KeyValueTextInputFormat`、`NLineInputFormat`、`CombineFileInputFormat`（治小文件） |
| **RecordReader** | 把 Split 读成 K-V 记录 | `LineRecordReader` |
| **Partitioner** | 决定一条中间记录去哪个 Reduce | `HashPartitioner`：`(key.hashCode() & Integer.MAX_VALUE) % numReduceTasks` |
| **Combiner** | **Map 端本地预聚合**，减少 Shuffle 数据量 | 通常直接复用 Reducer 类 |
| **Sort Comparator** | 决定 Key 的排序顺序（影响 Reduce 接收顺序） | Key 的 `compareTo` |
| **Grouping Comparator** | 决定「哪些 Key 算同一组、进同一次 `reduce()` 调用」 | 默认与排序比较器相同；**二次排序**就是把它改成只比部分字段 |
| **OutputFormat** | 决定结果怎么写 | `TextOutputFormat`（`key\tvalue`）、`SequenceFileOutputFormat` |

### Combiner：最划算的优化

Combiner 在 **Map 端溢写前**做一次本地聚合，把 `(hello,1),(hello,1),(hello,1)` 先合成 `(hello,3)` 再发给 Reducer。

- 网络传输量可降低几个数量级（WordCount 场景通常减少 80%+）。
- **数学要求**：Combiner 的操作必须满足**交换律与结合律**。
  - ✅ 求和、求最大/最小值、计数
  - ❌ **求平均值**（`avg(1,2,3) ≠ avg(avg(1,2),3)`），求平均要用 `(sum, count)` 对来传递
- Combiner **不保证一定被调用**（可能执行 0 次、1 次或多次），所以**它只能优化性能，不能影响正确性**。

### Reducer 数量

- 默认 **1 个**（`mapreduce.job.reduces`）。这是新手最常见的性能事故：数据再大也只有一个 reducetask 在跑。
- 经验值：`0.95 × 节点数 × 每节点最大容器数`（经验公式），或按数据量估算（每个 reduce 处理 1~5 GB）。
- **设为 0 表示不需要 Reduce 阶段**（纯 map 作业，如 ETL 清洗过滤）。
- **结果文件数 = reduce 任务数**，多个 reduce 会产出多个 `part-r-xxxxx`，下游要注意这点（Hive 里常见「小文件过多」就与此有关）。

## 四、Shuffle 详解（性能核心）

**Shuffle 是 MapReduce 的性能瓶颈所在**——它涉及磁盘 I/O、网络传输、排序，且必须等所有 Map 完成才能开始 Reduce。

### Map 端

```text
map() 输出 ──▶ 环形缓冲区（默认 100MB，mapreduce.task.io.sort.mb）
                    │ 达到 80%（mapreduce.map.sort.spill.percent）触发溢写
                    ▼
              【溢写线程】先按 Partition 分区，分区内按 Key 排序
                    ▼
              写到本地磁盘（临时文件，后缀 .spill）
                    │ 多个溢写文件
                    ▼
              【归并】把多个 spill 文件合并成一个
              （每次同时归并 mapreduce.task.io.sort.factor 个，默认 10）
                    ▼
              最终一个「已分区、区内有序」的大文件
```

要点：

1. **中间结果写本地磁盘，不写 HDFS**——因为是临时数据，丢了重算即可，写 HDFS 反而慢。
2. **排序在 Map 端就发生了**，这是 Reduce 能拿到「按 Key 有序」数据的前提。
3. 缓冲区越大、溢写越少，Shuffle 越快（但占内存），调优时常调大 `io.sort.mb`。
4. **Map 完成后不会立刻释放**，要等 Reduce 把数据拉走（这就是为什么 Reduce 慢会拖住整个作业）。

### Reduce 端

```text
① Copy/Fetch：从所有已完成 Map 的 NodeManager 拉取属于自己分区的数据
               （默认并行 5 个线程，mapreduce.reduce.shuffle.parallelcopies）
② Merge：先写内存缓冲区，满了落盘，最终把内存与磁盘的多份数据归并排序
③ Group：相同 Key 的 Value 聚合成一个 Iterable（供 reduce 的第二个参数使用）
④ reduce()：每个 Key 调用一次；这里「所有 Value 都在内存里」是错觉——
           大 Key 场景下框架会边归并边喂给你，避免 OOM
```

**Shuffle 阶段的耗时通常占整个作业的 60%~80%**，所以所有 MR 优化本质上都在做两件事：**减少 Shuffle 数据量**、**让 Shuffle 分布均匀**。

## 五、数据倾斜

**现象**：绝大多数 Reduce 任务几秒跑完，只有一两个跑了几个小时，整个作业被拖住。

**原因**：某个 Key 的数据量远超其他 Key（如按「省份」分组但 80% 数据来自同一个省；或 JOIN 时某个热点 ID）。

**排查**：看 JobHistory（19888 端口）各 reduce 的耗时对比，或看 Counter 中 `Reduce shuffle bytes` 的分布。

**解法**：

| 方法 | 说明 |
| --- | --- |
| **Combiners** | Map 端先聚合，减少热点 Key 的传输量 |
| **加盐打散 + 两阶段聚合** | 给热点 Key 加随机前缀 `key_1`、`key_2`… 分散到多个 Reduce 做局部聚合，再起第二个作业去掉前缀做全局聚合 |
| **自定义 Partitioner** | 按业务规则把热点 Key 单独拆开，而不是用 `hash % n` |
| **增大 Reduce 数** | 缓解但不治本，热点 Key 依然只进一个 Reduce |
| **Map-Side Join** | 小表广播到每个 Map 节点（`DistributedCache`），在 Map 端完成关联，**彻底避开 Shuffle** |
| **对大 Key 单独处理** | 把热点 Key 的数据单独捞出来用别的链路算，结果再合并 |

> **JOIN 的两种实现**尤其值得记：**Reduce-Side Join**（通用，两个表都按 join key 分区 shuffle，大表对大表）vs **Map-Side Join**（一个小表足够放进内存时，广播小表到每个 Map，效率高得多）。这个思路在 Spark 的 `broadcast join` 里完全一致。

## 六、优化清单

| 方向 | 手段 |
| --- | --- |
| **减少数据量** | 用 **Combiner**；Map 端尽早过滤（能少读就少读）；用压缩（中间结果压缩 `mapreduce.map.output.compress=true` + Snappy）；列式格式（Parquet/ORC）代替 Text |
| **减少 Shuffle** | **Map-Side Join** 替代 Reduce-Side Join；合理的 Partition；避免不必要的全局排序 |
| **调大内存相关参数** | `mapreduce.task.io.sort.mb`（缓冲区）、`mapreduce.map.java.opts` / `mapreduce.reduce.java.opts`（JVM 堆）、`mapreduce.reduce.shuffle.parallelcopies`（拉取并发） |
| **治小文件** | 输入用 `CombineFileInputFormat` 合并小文件；输出用 `mapreduce.job.jvm.numtasks` 复用 JVM；Hive 侧用 `hive.merge.*` |
| **输出格式** | 用 `SequenceFile` / `Parquet` 而非文本，体积小、可切分、下游读得快 |
| **推测执行** | 允许框架为慢任务启动备份任务（`mapreduce.map.speculative` / `mapreduce.reduce.speculative`，不同发行版默认值不同，以集群 `mapred-default.xml` 为准）。**注意**：非幂等的任务（会重复写外部系统）必须关掉，否则会重复写数据 |
| **JVM 复用** | 每个任务启一个 JVM 开销大，`mapreduce.job.jvm.numtasks` 可让一个 JVM 顺序跑多个任务 |

## 七、局限与「为什么被 Spark 取代」

| MapReduce 的问题 | Spark 的答案 |
| --- | --- |
| **中间结果写磁盘**：迭代算法（机器学习、图计算）每一步都要落盘，慢得离谱 | 内存计算 + DAG 优化，中间结果尽量留在内存，**快 10~100 倍** |
| **算子太少**：只有 Map 和 Reduce 两个原语，复杂逻辑要拆成串行的多个 Job | 几十个算子（filter/map/flatMap/join/groupBy/window…），一个 Job 内用 DAG 表达 |
| **调度开销大**：每个 Job 都要重启一轮 Map/Reduce | DAG 一次规划，任务间流水线执行 |
| **API 笨重**：Java 手写，Streaming 性能差 | DataFrame / SQL / Python / Scala，表达能力与性能兼顾 |
| **不适合交互式与流处理** | Spark SQL 秒级交互、Structured Streaming 微批流处理 |

**那还有用吗？有。** 三个理由：

1. **理解范式的钥匙**：Spark 的 `groupByKey`、Flink 的 `keyBy`、Hive 的 `DISTINCT`，底层都是 Map→Shuffle→Reduce。
2. **存量系统**：大量老作业（尤其银行、运营商）仍在跑 MR，能看懂才敢动。
3. **轻量场景够用**：一个简单的清洗/统计任务，写一个 MR 比搭 Spark 环境更省事。
4. **DistCp**：`hadoop distcp` 至今仍是集群间/与对象存储之间搬数据最靠谱的工具，而它就是基于 MR 实现的。

## 八、作业提交与调试

```bash
# 提交作业
hadoop jar myjob.jar com.example.Main -D mapreduce.job.reduces=10 /in /out

# 查看运行中的应用
yarn application -list
yarn application -status application_1234_0001

# 拉取日志（跨节点聚合，最实用）
yarn logs -applicationId application_1234_0001

# 历史作业（JobHistory Server，Web 19888）
mapred job -list all
mapred job -history /path/to/jobhistory/file

# 本地模式调试（不走 YARN，直接在本地跑，断点友好）
# 用 mapred-site.xml 的 mapreduce.framework.name=local
# 或在 IDE 里给 Configuration 设：
#   conf.set("mapreduce.framework.name", "local");
#   conf.set("fs.defaultFS", "file:///");
```

**用 Counter 做监控**：框架自带 `Map input records`、`HDFS bytes read`、`Spilled Records`、`Reduce shuffle bytes` 等计数器，自定义 `context.getCounter("MyGroup", "BadRows").increment(1)` 可以统计脏数据——**这是 MR 时代最好用的调试手段，至今仍是排查数据质量问题的第一现场**。

## 九、核心要点速记

1. **MapReduce 的本质 = 分而治之 + 移动计算而非移动数据**。
2. **模型只有两个原语**：`map` 打散成 KV，`reduce` 把同 Key 的 Value 聚合，中间靠 **Shuffle** 连接。
3. **同一个 Key 必然进同一个 Reduce**——这是所有聚合与 JOIN 正确性的根基（也是数据倾斜的根源）。
4. **中间结果写本地磁盘**，输入输出在 HDFS；Shuffle 是性能瓶颈（占 60%~80% 耗时）。
5. **Combiner 是最划算的优化**，但要求操作满足交换律与结合律，且不保证被调用。
6. **Reduce 数默认 1**，不改就是性能事故。
7. **数据倾斜的两大解法**：加盐两阶段聚合、Map-Side Join。
8. **写 MR 的功夫，80% 花在减少 Shuffle 上**。
9. 它已被 Spark 取代，但**「Map → Shuffle → Reduce」的思维范式永不过时**。

## 参考资料

- [Apache Hadoop MapReduce 官方文档](https://hadoop.apache.org/docs/current/hadoop-mapreduce-client/hadoop-mapreduce-client-core/MapReduceTutorial.html)
- Google 论文：*MapReduce: Simplified Data Processing on Large Clusters*（2004）
- 《Hadoop 权威指南》（Tom White）第 2、6、7 章
- 本仓库相关笔记：[hadoop.md](./hadoop.md)、[hive.md](./hive.md)、[spark.md](./spark.md)、[flink.md](./flink.md)、[doris.md](./doris.md)、[database.md](./database.md)