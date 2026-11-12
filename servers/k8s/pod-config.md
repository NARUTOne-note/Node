# K8s Pod 配置文件怎么用

一句话：Pod 配置文件（通常是 YAML）用来告诉 K8s：**运行哪个镜像、需要多少资源、如何检查健康状态、挂载什么配置和数据，以及出现异常时怎么处理**。

> Pod 是 K8s 的最小运行单元，但生产环境通常不直接创建单独的 Pod，而是通过 Deployment 管理它：Deployment 负责副本数、故障重建和滚动更新，Pod 模板负责描述容器怎么运行。本篇的 `spec` 配置同样可以放进 Deployment 的 `spec.template.spec` 中。

## 最小可用配置

```yaml
# pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: web
  labels:
    app: web
spec:
  containers:
    - name: web
      image: nginx:1.27-alpine
      ports:
        - containerPort: 80
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          cpu: 500m
          memory: 256Mi
```

常用操作：

```bash
kubectl apply -f pod.yaml          # 创建或更新配置
kubectl get pod web -o wide        # 查看状态、IP 和所在节点
kubectl describe pod web           # 查看配置及事件，排查启动失败
kubectl logs -f web                # 查看容器日志
kubectl delete -f pod.yaml         # 删除 Pod
```

提交前可以先做校验，不真正创建资源：

```bash
kubectl apply --dry-run=client -f pod.yaml
kubectl apply --dry-run=server -f pod.yaml  # 需要连接集群，校验更完整
```

## 一份较完整的常用配置

下面的镜像地址是占位地址，使用时换成自己的镜像；引用的 ServiceAccount、ConfigMap 和 Secret 也需要提前创建。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web
  namespace: demo
  labels:
    app: web
    env: prod
spec:
  serviceAccountName: web-sa
  restartPolicy: Always
  terminationGracePeriodSeconds: 30

  securityContext:
    seccompProfile:
      type: RuntimeDefault

  containers:
    - name: web
      image: registry.example.com/demo/web:1.0.0
      imagePullPolicy: IfNotPresent
      workingDir: /app
      ports:
        - name: http
          containerPort: 8080
          protocol: TCP

      env:
        - name: APP_ENV
          value: production
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: web-secret
              key: db-password

      resources:
        requests:
          cpu: 250m
          memory: 256Mi
        limits:
          cpu: "1"
          memory: 512Mi

      startupProbe:
        httpGet:
          path: /healthz
          port: http
        periodSeconds: 5
        timeoutSeconds: 2
        failureThreshold: 30

      readinessProbe:
        httpGet:
          path: /ready
          port: http
        periodSeconds: 10
        timeoutSeconds: 2
        failureThreshold: 3

      livenessProbe:
        httpGet:
          path: /healthz
          port: http
        periodSeconds: 10
        timeoutSeconds: 2
        failureThreshold: 3

      securityContext:
        runAsNonRoot: true
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL

      volumeMounts:
        - name: app-config
          mountPath: /etc/app
          readOnly: true
        - name: tmp
          mountPath: /tmp

  volumes:
    - name: app-config
      configMap:
        name: web-config
    - name: tmp
      emptyDir: {}
