<template>
  <div class="deploy-page">
    <div class="deploy-layout">
      <!-- 左侧: 参数表单 -->
      <section class="form-section">
        <h2 class="section-title">{{ $t('deploy.title') }}</h2>

        <div class="webusb-warning">
          ⚠️ <b>{{ $t('deploy.warningTitle') }}</b>：{{ $t('deploy.warningNotice') }}<br>
          💡 <b>{{ $t('deploy.warningTipTitle') }}</b>：{{ $t('deploy.warningTip') }}
        </div>

        <div class="form-group">
          <label class="form-label">{{ $t('deploy.form.signalingUrl') }} <span class="required">*</span></label>
          <input
            v-model="form.signalingUrl"
            class="form-input"
            :placeholder="$t('deploy.form.signalingPlaceholder')"
          >
          <div class="form-hint">{{ $t('deploy.form.signalingHint') }}</div>
        </div>

        <div class="form-group">
          <label class="form-label">{{ $t('deploy.form.iceServers') }}</label>
          <input
            v-model="form.iceServers"
            class="form-input"
            :placeholder="$t('deploy.form.iceServersPlaceholder')"
          >
          <div class="form-hint">{{ $t('deploy.form.iceServersHint') }}</div>
        </div>

        <div class="form-group">
          <label class="form-label">{{ $t('deploy.form.deviceId') }}</label>
          <input
            v-model="form.deviceId"
            class="form-input"
            :placeholder="$t('deploy.form.deviceIdPlaceholder')"
          >
        </div>

        <div class="form-group">
          <label class="form-label">{{ $t('deploy.form.videoCodecOptions') }}</label>
          <input
            v-model="form.videoCodecOptions"
            class="form-input"
            :placeholder="$t('deploy.form.videoCodecOptionsPlaceholder')"
          >
          <div class="form-hint">{{ $t('deploy.form.videoCodecOptionsHint') }}</div>
        </div>

        <div class="form-group">
          <label class="form-label">{{ $t('deploy.form.externalAddr') }}</label>
          <input
            v-model="form.externalAddr"
            class="form-input"
            :placeholder="$t('deploy.form.externalAddrPlaceholder')"
          >
          <div class="form-hint">{{ $t('deploy.form.externalAddrHint') }}</div>
        </div>

        <div class="form-group">
          <label class="form-label">{{ $t('deploy.form.webrtcPort') }}</label>
          <input
            v-model="form.webrtcPort"
            class="form-input"
            :placeholder="$t('deploy.form.webrtcPortPlaceholder')"
          >
        </div>

        <button
          class="deploy-btn"
          :disabled="isDeploying || !form.signalingUrl"
          @click="startDeploy"
        >
          {{ isDeploying ? $t('deploy.form.deployingBtn') : $t('deploy.form.deployBtn') }}
        </button>
      </section>

      <!-- 右侧: 部署进度与手动部署指导 -->
      <div class="right-column">
        <!-- 部署日志/进度 -->
        <section class="log-section">
          <h2 class="section-title">{{ $t('deploy.progress.title') }}</h2>

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
            <div v-if="deployLog.length === 0" class="log-empty">{{ $t('deploy.progress.waiting') }}</div>
            <div v-for="(line, i) in deployLog" :key="i" class="log-line">{{ line }}</div>
          </div>
        </section>

        <!-- 手动部署与命令行 ADB / Magisk 指导 -->
        <section class="manual-section">
          <div class="manual-header">
            <div class="manual-header-title-group">
              <h2 class="section-title">{{ $t('deploy.manual.title') }}</h2>
              <span class="manual-header-desc">{{ $t('deploy.manual.subtitle') }}</span>
            </div>
            <!-- 方式选择 Tab -->
            <div class="deploy-mode-tabs">
              <button 
                class="mode-tab-btn" 
                :class="{ active: manualMode === 'adb' }" 
                @click="manualMode = 'adb'"
              >
                <span class="tab-icon">💻</span>
                <span class="tab-text">{{ $t('deploy.manual.tabs.adb') }}</span>
              </button>
              <button 
                class="mode-tab-btn magisk-tab" 
                :class="{ active: manualMode === 'magisk' }" 
                @click="manualMode = 'magisk'"
              >
                <span class="tab-icon">📱</span>
                <span class="tab-text">{{ $t('deploy.manual.tabs.magisk') }}</span>
              </button>
            </div>
          </div>

          <!-- 官网 Android App 客户端推荐横幅 -->
          <div class="app-official-banner">
            <div class="app-banner-main">
              <div class="app-banner-icon-box">🤖</div>
              <div class="app-banner-info">
                <div class="app-banner-title-line">
                  <span class="app-banner-title">{{ $t('deploy.manual.appBannerTitle') }}</span>
                  <span class="app-banner-pill">{{ $t('deploy.manual.appBannerBadge') }}</span>
                </div>
                <div class="app-banner-desc">
                  {{ $t('deploy.manual.appBannerDesc') }}
                </div>
              </div>
            </div>
            <a 
              href="https://webrtc-phone.com/#download" 
              target="_blank" 
              rel="noopener" 
              class="app-banner-action-btn"
            >
              <span class="btn-icon">🌐</span>
              <span class="btn-text">{{ $t('deploy.manual.appDownloadBtn') }}</span>
              <span class="external-icon">↗</span>
            </a>
          </div>

          <!-- 途径一：电脑 ADB 一键部署 -->
          <div v-if="manualMode === 'adb'" class="manual-mode-block">
            <!-- 部署前准备 -->
            <div class="manual-prereqs">
              <div class="qs-prereq-title">{{ $t('deploy.manual.adbPrereqTitle') }}</div>
              <ul class="qs-prereq-list">
                <li v-html="$t('deploy.manual.adbPrereqPhone')"></li>
                <li v-html="$t('deploy.manual.adbPrereqPc')"></li>
              </ul>
            </div>
            
            <!-- 连贯自适应步骤流 -->
            <div class="step-flow-layout">
              <!-- 第一步：下载部署包 -->
              <div class="flow-step-card download-step-card">
                <div class="step-header">
                  <span class="step-badge">{{ $t('deploy.manual.step1') }}</span>
                  <span class="step-title">{{ $t('deploy.manual.getAdbPkg') }}</span>
                </div>
                <div class="download-action-banner gold-banner">
                  <div class="banner-left">
                    <div class="banner-icon">⚡</div>
                    <div class="banner-info">
                      <div class="banner-title">{{ $t('deploy.manual.adbPkgTitle') }}</div>
                      <div class="banner-desc">{{ $t('deploy.manual.adbPkgDesc') }}</div>
                      <div class="banner-tags">
                        <span class="tag-pill">{{ $t('deploy.manual.tagRunScript') }}</span>
                        <span class="tag-pill">{{ $t('deploy.manual.tagBatchStart') }}</span>
                        <span class="tag-pill">{{ $t('deploy.manual.tagArch') }}</span>
                      </div>
                    </div>
                  </div>
                  <a href="/agent/agent-deploy.pkg" download="agent-deploy.zip" class="banner-download-btn gold-btn">
                    <span class="btn-icon">📥</span>
                    <span class="btn-text">{{ $t('deploy.manual.downloadZip') }}</span>
                  </a>
                </div>
              </div>

              <!-- 第二步：本地终端运行一键脚本 -->
              <div class="flow-step-card guide-step-card">
                <div class="step-header">
                  <span class="step-badge">{{ $t('deploy.manual.step2') }}</span>
                  <span class="step-title">{{ $t('deploy.manual.runScriptTitle') }}</span>
                </div>
                <p class="step-desc" v-html="$t('deploy.manual.runScriptDesc')"></p>

                <!-- 单台设备命令网格 -->
                <div class="command-grid">
                  <div class="command-card">
                    <div class="script-box-title">
                      <span class="os-tag unix">Linux / macOS</span>
                      <span>{{ $t('deploy.manual.singleDeploy') }}</span>
                    </div>
                    <div class="code-container">
                      <pre class="code-block wrap">chmod +x run.sh && {{ shCommand }}</pre>
                      <button class="copy-code-btn" @click="copyCommand(`chmod +x run.sh && ${shCommand}`)">{{ $t('deploy.manual.copyCmd') }}</button>
                    </div>
                  </div>

                  <div class="command-card">
                    <div class="script-box-title">
                      <span class="os-tag win">Windows CMD</span>
                      <span>{{ $t('deploy.manual.singleDeploy') }}</span>
                    </div>
                    <div class="code-container">
                      <pre class="code-block wrap">{{ batCommand }}</pre>
                      <button class="copy-code-btn" @click="copyCommand(batCommand)">{{ $t('deploy.manual.copyCmd') }}</button>
                    </div>
                  </div>
                </div>

                <!-- 多机批量群控启动提示卡片 -->
                <div class="batch-deploy-banner">
                  <div class="batch-banner-header">
                    <span class="batch-tag">{{ $t('deploy.manual.batchTag') }}</span>
                    <span class="batch-title">{{ $t('deploy.manual.batchTitle') }}</span>
                  </div>
                  <p class="batch-desc">
                    {{ $t('deploy.manual.batchDesc') }}
                  </p>
                  
                  <div class="command-grid batch-command-grid">
                    <div class="command-card">
                      <div class="script-box-title">
                        <span class="os-tag unix">Linux / macOS</span>
                        <span>{{ $t('deploy.manual.batchStart') }}</span>
                      </div>
                      <div class="code-container">
                        <pre class="code-block wrap">chmod +x batch_start.sh && {{ batchShCommand }}</pre>
                        <button class="copy-code-btn" @click="copyCommand(`chmod +x batch_start.sh && ${batchShCommand}`)">{{ $t('deploy.manual.copyCmd') }}</button>
                      </div>
                    </div>

                    <div class="command-card">
                      <div class="script-box-title">
                        <span class="os-tag win">Windows CMD</span>
                        <span>{{ $t('deploy.manual.batchStartWin') }}</span>
                      </div>
                      <div class="code-container">
                        <pre class="code-block wrap">{{ batchBatCommand }}</pre>
                        <button class="copy-code-btn" @click="copyCommand(batchBatCommand)">{{ $t('deploy.manual.copyCmd') }}</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 第三步：验证在线状态 -->
              <div class="flow-step-card verify-step-card">
                <div class="step-header">
                  <span class="step-badge">{{ $t('deploy.manual.step3') }}</span>
                  <span class="step-title">{{ $t('deploy.manual.verifyStatusTitle') }}</span>
                </div>
                <div class="code-container">
                  <pre class="code-block wrap"># Check if Agent process is running:
adb shell "ps -A | grep cloudphone-agent"

# View Agent realtime logs:
adb shell "cat /data/local/tmp/cloudphone-agent.log"</pre>
                  <button class="copy-code-btn" @click="copyCommand(checkAgentCmd)">{{ $t('deploy.manual.copyCmd') }}</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 途径二：Magisk / KernelSU / APatch 刷机模块 -->
          <div v-else-if="manualMode === 'magisk'" class="manual-mode-block">
            <div class="manual-prereqs magisk-prereqs">
              <div class="qs-prereq-title magisk-title">{{ $t('deploy.manual.magiskPrereqTitle') }}</div>
              <ul class="qs-prereq-list">
                <li v-html="$t('deploy.manual.magiskPrereqRoot')"></li>
                <li v-html="$t('deploy.manual.magiskPrereqAdv')"></li>
              </ul>
            </div>
            
            <div class="step-flow-layout">
              <!-- 第一步：下载 Magisk 模块包 -->
              <div class="flow-step-card download-step-card">
                <div class="step-header">
                  <span class="step-badge magisk-badge">{{ $t('deploy.manual.step1') }}</span>
                  <span class="step-title">{{ $t('deploy.manual.getMagiskPkg') }}</span>
                </div>
                <div class="download-action-banner magisk-banner">
                  <div class="banner-left">
                    <div class="banner-icon">📱</div>
                    <div class="banner-info">
                      <div class="banner-title">{{ $t('deploy.manual.magiskPkgTitle') }}</div>
                      <div class="banner-desc">{{ $t('deploy.manual.magiskPkgDesc') }}</div>
                      <div class="banner-tags">
                        <span class="tag-pill magisk-pill">{{ $t('deploy.manual.tagAutoArch') }}</span>
                        <span class="tag-pill magisk-pill">{{ $t('deploy.manual.tagWatchdog') }}</span>
                        <span class="tag-pill magisk-pill">{{ $t('deploy.manual.tagOfflineConfig') }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="banner-action-group">
                    <a href="/agent/cloudphone-agent-magisk.pkg" download="cloudphone-agent-magisk.zip" class="banner-download-btn magisk-btn">
                      <span class="btn-icon">📥</span>
                      <span class="btn-text">{{ $t('deploy.manual.downloadMagiskZip') }}</span>
                    </a>
                    <a href="/agent/magisk-config-tools.pkg" download="magisk-config-tools.zip" class="banner-download-btn magisk-tool-btn" :title="$t('deploy.manual.offlineConfigToolsHint')">
                      <span class="btn-icon">🛠️</span>
                      <span class="btn-text">{{ $t('deploy.manual.offlineConfigTools') }}</span>
                    </a>
                  </div>
                </div>
              </div>

              <!-- 第二步：刷入模块与参数配置 -->
              <div class="flow-step-card guide-step-card">
                <div class="step-header">
                  <span class="step-badge magisk-badge">{{ $t('deploy.manual.step2') }}</span>
                  <span class="step-title">{{ $t('deploy.manual.flashModuleTitle') }}</span>
                </div>
                <p class="step-desc" v-html="$t('deploy.manual.flashModuleDesc')"></p>

                <!-- 配置方式卡片网格 -->
                <div class="magisk-methods-container">
                  <!-- 方式 A -->
                  <div class="magisk-method-card active-method">
                    <div class="method-header">
                      <span class="method-tag">{{ $t('deploy.manual.recommendTag') }}</span>
                      <span class="method-title">{{ $t('deploy.manual.methodATitle') }}</span>
                    </div>
                    <div class="code-container">
                      <pre class="code-block wrap">{{ magiskCommand }}</pre>
                      <button class="copy-code-btn" @click="copyCommand(magiskCommand)">{{ $t('deploy.manual.copyCmd') }}</button>
                    </div>
                  </div>

                  <!-- 方式 B & 方式 C -->
                  <div class="magisk-method-subgrid">
                    <div class="magisk-submethod-card">
                      <div class="submethod-title">{{ $t('deploy.manual.methodBTitle') }}</div>
                      <p class="submethod-desc" v-html="$t('deploy.manual.methodBDesc')"></p>
                    </div>
                    <div class="magisk-submethod-card config-tool-card">
                      <div class="submethod-header-row">
                        <div class="submethod-title">{{ $t('deploy.manual.methodCTitle') }}</div>
                        <a href="/agent/magisk-config-tools.pkg" download="magisk-config-tools.zip" class="tool-download-btn" :title="$t('deploy.manual.downloadConfigToolHint')">
                          <span>{{ $t('deploy.manual.downloadConfigTool') }}</span>
                        </a>
                      </div>
                      <p class="submethod-desc">
                        <span v-html="$t('deploy.manual.methodCDesc')"></span>
                      </p>
                      <div class="tool-usage-tips">
                        <div class="tip-item">
                          <span class="tip-os win">Windows</span>
                          <span class="tip-text" v-html="$t('deploy.manual.methodCWinTip')"></span>
                        </div>
                        <div class="tip-item">
                          <span class="tip-os unix">macOS / Linux</span>
                          <span class="tip-text" v-html="$t('deploy.manual.methodCUnixTip', { cmd: magiskToolShCommand })"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 第三步：验证状态 -->
              <div class="flow-step-card verify-step-card">
                <div class="step-header">
                  <span class="step-badge magisk-badge">{{ $t('deploy.manual.step3') }}</span>
                  <span class="step-title">{{ $t('deploy.manual.verifyMagiskTitle') }}</span>
                </div>
                <div class="code-container">
                  <pre class="code-block wrap"># Check cpctl status (RUNNING indicates active):
adb shell "su -c cpctl status"   # Phone terminal: su -> cpctl status

# View service logs in real time:
adb shell "su -c cpctl log"</pre>
                  <button class="copy-code-btn" @click="copyCommand(checkMagiskCmd)">{{ $t('deploy.manual.copyCmd') }}</button>
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
import { useI18n } from 'vue-i18n'
import { useDeploy } from '@/composables/useDeploy'

const { t } = useI18n()
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

const steps = computed(() => [
  t('deploy.steps.connect'),
  t('deploy.steps.auth'),
  t('deploy.steps.detect'),
  t('deploy.steps.push'),
  t('deploy.steps.start')
])

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
    alert(t('deploy.manual.cmdCopied'))
  }).catch(err => {
    console.error('复制失败:', err)
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

/* 官网 Android App 客户端专属横幅 */
.app-official-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 18px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(35, 134, 54, 0.08) 0%, rgba(35, 134, 54, 0.02) 100%);
  border: 1px solid rgba(35, 134, 54, 0.3);
  margin-bottom: 20px;
  flex-wrap: wrap;
  transition: all 0.2s ease;
}

