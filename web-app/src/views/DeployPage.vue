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
            placeholder="支持 ws:// 或 wss:// 前缀"
          >
          <div class="form-hint">需填写信令服务器地址（支持自动补全协议），例如：<br>非加密环境: <code>ws://192.168.1.2:8443</code> 或 <code>192.168.1.2:8443</code><br>加密环境: <code>wss://192.168.1.2:8443</code></div>
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
            <h2 class="section-title">独立部署与配置指导</h2>
            <!-- 方式选择 Tab -->
            <div class="deploy-mode-tabs">
              <button 
                class="mode-tab-btn" 
                :class="{ active: manualMode === 'adb' }" 
                @click="manualMode = 'adb'"
              >
                💻 电脑 ADB 一键部署 (无需 Root)
              </button>
              <button 
                class="mode-tab-btn magisk-tab" 
                :class="{ active: manualMode === 'magisk' }" 
                @click="manualMode = 'magisk'"
              >
                📱 Magisk / KSU 刷机模块 (Root 开机自启)
              </button>
            </div>
          </div>

          <!-- 途径一：电脑 ADB 一键部署 -->
          <div v-if="manualMode === 'adb'" class="manual-mode-block">
            <div class="manual-prereqs">
              <div class="qs-prereq-title">📋 电脑 ADB 部署前准备：</div>
              <ul class="qs-prereq-list">
                <li><b>手机端配置</b>：进入手机「设置 -> 开发者选项」开启<b>「USB 调试」</b>，并通过 USB 数据线连接电脑。</li>
                <li><b>电脑端配置</b>：电脑已安装 <b>ADB 工具</b>（可运行 <code>adb devices</code> 验证成功识别设备）。</li>
              </ul>
            </div>
            
            <div class="manual-layout">
              <div class="manual-download-col">
                <h3 class="manual-subtitle">第一步：下载 ADB 部署包</h3>
                <div class="download-row">
                  <a href="/agent/agent-deploy.pkg" download="agent-deploy.zip" class="download-card-btn gold-card">
                    <div class="card-title">⚡ ADB 一键部署资源包 (ZIP)</div>
                    <div class="card-desc">包含全平台 Agent 二进制、核心投屏库及一键脚本，解压即可通过 ADB 运行。</div>
                  </a>
                </div>
              </div>

              <div class="manual-guide-col">
                <h3 class="manual-subtitle">第二步：本地终端运行一键脚本</h3>
                <div class="guide-steps">
                  <div class="guide-step-item">
                    <span class="step-num">1</span>
                    <div class="step-content">
                      <p>解压下载的 <code>agent-deploy.zip</code> 并进入解压后的目录，然后执行下方对应系统的一键部署脚本命令：</p>
                      
                      <div class="deploy-script-tabs">
                        <div class="script-box-title">Linux / macOS (Unix ADB)</div>
                        <div class="code-container">
                          <pre class="code-block wrap">chmod +x run.sh && {{ shCommand }}</pre>
                          <button class="copy-code-btn" @click="copyCommand(`chmod +x run.sh && ${shCommand}`)">复制</button>
                        </div>

                        <div class="script-box-title" style="margin-top: 12px;">Windows CMD (ADB)</div>
                        <div class="code-container">
                          <pre class="code-block wrap">{{ batCommand }}</pre>
                          <button class="copy-code-btn" @click="copyCommand(batCommand)">复制</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="guide-step-item">
                    <span class="step-num">2</span>
                    <div class="step-content">
                      <p>在电脑终端验证 Agent 进程在线状态与日志：</p>
                      <pre class="code-block"># 验证 Agent 后台进程是否在线
adb shell "ps -A | grep cloudphone-agent"