```

> `readOnlyRootFilesystem: true` 要求程序不能把日志、缓存或临时文件写到其他系统目录；需要写入的目录应像上面的 `/tmp` 一样单独挂载。`runAsNonRoot: true` 也要求镜像确实支持非 root 用户运行。

## 基础字段

| 配置项 | 作用 | 常用设置 |
|---|---|---|
| `apiVersion` | 使用的 API 版本 | Pod 固定为 `v1` |
| `kind` | 资源类型 | Pod 固定为 `Pod` |
| `metadata.name` | Pod 名称，在命名空间内唯一 | 小写字母、数字和 `-`，如 `web` |
| `metadata.namespace` | 所属命名空间 | 不写默认是 `default`；按团队或环境划分，如 `demo`、`prod` |
| `metadata.labels` | 给资源打标签，供 Service、Deployment 等选择 | 至少设置稳定的 `app: web`；不要给每次变更都变化的值 |
| `metadata.annotations` | 保存给工具或平台读取的附加信息 | 一般按需设置，不用于 Service 的选择器 |
| `spec.containers` | Pod 中运行的容器列表 | 通常一个 Pod 只放一个主要业务容器；紧密协作的辅助容器才放一起 |

## 容器运行配置

| 配置项 | 作用 | 常用设置或建议 |
|---|---|---|
| `name` | 容器名称，在 Pod 内唯一 | 与业务一致，如 `web`、`api` |
| `image` | 容器镜像地址 | 开发可用明确版本号；生产建议固定版本或镜像摘要，避免使用 `latest` |
| `imagePullPolicy` | 镜像拉取策略 | 固定版本通常用 `IfNotPresent`；需要每次拉取时用 `Always` |
| `command` | 覆盖镜像的启动命令（ENTRYPOINT） | 一般优先使用镜像默认命令，确有需要再覆盖 |
| `args` | 覆盖或传给启动命令的参数（CMD） | 按程序参数设置，如 `["--config=/etc/app/app.yaml"]` |
| `workingDir` | 容器内的工作目录 | 按镜像和应用设置，如 `/app` |
| `ports.containerPort` | 声明容器监听的端口 | 填应用真实端口；它主要是声明，不会自动对外暴露服务 |
| `env` | 设置单个环境变量 | 普通配置可用 `value`；配置对象和敏感信息优先用 `valueFrom` |
| `envFrom` | 批量导入 ConfigMap 或 Secret 中的环境变量 | 配置项较多时使用，注意避免变量名冲突 |
| `volumeMounts` | 把 Pod 的卷挂载进容器 | 配置目录通常设 `readOnly: true` |

`command` 和 `args` 示例：

```yaml
containers:
  - name: web
    image: registry.example.com/demo/web:1.0.0
    command: ["/app/server"]
    args: ["--config=/etc/app/app.yaml", "--port=8080"]
```

环境变量引用配置：

```yaml
env:
  - name: LOG_LEVEL
    valueFrom:
      configMapKeyRef:
        name: web-config
        key: log-level
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: web-secret
        key: db-password
```

> Secret 只是适合保存和分发敏感配置，并不等于环境变量或卷中的内容自动变得绝对安全。不要把密码直接写进 Git 中的 YAML，也不要给 Pod 不必要的读取权限。

## 资源配置 resources

`resources` 写在**每个容器**下面，不是直接写在 Pod 的 `spec` 下面。这是最需要根据应用实际负载调整的部分，**没有适合所有程序的固定值**。

### 基本写法

```yaml
spec:
  containers:
    - name: web
      image: registry.example.com/demo/web:1.0.0
      resources:
        requests:
          cpu: 250m
          memory: 256Mi
        limits:
          cpu: "1"
          memory: 512Mi
