# Scrcpy over WebRTC (CloudPhone)

基于 WebRTC 和 Scrcpy 的高性能、低延迟云手机/云桌面解决方案，无需客户端，可以通过网页直接连接。
采用 **Fat Agent (直连模式)** 架构，结合 **硬件级 PTS 透传** 技术，实现媲美原生 Scrcpy 的丝滑体验。

## 核心特性

- **极致流畅 (Phase 22)**: 引入硬件级时钟透传 (HW-PTS Passthrough)，WebRTC Jitter Buffer 接近 0ms，彻底消除画面抖动。
- **性能卓越**: 采用零扫描流解析 (Zero-Search Parsing)，极大降低 Agent 端 CPU 占用。
- **秒级直连**: 绕过中转服务器，实现浏览器与 Android 容器/物理机的 P2P 高速通信。
- **全能交互**: 支持触控、物理按键模拟、WebADB 终端、实时快照与仪表盘管理。
- **一键部署**: 支持 WebUSB/WebADB 浏览器直连部署，无需本地安装 ADB 环境。

## 目录结构说明 (V5.0+)

发布包经过资源去重优化，结构如下：

- `start_server.sh`: **【推荐】** 根目录智能启动脚本，自动识别系统架构并启动服务。
- `bin/`: 存放各平台（Linux/macOS/Windows）的信令服务器二进制文件。
- `assets/`: 中央资源库，包含 V1 (默认) 和 V2 (新版) 两个版本的 Web 前端。
- `agentd/`: 安卓端代理服务。包含部署脚本 `run.sh`、Agent 程序及 `scrcpy-server.jar`。

## 快速使用

### 1. 启动信令服务器与 Web 前端

在发布包根目录下，根据您的需求选择 UI 版本启动：

- **启动默认 UI (V1)**: 
  ```bash
  ./start_server.sh
  ```
- **启动新版 UI (V2)**: 
  ```bash
  ./start_server.sh v2
  ```

*Windows 用户请进入 `bin/windows_amd64/` 运行 `run.bat` (V1) 或 `run_v2.bat` (V2)。*

启动后访问：`http://127.0.0.1:8443`。

### 2. 在 Android 端部署 Agent

#### 方式一：网页一键部署（最简单）
1. 在浏览器打开仪表盘，点击 **“部署新设备”**。
2. 通过 USB 线连接手机，点击“连接设备”并授权。
3. 点击“一键部署”，系统将自动探测架构并启动服务。

#### 方式二：命令行脚本部署 (CLI)
适用于已有 ADB 环境或远程物理机。
```bash
cd agentd
# 自动探测架构并推送 (将 IP 替换为服务器实际 IP)
./run.sh -id phone-01 -signaling ws://192.168.x.x:8443
```

#### 方式三：Docker / Redroid 容器 (支持 NAT 穿透)
如果 Agent 运行在隔离容器内，需映射 UDP 端口（默认 50000）并指定外部 IP。
```bash
./run.sh -id redroid-01 \
  -signaling ws://<服务器IP>:8443 \
  -external-addr <宿主机公网/局域网IP> \
  -webrtc-port 50000
```

## 技术参数说明 (高级调优)

在启动 Agent 时，可以通过参数进一步优化体验：

- `-bitrate`: 视频码率（默认 4000000 bps）。
- `-max-fps`: 限制最高帧率（默认不限制，建议 60）。
- `-video-codec-options`: 编码器底层调优。
  - *默认推荐*: `"intra-refresh-period=30,i-frame-interval=0"` (启用渐进式刷新，消除 UDP 丢包导致的卡顿)。
- `-snapshot-interval`: 仪表盘快照更新频率（默认 10 秒）。
- `-root`: 强制以 Root 权限启动服务（解决部分 ROM 权限限制）。

---
*本项目持续迭代中
