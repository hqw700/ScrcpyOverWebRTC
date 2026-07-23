# Scrcpy over WebRTC (穿云投屏)

中文 | [English](README.en.md)

📖 **官方技术文档与保姆级部署指南**：👉 [https://webrtc-phone.com/docs/](https://webrtc-phone.com/docs/)

基于 WebRTC 和 Scrcpy 的高性能、低延迟云手机解决方案，无需客户端，可以通过网页直接连接。
采用 **Fat Agent (直连模式)** 架构，结合 **硬件级 PTS 透传** 技术，实现媲美原生 Scrcpy 的丝滑体验。

<p align="center">
  <img src="screenshot/screenshot-pc.png" width="70%" />
  <img src="screenshot/screenshot-phone.jpg" width="20%" />
</p>

## 1. 核心特性

- **极致流畅**: 采用零扫描流解析 (Zero-Search Parsing)，不引入新的内存拷贝，性能和原生scrcpy基本一致。
- **公网增强**: 原生支持 IPv6 直连，彻底绕过运营商 CGNAT 封锁，显著提升移动网络下的打洞成功率。
- **全能交互**: 支持多指触控、物理按键模拟、自定义映射（键盘按键映射到屏幕）、WebADB 终端、实时高频快照。
- **动态控制**: 支持在连接前或连接后通过 UI 面板动态修改设备分辨率、码率、帧率以及开启/关闭 BWE 动态码率。
- **一键部署**: 支持 WebUSB/WebADB 浏览器直连物理设备部署，无需本地安装 ADB 环境。
- **网页直连**: 支持所有终端（IOS/Android/Win/Mac/Linux）通过浏览器连接。
- **支持群控**: 支持高同步率群控, 从控机器支持高帧率预览。
- **Magisk 模块**: 支持将 Agent 刷入为 Magisk / KernelSU / APatch 模块，作为系统服务开机自启保活，内置 `cpctl` 控制台实现免电脑热配置。
- **安卓APP**: 官方 App 主控/被控一体：作为主控端可直接操控手机（多点触控、音频、双向剪切板）；作为被控端支持 Root 与 Shizuku (ADB) 双引擎免电脑运行 Agent；开启单机模式后服务端亦可运行在手机内，彻底摆脱服务器。

## 2. 快速开始
### 🔑 默认连接地址与账户凭证
服务拉起成功后，在同局域网的电脑/手机浏览器中即可打开管理仪表盘大盘：
* **访问地址**：`https://<您的宿主机IP>:8443` (信令与 Web 默认以 HTTPS 模式运行)
* **默认管理员账号**：`admin`
* **默认管理员密码**：`admin123`

### 2.1 Host 网络模式 (推荐)
如果您的 Linux 宿主机有独立的公网 IP 或是纯内网环境，且没有端口占用冲突，**首选 Host 模式**。

*   **启动命令**:
    ```bash
    docker run -d \
      --pull=always \
      --rm \
      --name cp-aio \
      --net=host \
      -v ./data:/app/data \
      -e PUBLIC_IP=<宿主机真实IP> \
      buutuu/scrcpy-over-webrtc:latest
    ```
*   **优势**: 容器直接使用宿主机网络，零 NAT 转发损耗，无需映射大量 UDP 端口段，网络吞吐量最高。
*   **注意**: 必须确保宿主机上 `3478`（TURN）和 `8443`（信令）等端口未被其他服务占用。
*   **用户数据目录挂载**: `-v ./data:/app/data` 容器会把所有的持久化资产包括用户账号 users.json、设备标签及下载的文件保存在宿主机本地的 `./data` 目录下，保证升级时不被覆盖。
*   **PUBLIC_IP**: 当有公网IP时填入公网IP，当局域网内使用内填入宿主机IP

---

### 2.2 NAT / Bridge 网络模式 (常规)
如果运行在 macOS、Windows 等 Docker 虚拟化环境，或者出于安全考量必须使用 `-p` 映射端口，请务必遵循以下两条策略，**切忌映射整个 `49152-65535` 端口段（会导致宿主机 OOM 崩溃）**。

#### 策略 A：收窄 TURN UDP 端口段映射
在配置中指定一个极窄的中转 UDP 端口区间（如 100 个），并只放行此范围。

*   **启动命令 (常规对称映射)**:
    ```bash
    docker run -d --name cp-aio \
      --pull=always \
      --rm \
      -p 8443:8443 \
      -p 3478:3478/tcp \
      -p 3478:3478/udp \
      -p 55000-55100:55000-55100/udp \
      -v ./data:/app/data \
      -e PUBLIC_IP=<宿主机物理IP> \
      -e COTURN_MIN_PORT=55000 \
      -e COTURN_MAX_PORT=55100 \
      buutuu/scrcpy-over-webrtc:latest
    ```

#### 策略 B：非对称端口映射（重点）
当宿主机的默认端口（如 8443、3478）被其他服务占用，导致您不得不将外部端口映射为非对称端口（如 8443 映射为 18443，3478 映射为 13478）时。

> [!WARNING]
> 如果直接启动，容器内部的信令服务由于不知道外部映射了什么端口，依然会将默认的 `3478` 作为 TURN 地址下发给前端。导致前端网页尝试连接 `宿主机:3478` 失败而黑屏。
> 
> **解决方案**：必须传入 `EXTERNAL_SIGNALING_PORT` 和 `EXTERNAL_TURN_PORT` 环境变量，明确告知容器外部映射的公开端口。

*   **启动命令 (非对称端口映射)**:
    ```bash
    docker run -d --name cp-aio \
      --pull=always \
      --rm \
      -p 18443:8443 \
      -p 13478:3478/tcp \
      -p 13478:3478/udp \
      -p 55000-55100:55000-55100/udp \
      -e PUBLIC_IP=192.168.100.242 \
      -e COTURN_MIN_PORT=55000 \
      -e COTURN_MAX_PORT=55100 \
      -e EXTERNAL_SIGNALING_PORT=18443 \
      -e EXTERNAL_TURN_PORT=13478 \
      buutuu/scrcpy-over-webrtc:latest
    ```

*   **PUBLIC_IP**: 当有公网IP时填入公网IP，当局域网内使用内填入宿主机IP
*   **用户数据目录挂载**: `-v ./data:/app/data` 容器会把所有的持久化资产包括用户账号 users.json、设备标签及下载的文件保存在宿主机本地的 `./data` 目录下，保证升级时不被覆盖。

### 2.3 非 Docker 部署 (绿色单二进制)
如果您不想安装 Docker，可以直接在物理机或云服务器上以单二进制方式运行。前往 [Releases](https://github.com/hqw700/ScrcpyOverWebRTC/releases) 页面下载完整发布包 `cloudphone-vX.Y.Z.zip`，解压即用，内置 Linux / macOS / Windows (amd64 / arm64) 全平台二进制。

发布包核心目录结构：
*   `bin/<os>_<arch>/webrtc-signaling`：信令 + Web 服务单二进制
*   `assets/`：Web 前端静态资源与 Agent 一键部署资源包
*   `certs/`：HTTPS 自签名证书（生产环境可替换为自己的证书）
*   `data/`：持久化数据目录（用户账号、设备标签、快照、下载文件）

*   **启动命令 (Linux / macOS)**:
    ```bash
    unzip cloudphone-vX.Y.Z.zip -d cloudphone
    cd cloudphone
    chmod +x start_server.sh
    ./start_server.sh
    ```
    `start_server.sh` 会自动识别当前系统与架构，拉起对应的二进制。
*   **Windows**: 解压后进入 `bin\windows_amd64\` 目录，在终端执行 `run.bat`。
*   **优势**: 单进程零依赖，直接监听宿主机网络（IPv6 双栈），无容器 NAT 损耗；服务端只需放行 `8443` 一个端口，无需映射 UDP 端口段。
*   **与 Docker 版的差异**: 非 Docker 版不内置 TURN 中转服务，默认通过公共 STUN 打洞，局域网或公网直连场景开箱即用。如需跨 NAT 稳定中转，请自建 coturn 并通过参数指定：
    ```bash
    ./start_server.sh -ice_servers "turn:用户名:密码@<TURN服务器IP>:3478"
    ```
*   **常用参数**（追加在 `start_server.sh` 之后即可透传）:
    *   `-port 9443`：修改监听端口（默认 `8443`）
    *   `-no-auth`：关闭登录认证（仅限内网测试使用）
    *   `-ice_servers`：自定义 STUN/TURN 服务器列表
    *   `-debug`：输出详细调试日志
*   **数据持久化**: 所有用户数据保存在解压目录的 `./data` 下，升级时替换二进制与 `assets` 即可，请勿覆盖 `data` 目录。

---

### 2.4 Docker 环境变量参数说明
无论是 Host 模式还是 NAT/Bridge 模式，都可以通过 `-e` 传入以下环境变量定制容器行为：

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PUBLIC_IP` | `127.0.0.1` | 宿主机真实 IP，用于 WebRTC ICE 候选地址发布。有公网填公网 IP，纯局域网填宿主机内网 IP |
| `TURN_USER` | `cloudphone_user` | TURN 中转服务认证用户名，**生产环境务必修改** |
| `TURN_PASSWORD` | `cloudphone_secure_password` | TURN 中转服务认证密码，**生产环境务必修改** |
| `SIGNALING_PORT` | `8443` | 容器内部信令 / Web 服务监听端口 |
| `USE_TLS` | `true` | 是否启用 HTTPS，设为 `false` 后以 HTTP 模式运行 |
| `NO_AUTH` | - | 设为 `true` 时关闭登录认证，**仅限内网调试，公网环境严禁开启** |
| `DEFAULT_SETTINGS` | 见下方说明 | 新接入设备的默认画质参数 (JSON) |
| `EXTERNAL_SIGNALING_PORT` | 同 `SIGNALING_PORT` | 非对称端口映射时，外部实际暴露的信令端口（见 2.2 策略 B） |
| `EXTERNAL_TURN_PORT` | `3478` | 非对称端口映射时，外部实际暴露的 TURN 端口（见 2.2 策略 B） |
| `COTURN_MIN_PORT` / `COTURN_MAX_PORT` | `50000` / `50100` | TURN 媒体中转使用的 UDP 端口段，Bridge 模式下需与 `-p` 映射范围保持一致（见 2.2 策略 A） |

*   **DEFAULT_SETTINGS 示例**：`{"maxBitrate":4,"minBitrate":1,"fps":30,"size":1920,"bitrate":4}`，分别对应最高码率 (Mbps)、最低码率 (Mbps)、帧率、分辨率长边像素与默认码率。
*   **完整示例**：
    ```bash
    docker run -d \
      --pull=always \
      --rm \
      --name cp-aio \
      --net=host \
      -v ./data:/app/data \
      -e PUBLIC_IP=<宿主机真实IP> \
      -e TURN_USER=my_turn_user \
      -e TURN_PASSWORD=my_strong_password \
      -e DEFAULT_SETTINGS='{"maxBitrate":8,"minBitrate":2,"fps":60,"size":1920,"bitrate":6}' \
      buutuu/scrcpy-over-webrtc:latest
    ```

---

## 3. 添加手机：部署 Android Agent (入网)

服务端拉起后，访问网页管理后台进入 **“部署新设备”** 页面，页面会根据当前服务地址动态生成接入指令与资源包下载（Docker 用户也可以通过 `docker logs cp-aio` 查看接入说明）。支持以下三种部署方式：

*   **电脑 ADB 一键部署**：无需 Root，适合快速体验与临时调试
*   **Magisk / KSU 刷机模块**：需要 Root，作为系统服务开机自启，适合长期运行
*   **App 内运行 Agent**：无需电脑，支持 Root 与 Shizuku (ADB) 两种权限模式

### 3.1 电脑 ADB 一键部署 (无需 Root)
1. 访问网页管理后台，进入 **“部署新设备”** 页面。
2. 页面上提供统一的 **“一键部署资源包 (`agent-deploy.zip`)”** 下载。下载并解压在您的电脑端。
3. 将物理手机使用 USB 线连接电脑，开启 **「USB 调试」**。
4. 在电脑终端进入解压后的一键包目录，执行由页面动态生成的如下一键脚本指令：
   * **Linux / macOS**: `chmod +x run.sh && ./run.sh -id <自定义设备ID> -signaling ws://<宿主机IP>:8443`
   * **Windows CMD**: `run.bat -id <自定义设备ID> -signaling ws://<宿主机IP>:8443`

### 3.2 Magisk / KSU 刷机模块 (Root 开机自启)
适合需要长期运行、重启后自动入网的设备。刷入后 Agent 作为系统后台服务运行，无需连接电脑即可开机自启并保活。

1. **前置条件**：手机已 Root，并已安装 Magisk、KernelSU 或 APatch 模块管理器。
2. 在 **“部署新设备”** 页面切换到 **“Magisk / KSU 刷机模块”** 选项卡，下载 `cloudphone-agent-magisk.zip` 并传输到手机。
3. 打开 Magisk / KernelSU 管理器，选择 **“从本地安装”** 并选中该 ZIP，刷入成功后 **重启手机**。
4. **配置信令地址与设备 ID**（页面会动态生成命令，任选一种方式）：
   * **方式 A (命令行)**：在手机终端或 `adb shell` 中执行：
     ```bash
     su
     cpctl set CP_AGENT_SIGNALING "wss://<宿主机IP>:8443"
     cpctl set CP_AGENT_ID "<自定义设备ID>"
     cpctl restart
     ```
   * **方式 B (交互式菜单)**：`su` 后运行 `cpctl` 打开交互控制台修改。
   * **方式 C (编辑配置文件)**：编辑 `/data/adb/modules/cloudphone-agent/config.conf`，保存后在 Magisk 模块界面 **连续点击 2 次 Action 按钮** 热重载生效。
5. **验证状态**：`adb shell "su -c cpctl status"`，或查看运行日志 `/data/local/tmp/cloudphone-agent.log`。

### 3.3 App 内运行 Agent (Root / Shizuku 双模式)
不想依赖电脑时，可以直接在手机上安装 CloudPhone App，通过 App 内置的 **“被控端模式”** 拉起 Agent。App 已内置对应架构的 Agent 二进制与投屏服务，无需向手机推送任何文件。

1. 从 [Releases](https://github.com/hqw700/ScrcpyOverWebRTC/releases) 页面下载并安装 CloudPhone App (APK)。
2. 打开 App，在登录页或设备列表页点击 **“进入被控端模式”**。
3. **选择运行引擎**（二选一）：
   * **Root 模式**：已 Root 设备直接通过 `su` 提权运行（支持 Magisk / KernelSU / APatch）。
   * **ADB (Shizuku) 模式**：**免 Root** 方案。先在手机上安装并激活 [Shizuku](https://shizuku.rikka.app/)（Android 11+ 可通过「无线调试」直接激活），在 App 内完成 Shizuku 授权后，Agent 将以 `shell` 用户 (UID 2000) 身份运行——ADB 权限原生具备屏幕截取与输入注入能力，因此未 Root 的物理真机也能完整被控。
4. 在界面中填写 **信令服务器地址**（`ws://` 或 `wss://`，如 `wss://<宿主机IP>:8443`）与 **设备唯一 ID**，点击启动即可入网。
5. 界面会实时显示 Agent 进程 PID 与最近运行日志，方便排查问题。

> [!TIP]
> App 被控端还内置 **“独立单机模式”**：开启后信令服务与 Web 大盘也一并运行在该手机内，局域网浏览器直接访问 `https://<手机IP>:8443` 即可连接，完全无需外部服务器。

---

## 4. 前端二次开发指引 ( Development )

前端源码位于 `web-app` 目录下，完全开源。我们提供 **“本地前端 + 官方 Docker AIO 容器后端”** 的极速混合开发模式，无需在本地配置繁琐的 Go 编译环境即可实时热更新开发。

1. **准备后端**：参考前文启动官方 AIO 容器。
2. **安装前端依赖**：
   ```bash
   cd web-app
   npm install
   ```
3. **本地开发与实时热更新**：
   通过指定后端的 IP 地址启动开发服务器（Vite 的代理会将所有的 API 和 WebSocket 连接自动转发给容器）：
   ```bash
   # 如果后端跑在本地
   VITE_PROXY_TARGET=http://localhost:8443 npm run dev
   ```
4. **编译构建**：
   ```bash
   npm run build
   ```
   打包产物默认输出至根目录的 `assets/` 目录下。

> 💡 详细的前端目录结构、开发参数调优和 Docker 挂载联调说明，请直接查阅文档：[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

> [!IMPORTANT]
> **发布介质说明**：
> 本开源仓库仅托管前端 `web-app` 的全部源码。如果您需要以及免 Docker 的原生物理服务器部署版本和免服务器部署版本（全部运行在Android手机内），请直接前往 [releases](https://github.com/hqw700/ScrcpyOverWebRTC/releases) 页面下载官方打包好的完整发布包。

## License

**MIT License** - 前端 `web-app` 目录源代码开源。

*注意：官方 Docker 镜像内的二进制核心组件仅供学习和个人测试使用。*