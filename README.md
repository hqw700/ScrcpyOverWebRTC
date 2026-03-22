# Scrcpy over WebRTC

基于 WebRTC 和 Scrcpy 的高性能云手机/云桌面解决方案。
采用极简的 Fat Agent 架构，实现端到端的秒级直连体验。

## 目录结构说明

发布包中包含以下组件：

- `server/`: 信令服务器 (Signaling Server) 与 Web 前端静态资源。包含多种系统架构的预编译版本。
- `agentd/`: 安卓端代理服务 (CloudPhone Agent)。包含部署脚本、Agent 程序及 Scrcpy 依赖。

## 快速使用

### 1. 启动信令服务器与 Web 前端
进入 `server` 目录，找到对应您操作系统的文件夹（例如 macOS 苹果芯片使用 `darwin_arm64`，Linux 使用 `linux_amd64`，Windows 使用 `windows_amd64`）。

- **Windows**: 双击运行 `run.bat`
- **Linux / macOS**: 在终端执行 `./run.sh`

启动后，在浏览器中访问仪表盘：`http://127.0.0.1:8443`（如果部署在云端，请使用服务器的局域网或公网 IP）。

### 2. 在 Android 端启动 Agent

#### 方式一：网页一键部署（推荐）

打开仪表盘页面，进入 **部署** 页面，通过 USB 数据线将 Android 设备连接到电脑，按页面提示即可完成一键部署。

浏览器会通过 WebUSB 直接与手机通信，自动完成架构探测、文件推送和服务启动，无需安装任何命令行工具。

> **注意**: 此方式需要使用支持 WebUSB 的浏览器（Chrome / Edge），且必须通过 **USB 数据线** 连接设备，暂不支持无线 ADB。首次连接时请在手机屏幕上确认 USB 调试授权。

#### 方式二：命令行脚本部署

发布包在 `agentd` 目录下提供了一个自动化的 `run.sh` 脚本，它会自动探测设备架构、推送文件并启动 Agent。

```bash
cd agentd

# 使用默认在线设备启动 (将 192.168.x.x 替换为信令服务器的实际 IP)
./run.sh -id my-device-01 -signaling ws://192.168.x.x:8443

# 如果有多个 adb 设备，可以指定 Serial Number
./run.sh emulator-5554 -id my-device-01 -signaling ws://192.168.x.x:8443
```

#### 方式三：Docker / Redroid 容器环境 (NAT 网络穿透)

如果您的 Agent 运行在 Docker 容器（如 redroid）中，且**前端无法直接访问容器的私有 IP**，则需要映射 UDP 端口并指定外部 IP。

1. **容器启动时映射 UDP 端口**
   在启动 redroid 容器时，必须增加 `-p 50000:50000/udp` 将容器内的 WebRTC 端口暴露到宿主机。
   *(每个容器需要分配不同的外部 UDP 端口，例如 `-p 50001:50001/udp` 等)*

2. **使用脚本启动 Agent，带上网络穿透参数**
   ```bash
   cd agentd
   ./run.sh -id my-redroid-01 \
     -signaling ws://<信令服务器IP>:8443 \
     -external-addr <宿主机的公网/局域网IP> \
     -webrtc-port 50000 \
     -bitrate 8000000
   ```

> **参数说明**:
> - `-id`: 设定当前云手机的唯一标识。如果不填将自动使用设备型号+序列号。
> - `-signaling`: 填写第一步中启动的信令服务器的 IP 地址与端口。
> - `-bitrate`: 视频流码率（默认 4000000）。
> - `-root`: (可选) 如果在部分系统上遇到没有截屏或触摸权限的问题，加入此参数通过 `su` 特权启动 scrcpy。
> - `-external-addr`: (仅容器需要) 指定宿主机对外的 IP，用于 WebRTC NAT 穿透。
> - `-webrtc-port`: (仅容器需要) 强制指定 Agent 内部监听的 UDP 端口（默认 50000），配合 `-external-addr` 使用。

启动成功后，回到浏览器的仪表盘网页，即可看到新注册上线的云手机，点击它即可进入毫秒级低延迟的 WebRTC 桌面体验！