# 查看 Agent 服务运行日志
adb shell "cat /data/local/tmp/cloudphone-agent.log"</pre>
                    </div>
                  </div>
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
            
            <div class="manual-layout">
              <div class="manual-download-col">
                <h3 class="manual-subtitle">第一步：下载 Magisk 模块包</h3>
                <div class="download-row">
                  <a href="/agent/cloudphone-agent-magisk.pkg" download="cloudphone-agent-magisk.zip" class="download-card-btn magisk-card">
                    <div class="card-title">📱 Magisk / KSU 刷机模块 (ZIP)</div>
                    <div class="card-desc">专属模块压缩包，内置全架构支持、守护进程以及 cpctl 控制台工具。</div>
                  </a>
                </div>
              </div>

              <div class="manual-guide-col">
                <h3 class="manual-subtitle">第二步：刷入模块与热配置</h3>
                <div class="guide-steps">
                  <div class="guide-step-item">
                    <span class="step-num">1</span>
                    <div class="step-content">
                      <p><b>刷入模块包</b>：打开手机上的 Magisk / KernelSU 管理器，选择“从本地安装”并选中 <code>cloudphone-agent-magisk.zip</code>，刷入成功后<b>重启手机</b>。</p>
                    </div>
                  </div>

                  <div class="guide-step-item">
                    <span class="step-num">2</span>
                    <div class="step-content">
                      <p><b>配置信令服务器与 ICE 中转地址</b>（支持以下任一方式）：</p>
                      <div class="deploy-script-tabs">
                        <div class="script-box-title" style="color: #a855f7;">方式 A：命令行一键配置 (手机终端 / ADB shell)</div>
                        <div class="code-container">
                          <pre class="code-block wrap">{{ magiskCommand }}</pre>
                          <button class="copy-code-btn" @click="copyCommand(magiskCommand)">复制</button>
                        </div>
                      </div>
                      <p style="margin-top: 10px; font-size: 12px; color: var(--text-secondary); line-height: 1.6;">
                        • <b>设置 ICE 中转服务器 (可选)</b>：<code>cpctl set CP_AGENT_ICE_SERVERS "&lt;turn/stun地址&gt;"</code>（若仅局域网内直连可设为空 <code>""</code>）。<br>
                        • <b>方式 B (交互式菜单)</b>：在手机终端中运行 <code>su</code> 接着运行 <code>cpctl</code> 打开交互控制台选择项 4（可配置信令地址、ICE Servers、设备 ID 及码率）。<br>
                        • <b>方式 C (编辑配置文件)</b>：使用 MT管理器编辑 <code>/data/adb/modules/cloudphone-agent/config.conf</code>，修改 <code>CP_AGENT_SIGNALING</code> 或 <code>CP_AGENT_ICE_SERVERS</code> 等字段，保存后在 Magisk 模块界面<b>连续点击 2 次 Action 按钮</b>重载生效。
                      </p>
                    </div>
                  </div>

                  <div class="guide-step-item">
                    <span class="step-num">3</span>
                    <div class="step-content">
                      <p>验证 Magisk 模块服务状态：</p>
                      <pre class="code-block"># 查看控制台状态
adb shell "su -c cpctl status"   # 或手机终端运行: su -> cpctl

# 查看日志
adb shell "cat /data/local/tmp/cloudphone-agent.log"</pre>
                    </div>
                  </div>
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
  let url = form.signalingUrl || ''
  url = url.replace('ws://', '').replace('wss://', '')
  return url || window.location.host
})

