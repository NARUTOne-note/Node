# redis

> REmote DIctionary Server(Redis) 是一个由 Salvatore Sanfilippo 写的 key-value 存储系统，是跨平台的非关系型数据库。

[redis 官网](https://redis.io/)

Redis 通常被称为数据结构服务器，因为值（value）可以是字符串(String)、哈希(Hash)、列表(list)、集合(sets)和有序集合(sorted sets)、地图空间、流、位图等类型。常用于缓存、消息队列、会话存储等应用场景。

- **性能极高**：支持每秒数十万次高并发的读写操作，在需要快速响应的场景中，如缓存、会话管理、排行榜等
- **丰富的数据类型**：包括字符串、列表、集合、哈希表、有序集合等
- **原子性操作**：意味着操作要么完全执行，要么完全不执行。对于确保数据的一致性和完整性至关重要。
- **持久化**：可以将内存中的数据保存到磁盘中，以便在系统重启后恢复数据
- **支持发布/订阅模式**：内置了发布/订阅模式（Pub/Sub），允许客户端之间通过消息传递进行通信
- **单线程模型**：通过高效的事件驱动模型来处理并发请求，确保了高性能和低延迟
- **主从复制**：可以通过从节点来备份数据或分担读请求，提高数据的可用性和系统的伸缩性
- **应用场景广泛**：包括但不限于缓存系统、会话存储、排行榜、实时分析、地理空间数据索引等
- **社区支持**：跃的开发者社区，提供了大量的文档、教程和第三方库
- **跨平台兼容性**：可以在多种操作系统上运行，包括 Linux、macOS 和 Windows，灵活部署。

## 准备

- [redis window install](https://github.com/redis-windows/redis-windows/releases)

1、cmd 进入 redis 目录
2、使用环境变量，添加redis目录，则可以使用redis-cli 命令了

```bash
# 进入目录，powershell 不需要 /d
cd [/d] D:\lib\Redis-8.6.2-Windows-x64-msys2
# 手动启动服务端
redis-server.exe redis.conf

# 安装的  server 版本的redis，管理员运行 powershell 后台服务运行
redis-server --service-install redis.conf --loglevel verbose
redis-server --service-start

# docker 安装 redis
docker run -d -p 6379:6379 --name my-redis redis

# 另打开一个cmd 窗口，启动redis客户端，本地主机，端口 6379
redis-cli.exe -h 127.0.0.1 -p 6379
# 远程redis链接
# redis-cli -h host -p port -a password
# 这是连接成功后，设置键值对
SET keyxx abc

# 创建、修改用户密码
# ACL SETUSER <用户名> <规则列表...>
ACL SETUSER alice on >pwd123 ~* +@all
```

**redis-cli 命令**：

| 参数类别 | 参数示例 | 说明 |
| --- | --- | --- |
| 🔌 连接与控制 | `-h 127.0.0.1` | 指定服务器主机地址 |
| 🔌 连接与控制 | `-p 6379` | 指定服务器端口 |
| 🔌 连接与控制 | `-a password` | 密码认证（安全性不如环境变量） |
| 🔌 连接与控制 | `-n 1` | 选择数据库编号（0-15） |
| 🔌 连接与控制 | `-u redis://user:pass@host:port` | 使用 URI 格式进行连接 |
| ⚙️ 执行模式 | `-r 10` | 重复执行命令 10 次 |
| ⚙️ 执行模式 | `-i 1` | 每次执行间隔 1 秒 |
| ⚙️ 执行模式 | `-x` | 从标准输入读取最后一个参数 |
| ⚙️ 执行模式 | `-c` | 开启集群模式 |
| ⚙️ 执行模式 | `--eval script.lua` | 执行一个 Lua 脚本 |

**常用 ACL 规则**
你可以组合使用下面的规则来定义用户的权限：

| 规则示例 | 说明 |
| --- | --- |
| on / off | 启用/禁用该用户（创建的用户默认为 off 状态，无法登录） |
| >密码 | 为用户添加一个新密码（例如 >my_password）。该指令会同时移除 nopass（无密码）状态 |
| ~* | 允许访问所有 Key |
| ~cached:* | 只允许访问前缀为 cached: 的 Key |
| +@all | 允许执行所有命令 |
| +get +set | 只允许执行 get 和 set 命令 |
| -@dangerous | 禁止执行危险命令（如 FLUSHALL、CONFIG 等） |

## 命令

[redis 命令](https://redis.io/docs/latest/commands/)

- SET [key] [value] 设置键值对
- DEL [key] 删除键
- GET [key] 获取键值
- DUMP [key] 序列化键
- EXISTS [key] 检查键存在
- EXPIRE key seconds 设置过期时间
- EXPIREAT key timestamp 设置过期时间（时间戳）
- PEXPIRE key milliseconds 设置过期时间（毫秒）
- PEXPIREAT key milliseconds-timestamp 设置 key 过期时间的时间戳(unix timestamp) 以毫秒计
- KEYS pattern 查找所有符合给定模式( pattern)的 key 
- MOVE key db 将当前数据库的 key 移动到给定的数据库 db 当中
- PERSIST key 移除 key 的过期时间，key 将持久保持
- PTTL key 以毫秒为单位返回 key 的剩余的过期时间
- TTL key 以秒为单位，返回给定 key 的剩余生存时间(TTL, time to live)
- RANDOMKEY 从当前数据库中随机返回一个 key
- RENAME key newkey 重命名
- RENAMENX key newkey 仅当 newkey 不存在时，将 key 改名为 newkey 
- TYPE key 返回 key 所储存的值的类型
- SCAN cursor [MATCH pattern] [COUNT count] 迭代数据库中的数据库键

| 选项 | 描述 | 默认值 |
| --- | --- | --- |
| -h | 指定服务器主机名 | 127.0.0.1 |
| -p | 指定服务器端口 | 6379 |
| -s | 指定服务器 socket | |
| -c | 指定并发连接数 | 50 |
| -n | 指定请求数 | 10000 |
| -d | 以字节的形式指定 SET/GET 值的数据大小 | 2 |
| -k | 1=keep alive 0=reconnect | 1 |
| -r | SET/GET/INCR 使用随机 key, SADD 使用随机值 | |
| -P | 通过管道传输 `<numreq>` 请求 | 1 |
| -q | 强制退出 redis。仅显示 query/sec 值 | |
| --csv | 以 CSV 格式输出 | |
| -l（L 的小写字母） | 生成循环，永久执行测试 | |
| -t | 仅运行以逗号分隔的测试命令列表。 | |
| -I（i 的大写字母） | Idle 模式。仅打开 N 个 idle 连接并等待。 | |

### 有序集合 ZSET

- ZADD：往集合中添加成员
- ZREM：从集合中删除成员
- ZCARD：集合中的成员个数
- ZSCORE：某个成员的分数
- ZINCRBY：增加某个成员的分数
- ZRANK：成员在集合中的排名
- ZRANGE：打印某个范围内的成员
- ZRANGESTORE：某个范围内的成员，放入新集合
- ZCOUNT：集合中分数在某个返回的成员个数
- ZDIFF：打印两个集合的差集
- ZDIFFSTORE：两个集合的差集，放入新集合
- ZINTER：打印两个集合的交集
- ZINTERSTORE：两个集合的交集，放入新集合
- ZINTERCARD：两个集合的交集的成员个数
- ZUNION：打印两个集合的并集
- ZUNIONSTORE：两个集合的并集，放回新集合

## redis insight

> 官方一个Redis可视化工具，提供设计、开发和优化 Redis 应用程序的功能

- [redis insight 可视化](https://redis.io/insight/)