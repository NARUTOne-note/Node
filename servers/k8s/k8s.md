# Kubernetes（K8s）怎么用

一句话：K8s 是一套帮你「自动管理一堆机器上跑的程序」的系统 —— 你只说「我要 3 个副本」，它负责找机器、启动容器、挂了重启、忙了扩容。你不再需要自己 SSH 到服务器上敲启动命令。

它和 Docker 是**上下游关系，不是竞品**：Docker 负责把程序装进盒子（镜像），K8s 负责把盒子安排到一堆机器上跑。详见下文[「它和 Docker 是什么关系」](#它和-docker-是什么关系)。

## 基本介绍

把它想成一个**自动化码头**：你交一张托运单（YAML），码头自己决定用哪个泊位（节点）、派几个箱子（Pod）、箱子破了自己换一个，你只关心「我的货在不在、跑得怎么样」。

**核心特征：**

- **声明式** —— 你写「我想要什么」（要 3 个 nginx），而不是「怎么做」（在哪台机器上执行哪条命令）。系统自己想办法对齐。
- **自愈** —— 程序崩了自动重启，机器挂了把 Pod 挪到别的机器上重开。不需要人半夜起来处理。
- **滚动更新与回滚** —— 换新版本时一个个替换，全部成功才继续；发现不对一条命令回滚到上个版本。
- **弹性伸缩** —— 忙的时候把副本数从 3 调到 10，闲的时候调回来，一条命令的事。
- **一切皆对象** —— Pod、Deployment、Service、ConfigMap…… 全都是「资源」，用同一套 `kubectl` 命令读写。

三个最常打交道的对象：

| 对象 | 白话解释 | 类比 |
|------|---------|------|
| Pod | 最小的运行单元，里面装 1 个或多个容器 | 一个「包裹」，里面可以有多个「物品」 |
| Deployment | 声明副本数量，负责维持 Pod 一直达标 | 运单：「这个箱子要 3 份」 |
| Service | 给一组随时会变的 Pod 一个固定门牌 | 前台总机号码，永远能转到活着的分机 |

### 它和 Docker 是什么关系

**一句话：不是二选一，是上下游 —— Docker 把程序装进盒子，K8s 把盒子安排到一堆机器上。**

| 问题 | Docker（单机） | K8s（集群） |
|------|---------------|-------------|
| 程序怎么打包 | `docker build` 打成镜像 | 不管 |
| 镜像从哪来 | `docker push` 推到仓库 | 让 kubelet 从仓库 `pull` 下来 |
| 跑几个 | `docker run` 手动起一个 | 声明 `replicas: 3`，自动维持 3 个 |
| 挂了怎么办 | 手动重启 | 自动重启；机器挂了换台机器重开 |
| 一台机器装不下 | 自己想办法 | 自动调度到别的节点 |
| 对外提供服务 | `-p 8080:80` 映射端口 | Service / Ingress |
| 扩到 10 个 | 手敲 10 次 `docker run` | `kubectl scale --replicas=10` |

**三个容易搞混的点：**

- **容器到底是谁在跑**：Docker 内部是 `dockerd → containerd → runc` 三层；K8s 节点上的 `kubelet` 直接调用 containerd（K8s 从 1.24 起默认运行时就是 containerd）。所以「K8s 弃用 Docker」指的是弃用 `dockershim` 这层适配器，**不是不能跑 Docker 做的镜像** —— 镜像照跑，只是不再套 dockerd 这个壳。
- **镜像通用**：都遵守 OCI 标准。你本地 `docker build` 出来的镜像，push 到仓库后 K8s 直接拿来用，不需要重新打包。
- **compose 和 K8s 的分工**：`docker compose` 是「单机版编排」（一份 YAML 在一台机器上起一组容器），K8s 是「集群版编排」（多机、自愈、滚动更新、弹性伸缩）。本地开发用 compose、生产用 K8s，是很常见的组合。

一句话记忆：**Docker 是装货工，K8s 是码头调度中心。**

## 基本使用

### 前置 / 安装

本地练手不需要真集群，先装一个单机版：

```bash
# 方式一：minikube（需要先装 Docker 或 VirtualBox）
brew install minikube        # macOS
choco install minikube       # Windows（或直接下载 exe）
minikube start               # 启动一个本地的单节点集群

# 方式二：kind（用 Docker 跑集群，更轻）
brew install kind
kind create cluster --name demo
```

`kubectl` 是操作集群的命令行工具，必须装：

```bash
brew install kubectl         # macOS
choco install kubernetes-cli # Windows
```

检查是否连上集群：

```bash
kubectl cluster-info
kubectl get nodes            # 应该能看到节点，状态 Ready
```

> 用 Docker Desktop 的话，在设置里勾选 Kubernetes 就能得到同样的本地集群，最省事。

### 最小示例

这段做什么：声明「我要 3 个 nginx 副本」，再用 Service 把它们暴露出来。

```yaml
# web.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3                # 我要 3 个副本
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.27
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web                 # 找到带 app=web 标签的 Pod
  ports:
    - port: 80
      targetPort: 80
```

```bash
kubectl apply -f web.yaml    # 提交托运单，剩下的交给 K8s
kubectl get pods             # 看到 3 个 Running
kubectl get deploy,svc       # 看部署和门牌
```

> 想跑你自己的程序？先在本地 `docker build -t <仓库>/web:v1 .` 打成镜像、`docker push` 推上去，再把 YAML 里的 `image:` 换成 `<仓库>/web:v1` —— **K8s 只负责拉镜像，不关心镜像是谁做的**。

想从浏览器访问本地集群里的服务：

```bash
kubectl port-forward svc/web 8080:80
# 然后打开 http://localhost:8080
```

### 常用命令

| 命令 | 作用 | 示例 |
|------|------|------|
| `kubectl apply -f <file>` | 提交/更新一份 YAML | `kubectl apply -f web.yaml` |
| `kubectl get <资源>` | 列出资源（最常用） | `kubectl get pods -o wide` |
| `kubectl describe <资源> <名>` | 看详情，**排查问题的第一步** | `kubectl describe pod web-abc123` |
| `kubectl logs <pod>` | 看容器输出 | `kubectl logs -f web-abc123` |
| `kubectl exec -it <pod> -- sh` | 进容器里看看 | `kubectl exec -it web-abc123 -- sh` |
| `kubectl scale` | 改副本数 | `kubectl scale deploy/web --replicas=5` |
| `kubectl set image` | 换镜像（触发滚动更新） | `kubectl set image deploy/web web=nginx:1.28` |
| `kubectl rollout status/history/undo` | 看更新进度 / 历史 / 回滚 | `kubectl rollout undo deploy/web` |
| `kubectl delete -f <file>` | 删除 YAML 里定义的资源 | `kubectl delete -f web.yaml` |
| `kubectl get events --sort-by=.lastTimestamp` | 看最近发生了什么 | 排查「Pod 一直 Pending」 |

### 常见场景

- **部署一个新服务**：写 Deployment + Service 两个对象，`kubectl apply -f` 一次提交。
- **临时多开几个副本扛住流量**：`kubectl scale deploy/web --replicas=10`，用完调回去。
- **发新版发现有问题**：`kubectl set image deploy/web web=nginx:1.28` → 观察 `kubectl rollout status deploy/web` → 不对就 `kubectl rollout undo deploy/web`。
- **Pod 起不来想看原因**：`kubectl get pods` 看到状态不对 → `kubectl describe pod <名>` 看 Events（镜像拉不到？资源不够？）→ `kubectl logs <名>` 看程序日志。
- **进容器排查网络/配置**：`kubectl exec -it <pod> -- sh`，进去用 `curl`、`env`、`cat` 检查。
- **存放配置和密码**：配置用 ConfigMap、密码用 Secret 挂进 Pod，不要把配置硬写进镜像。

## 网络策略 NetworkPolicy

Pod 级别的防火墙，用来控制哪些 Pod/命名空间/IP 可以访问哪些 Pod 的哪些端口。

默认情况下，K8s 集群的网络是**「大通铺」**：同一个集群里，任何 Pod 都能访问任何 Pod，不需要开口子。这在多团队、多环境的集群里很危险 —— 一个被入侵的 Pod 能直接摸到数据库。NetworkPolicy 就是给 Pod 门口装一扇门 + 一张名单：名单上的人能进，其余一律挡在外面。

### 一句话理解核心规则

**没被任何 NetworkPolicy 选中的 Pod，默认「全通」；一旦被选中，在规则指定的方向上就变成「默认拒绝」，只有名单里的才放行。**

这是最容易踩的坑：策略不是「叠加白名单」，而是「选中即上锁，规则即钥匙」。

- **选中即上锁** —— 一个 Pod 只要被任意一条 NetworkPolicy 的 `podSelector` 命中，它在 `policyTypes` 列出的方向（Ingress / Egress）上立刻变成「先拒绝、再按规则放行」。
- **规则取并集** —— 多个策略同时选中同一个 Pod，只要**任意一条**放行，流量就通，不会互相覆盖。
- **策略有命名空间** —— NetworkPolicy 是 namespaced 资源，只对**所在命名空间**里、且被它选中的 Pod 生效。

> 类比：默认是「谁都能敲你家门」；装了 NetworkPolicy 之后，只有名单上的人按得响门铃，其他人连门都不存在。

### 前提：CNI 得支持

NetworkPolicy 只是「规则」，真正拦流量的是节点上的网络插件（CNI）。**CNI 不支持的话，YAML 能创建成功但完全不生效**，这是排查时最容易忽略的点。

| CNI | 是否支持 NetworkPolicy |
|-----|----------------------|
| Calico | ✅ 支持（最常用，功能全） |
| Cilium | ✅ 支持（基于 eBPF，性能好） |
| Weave Net | ✅ 支持 |
| flannel | ❌ 默认**不支持**（多数发行版默认装的就是它） |

本地用 minikube 练手时要显式指定：

```bash
minikube start --cni=calico    # flannel 不支持，练 NetworkPolicy 必须换
```

### 字段速览

| 字段 | 作用 |
|------|------|
| `podSelector` | **选谁**。被筛选中的 Pod 是这条策略的「保护对象」；空 `{}` 表示本命名空间全部 Pod |
| `policyTypes` | 管哪个方向：`Ingress`（进来的）/ `Egress`（出去的） |
| `ingress.from` | 允许**谁**进来：三种选择器二选一或组合（见下） |
| `egress.to` | 允许**去哪里**：同上三种选择器 |
| `ports` | 只放行哪些端口，不写表示全端口 |

三种「谁」的写法（`from` / `to` 通用）：

| 选择器 | 含义 | 示例 |
|--------|------|------|
| `podSelector` | 按标签选 Pod（默认限本命名空间） | `matchLabels: {app: web}` |
| `namespaceSelector` | 按标签选命名空间 | `matchLabels: {env: prod}` |
| `ipBlock` | 按 IP 段放行（集群外的地址） | `cidr: 10.0.0.0/8`，可配 `except` 排除 |

> 注意：`podSelector` 和 `namespaceSelector` 写在**同一个 `from` 项里**表示「且」（该命名空间里、带该标签的 Pod）；拆成**两个 `from` 项**表示「或」（都放行）。这是极易写错的地方。

### 常用示例

**① 默认拒绝所有入站**（最常先打的地基，上锁后再开洞）

```yaml
# default-deny-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: prod
spec:
  podSelector: {}          # 空 = 选中本命名空间的所有 Pod
  policyTypes:
    - Ingress              # 只锁入站；出站不受影响
```

**② 只允许同应用的 Pod 互相访问**：

```yaml
# allow-same-app.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-same-app
spec:
  podSelector:
    matchLabels:
      app: web            # 保护对象：带 app=web 的 Pod
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: web    # 放行：本命名空间里同样带 app=web 的 Pod
```

**③ 放行某个命名空间访问指定端口**（数据库只给 prod 开）

```yaml
spec:
  podSelector:
    matchLabels:
      app: mysql
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: prod   # 内置标签，值就是命名空间名
      ports:
        - protocol: TCP
          port: 3306          # 只开 3306，别的端口照拒
```

**④ 放行集群外的固定网段**：

```yaml
  ingress:
    - from:
        - ipBlock:
            cidr: 10.0.0.0/8
            except:
              - 10.0.1.0/24   # 大段里再挖掉一段（比如办公网）
```

**⑤ 限制出站**（防止被入侵的 Pod 往外传数据）

```yaml
spec:
  podSelector:
    matchLabels:
      app: web
  policyTypes:
    - Egress
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: db
      ports:
        - protocol: TCP
          port: 5432
    - to:                     # ⚠️ 锁了出站，一定要给 DNS 留口子
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
```

> **锁 Egress 必踩的坑**：DNS 请求也是出站流量。一旦限制出站却忘了放行 `kube-system` 里的 CoreDNS（53 端口），Pod 里所有域名解析都会失败，表现是「连不上 service 名」，很容易误以为策略写错了。

### 常用命令

| 命令 | 作用 |
|------|------|
| `kubectl get netpol -n <ns>` | 列出命名空间里的策略 |
| `kubectl describe netpol <名> -n <ns>` | 看某条策略具体选中的 Pod 和规则 |
| `kubectl get pods --show-labels` | 对齐标签，确认策略选中了谁 |

### 排查思路

连不上时，按「是不是策略挡的」从外到内查：

1. `kubectl get netpol -n <ns>` —— 这个命名空间到底有没有策略？**没有就一定是别的问题**。
2. `kubectl describe netpol <名>` —— 看它选中了哪些 Pod、放行了哪些来源/端口，和你实际的访问方对不上就是它。
3. 临时删掉策略验证：`kubectl delete netpol <名>`，如果立刻通了，说明就是策略拦的，回去补规则。
4. 别忘了 DNS —— 出站被限、`kube-system:53` 没放行，是「名字都解析不了」的经典原因。

**一句话记忆：NetworkPolicy 不是「加白名单」，而是「选中即上锁」。** 先写一条 `podSelector: {}` 的 default-deny 兜底，再逐条开洞，是最稳的用法。

## 小结

- K8s 的价值是**帮你维持一个「你期望的状态」**：你负责声明，它负责达成和修复。
- **Docker ≠ K8s**：Docker 解决「一个程序怎么打包、在一台机器上跑起来」，K8s 解决「一堆机器上的一堆容器谁来管」。先会 Docker，再学 K8s，顺序别反。
- 日常 90% 的操作就四件事：`apply`（提交）、`get`（看）、`describe`（查原因）、`logs`（看输出）。
- 上手顺序建议：会用 `docker build` / `docker run` → 本地起 minikube → 跑通一个 Deployment + Service → 练缩放和回滚 → 再学 ConfigMap / Ingress / 持久化存储。

什么时候不该用：

- **只有一台机器、一个简单服务** —— 直接 `docker compose` 更省事（见[上文对比](#它和-docker-是什么关系)），K8s 的复杂度是净亏。
- **团队没有运维/平台能力** —— 托管服务（云厂商的托管 K8s）能缓解，但仍需要有人懂。
- **有状态数据库（MySQL / Redis 主从）** —— 虽然能跑，但存储与故障恢复的坑很深，初期建议用云厂商托管数据库，把 K8s 留给无状态服务。
- **只想跑个定时脚本** —— 一台小服务器加 cron 就够了。