```

| 配置项 | 作用 | 不配置时的常见结果 |
|---|---|---|
| `resources.requests` | 容器正常运行需要的资源量；调度器主要按它选择节点，资源竞争时也作为分配依据 | 调度器无法准确评估需求，可能把过多 Pod 调度到同一节点；也可能被集群的配额策略拒绝 |
| `resources.limits` | 容器能够使用的资源上限 | 没有容器级上限，但仍可能受 LimitRange 默认值、节点容量和其他系统约束 |

两者的关系：

- 调度时看 `requests`，不是把所有 `limits` 加起来判断节点能否容纳。因此，多个 Pod 的 `limits` 总和可以超过节点容量，但节点过载时仍可能出现限流或驱逐。
- `requests` 不能大于同资源的 `limits`。
- 只配置 `limits` 而没有配置对应 `requests` 时，K8s 通常会把 `requests` 默认设置为相同值；只配置 `requests` 时，不代表一定没有上限，命名空间中的 LimitRange 可能补充默认上限。
- 最终生效值可通过 `kubectl get pod <名称> -o yaml` 查看。

### CPU 和内存超限后的区别

CPU 和内存的行为不一样，不能套用同一种调参思路：

| 资源 | `requests` 的意义 | 达到或超过 `limits` 后的表现 |
|---|---|---|
| CPU | 调度依据；节点 CPU 紧张时，也影响容器之间可获得的 CPU 权重 | 通常被限制使用更多 CPU，表现为程序变慢、延迟升高，称为 CPU throttling（限流） |
| 内存 | 调度依据；节点内存不足时，也影响 kubelet 选择驱逐哪些 Pod | 容器可能被 OOM Killer 终止，状态中常见 `OOMKilled`，随后是否重启取决于重启策略和控制器 |

简单来说：**CPU 是可以压缩的资源，超上限通常先变慢；内存不能随意压缩，超上限可能直接被杀。**

### 单位和可配置的资源类型

CPU：

- `1000m = 1 个 CPU`，`250m = 0.25 个 CPU`，`cpu: "1"` 与 `cpu: 1000m` 等价。
- 这里的“1 个 CPU”对应云主机或容器环境中的 1 个逻辑 CPU/vCPU，不一定等于一个完整的物理核心。
- 最小粒度通常是 `1m`；配置过小可能导致服务连启动或健康检查都超时。

内存：

- `Ki`、`Mi`、`Gi` 是二进制单位：`1Gi = 1024Mi`。
- `K`、`M`、`G` 是十进制单位；日常建议统一使用 `Mi`、`Gi`，避免混淆。
- `memory: 128Mi` 表示内存大小，不要误写成 `128m`；小写 `m` 在内存数量中有完全不同的含义。

除 CPU、内存外，还可以按需配置：

| 资源名 | 用途 | 建议 |
|---|---|---|
| `ephemeral-storage` | 限制临时存储，包括容器可写层、日志及部分 `emptyDir` 数据等 | 写日志或临时文件较多的服务可配置；超过上限可能导致 Pod 被驱逐 |
| `hugepages-<size>` | 使用指定大小的巨页内存 | 只用于有明确需求的高性能计算、网络等场景，普通服务不用配置 |
| `nvidia.com/gpu` 等扩展资源 | 申请 GPU 等由设备插件管理的硬件 | 资源名由设备和插件决定；节点必须已注册对应资源，不能写成通用的 `gpu` |

临时存储示例：

```yaml
resources:
  requests:
    cpu: 100m
    memory: 128Mi
    ephemeral-storage: 100Mi
  limits:
    cpu: 500m
    memory: 256Mi
    ephemeral-storage: 1Gi
```

### GPU 资源怎么配置

GPU 在 K8s 中通常属于**扩展资源（Extended Resource）**，通过设备插件暴露和分配。NVIDIA GPU 最常见的资源名是 `nvidia.com/gpu`，其他厂商或虚拟化方案可能使用不同名称，应以节点实际注册的资源名为准。

#### 使用前提

仅在 YAML 中写 `nvidia.com/gpu` 并不会让普通节点自动获得 GPU 能力，通常需要：

1. 节点有可用 GPU，并已正确安装主机驱动。
2. 集群安装相应的设备插件或 GPU Operator，并完成容器运行时配置。
3. 节点资源的 `Capacity` 和 `Allocatable` 中能看到对应 GPU 资源。
4. 容器镜像包含应用需要的 CUDA 等运行时组件，并且版本与主机驱动兼容。

检查节点是否已经向 K8s 注册 GPU：

```bash
kubectl describe node <节点名>
# 查看输出中的 Capacity、Allocatable，确认是否存在 nvidia.com/gpu

kubectl get node <节点名> -o jsonpath='{.status.allocatable.nvidia\.com/gpu}{"\n"}'
```

#### 基本配置

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: gpu-app
spec:
  containers:
    - name: trainer
      image: registry.example.com/demo/trainer:1.0.0
      resources:
        requests:
          cpu: "2"
          memory: 8Gi
          nvidia.com/gpu: 1
        limits:
          cpu: "4"
          memory: 16Gi
          nvidia.com/gpu: 1
```

关键规则：

