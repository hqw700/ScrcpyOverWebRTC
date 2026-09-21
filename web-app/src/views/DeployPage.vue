<template>
  <div class="deploy-page">
    <div class="deploy-layout">
      <!-- 左侧: 参数表单 -->
      <section class="form-section">
        <h2 class="section-title">网页一键 USB 部署</h2>

        <div class="webusb-warning">
          ⚠️ <b>使用须知</b>：本网页 USB 部署基于 WebUSB 协议，<b>不支持无线或网络 ADB 调试模式</b>，物理手机必须使用数据线直接连接当前电脑的 USB 端口。<br>
          💡 <b>防坑提醒</b>：若连接时提示 <i>"already in use" (设备被占用)</i>，通常是电脑后台运行了本地 ADB 或手机助手，只需在电脑终端中执行 <code>adb kill-server</code> 释放占用即可。
        </div>

        <div class="form-group">
          <label class="form-label">Signaling 地址 <span class="required">*</span></label>
          <input
            v-model="form.signalingUrl"
            class="form-input"
            placeholder="例如: wss://cloudphone.example.com:8443 或 wss://192.168.1.2:8443"
          >
          <div class="form-hint">需填写信令服务器地址（支持域名或 IP，支持自动补全协议），例如：<br>域名加密: <code>wss://cloudphone.example.com:8443</code> 或 <code>wss://cloudphone.example.com</code><br>局域网 IP: <code>ws://192.168.1.2:8443</code> 或 <code>192.168.1.2:8443</code></div>
        </div>

        <div class="form-group">
          <label class="form-label">ICE Servers 地址</label>
          <input
            v-model="form.iceServers"
            class="form-input"
            placeholder="stun:stun.l.google.com:19302"
          >
          <div class="form-hint">自定义 ICE 服务器，多个以英文逗号分隔，如：stun:stun.l.google.com:19302,turn:user:pass@host:port</div>
        </div>

        <div class="form-group">
          <label class="form-label">Device ID</label>
          <input
            v-model="form.deviceId"
            class="form-input"
            placeholder="留空自动生成"
          >
        </div>

        <div class="form-group">
          <label class="form-label">编码参数</label>
          <input
            v-model="form.videoCodecOptions"
            class="form-input"
            placeholder="留空使用默认值"
          >
          <div class="form-hint">默认: intra-refresh-period=30,i-frame-interval=2,vendor.rtc-ext-enc-low-latency=1</div>
        </div>

        <div class="form-group">
          <label class="form-label">External Addr</label>
          <input
            v-model="form.externalAddr"
            class="form-input"
            placeholder="留空不设置"
          >
          <div class="form-hint">非直连环境需填写转发端口的宿主机ip，如redroid环境，需填写redroid宿主机ip。</div>
        </div>

        <div class="form-group">
          <label class="form-label">WebRTC Port</label>
          <input
            v-model="form.webrtcPort"
            class="form-input"
            placeholder="留空不设置，默认 50000端口"
          >
        </div>

        <button
          class="deploy-btn"
          :disabled="isDeploying || !form.signalingUrl"
          @click="startDeploy"
        >
          {{ isDeploying ? '正在部署...' : '连接 USB 设备并部署' }}
        </button>
      </section>

      <!-- 右侧: 部署进度与手动部署指导 -->
      <div class="right-column">
        <!-- 部署日志/进度 -->
        <section class="log-section">
          <h2 class="section-title">USB 自动化部署进度</h2>

          <!-- 步骤列表 -->
          <div class="steps">
            <div v-for="(step, i) in steps" :key="i" class="step" :class="stepClass(i)">
              <span class="step-icon">{{ stepIcon(i) }}</span>
              <span class="step-label">{{ step }}</span>
            </div>
          </div>

          <!-- 进度条 -->
          <div class="progress-bar" v-if="isDeploying || deployProgress > 0">
            <div class="progress-inner" :style="{ width: deployProgress + '%' }"></div>
          </div>

          <!-- 状态 -->
          <div v-if="deployStatus" class="status-line" :class="{ error: deployError, success: deployProgress === 100 }">
            {{ deployStatus }}
          </div>

          <!-- 日志区域 -->
          <div class="log-area" ref="logArea">
            <div v-if="deployLog.length === 0" class="log-empty">等待部署...</div>
            <div v-for="(line, i) in deployLog" :key="i" class="log-line">{{ line }}</div>
          </div>
        </section>

        <!-- 手动部署与命令行 ADB / Magisk 指导 -->
        <section class="manual-section">
          <div class="manual-header">
            <div class="manual-header-title-group">
              <h2 class="section-title">独立部署与配置指导</h2>
              <span class="manual-header-desc">适合离线运行、机房多机批量群控或长期开机自启部署</span>
            </div>
            <!-- 方式选择 Tab -->
            <div class="deploy-mode-tabs">
              <button 
                class="mode-tab-btn" 
                :class="{ active: manualMode === 'adb' }" 
                @click="manualMode = 'adb'"
              >
                <span class="tab-icon">💻</span>
                <span class="tab-text">电脑 ADB 一键部署 (无需 Root)</span>
              </button>
              <button 
                class="mode-tab-btn magisk-tab" 
                :class="{ active: manualMode === 'magisk' }" 
                @click="manualMode = 'magisk'"
              >
                <span class="tab-icon">📱</span>
                <span class="tab-text">Magisk / KSU 刷机模块 (Root 开机自启)</span>
              </button>
            </div>
          </div>

          <!-- 途径一：电脑 ADB 一键部署 -->
          <div v-if="manualMode === 'adb'" class="manual-mode-block">
            <!-- 部署前准备 -->
            <div class="manual-prereqs">
              <div class="qs-prereq-title">📋 电脑 ADB 部署前准备：</div>
              <ul class="qs-prereq-list">
                <li><b>手机端配置</b>：进入手机「设置 -> 开发者选项」开启<b>「USB 调试」</b>，并通过 USB 数据线连接电脑。</li>
                <li><b>电脑端配置</b>：电脑已安装 <b>ADB 工具</b>（终端运行 <code>adb devices</code> 可识别设备且状态为 <code>device</code>）。</li>
              </ul>
            </div>
            
            <!-- 连贯自适应步骤流 -->
            <div class="step-flow-layout">
              <!-- 第一步：下载部署包 -->
              <div class="flow-step-card download-step-card">
                <div class="step-header">
                  <span class="step-badge">第一步</span>
                  <span class="step-title">获取 ADB 部署包</span>
                </div>
                <div class="download-action-banner gold-banner">
                  <div class="banner-left">
                    <div class="banner-icon">⚡</div>
                    <div class="banner-info">
                      <div class="banner-title">ADB 一键部署资源包 (ZIP)</div>
                      <div class="banner-desc">包含全平台 Agent 原生二进制、核心投屏库、单机与多机批量一键启动脚本，解压即可通过 ADB 运行。</div>
                      <div class="banner-tags">
                        <span class="tag-pill">内置 run.sh / run.bat</span>
                        <span class="tag-pill">内置 batch_start 批量群控</span>
                        <span class="tag-pill">全架构: arm64 / v7a / x86_64</span>
                      </div>
                    </div>
                  </div>
                  <a href="/agent/agent-deploy.pkg" download="agent-deploy.zip" class="banner-download-btn gold-btn">
                    <span class="btn-icon">📥</span>
                    <span class="btn-text">立即下载 (ZIP)</span>
                  </a>
                </div>
              </div>

              <!-- 第二步：本地终端运行一键脚本 -->
              <div class="flow-step-card guide-step-card">
                <div class="step-header">
                  <span class="step-badge">第二步</span>
                  <span class="step-title">本地终端运行一键脚本</span>
                </div>
                <p class="step-desc">解压下载的 <code>agent-deploy.zip</code> 并进入解压后的目录，然后执行下方对应系统的部署脚本命令：</p>

                <!-- 单台设备命令网格 -->
                <div class="command-grid">
                  <div class="command-card">
                    <div class="script-box-title">
                      <span class="os-tag unix">Linux / macOS</span>
                      <span>单机 ADB 部署</span>
                    </div>
                    <div class="code-container">
                      <pre class="code-block wrap">chmod +x run.sh && {{ shCommand }}</pre>
                      <button class="copy-code-btn" @click="copyCommand(`chmod +x run.sh && ${shCommand}`)">复制</button>
                    </div>
                  </div>

                  <div class="command-card">
                    <div class="script-box-title">
                      <span class="os-tag win">Windows CMD</span>
                      <span>单机 ADB 部署</span>
                    </div>
                    <div class="code-container">
                      <pre class="code-block wrap">{{ batCommand }}</pre>
                      <button class="copy-code-btn" @click="copyCommand(batCommand)">复制</button>
                    </div>
                  </div>
                </div>

                <!-- 多机批量群控启动提示卡片 -->
                <div class="batch-deploy-banner">
                  <div class="batch-banner-header">
                    <span class="batch-tag">多机群控</span>
                    <span class="batch-title">🔥 批量拉起所有已连接设备 (自动遍历 adb devices)</span>
                  </div>
                  <p class="batch-desc">
                    部署包内已内置批量启动脚本，自动遍历并并发拉起所有连接正常的 Android 设备：
                  </p>
                  
                  <div class="command-grid batch-command-grid">
                    <div class="command-card">
                      <div class="script-box-title">
                        <span class="os-tag unix">Linux / macOS</span>
                        <span>多机批量启动</span>
                      </div>
                      <div class="code-container">
                        <pre class="code-block wrap">chmod +x batch_start.sh && {{ batchShCommand }}</pre>
                        <button class="copy-code-btn" @click="copyCommand(`chmod +x batch_start.sh && ${batchShCommand}`)">复制</button>
                      </div>
                    </div>

                    <div class="command-card">
                      <div class="script-box-title">
                        <span class="os-tag win">Windows CMD</span>
                        <span>批量启动 (或双击 batch_start.bat)</span>
                      </div>
                      <div class="code-container">
                        <pre class="code-block wrap">{{ batchBatCommand }}</pre>
                        <button class="copy-code-btn" @click="copyCommand(batchBatCommand)">复制</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 第三步：验证在线状态 -->
              <div class="flow-step-card verify-step-card">
                <div class="step-header">
                  <span class="step-badge">第三步</span>
                  <span class="step-title">验证 Agent 在线状态与运行日志</span>
                </div>
                <div class="code-container">
                  <pre class="code-block wrap"># 验证 Agent 后台进程是否在线 (有进程输出即正常)
