# ELK Stack 介绍 · 日志分析三件套

> E = Elasticsearch · L = Logstash · K = Kibana —— 把散落各处的日志，变成能搜、能看、能告警的仪表盘。

**一句话理解**：ELK 像一座**图书馆**。**Logstash** 是分拣员（把乱糟糟的日志整理好），**Elasticsearch** 是带秒级搜索的图书库（存起来、随时查），**Kibana** 是阅览室的大屏（把数据画成图表给你看）。

数据流：`数据源 → Beats → Logstash → Elasticsearch → Kibana → 用户`

---

## 一、是什么 · What

| 组件 | 角色 | 类比 |
|------|------|------|
| **E**lasticsearch | 搜索引擎，负责存和查 | 带秒级搜索的图书库 |
| **L**ogstash | 数据处理管道，负责收和洗 | 分拣员把书编目 |
| **K**ibana | 可视化界面，负责看和告警 | 阅览室的大屏 |
| **B**eats | 轻量采集器，装在各服务器上抓日志 | 各库房送书的快递员 |

- 加上 **Beats** 合称 **Elastic Stack**
- 全部开源，由 Elastic 公司维护

## 二、怎么工作 · How

1、采集：Beats 装在各服务器上抓日志
2、清洗：Logstash 解析、过滤、补字段
3、存储：Elasticsearch 建索引、分布式存
4、可视化：Kibana 画图、搜索、配告警

数据单向流动：左 → 右，四步流水线。

## 三、为什么用 · Why

- 日志分散在几十上百台机器，`grep` 查不动
- ES 秒级全文搜索 + 聚合统计
- Kibana 拖拽出图表，不用写代码
- 典型场景：线上排障、安全审计、业务监控
- 替代方案：Loki、Splunk、OpenSearch

---

## 四、如何使用

### PART 1 · 五分钟跑起来

最快的方式：用 docker-compose 一键起一套 ELK。学习足够，生产再补 Logstash/Beats。

```yaml
# docker-compose.yml —— 一键启动 ELK（学习版：ES + Kibana）
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.13.0
    environment:
      - discovery.type=single-node       # 单机模式，免集群
      - xpack.security.enabled=false     # 学习关掉安全
      - ES_JAVA_OPTS=-Xms512m -Xmx512m   # 控内存
    ports: ["9200:9200"]

  kibana:
    image: docker.elastic.co/kibana/kibana:8.13.0
    ports: ["5601:5601"]
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on: [elasticsearch]
```

```bash
# 1. 启动
docker compose up -d

# 2. 等 30 秒，确认 ES 起来了（看到 "You Know, for Search"）
curl http://localhost:9200

# 3. 打开浏览器访问 Kibana
#    http://localhost:5601
```

> 💡 **端口速记**：ES = `9200`（存数据、接查询），Kibana = `5601`（你看的网页），Logstash = `5044`（接 Beats 的口）。

### PART 2 · 怎么往里塞一条日志

ES 把每条数据叫一个**文档 document**，同类文档放一起叫一个**索引 index**（相当于数据库的表）。

```bash
# 用 curl 写一条日志进 ES
curl -X POST "http://localhost:9200/app-logs/_doc" -H "Content-Type: application/json" -d '
{
  "time":   "2026-10-15T10:30:00Z",
  "level":  "ERROR",
  "service":"order-service",
  "msg":    "支付超时，订单 #8821"
}'
# 返回 {"_index":"app-logs", "_id":"abc123", "result":"created"}
```

> 📚 **类比数据库**：索引 index ≈ 表，文档 document ≈ 表里一行，字段 field ≈ 列。区别是 ES 每个字段都建了倒排索引，所以全文搜索飞快。

### PART 3 · Kibana 界面三步走

打开 Kibana 网页后，95% 的日常就这三件事：

1. **🔍 Discover · 搜日志** — 左侧菜单 `Discover`，选索引，输入框写查询条件，下面按时间倒序看每条日志原文。排查"某条报错是什么时候、哪台机器"就在这。
2. **📊 Dashboard · 看图表** — 左侧 `Dashboard`，把搜索结果画成柱状/饼/折线图，拖拽组合成大屏。比如"每天 ERROR 数趋势""各服务错误占比"。
3. **🚨 Alerts · 配告警** — 左侧 `Alerts`，设规则："ERROR 次数 > 100 就发飞书/钉钉"。不用写定时脚本，ES 自己盯着数据。