- GPU 数量通常写成整数，`nvidia.com/gpu: 1` 表示申请 1 个 GPU，**不能像 CPU 一样写成 `500m` 或 `0.5`**。
- GPU 不能像 CPU 那样超卖。同时设置 requests 和 limits 时，GPU 数量必须相等；通常可以只在 `limits` 中写 GPU，K8s 会把对应 request 默认成相同值。
- `limits` 在这里主要表示分配给容器的设备数量，不是类似 CPU 的运行时限流值。
- 多个容器都申请 GPU 时，请求量会累加。例如两个容器各申请 `1`，Pod 合计需要 `2` 个 GPU。
- `memory` 指的是**主机内存**，不是 GPU 显存。K8s 没有通用的 `gpu-memory` 字段，显存是否够用要根据模型、框架和具体 GPU 型号判断。

#### 一般申请多少 GPU

| 场景 | 常见起步配置 | 注意事项 |
|---|---|---|
| 单卡推理或单卡训练 | `nvidia.com/gpu: 1` | 最常见的配置；同时确认显存能容纳模型和批处理数据 |
| 小模型、多实例共享物理 GPU | 优先使用厂商支持的 MIG 等分区资源 | 分区资源名可能是 `nvidia.com/mig-1g.5gb` 等，以节点实际名称为准 |
| 单机多卡训练或大型模型推理 | `2`、`4`、`8` 等 | 只有应用和框架支持多卡并行才有意义，增加数量不等于自动提速 |
| 跨节点分布式训练 | 每个 Pod 按任务拓扑申请固定数量 GPU | 还需要分布式训练框架、网络及相应的任务调度配置 |

> MIG 等分区需要硬件、驱动和设备插件支持。时间片等共享方案也不等同于显存隔离；不能通过写 `nvidia.com/gpu: 0.5` 来申请半张卡。

#### 显存配额怎么写

**原生 K8s 和标准 NVIDIA Device Plugin 没有通用的显存配额字段。** 不能像下面这样配置：

```yaml
# 错误示例：这些不是通用的 K8s 资源名
resources:
  limits:
    gpu-memory: 8Gi
    nvidia.com/gpu-memory: 8Gi
```

显存配额取决于底层使用的 GPU 隔离或虚拟化方案，常见方式如下：

| 方案 | 能否设置显存配额 | 隔离特点 |
|---|---|---|
| 整卡分配 `nvidia.com/gpu` | 不能单独设置；容器获得整张卡的可用显存 | 通常按整卡排他分配，适合显存需求大或需要完整性能的任务 |
| NVIDIA MIG | 通过选择 MIG 规格确定显存大小 | 硬件级分区，各实例有独立显存，隔离最明确 |
| HAMi 等 vGPU 插件 | 使用插件定义的显存资源字段 | 可做显存和算力配额，但字段、单位和隔离能力依赖具体插件及版本 |
| 时间片共享 | 通常不能限制每个 Pod 的显存 | 多个 Pod 可能看到同一张卡的显存，容易发生相互影响和显存溢出 |

**方式一：使用 MIG 规格分配固定显存（推荐用于需要硬隔离的场景）**:

例如，节点已配置并注册 `nvidia.com/mig-1g.5gb` 资源时：

```yaml
resources:
  limits:
    nvidia.com/mig-1g.5gb: 1
```

这表示申请一个带约 5GB 独立显存的 MIG 实例，而不是申请一张整卡。只写 `limits` 时，对应的 request 会默认成相同值。

注意：

- `1g.5gb` 是 MIG 配置规格，不是所有 GPU 都支持；可用规格由 GPU 型号、显存容量和节点上的 MIG 配置决定。
- 资源名必须以节点 `Allocatable` 中实际注册的名称为准，可通过 `kubectl describe node <节点名>` 查看。
- 使用某个 MIG 实例时，不要再同时申请同一张物理卡的 `nvidia.com/gpu` 整卡资源。

**方式二：使用 vGPU 插件的显存字段**:

以部分 HAMi 部署为例：

```yaml
resources:
  limits:
    nvidia.com/gpu: 1
    nvidia.com/gpumem: 4096
```

这里表示使用一个 vGPU，并申请约 4096MB 显存。**`nvidia.com/gpumem` 是 HAMi 等方案定义的扩展字段，不是原生 K8s 或标准 NVIDIA Device Plugin 的通用字段**；数值单位、是否必须同时设置算力配额，以及超限时是拦截分配还是终止进程，都要以实际插件版本文档为准。

