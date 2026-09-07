# Kafka

> Kafka 是一个分布式**事件流（event streaming）**平台——你可以把它想成一个**超长、可回放、按顺序追加的"公共账本"**：谁都能往里写（生产者），谁都能订阅着读（消费者），写进去的东西按顺序排好，还能保存好几天。

LinkedIn 开发，后来捐给 Apache。和 RabbitMQ 的"取走即删"不同，Kafka 的消息**像日志一样存着**，可以反复回放、被多个消费者各读各的。

## 基本介绍

类比：把 Kafka 想成**电视台的录像带库**。节目（消息）按时间顺序录到带子上，观众（消费者）可以实时看直播，也可以以后倒带重看，不同观众各看各的进度，互不影响。

**核心特征：**

- **高吞吐** —— 单机就能扛住百万级消息/秒，适合日志、埋点这类海量数据
- **持久化 + 可回放** —— 消息写到磁盘日志，按"留存期"保留（默认 7 天），消费者能反复读
- **分区有序** —— 一个 Topic 分成多个 Partition，单分区内消息严格有序，分区之间可并行
- **消费组** —— 同一消费组内每个分区只被一个消费者消费，天然负载均衡
- **分布式易扩展** —— 加 Broker、加分区即可横向扩容

## 核心概念

- **Broker**：一个 Kafka 服务器节点。多个 Broker 组成集群。
- **Topic**：消息的分类/主题，类似"频道"。生产者往 Topic 发，消费者从 Topic 订。
- **Partition（分区）**：一个 Topic 切成多个分区，分散到不同 Broker 上。每个分区是一个**有序的、不可变的追加日志**。
- **Offset（位移）**：消息在分区里的序号。消费者靠记录 offset 知道"自己读到哪了"。
- **Producer（生产者）**：发消息的一方，指定发到哪个 Topic、哪个分区。
- **Consumer Group（消费组）**：一组消费者共同消费一个 Topic，组内分区不重复消费。
- **Replication（副本）**：每个分区有多份副本，一主（Leader）多从（Follower），挂了能切。

```
Producer ──发──> Topic (3 个分区)
                   ├─ Partition 0: [msg0, msg1, msg2, ...]   ──> 消费者A
                   ├─ Partition 1: [msg0, msg1, msg2, ...]   ──> 消费者B
                   └─ Partition 2: [msg0, msg1, msg2, ...]   ──> 消费者C
                 (每个分区内有序，整体并行)
```

## 基本使用

### 前置 / 安装

```bash
# docker 一键起 kafka（含 KRaft 模式，无需单独 ZooKeeper）
docker run -d --name kafka -p 9092:9092 \
  -e KAFKA_NODE_ID=1 \
  -e KAFKA_PROCESS_ROLES=broker,controller \
  -e KAFKA_LISTENERS=PLAINTEXT://:9092 \
  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092 \
  -e KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:9093 \
  -e KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:9092 \
  -e KAFKA_INTER_BROKER_LISTENER_NAME=PLAINTEXT \
  -e KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER \
  -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
  -e CLUSTER_ID=MkU3OEVCNTcwNJA5OEE3NQ \
  confluentinc/confluent-local
```

### 最小示例

进入容器，用自带命令行先建主题、再生产消费：

```bash
# 建一个叫 test 的 topic，1 个分区 1 个副本
docker exec -it kafka kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic test --partitions 1 --replication-factor 1

# 生产者：发几条消息
docker exec -it kafka kafka-console-producer \
  --bootstrap-server localhost:9092 --topic test
> hello
> kafka

# 消费者：另开窗口，从头读
docker exec -it kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 --topic test --from-beginning
```

Node 客户端发消息（用 `kafkajs`）：

```js
const { Kafka } = require('kafkajs')
const kafka = new Kafka({ clientId: 'demo', brokers: ['localhost:9092'] })
const producer = kafka.producer()
await producer.connect()
await producer.send({ topic: 'test', messages: [{ value: 'hello from node' }] })
```

### 常用参数

| 名称 | 作用 | 默认 / 示例 |
|------|------|-------------|
| `partitions` | Topic 分几个区，决定并行度 | `1`（吞吐大时调大） |
| `replication-factor` | 每个分区几份副本，决定容错 | `1`（生产环境 ≥3） |
| `acks` | 生产者要几个副本确认才算成功 | `all`（最安全）/ `1` |
| `retention.ms` | 消息保留多久后自动删 | `168h`（7 天） |
| `auto.offset.reset` | 消费者找不到位移时从哪读 | `earliest` / `latest` |

### 常见场景

- **日志/埋点收集**：各服务把日志发到 Kafka，下游消费写库或做流计算。吞吐高、可重放。
- **事件溯源**：业务事件先落 Kafka，再异步更新数据库，可随时回放重建状态。
- **削峰缓冲**：秒杀/大促的请求先进 Kafka，下游按能力消费，保护数据库。

## 小结

- Kafka 的核心是**顺序追加日志 + 分区并行 + 消费组**：用"存日志可回放"换来了超高吞吐和并行。
- 和 RabbitMQ 比：Kafka 不擅长复杂路由，但吞吐和可回放强；消息通常按留存期自然过期，不是取走就删。
- 什么时候不该用：消息量小、需要复杂路由分发、消息取走即删的传统任务队列场景——RabbitMQ 更合适。
