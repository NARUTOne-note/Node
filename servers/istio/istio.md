# Istio

Istio 是给微服务「装管家」的工具——你不用改一行业务代码，它就帮你把流量的路由、加密、监控、限流全管起来。

## 基本介绍

**一句话类比**：把 Istio 想象成一栋写字楼的物业管理处。楼里每间公司（你的每个服务）照常做生意，但大门保安（路由）、对讲机加密（mTLS）、楼层电表（监控）、访客限流（限流熔断）全由物业统一打理，公司自己不用操心。

**核心特征：**

- **Sidecar 模式** —— 给每个服务旁边塞一个小代理（Envoy），所有进出流量都先经过它，服务本身完全无感。
- **控制面 + 数据面分离** —— Istiod 是「大脑」负责下指令，Envoy 是「手脚」负责实际转发，互不打扰。
- **不用改业务代码** —— 流量管理、安全、可观测性全是「外挂」上去的，对服务透明。
- **平台无关** —— 只要跑在 Kubernetes 上基本都能用，不绑定特定语言或框架。
- **声明式配置** —— 用 YAML 描述「我想要流量怎么走」，Istio 负责把它变成现实。

## 基本使用

### 前置 / 安装

需要一个能跑的 Kubernetes 集群（本地可用 minikube / kind）。

```bash
# 1. 下载 istioctl（官方命令行工具）
curl -L https://istio.io/downloadIstio | sh -

# 2. 进目录，把 bin 加到 PATH
cd istio-* && export PATH="$PWD/bin:$PATH"

# 3. 安装到集群（demo 配置档适合上手，开箱带监控套件）
istioctl install --set profile=demo -y

# 4. 给某个命名空间开启自动注入 sidecar
kubectl label namespace default istio-injection=enabled
```

之后只要在这个命名空间里部署 Pod，Istio 就会自动往每个 Pod 里塞一个 Envoy sidecar。

### 最小示例

先把一个示例应用跑起来，验证 sidecar 已注入：

```bash
# 部署官方示例（两个版本，方便后面演示流量切分）
kubectl apply -f samples/bookinfo/platform/kube/bookinfo.yaml
```

检查任意一个 Pod，应该看到「2/2」——一个业务容器 + 一个 istio-proxy sidecar：

```bash
kubectl get pods
#NAME                              READY   STATUS    ...
#details-v1-...                    2/2     Running   ...
```

### 常用参数

Istio 的「参数」其实是各种 CRD（自定义资源），最常用的几个：

| 资源 | 作用 | 典型字段示例 |
|------|------|--------------|
| `Gateway` | 接入外部流量（类似给网格开大门） | `port: 80`, `hosts: ["*"]` |
| `VirtualService` | 定义路由规则（请求往哪走） | `http.match.uri`, `route.destination` |
| `DestinationRule` | 定义到目标的策略（负载均衡/熔断） | `trafficPolicy.loadBalancer` |
| `ServiceEntry` | 把外部服务纳入网格管理 | `hosts`, `resolution` |
| `PeerAuthentication` | 服务间 mTLS 策略 | `mtls.mode: STRICT` |

### 常见场景

- **把 90% 流量给 v1，10% 给 v2（灰度发布）** —— 用 VirtualService 按权重切：

```yaml
spec:
  http:
  - route:
    - destination: { host: reviews, subset: v1 }
      weight: 90
    - destination: { host: reviews, subset: v2 }
      weight: 10
```

- **强制所有服务间通信加密（mTLS）** —— 一条 PeerAuthentication：

```yaml
spec:
  mtls: { mode: STRICT }
```

- **给外部访问开大门（Ingress Gateway）** —— Gateway + VirtualService 组合：

```yaml
# 大门
spec: { servers: [{ port: { number: 80, name: http, protocol: HTTP }, hosts: ["*"] }] }
# 进门后怎么走
spec: { http: [{ route: [{ destination: { host: productpage } }] }] }
```

- **自动重试 + 超时** —— 在 VirtualService 里加一句：

```yaml
spec:
  http:
  - retries: { attempts: 3, perTryTimeout: 2s }
    route: [{ destination: { host: reviews } }]
```

## 小结

- **核心心智模型**：Istio = 控制面（Istiod 下指令）+ 数据面（每个服务旁的 Envoy sidecar 转发流量）。你写 YAML 告诉控制面想要什么，控制面把规则下发到所有 sidecar。
- **上手路径**：装 istioctl → `istioctl install` → 给命名空间打注入标签 → 部署应用（自动带 sidecar）→ 用 VirtualService/Gateway 控流量。
- **什么时候不该用**：服务数量很少（三两个）、没有 Kubernetes 环境、团队对运维复杂度敏感——Istio 引入的额外组件和配置心智负担，对小项目不划算，先用好 K8s 本身再说。
