# GPU

> 🎮 图形处理器（Graphics Processing Unit），从图形渲染专用芯片发展为通用并行计算的引擎。

GPU 是一种专门用于**大规模并行计算**的处理器。最初为图形渲染设计，如今广泛应用于游戏、深度学习、科学计算、视频编解码、加密货币挖矿等领域。

## GPU 与 CPU 的区别

| 维度 | CPU | GPU |
| --- | --- | --- |
| 设计目标 | 通用计算、复杂逻辑控制 | 大规模并行、简单重复计算 |
| 核心数量 | 几个到几十个（强单核） | 数百到数万个（弱单核） |
| 擅长任务 | 串行任务、分支判断、系统调度 | 矩阵运算、像素处理、向量计算 |
| 缓存 | 大缓存，降低延迟 | 小缓存，靠高吞吐掩盖延迟 |
| 类比 | 一位全能的博士（一次干一件事） | 一万个小学生（一起干简单的事） |

一句话：**CPU 负责"决策"，GPU 负责"干活"**。CPU 适合处理依赖上下文、分支多的任务；GPU 适合把同一件事重复上万遍的任务。

## 常见分类

- **集成显卡（iGPU）**：集成在 CPU 里（如 Intel Iris、AMD APU），共享内存，功耗低，性能有限，满足日常办公、视频播放。
- **独立显卡（dGPU）**：单独插卡（如 NVIDIA RTX 系列、AMD RX 系列），自带显存（VRAM），性能强，用于游戏、渲染、AI 计算。
- **计算卡（GPGPU / 数据中心卡）**：如 NVIDIA A100/H100、Tesla 系列，专为计算设计，通常没有视频输出，显存大、带宽高。

## 核心概念

- **CUDA 核心 / 流处理器（SP）**：GPU 的基本计算单元。数量越多，并行能力越强。
- **显存（VRAM）**：GPU 专用的内存，存放纹理、模型参数、中间计算结果。AI 训练中显存大小往往决定能跑多大的模型/多大的 batch。
- **显存带宽**：显存与计算单元之间的数据吞吐能力，单位 GB/s。带宽不足时，核心算得再快也只能"等数据"。
- **算力（FLOPS）**：每秒浮点运算次数。常见精度：FP32（通用）、FP16/BF16（AI 训练）、INT8（推理量化）。Tensor Core 专门加速矩阵乘。
- **Tensor Core**：NVIDIA 的矩阵计算专用单元，是深度学习加速的关键。
- **RT Core**：光线追踪专用单元，用于游戏实时光追。
- **TDP**：热设计功耗，显卡发热与供电需求的参考。
- **CUDA**：NVIDIA 的 GPU 编程平台/生态；对应 AMD 的是 ROCm。绝大多数深度学习框架（PyTorch、TensorFlow）底层都走 CUDA。

## 常见厂商

- **NVIDIA**：市场份额最大，CUDA 生态几乎垄断 AI 计算。产品线：GeForce（消费）、RTX A 系列（工作站）、A100/H100（数据中心）。
- **AMD**：Radeon（消费）、Instinct（计算卡），ROCm 生态。
- **Intel**：Arc 独显、Xe 核显，主推 oneAPI。
- **国产**：摩尔线程、壁仞、昇腾（华为）、寒武纪等，主打信创与国产 AI 算力。

## 典型应用场景

- **图形渲染**：游戏、3D 建模、影视特效（Blender、Unity、Unreal）。
- **深度学习**：训练与推理大模型，本质是海量矩阵乘法，正好命中 GPU 的并行特长。
- **科学计算**：天气模拟、分子动力学、金融建模（HPC 集群）。
- **视频编解码**：NVENC/NVDEC 硬件编解码，直播转码、剪辑导出。
- **挖矿**：以太坊等曾大量使用 GPU 算力（后转向 ASIC/PoS）。

## 常用命令

```bash
# 查看 GPU 状态（NVIDIA）
nvidia-smi

# 持续监控
nvidia-smi -l 1          # 每 1 秒刷新
watch -n 1 nvidia-smi    # Linux/macOS 下等效写法
```

`nvidia-smi` 关键字段：

- `GPU-Util`：计算核心利用率（0% 说明没活干，见 [idle.md](./idle.md)）
- `Memory-Usage`：显存占用 / 总显存
- `Power Draw`：当前功耗
- `Temperature`：温度
- `Processes`：占用 GPU 的进程及显存

## 服务器中的 GPU

- **GPU 服务器**：一台机器插多张卡（4 卡、8 卡常见），通过 NVLink/PCIe 互联，常用于 AI 训练。
- **虚拟化**：通过 vGPU、MIG（Multi-Instance GPU，把一张 A100/H100 切成多个隔离实例）实现多用户共享。
- **K8s 调度**：使用 `nvidia.com/gpu` 资源声明分配 GPU，配合 NVIDIA device plugin。
- **计费**：云 GPU 按小时计费，**idle 也要花钱**，所以要关注利用率（参见 [GPU idle](./idle.md)）。

## 参考资料

- [NVIDIA CUDA 官方文档](https://docs.nvidia.com/cuda/)
- [GPU 与 CPU 的区别](https://www.nvidia.com/en-us/data-center/what-is-a-gpu/)
