<template>
  <div class="deploy-page">
    <div class="deploy-layout">
      <!-- 左侧: 参数表单 -->
      <section class="form-section">
        <h2 class="section-title">USB 部署 Agent</h2>

        <div class="form-group">
          <label class="form-label">Signaling 地址 <span class="required">*</span></label>
          <input
            v-model="form.signalingUrl"
            class="form-input"
            placeholder="必填项"
          >
          <div class="form-hint">需填写本机ip+端口，如：192.168.1.2:8443</div>
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
          <label class="form-label">视频码率</label>
          <select v-model="form.bitrate" class="form-input">
            <option :value="2000000">2 Mbps</option>
            <option :value="4000000">4 Mbps (默认)</option>
            <option :value="8000000">8 Mbps</option>
            <option :value="16000000">16 Mbps</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">最大分辨率</label>
          <select v-model="form.maxSize" class="form-input">
            <option :value="0">不限制</option>
            <option :value="1280">1280</option>
            <option :value="1920">1920 (推荐)</option>
            <option :value="2560">2560</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">最大帧率</label>
          <select v-model="form.maxFps" class="form-input">
            <option :value="0">不限制</option>
            <option :value="15">15 FPS</option>
            <option :value="30">30 FPS</option>
            <option :value="60">60 FPS (推荐)</option>
            <option :value="90">90 FPS</option>
            <option :value="120">120 FPS</option>
          </select>
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

        <div class="form-group form-row">
          <label class="form-label">以 root 运行</label>
          <label class="toggle">
            <input type="checkbox" v-model="form.runAsRoot">
            <span class="toggle-slider"></span>
          </label>
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

      <!-- 右侧: 部署日志/进度 -->
      <section class="log-section">
        <h2 class="section-title">部署进度</h2>

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
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, nextTick, onMounted } from 'vue'
import { useDeploy } from '@/composables/useDeploy'

const { isDeploying, deployStatus, deployProgress, deployError, deployLog, deployAgent } = useDeploy()

const logArea = ref(null)

const form = reactive({
  signalingUrl: localStorage.getItem('signalingAddr') || '',
  deviceId: '',
  bitrate: 4000000,
  maxSize: 1920,
  maxFps: 60,
  videoCodecOptions: '',
  runAsRoot: false,
  externalAddr: '',
  webrtcPort: '',
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
    bitrate: form.bitrate,
    maxSize: form.maxSize,
    maxFps: form.maxFps,
    videoCodecOptions: form.videoCodecOptions || undefined,
    runAsRoot: form.runAsRoot,
    externalAddr: form.externalAddr || undefined,
    webrtcPort: form.webrtcPort || undefined,
  })
}
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

/* 移动端 */
@media (max-width: 768px) {
  .deploy-layout {
    grid-template-columns: 1fr;
  }
}
</style>