### PART 4 · 怎么搜 · KQL 查询语法

Kibana 搜索框里用的是 **KQL**（Kibana Query Language），接近自然语言：

```text
-- 1. 全文搜：含"支付"的日志
支付

-- 2. 字段搜：level 是 ERROR 的
level: ERROR

-- 3. 多条件 AND / OR
level: ERROR AND service: "order-service"

-- 4. 范围：响应时间大于 1000ms
duration > 1000

-- 5. 通配符：所有 service 以 order 开头
service: order*

-- 6. 取反 NOT
NOT level: INFO
```

对应的 REST API（程序里调用，Query DSL 是 JSON）：

```bash
# 用 _search 端点查询，body 是 Query DSL
curl -X GET "http://localhost:9200/app-logs/_search" -H "Content-Type: application/json" -d '
{
  "query": {
    "bool": {
      "must": [
        { "match": { "level":   "ERROR" } },
        { "match": { "service": "order-service" } }
      ]
    }
  },
  "size": 20
}'
```

> 🔑 **一句话区分**：**KQL** 是给人在 Kibana 搜索框敲的（简写好记）；**Query DSL** 是给程序发 HTTP 请求用的（JSON 完整）。结果一样。

#### KQL 进阶

```text
-- 7. 分组括号（优先级）
(level: ERROR OR level: WARN) AND service: "order-service"

-- 8. 字段是否存在：有 duration 字段的
duration: *

-- 9. 字段不存在
NOT duration: *

-- 10. 日期范围（Kibana 自动转成时间过滤）
@timestamp: "2026-10-01" TO "2026-10-15"

-- 11. 数值范围闭区间
duration: [1000 TO 5000]

-- 12. 多值 OR 简写
level: (ERROR OR WARN OR FATAL)
```

#### Query DSL 常用查询速查

```bash
# —— 精确匹配 term（不分词，适合 keyword / 数值 / 布尔）
curl -X POST "localhost:9200/app-logs/_search" -H "Content-Type: application/json" -d '
{ "query": { "term": { "level": { "value": "ERROR" } } } }'

# —— 全文匹配 match（会分词，适合 text 长文本）
{ "query": { "match": { "msg": "支付超时" } } }

# —— 短语匹配 match_phrase（词序必须连在一起）
{ "query": { "match_phrase": { "msg": "支付超时" } } }

# —— 多字段匹配 multi_match（msg 或 service 里都找）
{ "query": { "multi_match": { "query": "order", "fields": ["msg", "service"] } } }

# —— 范围 range（gt/gte/lt/lte）
{ "query": { "range": { "duration": { "gte": 1000, "lte": 5000 } } } }

# —— 日期范围
{ "query": { "range": { "@timestamp": { "gte": "now-1h", "lte": "now" } } } }

# —— 字段存在 exists
{ "query": { "exists": { "field": "duration" } } }

# —— 前缀 / 通配 / 正则
{ "query": { "prefix":  { "service": "order" } } }
{ "query": { "wildcard": { "service": { "value": "order*" } } } }
{ "query": { "regexp":  { "service": "order.*" } } }

# —— bool 组合：must(且) / should(或) / must_not(非) / filter(且但不计分)
{ "query": { "bool": {
    "must":     [ { "match": { "level": "ERROR" } } ],
    "filter":   [ { "range": { "duration": { "gte": 1000 } } } ],
    "must_not": [ { "match": { "service": "test" } } ],
    "should":   [ { "match": { "msg": "timeout" } } ]
} } }
```

#### Query DSL 聚合 · 分组统计

```bash
# —— 按服务名分组，每组统计条数（类似 SQL GROUP BY + COUNT）
curl -X POST "localhost:9200/app-logs/_search" -H "Content-Type: application/json" -d '
{ "size": 0,
  "aggs": { "by_service": { "terms": { "field": "service", "size": 10 } } } }'

# —— 按 level 分组求平均响应时间
{ "size": 0,
  "aggs": {
    "by_level": {
      "terms": { "field": "level" },
      "aggs": { "avg_dur": { "avg": { "field": "duration" } } }
    }
  }}

# —— 按时间分桶（每 1 小时一桶，画趋势图用）
{ "size": 0,
  "aggs": {
    "timeline": { "date_histogram": { "field": "@timestamp", "fixed_interval": "1h" } }
  }}

# —— 同时算最大 / 最小 / 求和
{ "size": 0,
  "aggs": {
    "max_dur":  { "max":  { "field": "duration" } },
    "min_dur":  { "min":  { "field": "duration" } },
    "sum_dur":  { "sum":  { "field": "duration" } }
  }}
```