adb shell "ps -A | grep cloudphone-agent"

# 查看 Agent 实时运行日志
adb shell "cat /data/local/tmp/cloudphone-agent.log"</pre>
                  <button class="copy-code-btn" @click="copyCommand(checkAgentCmd)">复制命令</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 途径二：Magisk / KernelSU / APatch 刷机模块 -->
          <div v-else-if="manualMode === 'magisk'" class="manual-mode-block">
            <div class="manual-prereqs magisk-prereqs">
              <div class="qs-prereq-title magisk-title">📋 Magisk 模块部署前准备：</div>
              <ul class="qs-prereq-list">
                <li><b>设备权限要求</b>：物理手机需<b>已 Root</b>，并已安装 Magisk、KernelSU 或 APatch 模块管理器。</li>
                <li><b>服务优势</b>：刷入后作为系统后台服务自动运行，设备重启后无需电脑连接即可<b>自动开机自启并保活</b>。</li>
              </ul>
            </div>
            
            <div class="step-flow-layout">
              <!-- 第一步：下载 Magisk 模块包 -->
              <div class="flow-step-card download-step-card">
                <div class="step-header">
                  <span class="step-badge magisk-badge">第一步</span>
                  <span class="step-title">获取 Magisk 模块刷机包</span>
                </div>
                <div class="download-action-banner magisk-banner">
                  <div class="banner-left">
                    <div class="banner-icon">📱</div>
                    <div class="banner-info">
                      <div class="banner-title">Magisk / KSU 刷机模块 (ZIP)</div>
                      <div class="banner-desc">专属模块压缩包，内置全架构自适应二进制、开机自启看门狗以及 cpctl 运维控制台工具。</div>
                      <div class="banner-tags">
                        <span class="tag-pill magisk-pill">自动探测架构</span>
                        <span class="tag-pill magisk-pill">开机自启看门狗</span>
                        <span class="tag-pill magisk-pill">支持离线预设配置</span>
                      </div>
                    </div>
                  </div>
                  <div class="banner-action-group">
                    <a href="/agent/cloudphone-agent-magisk.pkg" download="cloudphone-agent-magisk.zip" class="banner-download-btn magisk-btn">
                      <span class="btn-icon">📥</span>
                      <span class="btn-text">下载刷机包 (ZIP)</span>
                    </a>
                    <a href="/agent/magisk-config-tools.pkg" download="magisk-config-tools.zip" class="banner-download-btn magisk-tool-btn" title="包含 Windows 拖拽即用批处理与 Mac/Linux 离线配置脚本">
                      <span class="btn-icon">🛠️</span>
                      <span class="btn-text">离线配置工具 (ZIP)</span>
                    </a>
                  </div>
                </div>
              </div>

              <!-- 第二步：刷入模块与参数配置 -->
              <div class="flow-step-card guide-step-card">
                <div class="step-header">
                  <span class="step-badge magisk-badge">第二步</span>
                  <span class="step-title">刷入模块与参数配置</span>
                </div>
                <p class="step-desc">打开手机上的 Magisk / KernelSU 管理器，选择“从本地安装”并选中 <code>cloudphone-agent-magisk.zip</code>，刷入成功后<b>重启手机</b>。首次使用可通过以下任一方式配置信令：</p>

                <!-- 配置方式卡片网格 -->
                <div class="magisk-methods-container">
                  <!-- 方式 A -->
                  <div class="magisk-method-card active-method">
                    <div class="method-header">
                      <span class="method-tag">推荐首选</span>
                      <span class="method-title">方式 A：命令行一键配置 (手机终端 / ADB shell)</span>
                    </div>
                    <div class="code-container">
                      <pre class="code-block wrap">{{ magiskCommand }}</pre>
                      <button class="copy-code-btn" @click="copyCommand(magiskCommand)">复制</button>
                    </div>
                  </div>

                  <!-- 方式 B & 方式 C -->
                  <div class="magisk-method-subgrid">
                    <div class="magisk-submethod-card">
                      <div class="submethod-title">🎮 方式 B：交互式控制台菜单 (cpctl)</div>
                      <p class="submethod-desc">在手机终端 (如 Termux) 执行 <code>su</code> 然后输入 <code>cpctl</code> 打开交互控制台，按 <code>4</code> 即可视化修改信令地址、ICE Servers、设备 ID 与视频码率。</p>
                    </div>
                    <div class="magisk-submethod-card config-tool-card">
                      <div class="submethod-header-row">
                        <div class="submethod-title">🛠️ 方式 C：电脑离线预设定制 (推荐批量刷机)</div>
                        <a href="/agent/magisk-config-tools.pkg" download="magisk-config-tools.zip" class="tool-download-btn" title="点击下载轻量配置工具包 (约 15KB)">
                          <span>📥 下载配置工具包</span>
                        </a>
                      </div>
                      <p class="submethod-desc">
                        解压工具包与 <code>cloudphone-agent-magisk.zip</code> 置于同目录，预先写入信令地址再刷入手机，开机自动上线：
                      </p>
                      <div class="tool-usage-tips">
                        <div class="tip-item">
                          <span class="tip-os win">Windows</span>
                          <span class="tip-text">免装环境，直接将 <code>.zip</code> 拖拽到 <code>configure_magisk.bat</code> 上即可</span>
                        </div>
                        <div class="tip-item">
                          <span class="tip-os unix">macOS / Linux</span>
                          <span class="tip-text">终端执行 <code>{{ magiskToolShCommand }}</code>（或直接运行向导）</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 第三步：验证状态 -->
              <div class="flow-step-card verify-step-card">
                <div class="step-header">
                  <span class="step-badge magisk-badge">第三步</span>
                  <span class="step-title">验证 Magisk 模块服务状态</span>
                </div>
                <div class="code-container">
                  <pre class="code-block wrap"># 查看控制台状态 (显示 RUNNING 即正常在线)