如果集群只安装了标准 NVIDIA Device Plugin，写上这个字段通常会因节点没有注册对应资源而无法调度，并不会自动获得显存限制能力。

**配额一般设置多少**:

1. 先在实际模型和批处理大小下测量显存峰值，再增加约 10%～20% 的余量作为起点；显存波动大的任务应留更多余量。
2. 推理不仅要算模型权重，还要考虑 KV Cache、激活值和框架开销；训练还要考虑梯度、优化器状态和激活值，不能只按模型文件大小估算。
3. MIG 场景选择能覆盖实际峰值的规格。例如峰值接近 8GB 时，不能分配 5GB 实例，应选择更大的可用规格或使用整卡。
4. vGPU 软配额不要等于物理卡的全部显存，还要给驱动和其他必要开销留空间；多个共享实例的配额之和能否超过物理显存，也取决于插件是否允许超卖。
5. `memory: 8Gi` 限制的是主机内存，`CUDA_VISIBLE_DEVICES` 控制的是设备可见性，两者都不是显存配额。

#### GPU 常见问题排查

| 现象 | 优先检查 |
|---|---|
| Pod 一直 `Pending`，出现 `Insufficient nvidia.com/gpu` | 节点可分配 GPU 是否已被占满；节点选择、亲和性、污点和容忍是否排除了 GPU 节点 |
| 节点的 Capacity 中根本没有 GPU 资源 | GPU 驱动、设备插件或 GPU Operator 是否正常运行，资源名是否写对 |
| Pod 已运行但程序提示找不到 GPU 或 CUDA 不兼容 | 容器是否实际分到设备、镜像 CUDA 版本、主机驱动版本和设备插件配置 |
| 容器因显存不足退出 | 检查模型、batch size、框架显存占用及其他进程；增加主机 `memory` 不能解决显存不足 |

```bash
kubectl describe pod gpu-app
kubectl exec -it gpu-app -- nvidia-smi  # 需要镜像中包含 nvidia-smi
```

`kubectl top pod` 通常只展示 CPU 和主机内存，不代表 GPU 利用率或显存。GPU 监控可使用 `nvidia-smi`，生产环境可结合 DCGM Exporter 等厂商监控方案。

### 一般设置多少

以下只是**起步参考值**，不是生产环境的固定答案；应根据程序运行时、实例承担的流量和实际监控调整：

| 应用规模或类型 | CPU requests | CPU limits | 内存 requests | 内存 limits |
|---|---:|---:|---:|---:|
| 很小的代理、任务或低流量服务 | `50m`～`100m` | `200m`～`500m` | `64Mi`～`128Mi` | `128Mi`～`256Mi` |
| 普通 Node.js、Go 等 Web 服务 | `100m`～`250m` | `500m`～`1` | `128Mi`～`256Mi` | `256Mi`～`512Mi` |
| 中等流量或计算较多的服务 | `250m`～`500m` | `1`～`2` | `256Mi`～`512Mi` | `512Mi`～`1Gi` |
| Java 等运行时开销较大的服务 | `250m`～`500m` | `1`～`2` | `512Mi`～`1Gi` | `1Gi`～`2Gi` |

调参原则：

1. **requests 以稳定负载为依据**：先测量正常和高峰负载，接近正常负载下的实际需求，并留合理余量。设置过高会浪费可调度资源，甚至导致 Pod 一直 `Pending`；设置过低则容易过度超卖。
2. **内存 limits 要覆盖峰值**：可从实际峰值的 1.2～2 倍开始验证，但不应盲目套倍数。频繁 `OOMKilled` 时，先确认是上限不足还是存在内存泄漏。
3. **CPU limits 关注延迟而非仅看使用率**：如果流量上来后 CPU 使用不高但请求延迟明显增加，应检查是否发生 CPU 限流。对延迟敏感的服务可评估提高或不设置 CPU 上限，但要遵守集群规范，避免单个容器挤占整个节点。
4. **Java 等应用还要检查运行时堆设置**：JVM 堆、直接内存、线程栈和运行时自身都会占内存，不能只把容器内存上限等同于 `-Xmx`。较新的 JVM 通常能识别容器限制，但仍应实际验证。
5. **有突发流量的服务分别观察启动和运行阶段**：编译、连接池初始化、缓存加载可能使启动时资源需求明显高于稳定运行时。
6. **每次只调整一项并对比监控**：重点看 CPU 使用率与限流、内存工作集、OOM、请求延迟和错误率。

