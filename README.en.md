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
- **Magisk Module**: The Agent can be flashed as a Magisk / KernelSU / APatch module, running as a system service with auto-start on boot, and ships with the `cpctl` console for computer-free hot configuration.
- **Android App**: The official App works as both controller and controlled end: as a controller, it connects to the dashboard to view and control cloud phones (multi-touch, hardware keys, camera passthrough); as a controlled end, its built-in Controlled Mode runs the Agent directly on the phone via Root or Shizuku (ADB) engines — no computer needed. With Standalone Mode enabled, even the server runs inside the phone.

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

---

### 2.3 Non-Docker Deployment (Standalone Binary)
If you don't want to install Docker, you can run the server directly on a physical machine or cloud server as a single binary. Go to the [Releases](https://github.com/hqw700/ScrcpyOverWebRTC/releases) page, download the full release package `cloudphone-vX.Y.Z.zip`, and extract it — prebuilt binaries for Linux / macOS / Windows (amd64 / arm64) are all included.

Package structure:
*   `bin/<os>_<arch>/webrtc-signaling`: all-in-one signaling + web server binary
*   `assets/`: web frontend static assets and Agent one-click deployment packages
*   `certs/`: self-signed HTTPS certificate (replace it with your own certificate in production)
*   `data/`: persistent data directory (user accounts, device tags, snapshots, downloaded files)

*   **Startup (Linux / macOS)**:
    ```bash
    unzip cloudphone-vX.Y.Z.zip -d cloudphone
    cd cloudphone
    chmod +x start_server.sh
    ./start_server.sh
    ```
    `start_server.sh` automatically detects your OS and architecture and launches the matching binary.
*   **Windows**: after extracting, open the `bin\windows_amd64\` directory and run `run.bat` in a terminal.
*   **Advantages**: a single process with zero dependencies, binding directly to the host network (IPv6 dual-stack) with no container NAT overhead; only port `8443` needs to be exposed — no UDP port range mapping required.
*   **Difference from the Docker image**: the standalone build does not bundle a TURN relay server and falls back to a public STUN server for NAT traversal, which works out of the box on LANs or over direct public connections. If you need reliable relay across NATs, deploy your own coturn server and point to it:
    ```bash
    ./start_server.sh -ice_servers "turn:<user>:<password>@<TURN_SERVER_IP>:3478"
    ```
*   **Common flags** (append them after `start_server.sh`; they are passed through to the binary):
    *   `-port 9443`: change the listening port (default `8443`)
    *   `-no-auth`: disable login authentication (intranet testing only)
    *   `-ice_servers`: custom STUN/TURN server list
    *   `-debug`: verbose debug logging
*   **Data persistence**: all user data is stored in `./data` under the extracted directory. When upgrading, replace the binaries and `assets`, but do not overwrite the `data` directory.

---

### 2.4 Docker Environment Variables
Both Host mode and NAT/Bridge mode accept the following environment variables via `-e`:

| Variable | Default | Description |
| --- | --- | --- |
| `PUBLIC_IP` | `127.0.0.1` | The host's real IP, used to publish WebRTC ICE candidates. Use the public IP if available, otherwise the host's LAN IP |
| `TURN_USER` | `cloudphone_user` | TURN relay username — **must be changed in production** |
| `TURN_PASSWORD` | `cloudphone_secure_password` | TURN relay password — **must be changed in production** |
| `SIGNALING_PORT` | `8443` | Signaling / web service port inside the container |
| `USE_TLS` | `true` | Enable HTTPS; set to `false` to run in plain HTTP mode |
| `NO_AUTH` | - | Set to `true` to disable login authentication — **intranet debugging only; never enable it on public networks** |
| `DEFAULT_SETTINGS` | See below | Default video quality parameters for newly connected devices (JSON) |
| `EXTERNAL_SIGNALING_PORT` | Same as `SIGNALING_PORT` | The externally exposed signaling port for asymmetric port mapping (see 2.2 Strategy B) |
| `EXTERNAL_TURN_PORT` | `3478` | The externally exposed TURN port for asymmetric port mapping (see 2.2 Strategy B) |
| `COTURN_MIN_PORT` / `COTURN_MAX_PORT` | `50000` / `50100` | UDP port range used by the TURN relay; in Bridge mode it must match the `-p` mapping range (see 2.2 Strategy A) |

*   **DEFAULT_SETTINGS example**: `{"maxBitrate":4,"minBitrate":1,"fps":30,"size":1920,"bitrate":4}` — max bitrate (Mbps), min bitrate (Mbps), frame rate, long-edge resolution (px), and default bitrate.
*   **Full example**:
    ```bash
    docker run -d \
      --name cp-aio \
      --net=host \
      -v ./data:/app/data \
      -e PUBLIC_IP=<Host_IP> \
      -e TURN_USER=my_turn_user \
      -e TURN_PASSWORD=my_strong_password \
      -e DEFAULT_SETTINGS='{"maxBitrate":8,"minBitrate":2,"fps":60,"size":1920,"bitrate":6}' \
      buutuu/scrcpy-over-webrtc:latest
    ```

---

## 3. Deploy Android Agent (Onboarding)

Once the server is running, open the web dashboard and go to the **"Deploy New Device"** page. It dynamically generates onboarding commands and download links based on your current server address (Docker users can also run `docker logs cp-aio` to view the instructions). Three deployment methods are supported:

*   **One-click ADB deployment from a computer**: no root required; best for quick evaluation and temporary debugging
*   **Magisk / KSU flashable module**: requires root; runs as a system service with auto-start on boot — best for long-term operation
*   **Run the Agent inside the App**: no computer required; supports both Root and Shizuku (ADB) privilege modes

### 3.1 One-Click ADB Deployment from a Computer (No Root)
1. Access the web dashboard and enter the **"Deploy New Device"** page.
2. The page provides a unified **"One-Click Deployment Package (`agent-deploy.zip`)"** for download. Download and extract it on your local computer.
3. Connect the physical phone to the computer via USB and enable **"USB Debugging"** in developer options.
4. Open your local terminal, navigate to the extracted directory, and run the dynamically generated one-click script command:
   * **Linux / macOS**: `chmod +x run.sh && ./run.sh -id <Device_ID> -signaling ws://<Host_IP>:8443`
   * **Windows CMD**: `run.bat -id <Device_ID> -signaling ws://<Host_IP>:8443`