adb shell "su -c cpctl status"   # 手机终端执行: su -> cpctl status

# 实时滚动查看服务运行日志
adb shell "su -c cpctl log"</pre>
                  <button class="copy-code-btn" @click="copyCommand(checkMagiskCmd)">复制命令</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, nextTick, onMounted, computed } from 'vue'
import { useDeploy } from '@/composables/useDeploy'

const { isDeploying, deployStatus, deployProgress, deployError, deployLog, deployAgent } = useDeploy()

const logArea = ref(null)
const manualMode = ref('adb') // 'adb' | 'magisk'

const form = reactive({
  signalingUrl: '',
  deviceId: '',
  maxFps: 60,
  videoCodecOptions: '',
  externalAddr: '',
  webrtcPort: '',
  iceServers: '',
})

const steps = ['连接 USB 设备', 'ADB 认证', '探测架构', '推送文件', '启动服务']

function currentStep() {
  if (deployProgress.value >= 100) return 5
  if (deployProgress.value >= 80) return 4
  if (deployProgress.value >= 40) return 3
  if (deployProgress.value >= 20) return 2
  if (isDeploying.value) return 0
  return -1
}

function stepClass(i) {
  const cur = currentStep()
  if (deployError.value && i === cur) return 'error'
  if (i < cur) return 'done'
  if (i === cur) return 'active'
  return ''
}

