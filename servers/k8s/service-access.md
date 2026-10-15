# K8s 里服务之间怎么互相访问

一句话：在 K8s 里，服务 A 想调用服务 B，**不写 IP，写名字** —— 靠 DNS 把名字翻译成 Service 的门牌，再由 Service 转给某个活着的 Pod。

这背后要解决两个问题：**「怎么找到对方」**和**「找到之后能不能通」**。前者靠 Service + DNS，后者靠 NetworkPolicy 等限制。最后再聊**跨集群**（多个 K8s 集群之间）怎么打通。

> 本篇和 [k8s.md](./k8s.md) 配套看：那篇讲 K8s 整体怎么用，这篇专讲「网络访问」这一块。

## 先理清三个角色

| 角色 | 白话 | 类比 |
|------|------|------|
| Pod | 真正干活的程序实例，IP 会变 | 一个工位上的员工，今天坐这明天可能换 |
| Service | 给一组 Pod 一个固定名字 + 固定 IP，自动转发 | 公司前台总机，永远能转到「今天在岗」的人 |
| DNS（CoreDNS） | 把「名字」翻译成 Service 的 IP | 114 查号台，问「web 服务电话多少」 |

关键认知：**Pod 的 IP 是会变的**（重启、扩缩容、换节点都会变），所以服务间绝对不能靠记 Pod IP 来访问。Service 的存在就是为了给你一个**不变的名字**。

## 同集群内：服务怎么找到彼此

### 默认方式：Service 名 + DNS

假设你部署了一个 `web` 服务和一个 `api` 服务，各自配了 Service：

```bash
[ web Pod ] ──调用──> [ api Service ] ──转发──> [ api Pod ]
            写 "api"          固定 IP            真正干活
```

`web` 调用 `api` 时，直接用**名字**当主机名：

```bash
curl http://api            # 同命名空间里，直接写 Service 名
curl http://api.default    # 跨命名空间，带上命名空间名
curl http://api.default.svc.cluster.local   # 完整域名（最保险）
```

这三种写法是**同一个东西的短/中/长写法**，CoreDNS 都能解析。日常同命名空间内用最短的就够了。

**域名规则**：`<Service名>.<命名空间>.svc.cluster.local`

- `cluster.local` 是集群内部的固定后缀，不用管。
- 真正有用的是前两段：**Service 名 + 命名空间名**。
- 跨命名空间访问时（比如 `prod` 里的服务要调 `monitoring` 里的），必须带上命名空间名，写成 `api.monitoring`。

### DNS 是谁在跑

集群里有一个叫 **CoreDNS** 的 Pod（在 `kube-system` 命名空间），专门干「名字 → Service IP」的翻译。你 Pod 里之所以能 `curl http://api` 就通，是因为 K8s 给每个 Pod 的 `/etc/resolv.conf` 自动配好了，让它去找 CoreDNS。

```bash
kubectl get pods -n kube-system | grep dns   # 能看到 coredns 在跑
```

> 排查「名字连不上」的第一步：进 Pod `cat /etc/resolv.conf` 看 DNS 指没指对，再 `nslookup api` 看能不能解析出来。

### Service 的三种类型（决定谁能访问到）

| 类型 | 谁能访问 | 典型场景 |
|------|---------|---------|
| `ClusterIP`（默认） | **只有集群内部**能访问 | 服务间互相调用 —— 90% 都是这个 |
| `NodePort` | 集群外也能访问（通过节点 IP + 一个高位端口） | 临时从外面调试 |
| `LoadBalancer` | 云厂商给一个公网 IP | 对外暴露服务（要云环境支持） |

**重点：服务间互调用 `ClusterIP` 就够了，它是「集群内部专用门牌」。** 不要为了图省事全开 NodePort —— 那等于把内网服务暴露到节点上，是安全隐患。

### 一种特殊情况：Headless Service（无头服务）