### 3.2 Magisk / KSU Flashable Module (Root, Auto-start on Boot)
Ideal for devices that need to stay enrolled long-term and rejoin automatically after reboot. Once flashed, the Agent runs as a background system service — no computer connection required.

1. **Prerequisites**: the phone is rooted and has Magisk, KernelSU, or APatch installed.
2. On the **"Deploy New Device"** page, switch to the **"Magisk / KSU Module"** tab, download `cloudphone-agent-magisk.zip`, and transfer it to the phone.
3. Open your Magisk / KernelSU manager, choose **"Install from local storage"**, select the ZIP, and **reboot** the phone after flashing.
4. **Configure the signaling address and device ID** (the page generates the commands dynamically; pick any one method):
   * **Method A (command line)**: run in an on-device terminal or `adb shell`:
     ```bash
     su
     cpctl set CP_AGENT_SIGNALING "wss://<Host_IP>:8443"
     cpctl set CP_AGENT_ID "<Device_ID>"
     cpctl restart
     ```
   * **Method B (interactive menu)**: run `su`, then `cpctl`, to open the interactive console.
   * **Method C (edit the config file)**: edit `/data/adb/modules/cloudphone-agent/config.conf`, save it, then **tap the Action button twice in a row** in the Magisk module page to hot-reload.
5. **Verify**: `adb shell "su -c cpctl status"`, or check the runtime log at `/data/local/tmp/cloudphone-agent.log`.

### 3.3 Run the Agent Inside the App (Root / Shizuku Dual Mode)
If you'd rather not rely on a computer, install the CloudPhone App on the phone and launch the Agent from its built-in **"Controlled Mode"**. The App bundles the Agent binary and the streaming service for your architecture — no files need to be pushed to the phone.

1. Download and install the CloudPhone App (APK) from the [Releases](https://github.com/hqw700/ScrcpyOverWebRTC/releases) page.
2. Open the App and tap **"Enter Controlled Mode"** on the login page or the device list page.
3. **Choose an execution engine** (either one):
   * **Root mode**: on rooted devices, the Agent runs via `su` (supports Magisk / KernelSU / APatch).
   * **ADB (Shizuku) mode**: the **root-free** option. Install and activate [Shizuku](https://shizuku.rikka.app/) on the phone first (on Android 11+, it can be activated directly via "Wireless debugging"). After granting Shizuku access in the App, the Agent runs as the `shell` user (UID 2000) — ADB privileges natively include screen capture and input injection, so unrooted physical phones can be fully controlled.
4. Enter the **signaling server address** (`ws://` or `wss://`, e.g. `wss://<Host_IP>:8443`) and a **unique device ID** in the UI, then tap start to onboard.
5. The UI shows the Agent PID and recent logs in real time for troubleshooting.

> [!TIP]
> The App's controlled mode also includes a **"Standalone Mode"**: when enabled, the signaling server and web dashboard run on the phone itself, and any LAN browser can connect directly at `https://<Phone_IP>:8443` — no external server required.

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