function stepIcon(i) {
  const cur = currentStep()
  if (deployError.value && i === cur) return '✗'
  if (i < cur) return '✓'
  if (i === cur) return '⟳'
  return '○'
}

// 自动滚动日志
watch(deployLog, async () => {
  await nextTick()
  if (logArea.value) {
    logArea.value.scrollTop = logArea.value.scrollHeight
  }
}, { deep: true })

async function startDeploy() {
  localStorage.setItem('signalingAddr', form.signalingUrl)
  await deployAgent({
    signalingUrl: form.signalingUrl,
    deviceId: form.deviceId || undefined,
    maxFps: form.maxFps,
    videoCodecOptions: form.videoCodecOptions || undefined,
    externalAddr: form.externalAddr || undefined,
    webrtcPort: form.webrtcPort || undefined,
    iceServers: form.iceServers || undefined,
  })
}

// 提取当前信令服务的 IP 和 Port 供脚本命令生成使用
const signalingIp = computed(() => {
  let url = (form.signalingUrl || '').trim()
  url = url.replace('https://', '').replace('http://', '').replace('wss://', '').replace('ws://', '')
  return url || window.location.host
})

// 响应式生成 Unix/macOS 的一键部署命令
const shCommand = computed(() => {
  const host = signalingIp.value
  const ip = host.split(':')[0] || '127.0.0.1'
  const isPlain = form.signalingUrl.startsWith('ws://') || form.signalingUrl.startsWith('http://')
  const protocol = isPlain ? 'ws' : 'wss'
  const deviceIdArg = form.deviceId ? ` -id ${form.deviceId}` : ''
  const maxFpsArg = form.maxFps > 0 ? ` -max-fps ${form.maxFps}` : ''
  const codecArg = form.videoCodecOptions ? ` -video-codec-options "${form.videoCodecOptions}"` : ''
  const extArg = form.externalAddr ? ` -external-addr ${form.externalAddr}` : ''
  const portArg = form.webrtcPort ? ` -webrtc-port ${form.webrtcPort}` : ''
  
  let iceServersArg = ` -ice-servers "turn:cloudphone_user:cloudphone_secure_password@${ip}:3478?transport=udp,stun:${ip}:3478"`
  if (form.iceServers) {
    iceServersArg = ` -ice-servers "${form.iceServers}"`
  }

  return `./run.sh${deviceIdArg} -signaling "${protocol}://${host}"${maxFpsArg}${codecArg}${extArg}${portArg}${iceServersArg}`
})

