# Scrcpy over WebRTC (CloudPhone)

[中文](README.md) | English

📖 **Official Technical Documentation & Deployment Guide**: 👉 [https://webrtc-phone.com/docs/](https://webrtc-phone.com/docs/)

A high-performance, low-latency cloud phone/cloud desktop solution based on WebRTC and Scrcpy. No client required; you can connect directly through a web browser.
It adopts a **Fat Agent (Direct Connection)** architecture, combined with **Hardware-level PTS Passthrough** technology, to achieve a silky-smooth experience comparable to native Scrcpy.

<p align="center">
  <img src="screenshot/screenshot-pc.png" width="70%" />
  <img src="screenshot/screenshot-phone.jpg" width="20%" />
</p>

## 1. Core Features

- **Ultimate Smoothness**: Utilizes Zero-Search Parsing, avoiding any new memory copies. Performance is practically identical to native scrcpy.
- **Public Network Enhancement**: Native support for IPv6 direct connection, completely bypassing carrier CGNAT blockades, significantly improving NAT hole punching success rates under mobile networks.
- **All-Around Interaction**: Supports multi-finger touch, physical key simulation, custom key mappings (mapping keyboard keys to screen actions), WebADB console, and real-time snapshots.
- **Dynamic Control**: Dynamically modify device resolution, bitrate, framerate, and toggle BWE (Bandwidth Estimation) dynamic bitrate from the UI panel, either before or after connecting.
- **One-Click Deployment**: Supports deploying the Agent directly to physical devices via browser using WebUSB/WebADB. No local ADB environment required.
- **Direct Web Access**: Supports connection from any OS (iOS/Android/Windows/Mac/Linux) simply via a web browser.
- **Group Control**: High-sync rate group control, sub-machines support high frame rate previews.
- **ADB-Free**: Supports running with root privileges.

## 2. Quick Start

```bash
docker pull buutuu/scrcpy-over-webrtc:latest
```

### 🔑 Default Connection Address & Credentials
Once the services are successfully started, you can access the admin dashboard via browser on any device within the same network:
* **Access URL**: `https://<YOUR_HOST_IP>:8443` (Signaling & Web runs in HTTPS mode by default)
* **Default Username**: `admin`
* **Default Password**: `admin123`

### 2.1 Host Network Mode (Recommended)
If your Linux host has a public IP or is in a pure intranet environment with no port conflicts, **Host mode is the preferred option**.

*   **Startup Command**:
    ```bash
    docker run -d \
      --name cp-aio \
      --net=host \
      -e PUBLIC_IP=<Host_IP> \
      buutuu/scrcpy-over-webrtc:latest
    ```
*   **Advantages**: The container directly uses the host's network stack, resulting in zero NAT forwarding overhead, no need to expose large UDP port ranges, and maximum network throughput.
*   **Note**: Ensure that ports `3478` (TURN) and `8443` (Signaling) on the host are not occupied by other services.
*   **PUBLIC_IP**: Fill in the public IP if available, or the host's LAN IP for intranet usage.

---

### 2.2 NAT / Bridge Network Mode (Regular)
If running on macOS, Windows, or other environments where Docker virtualization is used, or if port exposure via `-p` is mandatory, follow these two strategies. **Avoid exposing the entire `49152-65535` port range (which can cause host OOM crashes)**.

#### Strategy A: Narrow TURN UDP Port Range Mapping
Expose only a very narrow UDP port range (e.g., 100 ports) in the config.

*   **Startup Command (Symmetric Mapping)**:
    ```bash
    docker run -d --name cp-aio \
      -p 8443:8443 \
      -p 3478:3478/tcp \
      -p 3478:3478/udp \
      -p 55000-55100:55000-55100/udp \
      -e PUBLIC_IP=<Host_IP> \
      -e COTURN_MIN_PORT=55000 \
      -e COTURN_MAX_PORT=55100 \
      buutuu/scrcpy-over-webrtc:latest
    ```

#### Strategy B: Asymmetric Port Mapping (Important)
If the default ports on the host (like 8443, 3478) are occupied, forcing you to map external ports to asymmetric ones (e.g., 8443 mapped to 18443, 3478 mapped to 13478).

> [!WARNING]
> If started directly, the signaling service inside the container will not know the external mapped ports and will continue to distribute the default `3478` to the frontend. This will cause the frontend to fail to connect to `Host:3478`, resulting in a black screen.
> 
> **Solution**: You must pass the `EXTERNAL_SIGNALING_PORT` and `EXTERNAL_TURN_PORT` environment variables to inform the container of the external mapped ports.

*   **Startup Command (Asymmetric Port Mapping)**:
    ```bash
    docker run -d --name cp-aio \
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

*   **PUBLIC_IP**: Fill in the public IP if available, or the host's LAN IP for intranet usage.

## 3. Deploy Android Agent (Onboarding)

Once the container is running, all connection details will be printed in the logs. Run the following command to view instructions:
```bash
docker logs cp-aio
```

### 3.1 One-Click Script Deployment (Preferred)
1. Access the web dashboard and enter the **"Deploy New Device"** page.
2. The page provides a unified **"One-Click Deployment Package (`agent-deploy.zip`)"** for download. Download and extract it on your local computer.
3. Connect the physical phone to the computer via USB and enable **"USB Debugging"** in developer options.
4. Open your local terminal, navigate to the extracted directory, and run the dynamically generated one-click script command:
   * **Linux / macOS**: `chmod +x run.sh && ./run.sh -id <Device_ID> -signaling ws://<Host_IP>:8443`
   * **Windows CMD**: `run.bat -id <Device_ID> -signaling ws://<Host_IP>:8443`

---

## 4. Frontend Secondary Development

The frontend source code is fully open-source and located in the `web-app` directory. We provide a **"Local Frontend + Official Docker AIO Backend"** hybrid development mode. You do not need to configure a Go build environment locally to perform real-time hot-reloading development.

1. **Prepare Backend**: Start the official AIO container as described above.
2. **Install Frontend Dependencies**:
   ```bash
   cd web-app
   npm install
   ```
3. **Local Development & Hot Reloading**:
   Start the dev server by specifying the backend IP and port (Vite proxy will forward API and WebSocket connections to the container automatically):
   ```bash
   VITE_PROXY_TARGET=http://localhost:8443 npm run dev
   ```
4. **Build Frontend**:
   ```bash
   npm run build
   ```
   The build artifacts will be outputted to the root `assets/` directory by default.

> 💡 For detailed directory structure, development parameters, and Docker mount debugging instructions, please check the document: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

> [!IMPORTANT]
> **Release Package Notice**:
> This open-source repository only hosts the frontend `web-app` source code. If you need the pre-compiled Go/C++ backend signaling and media binaries (`bin/` directory), physical Android Agent deployment packages, one-click startup scripts, and native server-free deployment versions, please download the fully packaged releases directly from the [Releases](https://github.com/hqw700/ScrcpyOverWebRTC/releases) page.

## License

**MIT License** - Frontend `web-app` directory source code is open source.

*Note: The binary core components inside the official Docker image are for educational and personal testing purposes only.*