普通 Service 会给你一个虚拟 IP 当中转。但有时你想**直接拿到每个 Pod 的 IP**（比如数据库主从，你得明确连「主」而不是随便连一个），这时给 Service 加一句 `clusterIP: None`：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: db
spec:
  clusterIP: None      # 关键：不要虚拟 IP
  selector:
    app: mysql
  ports:
    - port: 3306
```

这种叫 **Headless Service**。它不给你中转 IP，而是**DNS 查询时直接返回所有 Pod 的 IP 列表**。配合 StatefulSet 用，每个 Pod 还能有稳定名字（`db-0`、`db-1`），可以精确连到某一个。

> 一句话区分：普通 Service = 「找前台总机帮我转一个」；Headless Service = 「给我所有分机号，我自己挑一个拨」。

## 访问集群外的服务

服务要调外部的东西（比如云上的 MySQL、第三方 API），怎么办？

- **直接写外部 IP / 域名**：`curl https://api.example.com`，和普通程序一样，不用特殊配置。
- **想用一个集群内部名字统一管理**：建一个**没有 selector 的 Service** + 手动写一个 Endpoints 指向外部 IP。这样集群里就能用 `mysql` 这个名字访问外部数据库，将来外部 IP 变了只改 Endpoints，调用方无感。

> 日常小项目直接写外部域名最简单；当外部依赖多、想统一治理时再上第二种。

## 有哪些限制（重点）

K8s 网络默认是**「大通铺」**：同集群里任何 Pod 都能访问任何 Pod，不设防。这在多团队、多环境的集群里很危险 —— 一个被入侵的 Pod 能直接摸到数据库。所以生产环境一定要加限制。

### ① NetworkPolicy：Pod 级防火墙