// 响应式生成 Windows CMD 的一键部署命令
const batCommand = computed(() => {
  const host = signalingIp.value
  const ip = host.split(':')[0] || '127.0.0.1'
  const isPlain = form.signalingUrl.startsWith('ws://') || form.signalingUrl.startsWith('http://')
  const protocol = isPlain ? 'ws' : 'wss'
  const deviceIdArg = form.deviceId ? ` -id ${form.deviceId}` : ''
  const maxFpsArg = form.maxFps > 0 ? ` -max-fps ${form.maxFps}` : ''
  const codecArg = form.videoCodecOptions ? ` -video-codec-options "${form.videoCodecOptions}"` : ''
  const extArg = form.externalAddr ? ` -external-addr ${form.externalAddr}` : ''
  const portArg = form.webrtcPort ? ` -webrtc-port ${form.webrtcPort}` : ''
  
  let iceServersArg = ` -ice-servers "turn:cloudphone_user:cloudphone_secure_password@${ip}:3478?transport=udp,stun:${ip}:3478"`
  if (form.iceServers) {
    iceServersArg = ` -ice-servers "${form.iceServers}"`
  }

  return `run.bat${deviceIdArg} -signaling "${protocol}://${host}"${maxFpsArg}${codecArg}${extArg}${portArg}${iceServersArg}`
})

// 响应式生成 Unix/macOS 的多机批量启动命令
const batchShCommand = computed(() => {
  const host = signalingIp.value
  const ip = host.split(':')[0] || '127.0.0.1'
  const isPlain = form.signalingUrl.startsWith('ws://') || form.signalingUrl.startsWith('http://')
  const protocol = isPlain ? 'ws' : 'wss'
  const maxFpsArg = form.maxFps > 0 ? ` -max-fps ${form.maxFps}` : ''
  const codecArg = form.videoCodecOptions ? ` -video-codec-options "${form.videoCodecOptions}"` : ''
  const extArg = form.externalAddr ? ` -external-addr ${form.externalAddr}` : ''
  const portArg = form.webrtcPort ? ` -webrtc-port ${form.webrtcPort}` : ''
  
  let iceServersArg = ` -ice-servers "turn:cloudphone_user:cloudphone_secure_password@${ip}:3478?transport=udp,stun:${ip}:3478"`
  if (form.iceServers) {
    iceServersArg = ` -ice-servers "${form.iceServers}"`
  }

  return `./batch_start.sh -signaling "${protocol}://${host}"${maxFpsArg}${codecArg}${extArg}${portArg}${iceServersArg}`
})

// 响应式生成 Windows CMD 的多机批量启动命令
const batchBatCommand = computed(() => {
  const host = signalingIp.value
  const ip = host.split(':')[0] || '127.0.0.1'
  const isPlain = form.signalingUrl.startsWith('ws://') || form.signalingUrl.startsWith('http://')
  const protocol = isPlain ? 'ws' : 'wss'
  const maxFpsArg = form.maxFps > 0 ? ` -max-fps ${form.maxFps}` : ''
  const codecArg = form.videoCodecOptions ? ` -video-codec-options "${form.videoCodecOptions}"` : ''
  const extArg = form.externalAddr ? ` -external-addr ${form.externalAddr}` : ''
  const portArg = form.webrtcPort ? ` -webrtc-port ${form.webrtcPort}` : ''
  
  let iceServersArg = ` -ice-servers "turn:cloudphone_user:cloudphone_secure_password@${ip}:3478?transport=udp,stun:${ip}:3478"`
  if (form.iceServers) {
    iceServersArg = ` -ice-servers "${form.iceServers}"`
  }

  return `batch_start.bat -signaling "${protocol}://${host}"${maxFpsArg}${codecArg}${extArg}${portArg}${iceServersArg}`
})

