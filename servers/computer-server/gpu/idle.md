# GPU idle

GPU idle 就是 GPU 处于“空闲/无事可做”的状态。通常表现为 nvidia-smi 里 GPU-Util 为 0% 或极低，功耗、频率、温度下降，可能进入低功耗 P-State

GPU idle = GPU 没活干。
任务没跑时它是正常省电状态；任务在跑却长期 idle，通常说明瓶颈在 CPU、数据、同步、通信或请求量，而不是 GPU 本身。

## 常见表现

- `nvidia-smi` 中 `GPU-Util` 接近 0%
- `Power Draw` 明显降低
- 核心频率降到较低水平
- 显存可能仍被占用，但计算 kernel 没执行
- 多卡训练时，可能只有部分卡忙，其他卡 idle

## 出现 GPU idle？

常见原因：

1. **CPU/数据加载瓶颈**：GPU 算得很快，但 CPU 预处理、DataLoader、磁盘/网络读取太慢。
2. **频繁同步**：代码里频繁 `.item()`、`.cpu()`、`print(loss)`、`torch.cuda.synchronize()`，导致 GPU 等 CPU。
3. **batch 太小或模型太小**：kernel 启动开销占比高，GPU 刚启动就结束。
4. **推理请求不足**：在线服务 QPS 低，没有开启动态 batching/连续批处理。
5. **通信等待**：分布式训练中 NCCL all-reduce、节点间网络慢，GPU 等通信。
6. **锁/队列/进程问题**：Docker、K8s、MIG、CUDA\_VISIBLE\_DEVICES 配错，任务没真正用到 GPU。
7. **显存占用但 util 为 0**：进程存在，可能只是占着显存，没有提交计算 kernel。
8. **正常空闲**：任务完成、服务无请求、弹性伸缩缩容前。

## 影响

- 对训练：训练变慢，GPU 利用率低，成本浪费。
- 对推理：吞吐低、延迟高、资源闲置。
- 对云 GPU：即使 idle 也通常按小时计费，浪费钱。
- 对硬件：idle 本身不伤卡，反而功耗低、温度低。
