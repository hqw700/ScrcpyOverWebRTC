# Scrcpy over WebRTC (CloudPhone)

基于 WebRTC 和 Scrcpy 的高性能、低延迟云手机/云桌面解决方案，无需客户端，可以通过网页直接连接。

## 快速开始

### 1. 启动服务器

```bash
# 默认启动 (IPv4)
./start_server.sh

# 开启 IPv6/双栈支持 (推荐)
# Windows 用户请进入 bin/ 运行 run.bat
./bin/linux_amd64/webrtc-signaling -host :: -assets ./assets/v1
```

启动后访问：`http://localhost:8443` 或 `http://[您的IPv6地址]:8443/`

### 2. 部署 Agent 到 Android

```bash
cd agentd
# IPv6也可以只填写ipv4地址
./run.sh -id my-phone -signaling ws://<服务器IP>:8443
```

#### 3. Docker / Redroid 容器 (暂不支持自动公网穿透)
Agent 运行在隔离容器内时，需要-external-addr host地址, 使用 -p 50000:50000/udp转发端口
```bash
./run.sh -id redroid-01 \
  -signaling ws://<服务器IP>:8443 \
  -external-addr <host ip> \
  -webrtc-port 50000
```


## IPv6 使用注意事项 (重要)

- **双端公网**: 真正的 IPv6 P2P 直连要求**手机端**和**浏览器端**都拥有公网 IPv6 地址。
- **防火墙**: 需在路由器中放行 TCP **8443** (信令) 和 UDP **50000** (WebRTC) 端口。
- **混合探测**: Agent 具备自动感知 IPv6 变化的能力，优先协商公网链路。

## 目录结构

```
ScrcpyOverWebRTC/
├── web-app/              # 前端源代码 (开源)
├── bin/                  # 信令服务器 (各平台)
│   ├── linux_amd64/
│   ├── linux_arm64/
│   ├── darwin_amd64/
│   ├── darwin_arm64/
│   ├── windows_amd64/
│   └── windows_arm64/
├── agentd/               # Android Agent
│   ├── cloudphone-agent-arm64
│   ├── cloudphone-agent-amd64
│   ├── scrcpy-server.jar
│   └── run.sh
├── start_server.sh      # 启动脚本
├── build.sh             # 编译脚本
└── README.md
```

## 前端开发 (web-app)

### 快速构建
```bash
./build.sh
```

### 技术栈
- Vue 3 + Composition API
- Vite 构建工具
- Pinia 状态管理
- WebRTC 视频流传输

### 本地开发
```bash
cd web-app
npm install
npm run dev
```

### 构建
```bash
npm run build
```

### 功能特性
- **设备列表**: 实时显示在线设备
- **远程控制**: WebRTC 视频流 + 触摸/按键控制
- **WebADB**: 浏览器内 ADB 终端
- **一键部署**: WebUSB 自动部署 Agent
- **IPv6 支持**: 全自动双栈协商，绕过 CGNAT

### 响应式设计
- **PC 端**: 悬浮面板 + 可调整大小
- **移动端**: 全屏模式，横屏视频自动旋转

## Agent 部署参数

```bash
./run.sh -id <设备ID> -signaling ws://<服务器IP>:8443 [其他参数]
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-id` | 设备唯一标识 | 必填 |
| `-signaling` | 信令服务器地址 | 必填 |
| `-external-addr` | 手动指定公网 IP | 自动检测 |
| `-webrtc-port` | WebRTC 端口 | 50000 |
| `-bitrate` | 视频码率 | 4000000 |
| `-max-fps` | 最高帧率 | 不限制 |
| `-max-size` | 视频最长边 | 不限制 |

## 协议说明

前端暴露的协议信息，方便第三方开发：

### 信令协议
- WebSocket 路径: `/connect_client`
- 消息类型: `offer`, `answer`, `ice_candidate`, `device_list`, `device_quit`

### WebRTC DataChannel
- `video`: 视频流
- `input`: 触摸/按键输入
- `adb`: ADB 数据透传

### 触摸协议
```json
{"type":"touch", "id":0, "action":0, "x":100, "y":200, "w":1080, "h":1920}
```
- action: 0=DOWN, 1=UP, 2=MOVE

## 第三方开发

基于本项目，你可以：
- 定制 UI 样式和布局
- 开发 iOS/Android 原生客户端
- 使用其他框架重写前端 (React, Angular 等)

## License

MIT License - 前端源代码开源

Agent 和信令服务器二进制文件仅供学习和个人使用。
