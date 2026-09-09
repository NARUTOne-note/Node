# RocketMQ

> RocketMQ 是阿里巴巴开源、后捐给 Apache 的分布式**消息中间件**——你可以把它想成一个**很稳、很能扛、还自带"生意人逻辑"的快递分拣中心**：发件人（生产者）把包裹丢到分拣中心（Broker），中心按地址（Topic/Tag）分拣好，收件人（消费者）按自己的节奏来取，丢了能补、顺序也能保证。

和 Kafka 一样能扛高吞吐，但比 Kafka 多了一堆**业务向**的开箱功能：事务消息、定时/延迟消息、顺序消息、消息轨迹与回溯——做电商起家的，天然懂"下单、扣库存、发券"这类场景。

## 基本介绍

类比：把 RocketMQ 想成**快递分拣中心**。包裹（消息）进中心后按"目的地 + 类别"（Topic + Tag）分拣，分到哪条传送带（Queue）就按先后顺序送出。普通包裹走普通带，VIP 包裹还能走"定时送达"或"保顺序"的专用带。包裹送出去还能留签收记录（消息轨迹），随时能查。

**核心特征：**

- **高吞吐 + 低延迟** —— 单机十万级消息/秒，延迟毫秒级，扛得住大流量
- **业务功能全** —— 自带事务消息、延迟消息、顺序消息、死信队列，做业务不用自己造轮子
- **可靠不丢** —— 同步/异步刷盘 + 主从复制，主挂了能从从切换，消息不丢
- **消息可追溯** —— 能查一条消息"谁发的、什么时候发、被谁消费了、消费了几次"
- **水平扩展** —— 加 Broker 节点即可扩容，Topic 的 Queue 分散到多机上并行

## 核心概念

- **NameServer**：轻量的"地址簿"服务。Broker 启动时把自己的信息登记上去，生产者/消费者找它问"某个 Topic 在哪几台 Broker 上"。比 ZooKeeper 简单，多台 NameServer 互相不通信、各自独立，挂一台不影响。
- **Broker**：真正存消息、转发消息的服务器。分主（Master）从（Slave），主负责写，从负责备份。
- **Topic**：消息的一级分类，类似"频道"。生产者往 Topic 发，消费者订阅 Topic。
- **Tag**：Topic 下的二级分类，类似频道里的"子栏目"。一条消息可以带 Tag，消费者可以只订阅自己关心的 Tag。
- **Queue（队列）**：一个 Topic 在一台 Broker 上分成多个 Queue，类似"传送带"。Queue 是真正的消息存储和并行单元。
- **Producer（生产者）**：发消息的一方。分同步发送、异步发送、单向（oneway）三种方式。
- **Consumer（消费者）**：取消息的一方。按消费组（Consumer Group）组织，组内分摊消费。
- **消费模式**：集群（CLUSTERING，组内每条消息只被一个消费者消费，最常用）和广播（BROADCASTING，组内每个消费者都消费全量）。

```
              注册/心跳             Producer
Producer ────┐                   ───┐
             │                      │
        ┌────▼────┐  问地址   ┌─────▼─────┐
        │NameServer│<─────────│  Producer  │
        └────┬────┘          └─────┬─────┘
             │ 注册/心跳            │ 发消息
        ┌────▼──────────────────────▼────┐
        │         Broker (Master)         │
        │  TopicA ─┬─ Queue0 ─ Queue1      │
        │          └─ Tag: order/pay      │
        │         TopicB ─ ...            │
        └────────────┬───────────────────┘
                     │ 取消息
              ┌──────▼──────┐
              │ Consumer组  │ (集群模式：Queue 分摊给组内各消费者)
              └─────────────┘
```

## 基本使用

### 前置 / 安装

```bash
# 用 docker 起一个 NameServer + 一个 Broker（快速体验）
# 1. NameServer
docker run -d --name rmqnamesrv -p 9876:9876 \
  apache/rocketmq:5.3.1 sh mqnamesrv

# 2. Broker（指向上面 NameServer 的地址）
docker run -d --name rmqbroker --link rmqnamesrv:namesrv \
  -p 10911:10911 -p 10909:10909 \
  -e "NAMESRV_ADDR=namesrv:9876" \
  apache/rocketmq:5.3.1 sh mqbroker
```

### 最小示例

进入 Broker 容器，用自带命令行先发后收：

```bash
# 生产者：往 TopicTest 发一条消息
docker exec -it rmqbroker sh -c \
  'sh /home/rocketmq/rocketmq-5.3.1/bin/tools.sh \
   org.apache.rocketmq.example.quickstart.Producer TopicTest'

# 消费者：另开窗口，订阅 TopicTest 收消息
docker exec -it rmqbroker sh -c \
  'sh /home/rocketmq/rocketmq-5.3.1/bin/tools.sh \
   org.apache.rocketmq.example.quickstart.Consumer TopicTest'
```

Node 客户端发消息（用官方 `rocketmq-client-nodejs` 或社区 `rocketmq-nodejs-sdk`，这里以通用写法示意）：

```js
const { Producer, Message } = require('rocketmq-client-nodejs')

const producer = new Producer({
  nameServerAddress: '127.0.0.1:9876',
  groupName: 'demo-group',
})
await producer.start()

// 发一条普通消息：指定 Topic + 消息体 + Tag
await producer.send(
  new Message('TopicTest', 'TagA', 'hello from node')
)
```

### 常用参数

| 名称 | 作用 | 默认 / 示例 |
|------|------|-------------|
| `NAMESRV_ADDR` | NameServer 地址，生产者/消费者靠它找 Broker | `127.0.0.1:9876` |
| `groupName` | 生产/消费组名，同组内做负载均衡 | `demo-group` |
| `sendMessageTimeout` | 发送超时 | `3000`（ms） |
| `messageDelayLevel` | 延迟消息的延迟级别（内置档位） | `1s 5s 10s 30s ...` |
| `maxReconsumeTimes` | 消费失败最多重试次数 | `16` |
| `messageModel` | 消费模式：集群 / 广播 | `CLUSTERING` |

### 常见场景

- **事务消息**：下单 → 扣库存 → 发消息，要保证"本地事务成功消息一定发出去"。用 RocketMQ 的半消息（half message）+ 回查机制，比手写"先写库再发 MQ 查补"更稳。
- **延迟消息**：下单 30 分钟未支付自动取消、预约任务到点执行。直接设延迟级别，不用自己起定时扫库。
- **顺序消息**：同一个订单的"创建→支付→发货"必须按顺序处理。把同一订单号的消息路由到同一个 Queue，Queue 内天然有序。
- **削峰填谷**：秒杀请求先进 RocketMQ，下游按能力消费，保护数据库。

## 小结

- RocketMQ 的核心是 **NameServer 寻址 + Broker 主从 + Queue 并行**，扛得住高吞吐，又自带事务/延迟/顺序等业务功能。
- 和 Kafka 比：吞吐略低但业务功能更全，事务消息、延迟消息、消息轨迹开箱即用；和 RabbitMQ 比：路由规则没那么花，但吞吐和可靠性更强、更适合大流量业务。
- 什么时候不该用：消息量小、需要极复杂的路由规则（如按 key 模糊匹配多路分发）——RabbitMQ 更灵活；纯海量日志/埋点流式消费、要长时间回放——Kafka 更对口。