// 响应式生成 Unix/macOS 的一键部署命令
const shCommand = computed(() => {
  const host = signalingIp.value
  const ip = host.split(':')[0] || '127.0.0.1'
  const protocol = form.signalingUrl.startsWith('ws://') ? 'ws' : 'wss'
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
  const protocol = form.signalingUrl.startsWith('ws://') ? 'ws' : 'wss'
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

// 响应式生成 Magisk / KSU 的命令
const magiskCommand = computed(() => {
  const host = signalingIp.value
  const ip = host.split(':')[0] || '127.0.0.1'
  const protocol = form.signalingUrl.startsWith('ws://') ? 'ws' : 'wss'
  const sig = `${protocol}://${host}`
  const iceServersVal = form.iceServers || `turn:cloudphone_user:cloudphone_secure_password@${ip}:3478?transport=udp,stun:${ip}:3478`
  const iceCmd = iceServersVal ? `\ncpctl set CP_AGENT_ICE_SERVERS "${iceServersVal}"` : ''
  const devIdCmd = form.deviceId ? `\ncpctl set CP_AGENT_ID "${form.deviceId}"` : ''
  return `su\ncpctl set CP_AGENT_SIGNALING "${sig}"${iceCmd}${devIdCmd}\ncpctl restart`
})

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
  max-width: 1200px;
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
}

.manual-section {
  background: var(--bg-surface, var(--bg-secondary));
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.manual-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

/* 如果屏幕宽度较宽，将下载与指导分为两列 */
@media (min-width: 1024px) {
  .manual-layout {
    grid-template-columns: 320px 1fr;
  }
}

.manual-subtitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0 0 14px 0;
  opacity: 0.85;
}

.download-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.download-card-btn {
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.download-card-btn:hover {
  border-color: var(--accent);
  background: rgba(59, 130, 246, 0.04);
  transform: translateY(-1px);
}

.download-card-btn .card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 4px;
}

.download-card-btn .card-desc {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.7;
}

.download-card-btn.core-library-card {
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.01);
}

.download-card-btn.core-library-card:hover {
  border-color: rgb(16, 185, 129);
  background: rgba(16, 185, 129, 0.06);
}

.download-card-btn.core-library-card .card-title {
  color: rgb(16, 185, 129);
}

/* ADB 指导步骤样式 */
.guide-steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.guide-step-item {
  display: flex;
  gap: 12px;
}

.guide-step-item .step-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: var(--accent);
  color: white;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 2px;
}

.guide-step-item .step-content {
  flex: 1;
}

.guide-step-item .step-content p {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
}

.code-block {
  margin: 0;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: var(--text-primary);
  overflow-x: auto;
  line-height: 1.5;
}

.code-block.wrap {
  white-space: pre-wrap;
  word-break: break-all;
}

.code-container {
  position: relative;
}

.copy-code-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  background: var(--bg-surface, var(--bg-secondary));
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.copy-code-btn:hover {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

/* 移动端 */
@media (max-width: 768px) {
  .deploy-layout {
    grid-template-columns: 1fr;
  }
}
.manual-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.manual-header .section-title {
  margin-bottom: 0;
}

.deploy-mode-tabs {
  display: flex;
  gap: 8px;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.mode-tab-btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-tab-btn:hover {
  color: var(--text-primary);
}

.mode-tab-btn.active {
  background: var(--bg-surface, rgba(88, 166, 255, 0.15));
  color: #58a6ff;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.mode-tab-btn.magisk-tab.active {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
}

.magisk-prereqs {
  border-color: rgba(168, 85, 247, 0.2);
  background: rgba(168, 85, 247, 0.02);
}

.qs-prereq-title.magisk-title {
  color: #c084fc;
}

.download-card-btn.gold-card {
  border-color: rgba(88, 166, 255, 0.4);
  background: rgba(88, 166, 255, 0.03);
}

.download-card-btn.gold-card:hover {
  border-color: #58a6ff;
  background: rgba(88, 166, 255, 0.08);
}

.download-card-btn.gold-card .card-title {
  color: #58a6ff;
  font-weight: 700;
}

.download-card-btn.magisk-card {
  border-color: rgba(168, 85, 247, 0.4);
  background: rgba(168, 85, 247, 0.03);
}

.download-card-btn.magisk-card:hover {
  border-color: #a855f7;
  background: rgba(168, 85, 247, 0.08);
}

.download-card-btn.magisk-card .card-title {
  color: #a855f7;
  font-weight: 700;
}

.script-box-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

/* 新增网页部署的警告与准备工作样式 */
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

.manual-prereqs {
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 24px;
}

.qs-prereq-title {
  font-size: 13px;
  font-weight: 600;
  color: #ff9f43;
  margin-bottom: 8px;
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
</style>