.app-official-banner:hover {
  border-color: rgba(63, 185, 80, 0.55);
  box-shadow: 0 4px 16px rgba(35, 134, 54, 0.15);
}

.app-banner-main {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 260px;
}

.app-banner-icon-box {
  font-size: 24px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: rgba(35, 134, 54, 0.15);
  border: 1px solid rgba(35, 134, 54, 0.28);
  flex-shrink: 0;
}

.app-banner-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.app-banner-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.app-banner-title {
  font-size: 14px;
  font-weight: 700;
  color: #3fb950;
}

.app-banner-pill {
  padding: 2px 7px;
  background: rgba(35, 134, 54, 0.18);
  color: #3fb950;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.app-banner-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.app-banner-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 18px;
  border-radius: 8px;
  background: #238636;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 6px rgba(35, 134, 54, 0.3);
  flex-shrink: 0;
}

.app-banner-action-btn:hover {
  background: #2ea043;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(35, 134, 54, 0.4);
}

.app-banner-action-btn .external-icon {
  font-size: 11px;
  margin-left: 2px;
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
  white-space: nowrap;
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

  .app-banner-action-btn {
    width: 100%;
    justify-content: center;
  }

  .command-grid,
  .magisk-method-subgrid {
    grid-template-columns: 1fr;
  }
}
</style>