### 多容器和 init 容器怎么计算

`resources` 按容器分别设置。对同一种资源，Pod 用于调度的有效请求量大致按以下规则计算：

1. 所有普通容器的 `requests` **相加**，因为它们是同时运行的。
2. 普通 `initContainers` 按顺序执行，取其中单个 init 容器请求量的**最大值**，而不是相加。
3. Pod 的有效请求量取“普通容器之和”和“init 容器最大值”两者中的较大值。

例如：

```yaml
spec:
  initContainers:
    - name: migrate
      image: registry.example.com/demo/migrate:1.0.0
      resources:
        requests:
          cpu: 500m
          memory: 512Mi
  containers:
    - name: web
      image: registry.example.com/demo/web:1.0.0
      resources:
        requests:
          cpu: 250m
          memory: 256Mi
    - name: log-agent
      image: registry.example.com/demo/log-agent:1.0.0
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
```

普通容器合计为 `350m CPU + 384Mi 内存`，init 容器为 `500m CPU + 512Mi 内存`，因此这个示例 Pod 的调度请求为 `500m CPU + 512Mi 内存`。

> 常驻 sidecar、带 `restartPolicy: Always` 的 init 容器等场景有更细致的计算规则；普通业务先掌握“普通容器求和、顺序 init 取最大”即可。

### QoS 等级：资源完整度带来的差别

K8s 会根据 Pod 中 CPU、内存的 `requests` 和 `limits` 自动计算 QoS（服务质量）等级，不需要手工填写：

| QoS 等级 | 判定条件 | 特点 |
|---|---|---|
| `Guaranteed` | 每个容器（包括 init 容器）都设置 CPU、内存的 requests 和 limits，且二者分别相等 | 资源保障最强，但 requests 较高时也会占用更多调度容量 |
| `Burstable` | 不符合 `Guaranteed`，但至少一个容器设置了 CPU 或内存的 requests/limits | 最常见，允许在保障值与上限之间使用突发资源 |
| `BestEffort` | 所有容器都没有设置 CPU、内存的 requests 和 limits | 节点资源紧张时通常更容易被驱逐，不适合重要生产服务 |

节点资源不足时，kubelet 会综合资源实际使用量、requests、Pod 优先级等因素选择驱逐对象，并不是简单地只看 QoS；`Guaranteed` 也不代表永远不会被驱逐。

查看 Pod 的 QoS：

```bash
kubectl get pod web -n demo -o jsonpath='{.status.qosClass}{"\n"}'
```

### LimitRange 和 ResourceQuota 的影响

Pod 里没写或写了 resources，还可能受到命名空间级策略影响：

| 资源对象 | 作用 | 与 Pod 的关系 |
|---|---|---|
| `LimitRange` | 给容器设置默认 requests/limits，并限制允许的最小值、最大值及比例 | 可能自动补全资源值，也可能让不符合范围的 Pod 创建失败 |
| `ResourceQuota` | 限制整个命名空间可使用的资源总量和对象数量 | 配额包含 requests/limits 时，未配置相应资源或超出剩余配额的 Pod 可能被拒绝 |

遇到“YAML 没写但运行后多了资源值”或“资源足够却创建失败”时，检查：

```bash
kubectl get limitrange -n demo
kubectl describe limitrange -n demo
kubectl get resourcequota -n demo
kubectl describe resourcequota -n demo
```

### 监控与常见问题排查

查看实际资源使用量（需要集群安装 Metrics Server；指标通常是近期采样值，不等同于长期峰值）：

```bash
kubectl top pod web -n demo
kubectl top pod web -n demo --containers
kubectl top nodes
```

