<template>
  <div class="deploy-page">
    <div class="deploy-layout">
      <!-- 左侧: 参数表单 -->
      <section class="form-section">
        <h2 class="section-title">网页一键 USB 部署</h2>

        <div class="webusb-warning">
          ⚠️ 注意：本网页 USB 部署基于 WebUSB 协议，<b>不支持无线或网络 ADB 调试模式</b>，物理手机必须使用数据线直接连接当前电脑的 USB 端口。
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

        <!-- 手动部署与命令行 ADB 指导 -->
        <section class="manual-section">
          <h2 class="section-title">手动部署与一键脚本指导</h2>

          <!-- 准备条件提示 -->
          <div class="manual-prereqs">
            <div class="qs-prereq-title">📋 手动部署前准备工作：</div>
            <ul class="qs-prereq-list">
              <li><b>手机端配置</b>：需进入手机的「设置 -> 开发者选项」开启<b>「USB 调试」</b>，并已使用 USB 数据线连上电脑。</li>
              <li><b>电脑端配置</b>：电脑需要已安装 <b>ADB 工具</b>（确保可在命令行成功识别到您的手机设备，可通过 <code>adb devices</code> 验证）。</li>
            </ul>
          </div>
          
          <div class="manual-layout">
            <!-- 资源下载 -->
            <div class="manual-download-col">
              <h3 class="manual-subtitle">第一步：下载一键部署资源包</h3>
              <div class="download-row">
                <a href="/agent/agent-deploy.zip" download="agent-deploy.zip" class="download-card-btn gold-card">
                  <div class="card-title">⚡ 一键部署资源包 (ZIP)</div>
                  <div class="card-desc">包含全平台 Agent 二进制、核心投屏库及一键脚本，解压即可运行。</div>
                </a>
              </div>
            </div>

            <!-- 脚本运行指导 -->
            <div class="manual-guide-col">
              <h3 class="manual-subtitle">第二步：本地终端一键部署</h3>
              <div class="guide-steps">
                <div class="guide-step-item">
                  <span class="step-num">1</span>
                  <div class="step-content">
                    <p>解压下载的 <code>agent-deploy.zip</code> 包并进入解压后的目录，然后执行下方一键运行脚本命令：</p>
                    
                    <div class="deploy-script-tabs">
                      <div class="script-box-title">Linux / macOS (Unix)</div>
                      <div class="code-container">
                        <pre class="code-block wrap">chmod +x run.sh && {{ shCommand }}</pre>
                        <button class="copy-code-btn" @click="copyCommand(`chmod +x run.sh && ${shCommand}`)">复制</button>
                      </div>

                      <div class="script-box-title" style="margin-top: 12px;">Windows CMD</div>
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
                    <p>在本地终端验证云手机/容器内的 Agent 运行状态：</p>
                    <pre class="code-block"># 验证 Agent 后台进程是否正常在线
adb shell "ps -A | grep cloudphone-agent"

# 查看 Agent 服务运行日志
adb shell "cat /data/local/tmp/cloudphone-agent.log"</pre>
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