// 响应式生成 Magisk / KSU 的命令
const magiskCommand = computed(() => {
  const host = signalingIp.value
  const ip = host.split(':')[0] || '127.0.0.1'
  const isPlain = form.signalingUrl.startsWith('ws://') || form.signalingUrl.startsWith('http://')
  const protocol = isPlain ? 'ws' : 'wss'
  const sig = `${protocol}://${host}`
  const iceServersVal = form.iceServers || `turn:cloudphone_user:cloudphone_secure_password@${ip}:3478?transport=udp,stun:${ip}:3478`
  const iceCmd = iceServersVal ? `\ncpctl set CP_AGENT_ICE_SERVERS "${iceServersVal}"` : ''
  const devIdCmd = form.deviceId ? `\ncpctl set CP_AGENT_ID "${form.deviceId}"` : ''
  return `su\ncpctl set CP_AGENT_SIGNALING "${sig}"${iceCmd}${devIdCmd}\ncpctl restart`
})

// 响应式生成 Magisk 离线配置工具执行命令
const magiskToolShCommand = computed(() => {
  const host = signalingIp.value
  const isPlain = form.signalingUrl.startsWith('ws://') || form.signalingUrl.startsWith('http://')
  const protocol = isPlain ? 'ws' : 'wss'
  const sig = `${protocol}://${host}`
  return `./configure_magisk.sh -s "${sig}"`
})

// 常用验证与状态检测命令
const checkAgentCmd = 'adb shell "ps -A | grep cloudphone-agent"'
const checkMagiskCmd = 'adb shell "su -c cpctl status"'

// 一键复制命令到剪贴板
function copyCommand(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('命令已成功复制到剪贴板！')
  }).catch(err => {
    console.error('复制失败:', err)
    alert('复制失败，请手动选择复制。')
  })
}

// 格式化后端返回的 ICE Servers 数组为逗号分隔的参数格式
function formatIceServers(servers) {
  if (!Array.isArray(servers)) return ''
  const result = []
  servers.forEach(srv => {
    if (!srv.urls || !Array.isArray(srv.urls)) return
    srv.urls.forEach(url => {
      if ((url.startsWith('turn:') || url.startsWith('turns:')) && srv.username) {
        const prefix = url.startsWith('turn:') ? 'turn:' : 'turns:'
        const hostPart = url.substring(prefix.length)
        result.push(`${prefix}${srv.username}:${srv.credential || ''}@${hostPart}`)
      } else {
        result.push(url)
      }
    })
  })
  return result.join(',')
}

// 从后端接口动态拉取已配置的 ICE 服务器列表，自动填充默认值
async function fetchIceServers() {
  try {
    const res = await fetch('/api/ice_servers')
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        const formatted = formatIceServers(data)
        if (formatted) {
          form.iceServers = formatted
        }
      }
    }
  } catch (err) {
    console.error('获取 ICE Servers 失败:', err)
  }
}

onMounted(async () => {
  // 强行跟随当前访问的服务器配置地址与协议，防止多网卡或者部署环境改变导致的缓存污染
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
  form.signalingUrl = protocol + window.location.host
  
  // 先自动填上基于当前域名的默认 ICE Server 地址，以保证输入框立即有值并实现兜底
  const host = signalingIp.value
  const ip = host.split(':')[0] || '127.0.0.1'
  form.iceServers = `turn:cloudphone_user:cloudphone_secure_password@${ip}:3478?transport=udp,stun:${ip}:3478`

  await fetchIceServers()
})
</script>

<style scoped>
.deploy-page {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.deploy-layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 24px;
  max-width: 1440px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 20px 0;
  color: var(--text-primary);
}

/* 表单 */
.form-section {
  background: var(--bg-surface, var(--bg-secondary));
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  align-self: start;
}

.form-group {
  margin-bottom: 16px;
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.form-hint {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.6;
  margin-top: 4px;
  word-break: break-all;
}

.form-row .form-label {
  margin-bottom: 0;
}

.required {
  color: var(--error, #f44);
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  background: var(--bg-primary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent);
}

/* Toggle switch */
.toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--border);
  border-radius: 22px;
  transition: 0.2s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.2s;
}

.toggle input:checked + .toggle-slider {
  background: var(--accent);
}

.toggle input:checked + .toggle-slider::before {
  transform: translateX(18px);
}

.deploy-btn {
  width: 100%;
  padding: 10px;
  margin-top: 8px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.deploy-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.deploy-btn:disabled {
  background: var(--bg-hover);
  color: var(--text-muted);
  cursor: not-allowed;
}

/* 手动部署下载区域样式 */
.divider {
  height: 1px;
  background: var(--border);
  margin: 20px 0;
  opacity: 0.8;
}

.manual-download-box {
  display: flex;
  flex-direction: column;
}

.sub-section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--text-primary);
}