| 现象 | 优先检查 |
|---|---|
| Pod 一直 `Pending`，事件中有 `Insufficient cpu` 或 `Insufficient memory` | requests 是否过大、节点可用资源是否不足、亲和性或污点是否进一步缩小了可调度节点范围 |
| 容器反复重启，退出原因 `OOMKilled` | 内存 limits、真实峰值、JVM/运行时堆设置以及是否存在内存泄漏 |
| 请求变慢但 CPU 使用率看起来没有打满 | CPU limits 是否过低、是否发生 CPU 限流、健康检查是否因此超时 |
| 节点资源紧张时 Pod 被驱逐 | QoS、requests 是否合理、临时存储是否超限、节点是否存在资源压力 |
| Pod 创建时被准入策略拒绝 | LimitRange 的默认值/范围和 ResourceQuota 的剩余配额 |

结合详情定位：

```bash
kubectl describe pod web -n demo
kubectl get pod web -n demo -o yaml
kubectl logs web -n demo --previous
```

## 健康检查探针

| 探针 | 解决的问题 | 检查失败后的动作 |
|---|---|---|
| `startupProbe` | 程序启动慢，如何避免启动期间被其他探针误判 | 重启容器；成功后才开始执行存活和就绪检查 |
| `readinessProbe` | 程序是否准备好接收流量 | 从 Service 可用端点中移除，**不会重启容器** |
| `livenessProbe` | 程序是否已经卡死、无法自行恢复 | 重启容器 |

常用起步值：

| 配置项 | 含义 | 常用起步值 |
|---|---|---|
| `httpGet.path` | HTTP 检查路径 | 存活检查用 `/healthz`，就绪检查用 `/ready` |
| `httpGet.port` | 检查端口 | 应用真实端口，也可引用端口的 `name` |
| `periodSeconds` | 每隔多久检查一次 | `10s`；启动探针可设为 `5s` |
| `timeoutSeconds` | 单次检查多久算超时 | `1s`～`3s` |
| `successThreshold` | 连续成功几次算成功 | 通常保持默认 `1` |
| `failureThreshold` | 连续失败几次算失败 | 存活和就绪通常 `3`；启动探针按最长启动时间计算 |
| `initialDelaySeconds` | 容器启动后延迟多久开始检查 | 有 `startupProbe` 时通常不必再给存活探针设置；否则按启动时间设置 |

`startupProbe` 能容忍的最长启动时间约为：

```text
periodSeconds × failureThreshold
```

例如 `5 × 30 = 150 秒`。启动较慢的应用可以适当增加 `failureThreshold`，不要只靠很大的 `initialDelaySeconds` 猜启动时间。

使用建议：

- 普通 Web 服务至少配置 `readinessProbe` 和 `livenessProbe`；启动时间不稳定或较长时再加 `startupProbe`。
- 存活检查应尽量轻量，只判断进程是否还能正常工作；不要因为数据库等外部依赖短暂异常就重启整个容器。
- 就绪检查可以判断应用是否能接流量，但也要避免检查过多依赖导致大面积摘除实例。
- 不要把存活探针和就绪探针不加区分地指向同一个依赖复杂的接口。

## 重启、调度和终止配置

| 配置项 | 作用 | 常用设置或建议 |
|---|---|---|
| `restartPolicy` | 容器退出后的重启策略 | 常驻服务用 `Always`（默认）；一次性任务可用 `OnFailure` 或 `Never`；Deployment 只支持 `Always` |
| `terminationGracePeriodSeconds` | 收到终止信号后，给程序优雅退出的时间 | 通常 `30` 秒；请求处理较长可设 `60` 秒或更长 |
| `serviceAccountName` | 指定 Pod 访问 K8s API 时使用的身份 | 默认是命名空间的 `default`；生产建议专用账号并遵循最小权限 |
| `nodeSelector` | 按节点标签选择可运行的节点 | 有明确硬件或区域要求时使用，如 `disktype: ssd` |
| `affinity` | 更灵活的节点、Pod 亲和或反亲和规则 | 多副本分散部署可用 Pod 反亲和；普通小项目不必先配 |
| `tolerations` | 允许 Pod 调度到带特定污点的节点 | 只有需要运行到专用节点时配置；容忍污点不代表一定会调度过去 |
| `priorityClassName` | 设置调度与资源紧张时的优先级 | 引用集群已有的 PriorityClass，不要随意给普通服务设最高优先级 |
| `dnsPolicy` | Pod 的 DNS 策略 | 通常保持默认 `ClusterFirst`；使用宿主机网络且仍需集群 DNS 时考虑 `ClusterFirstWithHostNet` |
| `hostNetwork` | 是否直接使用宿主机网络 | 通常保持默认 `false`，只在明确的系统组件或网络场景使用 |
| `initContainers` | 主容器启动前按顺序执行的初始化容器 | 用于迁移、等待依赖或准备文件；必须成功完成才会启动主容器 |