这是控制「哪些 Pod 能访问哪些 Pod」的核心手段。详细的写法和示例见 [k8s.md 里的 NetworkPolicy 章节](./k8s.md#网络策略-networkpolicy)，这里只讲它对**服务间访问**的影响。

核心规则一句话：**没被任何策略选中的 Pod 默认「全通」；一旦被选中，在指定方向上立刻变成「先拒绝、再按规则放行」。**

典型用法：

```yaml
# 数据库只允许 web 命名空间访问 3306 端口
spec:
  podSelector:
    matchLabels: { app: mysql }   # 保护数据库
  policyTypes: [ Ingress ]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels: { kubernetes.io/metadata.name: web }
      ports:
        - port: 3306
```

加上这条之后，除了 `web` 命名空间里的 Pod，谁都连不上数据库的 3306。

**服务间访问被限制时最常见的两个坑：**

- **DNS 忘了放行**：一旦你限制了某个 Pod 的**出站（Egress）**，DNS 请求也算出站流量，忘了放行 `kube-system` 的 CoreDNS（53 端口）会导致「名字都解析不了，看似策略写错其实是 DNS 被挡了」。
- **命名空间标签写错**：`namespaceSelector` 用的是命名空间的**标签**，不是名字。要用内置标签 `kubernetes.io/metadata.name`（值就是命名空间名）才稳。

### ② 命名空间：逻辑分组，不是安全边界

命名空间能把服务分组（`prod` / `dev` / `monitoring`），方便管理和配额，**但它本身不隔离网络**。`dev` 里的 Pod 默认照样能 `curl prod` 里的 Service。

要真隔离，得配合 NetworkPolicy 用，别以为「放在不同命名空间」就安全了。

### ③ 资源与配额限制

服务间访问除了「通不通」，还有「跑不跑得动」的限制：

- **ResourceQuota**：限制一个命名空间最多用多少 CPU / 内存 / Pod 数，防止一个团队把集群吃满。
- **LimitRange**：限制单个 Pod 的资源上下限，防止有人忘了写 `resources` 把节点挤爆。

这些不直接挡流量，但会影响服务能不能起来、起来后稳不稳定。

## 跨集群：多个 K8s 集群之间怎么互访

当一个公司有多个 K8s 集群（比如「生产集群」和「灾备集群」、「国内集群」和「海外集群」），集群之间的服务怎么互相访问？复杂度明显上升，因为没有现成的「集群间 DNS」。

先说一个前提：**跨集群访问通常不是初学者的需求**，先把单集群搞熟。这里介绍几种主流思路，从简单到复杂：

### 思路一：通过 Ingress / 网关走公网或专线（最简单）

把对方集群的服务用 Ingress 暴露成一个 URL，本集群的服务当成普通外部地址来调：

```bash
[ 集群A 的 web ] ──curl https://api.cluster-b.com──> [ 集群B 的 Ingress ] ──> [ api Pod ]
```

- **优点**：简单，不引入新组件，两个集群各自独立。
- **缺点**：流量出集群再进来，有性能损耗；要走公网的话有安全和延迟问题（可用专线 / VPN 缓解）；对方服务得在 Ingress 上暴露，不是「集群内直连」。

### 思路二：Service Mesh（服务网格，如 Istio）

用 Istio 这类网格把多个集群的「服务发现」打通，让你在集群 A 里像调本地服务一样调集群 B 的服务（`curl http://api` 就连到 B 去了）。

```bash
集群A                              集群B
[ web Pod + sidecar ] ──────────> [ api Pod + sidecar ]
        网格控制平面统一管理两边服务的「名字→位置」映射
```

- **优点**：调用方无感，统一治理（流量、熔断、加密都在网格里做）。
- **缺点**：引入 sidecar 增加复杂度和资源开销；多集群 Istio 的安装和配置门槛高，适合较大团队。

### 思路三：Multi-Cluster Services（MCS，官方标准）

K8s 官方推的一个规范（KEP-1645）：扩展 Service 和 DNS，让一个 Service 能跨越多个集群，名字解析时自动返回其它集群里的端点。

```bash
kubectl get serviceexports  # 把本集群服务「导出」给多集群
kubectl get serviceimports  # 导入别的集群的服务，本地就能用名字访问
```

- **优点**：官方标准，和原生 Service / DNS 体验一致，不需要 sidecar。
- **缺点**：还在演进中，各发行版支持程度不一；需要集群间网络互通打底。

### 思路四：多集群网关（Multi-Cluster Gateway）

用专门的跨集群网关（如 Gateway API + 多集群实现）统一管理多个集群的流量入口，按策略路由到不同集群。

适合「按地域就近访问」「灰度分流到不同集群」这类场景。

### 怎么选（一张表）

| 场景 | 推荐 |
|------|------|
| 两三个集群、调用简单、能接受绕公网/专线 | **思路一 Ingress**（先这么干，别过度设计） |
| 集群多、服务多、需要统一流量治理和加密 | **思路二 Service Mesh（Istio）** |
| 想要原生体验、追求标准化、能等生态成熟 | **思路三 MCS** |
| 按地域分流、多活/灾备 | **思路四 多集群网关** |

> 不管哪种思路，跨集群的**前提都是网络要先打通**（专线、VPN、Mesh 的东西向网关等）。DNS 能解析、网络能到达，服务才能通，顺序不能反。

## 小结

- **同集群内**：服务间靠 **Service 名 + DNS** 互访，不写 IP；跨命名空间带上命名空间名（`api.monitoring`）。
- **Service 类型**：服务间互调用默认的 `ClusterIP` 就够；Headless Service 用在需要直连每个 Pod 的场景（如数据库主从）。
- **限制**：默认网络是「大通铺」，生产必加 **NetworkPolicy** 上锁再开洞；命名空间只分组不隔离；别忘了出站限制要给 **DNS 留口子**。
- **跨集群**：从简单到复杂依次是 Ingress 走网关、Service Mesh、MCS、多集群网关；**先把单集群网络彻底搞懂再碰跨集群**，且任何方案的前提都是底层网络先打通。

**一句话记忆：集群内写名字不写 IP，默认不设防要靠 NetworkPolicy 上锁，跨集群先通网络再谈方案。**