.download-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.download-action-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  text-decoration: none;
  color: var(--text-primary);
  font-size: 12px;
  transition: all 0.2s ease;
}

.download-action-btn:hover {
  border-color: var(--accent);
  background: rgba(59, 130, 246, 0.05);
}

.download-action-btn .btn-name {
  font-weight: 500;
}

.download-action-btn .download-icon-text {
  font-size: 11px;
  color: var(--accent);
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.download-action-btn.core-library {
  border-color: rgba(16, 185, 129, 0.3); /* 翠绿色边框，区分核心库 */
  background: rgba(16, 185, 129, 0.02);
}

.download-action-btn.core-library:hover {
  border-color: rgb(16, 185, 129);
  background: rgba(16, 185, 129, 0.08);
}

.download-action-btn.core-library .download-icon-text {
  color: rgb(16, 185, 129);
  background: rgba(16, 185, 129, 0.1);
}


/* 日志区域 */
.log-section {
  background: var(--bg-surface, var(--bg-secondary));
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  min-height: 400px;
}

.steps {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.step {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--bg-primary);
}

.step.done {
  color: var(--success, #4caf50);
}

.step.active {
  color: var(--accent);
  background: rgba(59, 130, 246, 0.1);
}

.step.error {
  color: var(--error, #f44);
  background: rgba(244, 67, 54, 0.1);
}

.step-icon {
  font-size: 14px;
}

.progress-bar {
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-inner {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.status-line {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.status-line.success {
  color: var(--success, #4caf50);
}

.status-line.error {
  color: var(--error, #f44);
}

.log-area {
  flex: 1;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.6;
  overflow-y: auto;
  max-height: 400px;
}

.log-empty {
  color: var(--text-secondary);
  opacity: 0.5;
}

.log-line {
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
}

/* 右侧双栏与手动指导区域样式 */
.right-column {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

/* 网页 USB 部署的警告与使用须知 */
.webusb-warning {
  font-size: 12px;
  color: #ff7675;
  background: rgba(255, 118, 117, 0.08);
  border: 1px solid rgba(255, 118, 117, 0.15);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 24px;
  line-height: 1.6;
}

/* 手动指导区域顶层容器 */
.manual-section {
  background: var(--bg-surface, var(--bg-secondary));
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.manual-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.manual-header-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.manual-header .section-title {
  margin-bottom: 0;
}

.manual-header-desc {
  font-size: 12px;
  color: var(--text-secondary);
  opacity: 0.8;
}

.deploy-mode-tabs {
  display: flex;
  gap: 8px;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--border);
  flex-wrap: wrap;
}

.mode-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.mode-tab-btn:hover {
  color: var(--text-primary);
}

.mode-tab-btn.active {
  background: var(--bg-surface, rgba(88, 166, 255, 0.15));
  color: #58a6ff;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.mode-tab-btn.magisk-tab.active {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
}

/* 部署前准备须知 */
.manual-prereqs {
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 20px;
}

.manual-prereqs.magisk-prereqs {
  border-color: rgba(168, 85, 247, 0.2);
  background: rgba(168, 85, 247, 0.02);
}

.qs-prereq-title {
  font-size: 13px;
  font-weight: 600;
  color: #ff9f43;
  margin-bottom: 8px;
}

.qs-prereq-title.magisk-title {
  color: #c084fc;
}

.qs-prereq-list {
  margin: 0;
  padding-left: 20px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.qs-prereq-list li {
  margin-bottom: 4px;
}

.qs-prereq-list li:last-child {
  margin-bottom: 0;
}

/* 自适应步骤流 (Step Flow Layout) */
.step-flow-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.flow-step-card {
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.step-badge {
  padding: 3px 8px;
  background: rgba(88, 166, 255, 0.15);
  color: #58a6ff;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.step-badge.magisk-badge {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
}

.step-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.step-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.step-desc code {
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: #58a6ff;
}

/* 第一步：横向自适应下载横幅 */
.download-action-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 20px;
  border-radius: 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  flex-wrap: wrap;
  transition: all 0.2s ease;
}

.download-action-banner.gold-banner {
  border-color: rgba(88, 166, 255, 0.3);
  background: linear-gradient(135deg, rgba(88, 166, 255, 0.04) 0%, rgba(88, 166, 255, 0.01) 100%);
}

.download-action-banner.magisk-banner {
  border-color: rgba(168, 85, 247, 0.3);
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.04) 0%, rgba(168, 85, 247, 0.01) 100%);
}

.banner-left {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex: 1;
  min-width: 260px;
}

.banner-icon {
  font-size: 24px;
  line-height: 1;
  margin-top: 2px;
}

.banner-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.banner-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.gold-banner .banner-title {
  color: #58a6ff;
}

.magisk-banner .banner-title {
  color: #c084fc;
}

.banner-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.banner-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.tag-pill {
  padding: 2px 7px;
  background: rgba(88, 166, 255, 0.12);
  color: #58a6ff;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.tag-pill.magisk-pill {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
}

.banner-download-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.banner-download-btn.gold-btn {
  background: #238636;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 6px rgba(35, 134, 54, 0.3);
}

.banner-download-btn.gold-btn:hover {
  background: #2ea043;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(35, 134, 54, 0.4);
}

.banner-download-btn.magisk-btn {
  background: #9333ea;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 6px rgba(147, 51, 234, 0.3);
}

.banner-download-btn.magisk-btn:hover {
  background: #a855f7;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(147, 51, 234, 0.4);
}

.banner-action-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.banner-download-btn.magisk-tool-btn {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.35);
}

.banner-download-btn.magisk-tool-btn:hover {
  background: rgba(168, 85, 247, 0.25);
  border-color: #c084fc;
  color: #ffffff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(168, 85, 247, 0.25);
}

/* 第二步：自适应脚本命令网格 */
.command-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
}

.command-card {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.script-box-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.os-tag {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.os-tag.unix {
  background: rgba(59, 130, 246, 0.15);
  color: #58a6ff;
}

.os-tag.win {
  background: rgba(16, 185, 129, 0.15);
  color: #3fb950;
}

/* 代码容器与代码块：右侧预留 72px 确保复制按钮永不遮挡命令文本 */
.code-container {
  position: relative;
  width: 100%;
  min-width: 0;
}

.code-block {
  margin: 0;
  padding: 10px 72px 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: 'SF Mono', 'Fira Code', 'Menlo', monospace;
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.5;
  box-sizing: border-box;
  width: 100%;
  overflow-x: auto;
}

.code-block.wrap {
  white-space: pre-wrap;
  word-break: break-all;
}

.copy-code-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 10px;
  background: var(--bg-surface, var(--bg-secondary));
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 2;
}

.copy-code-btn:hover {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

/* 多机群控批量部署横幅 */
.batch-deploy-banner {
  margin-top: 4px;
  padding: 14px 16px;
  background: rgba(88, 166, 255, 0.04);
  border: 1px dashed rgba(88, 166, 255, 0.35);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.batch-banner-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.batch-tag {
  display: inline-block;
  padding: 2px 7px;
  background: rgba(88, 166, 255, 0.18);
  color: #58a6ff;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.batch-title {
  font-size: 13px;
  font-weight: 700;
  color: #58a6ff;
}

.batch-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.batch-desc code {
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 11px;
  color: #58a6ff;
}

.batch-command-grid {
  margin-top: 2px;
}

/* Magisk 部署方式容器与子卡片 */
.magisk-methods-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.magisk-method-card {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.magisk-method-card.active-method {
  border-color: rgba(168, 85, 247, 0.35);
  background: rgba(168, 85, 247, 0.03);
}

.method-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.method-tag {
  padding: 2px 7px;
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
}

.method-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.magisk-method-subgrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.magisk-submethod-card {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.submethod-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.submethod-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.submethod-desc code {
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 11px;
  color: #c084fc;
}

.magisk-submethod-card.config-tool-card {
  border-color: rgba(168, 85, 247, 0.35);
  background: rgba(168, 85, 247, 0.02);
}

.submethod-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.tool-download-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  background: rgba(168, 85, 247, 0.18);
  border: 1px solid rgba(168, 85, 247, 0.4);
  color: #c084fc;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tool-download-btn:hover {
  background: #9333ea;
  border-color: #9333ea;
  color: #ffffff;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(147, 51, 234, 0.3);
}

.tool-usage-tips {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
  background: rgba(0, 0, 0, 0.25);
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.tip-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  flex-wrap: wrap;
}

.tip-os {
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  flex-shrink: 0;
}

.tip-os.win {
  background: rgba(16, 185, 129, 0.15);
  color: #3fb950;
}

.tip-os.unix {
  background: rgba(59, 130, 246, 0.15);
  color: #58a6ff;
}

.tip-text {
  color: var(--text-secondary);
  line-height: 1.4;
}

.tip-text code {
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 11px;
  color: #c084fc;
}

/* 屏幕自适应媒体查询断点 */
@media (max-width: 1024px) {
  .deploy-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .deploy-page {
    padding: 16px 12px;
  }

  .manual-section,
  .form-section,
  .log-section {
    padding: 16px 14px;
  }

  .flow-step-card {
    padding: 14px 12px;
  }

  .deploy-mode-tabs {
    width: 100%;
  }

  .mode-tab-btn {
    flex: 1;
    justify-content: center;
    padding: 8px 10px;
    font-size: 12px;
  }

  .banner-action-group {
    width: 100%;
    flex-direction: column;
  }

  .banner-download-btn {
    width: 100%;
  }

  .command-grid,
  .magisk-method-subgrid {
    grid-template-columns: 1fr;
  }
}
</style>
