# Pulsar

> Pulsar 是一个分布式**发布-订阅消息 + 事件流**平台——你可以把它想成**"邮局 + 仓库分家"**：前台（Broker）只管收发，后台（BookKeeper）专门存东西。两边分开扩容，谁忙加谁。

Yahoo 开发，后捐给 Apache。它最大的特点是**计算与存储分离**，同时支持传统的队列模型和流式消费模型，原生多租户。

## 基本介绍

类比：RabbitMQ/Kafka 里"收发的柜台"和"存东西的仓库"是挤在一起的；Pulsar 把它们**拆开**——Broker 是无状态的柜台，BookKeeper 是专门的仓库。柜台坏了换一个就行（无状态），仓库可以单独加机器扩容。

**核心特征：**

- **存算分离** —— Broker 只做收发（无状态），消息存到 BookKeeper；扩容 Broker 不影响存储，反之亦然
- **同时支持队列 + 流** —— 用 `Shared` 订阅模式像 RabbitMQ 队列（取走即处理），用 `Failover`/`Exclusive` 像 Kafka 消费组（按序消费），用 `Key_Shared` 还能保证同 key 有序
- **原生多租户** —— Tenant（租户）→ Namespace（命名空间）→ Topic 三级结构，天然隔离
- **高吞吐 + 低延迟** —— 吞吐接近 Kafka，延迟也够低
- **消息可回放** —— 和 Kafka 一样靠 offset/游标，支持按时间或位置重放
- **跨地域复制** —— 内置 Geo-Replication，多机房消息可自动同步

## 核心概念

- **Producer（生产者）**：发消息到 Topic。
- **Topic**：消息主题。完整名形如 `persistent://租户/命名空间/主题名`。
- **Broker**：无状态的服务节点，负责接收和转发消息，不持久化存消息。
- **BookKeeper / Bookie**：专门的存储节点，消息以 ledger 形式分散写到多个 Bookie 上，多副本。
- **订阅模式（Subscription）**——同一 Topic 用不同模式消费，效果完全不同：
  - `Exclusive`：一个订阅只有一个消费者，独占（像 Kafka 单消费者）。
  - `Shared`：多个消费者共享，消息随机分发，取走即处理（像 RabbitMQ 工作队列）。
  - `Failover`：主备，主挂了备顶上。
  - `Key_Shared`：共享但保证同一 key 的消息总到同一消费者，既有并行又有 key 内有序。
- **Cursor（游标）**：记录消费进度（类似 Kafka 的 offset），存在 BookKeeper 里，不依赖 Broker。

```
Producer ──发──> Broker (无状态，只收发) ──存──> BookKeeper 集群 (多副本持久化)
                       │
                       └──按订阅模式分发──> Consumers
                          (Exclusive / Shared / Failover / Key_Shared)
```

## 基本使用

### 前置 / 安装

```bash
# docker 起一个本地 Pulsar standalone（自带 BookKeeper）
docker run -d -p 6650:6650 -p 8080:8080 \
  --name pulsar apachepulsar/pulsar:latest \
  bin/pulsar standalone
```

### 最小示例

用自带 CLI 先生产再消费：

```bash
# 生产一条消息到默认租户的 topic
docker exec -it pulsar bin/pulsar-client produce \
  my-topic --messages "hello pulsar"

# 消费（订阅名 my-sub，从头读）
docker exec -it pulsar bin/pulsar-client consume \
  my-topic -s my-sub --from-earliest
```

Node 客户端发消息（用 `pulsar-client`）：

```js
const Pulsar = require('pulsar-client')
const client = new Pulsar.Client({ serviceUrl: 'pulsar://localhost:6650' })
const producer = await client.createProducer({ topic: 'my-topic' })
await producer.send({ data: Buffer.from('hello from node') })
await producer.close()
await client.close()
```

### 常用参数

| 名称 | 作用 | 默认 / 示例 |
|------|------|-------------|
| `topic` | 完整主题名 | `persistent://public/default/my-topic` |
| `subscription` | 订阅名 + 模式 | `my-sub` / `Shared` |
| `retention` | 消息保留策略 | 默认按容量淘汰 |
| `ackTimeout` | 消费者多久没确认就重发 | `10s` |
| `numPartitions` | 分区数（分区 Topic 时） | `1`（吞吐大时调大） |

### 常见场景

- **多业务线共享一套 MQ**：多租户天然隔离，不同团队不同 tenant/namespace，互不影响。
- **既要队列又要流**：同一个 Topic，秒杀用 Shared 削峰，分析用 Failover 顺序消费，模式一改即可。
- **跨机房容灾**：Geo-Replication 把 A 机房消息复制到 B 机房，A 整个挂了 B 还能消费。

## 小结

- Pulsar 的核心是**存算分离 + 多订阅模式 + 原生多租户**：把存和算拆开换来了灵活扩展，把订阅模式做丰富让它既能当队列又能当流。
- 和 Kafka 比：扩展更平滑（Broker 无状态随便加），消费模型更灵活（Shared 模式 Kafka 没有），多租户原生支持；但生态和成熟度不如 Kafka。
- 和 RabbitMQ 比：吞吐高得多，但路由规则没 RabbitMQ 的 Exchange 那么细。
- 什么时候不该用：团队小、消息量一般、只需要简单队列分发——RabbitMQ 上手更快；纯日志高吞吐且生态要成熟——Kafka 更稳。
