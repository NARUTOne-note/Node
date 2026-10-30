# NVIDIA 显卡概览

> 🟢 NVIDIA（英伟达）是目前 GPU 市场的绝对霸主，尤其在 AI 计算领域凭借 CUDA 生态几乎垄断。

本文按**产品线**梳理 NVIDIA 显卡体系，帮助快速识别一张卡的定位。

## 产品线总览

| 产品线 | 定位 | 典型型号 | 主要用户 |
| --- | --- | --- | --- |
| **GeForce RTX/GTX** | 消费级（游戏、创作） | RTX 4090、RTX 4060 | 游戏玩家、个人创作者 |
| **RTX Ada / RTX A 系列** | 专业工作站（渲染、设计） | RTX 6000 Ada、RTX A5000 | 设计师、工程师 |
| **数据中心（Data Center）** | AI 训练/推理、HPC | H100、A100、H200、B200 | 云厂商、AI 公司 |
| **Tegra / Jetson** | 嵌入式、边缘计算、车载 | Jetson Orin、Drive Thor | 机器人、自动驾驶 |
| **Quadro**（已并入 RTX 专业线） | 旧工作站品牌 | Quadro P6000 | — |

## 消费级：GeForce

### 命名规则

以 `RTX 4090` 为例：

- **RTX / GTX**：RTX 支持光线追踪（RT Core）和 DLSS；GTX 是老一代无光线追踪的命名。
- **40**：架构代次。数字越大越新，如 10 → 20 → 30 → 40 → 50。
- **90**：同代内的档位。常见档位：

| 档位 | 定位 |
| --- | --- |
| 90 | 旗舰（如 RTX 4090） |
| 80 / 80 Ti | 高端 |
| 70 | 中高端，甜点卡 |
| 60 | 主流，出货量最大 |
| 50 | 入门 |

- **后缀**：
  - `Ti` / `Super`：同档位加强版（如 RTX 4070 Ti）。
  - `Laptop / Max-Q`：笔记本版本，功耗与性能缩水。

### 历代架构（消费级）

| 架构 | 代表显卡 | 年份 | 特点 |
| --- | --- | --- | --- |
| Turing | RTX 20 系 | 2018 | 首次引入 RT Core、Tensor Core |
| Ampere | RTX 30 系 | 2020 | 算力大涨，挖矿潮 |
| Ada Lovelace | RTX 40 系 | 2022 | DLSS 3 帧生成，能效比提升 |
| Blackwell | RTX 50 系 | 2025 | DLSS 4、GDDR7 显存 |

## 专业工作站：RTX 系列

- 面向 CAD、渲染、影视后期等专业软件，驱动经过 **ISV 认证**（Autodesk、SolidWorks 等），稳定性和兼容性优先于游戏性能。
- 显存通常比同核心消费卡更大，支持 ECC（纠错）显存。
- 命名从 `Quadro` 过渡到 `RTX A 系列`（Ampere 代），再到 `RTX Ada 系列`（如 RTX 6000 Ada，48GB 显存）。

## 数据中心：计算卡

AI 时代的核心产品线，通常**没有视频输出接口**，专为计算设计。

| 型号 | 架构 | 显存 | 说明 |
| --- | --- | --- | --- |
| V100 | Volta | 16/32GB HBM2 | 首个 Tensor Core 计算卡 |
| A100 | Ampere | 40/80GB HBM2e | 上一代 AI 训练主力，支持 MIG |
| H100 | Hopper | 80GB HBM3 | 大模型训练主力，Transformer Engine |
| H200 | Hopper | 141GB HBM3e | H100 显存增强版 |
| B200 / GB200 | Blackwell | 192GB HBM3e | 新一代旗舰，常以 NVL72 整机柜交付 |
| L40S | Ada | 48GB GDDR6 | 推理与图形混合负载 |
| H20 / L20 | Hopper/Ada | 96GB | 面向中国市场的特供版（受出口管制） |

关键特性：

- **HBM 显存**：高带宽显存，带宽可达数 TB/s（消费卡是 GDDR，带宽低一个量级）。
- **NVLink / NVSwitch**：卡间高速互联，多卡训练时通信带宽远超 PCIe。
- **MIG（Multi-Instance GPU）**：把一张 A100/H100 切成最多 7 个硬件隔离实例，供多用户共享。
- **SXM / PCIe 形态**：SXM 版本功耗更高、性能更强，走 NVLink；PCIe 版本通用性好。

### 消费卡 vs 计算卡

| 维度 | GeForce（如 4090） | 计算卡（如 H100） |
| --- | --- | --- |
| 价格 | 万元级 | 20 万～30 万+ |
| 显存 | 24GB GDDR6X | 80GB HBM3 |
| 显存带宽 | ~1 TB/s | ~3.35 TB/s |
| ECC 纠错 | 无 | 有 |
| FP64（双精度） | 被大幅阉割 | 完整（HPC 需要） |
| 多卡互联 | PCIe | NVLink/NVSwitch |
| 许可 | EULA 禁止用于数据中心（推理小规模实际常见） | 官方支持 |

> 实践中，个人/小团队做模型微调和推理常用 4090/3090（24GB 显存性价比高）；大规模训练必须用计算卡 + 高速互联。

## 嵌入式与边缘：Jetson

- **Jetson 系列**（Nano、Xavier、Orin）：把 GPU + CPU + 内存集成在小板卡上，用于机器人、无人机、智能摄像头等边缘 AI 场景。
- **DRIVE 平台**：面向自动驾驶的车载计算平台。

## 历代架构速查

NVIDIA 架构均以科学家命名：

```text
Kepler → Maxwell → Pascal → Volta → Turing → Ampere → Ada Lovelace → Hopper → Blackwell
```

- **Pascal**（2016）：GTX 10 系，经典 1080 Ti。
- **Turing**（2018）：首上光追。
- **Ampere**（2020）：消费（30 系）与计算（A100）同架构。
- **Hopper**（2022）：专供数据中心（H100），消费端是 Ada。
- **Blackwell**（2024-2025）：消费 50 系与数据中心 B200 统一架构。

## 常用参考工具

- `nvidia-smi`：查看显卡型号、驱动、CUDA 版本、温度功耗等（见 [gpu.md](./gpu.md)）。
- **CUDA Compute Capability**：每张卡的"算力版本号"（如 4090 是 8.9，A100 是 8.0，H100 是 9.0），决定支持哪些 CUDA 特性，编译 kernel 和选深度学习框架版本时需要关注。

## 参考资料

- [NVIDIA 官网产品页](https://www.nvidia.com/en-us/)
- [CUDA GPU 算力版本列表](https://developer.nvidia.com/cuda-gpus)
- [NVIDIA 数据中心 GPU](https://www.nvidia.com/en-us/data-center/)