#### 排序 / 分页 / 裁剪字段 / 高亮

```bash
# —— 排序 + 分页（from/size，深分页用 search_after）
curl -X POST "localhost:9200/app-logs/_search" -H "Content-Type: application/json" -d '
{ "query": { "match_all": {} },
  "sort": [ { "@timestamp": "desc" }, { "duration": "desc" } ],
  "from": 0, "size": 20 }'

# —— 只返回指定字段（_source 裁剪，省网络）
{ "query": { "term": { "level": "ERROR" } },
  "_source": ["@timestamp", "service", "msg"] }

# —— 关键词高亮（结果里给命中词包 <em>）
{ "query": { "match": { "msg": "支付" } },
  "highlight": { "fields": { "msg": {} } } }

# —— 只数条数，不返回正文
curl -X POST "localhost:9200/app-logs/_count" -H "Content-Type: application/json" -d '
{ "query": { "term": { "level": "ERROR" } } }'
```

> 💡 **选择小抄**：精确值（枚举/数值/布尔）用 `term`；长文本搜索用 `match`；要词序用 `match_phrase`；过滤条件不计相关性用 `bool.filter`；分组统计用 `aggs`。深分页（>1 万条）改用 `search_after` 或滚动，别硬翻 `from/size`。

### PART 5 · 接上真实日志 · Logstash + Beats

真实场景：应用日志写在文件里，要让它**自动流**进 ES。

```yaml
# filebeat.yml —— 盯着日志文件，往 Logstash 推（装在应用服务器上）
filebeat.inputs:
- type: log
  paths:
    - /var/log/myapp/*.log       # 要采集的日志路径

output.logstash:
  hosts: ["logstash:5044"]       # 推给 Logstash 清洗
```

```text
# logstash.conf —— 三段式：输入 → 过滤 → 输出
input {
  beats { port => 5044 }                  # 接 Filebeat
}

filter {
  grok {
    match => { "message" => "%{TIMESTAMP_ISO8601:time} %{LOGLEVEL:level} %{GREEDYDATA:msg}" }
    # 把一行文本日志拆成 time / level / msg 三个字段
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "app-logs"                   # 写进哪个索引
  }
}
```

> 🌊 **完整数据流**：应用写文件 → `Filebeat` 读文件 → `Logstash` 拆字段清洗 → `Elasticsearch` 存索引 → `Kibana` 搜/画/告警。

### PART 6 · 日常运维 · 常用命令

```bash
# 集群健康（green / yellow / red）
curl localhost:9200/_cluster/health

# 列出所有索引（看存了哪些"表"）
curl localhost:9200/_cat/indices?v

# 看某索引的文档总数
curl localhost:9200/app-logs/_count

# 按 ID 取一条
curl localhost:9200/app-logs/_doc/abc123

# 删一个索引（慎用，数据会没）
curl -X DELETE localhost:9200/app-logs
```

---

## 五、关键概念速查

### Elasticsearch 核心词

| 概念 | 含义 |
|------|------|
| 文档 document | 一条数据，JSON |
| 索引 index | 文档集合，≈ 表 |
| 分片 shard | 索引切块，分到多台 |
| 副本 replica | 分片的备份 |
| 倒排索引 | 搜得快的核心机制 |

### Logstash 三段

- `input` — 从哪收（file/beats）
- `filter` — 怎么洗（grok 拆字段）
- `output` — 送到哪（→ ES）

### Kibana 三件

- `Discover` — 搜日志原文
- `Dashboard` — 组合图表大屏
- `Alerts` — 规则触发告警
- `Dev Tools` — 调试 DSL 控制台

---

## 六、生产注意

1. 开启 `xpack.security`，设密码
2. ES 是吃内存大户：JVM 堆别超物理内存 50%、别超 31GB
3. 用 **ILM**（Index Lifecycle Management）策略自动老化/删除旧索引，否则磁盘会爆
4. 重要索引配分片 + 副本，防节点挂掉丢数据

---

> 图解版见同目录 [`elk.html`](./elk.html)，含可视化流水线图与导出 PNG/PDF。