优雅终止不要只靠延长时间：应用还应当响应 `SIGTERM`，停止接收新请求，并在宽限时间内处理完已有请求。若前置代理摘除流量存在延迟，可以评估 `lifecycle.preStop`，但不要把它当成应用优雅退出的替代品。

## 配置和数据卷 volumes

| 卷类型 | 用途 | 数据生命周期与建议 |
|---|---|---|
| `configMap` | 挂载非敏感配置 | 适合配置文件；可按需只读挂载 |
| `secret` | 挂载密码、令牌等敏感配置 | 配合最小权限使用，不要把真实 Secret 内容提交到 Git |
| `emptyDir` | Pod 内容器共享的临时目录 | Pod 删除后数据丢失，适合缓存和临时文件 |
| `hostPath` | 挂载节点上的文件或目录 | 与节点强绑定且有安全风险，普通业务尽量避免 |
| `persistentVolumeClaim` | 使用持久化存储 | 适合需要保留的数据；Pod 重建后能否复用还取决于存储及访问模式 |

持久化卷示例：

```yaml
spec:
  containers:
    - name: app
      image: registry.example.com/demo/app:1.0.0
      volumeMounts:
        - name: data
          mountPath: /var/lib/app
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: app-data
```

> Deployment 中的多个副本如果共用存储，要确认存储支持相应的读写模式。数据库等有状态应用通常还需要 StatefulSet、备份和故障恢复方案，不是挂一个卷就够了。

## 安全上下文 securityContext

生产环境建议从以下配置开始，并确认应用兼容：

```yaml
spec:
  securityContext:
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: web
      securityContext:
        runAsNonRoot: true
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop: ["ALL"]
```

| 配置项 | 作用 | 一般建议 |
|---|---|---|
| `runAsNonRoot` | 要求容器不能以 root 用户运行 | 能支持就设为 `true` |
| `allowPrivilegeEscalation` | 是否允许进程获得更多权限 | 通常设为 `false` |
| `readOnlyRootFilesystem` | 将容器根文件系统设为只读 | 建议 `true`，写入目录单独挂载 |
| `capabilities.drop` | 删除 Linux  capabilities | 先删除 `ALL`，确实需要再单独添加 |
| `seccompProfile` | 限制可用的系统调用 | 通常使用 `RuntimeDefault` |
| `privileged` | 是否运行特权容器 | 普通业务必须保持 `false` |

如果 Pod 不需要访问 K8s API，还可以在 Pod 或 ServiceAccount 上设置 `automountServiceAccountToken: false`，避免自动挂载访问令牌。

## 生产环境常用起步清单

- 用 Deployment 等控制器管理 Pod；无状态服务通常至少 `2` 个副本，但副本数写在 Deployment 的 `replicas`，不是 Pod 配置里。
- 镜像使用明确版本或摘要，不依赖 `latest`。
- 每个容器都设置合理的 `resources.requests`，并根据应用情况设置 `limits`。
- 配置 `readinessProbe` 和 `livenessProbe`，慢启动应用增加 `startupProbe`。
- `terminationGracePeriodSeconds` 通常从 `30` 秒开始，同时让应用正确处理 `SIGTERM`。
- 配置放入 ConfigMap，敏感配置放入 Secret，持久数据使用 PVC。
- 使用专用 ServiceAccount 和最小 RBAC 权限，不需要访问 K8s API 时关闭令牌自动挂载。
- 尽量启用非 root、只读根文件系统、禁止提权并删除不需要的 capabilities。
- 根据监控和压测持续调整资源与探针参数，不把示例值当成所有应用的固定答案。
