<template>
  <div class="device-panel-view" :class="{ 'mobile-landscape': isMobile && isVideoLandscape }">
    <!-- 悬浮全屏按钮 (右上角) -->
    <button class="fullscreen-fab" @click="toggleFullscreen" title="全屏">⛶</button>

    <!-- 主视频容器 -->
    <div class="video-wrapper" ref="containerRef">
      <video
        ref="videoElement"
        autoplay
        playsinline
        muted
        class="video-stream"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseLeave"
        @touchstart.prevent="onTouchStart"
        @touchmove.prevent="onTouchMove"
        @touchend.prevent="onTouchEnd"
        @touchcancel.prevent="onTouchEnd"
        @loadedmetadata="onVideoLoaded"
        @resize="onVideoResize"
      />

      <!-- 视频流状态面板 (左上角) -->
      <div v-if="videoStats" class="stats-badge">
        <span class="stat-fps">{{ videoStats.fps }}fps</span>
        <span class="stat-delimiter">|</span>
        <span class="stat-delay">JB {{ videoStats.jbDelay }}ms</span>
        <span class="stat-delimiter">|</span>
        <span class="stat-bitrate">{{ videoStats.bitrate }}kbps</span>
        <span class="stat-delimiter">|</span>
        <span :class="['stat-pli', { 'stat-warn': videoStats.pliCount > 0 }]">PLI {{ videoStats.pliCount }}</span>
        <span class="stat-delimiter">|</span>
        <span :class="['stat-pause', { 'stat-warn': videoStats.pauseCount > 0 }]">Pause {{ videoStats.pauseCount }}</span>
        <span class="stat-delimiter">|</span>
        <span :class="['stat-lost', { 'stat-warn': videoStats.lostCount > 0 }]">Lost {{ videoStats.lostCount }}</span>
      </div>

      <!-- 加载/错误覆盖层 -->
      <div v-if="showOverlay" class="panel-overlay">
        <div class="overlay-box">
          <template v-if="['connecting', 'signaling', 'waiting_offer', 'connecting_webrtc'].includes(webrtc.status.value)">
            <div class="mini-spinner"></div>
            <p>{{ loadingText }}</p>
          </template>
          <template v-else-if="webrtc.error.value">
            <p class="error-msg">❌ 连接失败</p>
            <p class="error-tip">{{ webrtc.error.value }}</p>
            <button class="retry-btn" @click="retry">重试</button>
          </template>
          <template v-else-if="webrtc.status.value === 'disconnected'">
            <p>连接已断开</p>
            <button class="retry-btn" @click="retry">重新连接</button>
          </template>
        </div>
      </div>
    </div>

    <!-- 底部控制按钮 -->
    <div class="panel-footer-actions">
      <button class="action-item" @click="quickKey('input keyevent 3')">🏠 HOME</button>
      <button class="action-item" @click="quickKey('input keyevent 4')">◀ BACK</button>
      <button class="action-item" @click="showConsole = !showConsole">📟 控制台</button>
      <button class="action-item danger" @click="quitAgent">退出 Agent</button>
    </div>

    <!-- 控制台/ADB 抽屉 -->
    <div v-show="showConsole" class="console-drawer">
      <div class="console-header">
        <div class="console-tabs">
          <button :class="{active: activeTab === 'shell'}" @click="activeTab = 'shell'">终端 (Shell)</button>
          <button :class="{active: activeTab === 'adb'}" @click="activeTab = 'adb'">ADB 调试</button>
        </div>
        <button class="close-console" @click="toggleConsole">✕</button>
      </div>

      <!-- 标准 Shell 视图 -->
      <div v-show="activeTab === 'shell'" style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
        <div class="console-history" ref="consoleRef">
          <div v-for="(log, idx) in consoleLogs" :key="idx" :class="['log-item', log.type]">
            <span class="log-cmd" v-if="log.cmd">$ {{ log.cmd }}</span>
            <pre class="log-out">{{ log.text }}</pre>
          </div>
          <div v-if="consoleLogs.length === 0" class="console-empty">等待命令下发...</div>
        </div>
        <div class="console-shortcuts">
          <button @click="quickCmd('pm list packages -3')">三方应用</button>
          <button @click="quickCmd('getprop ro.product.model')">型号</button>
          <button @click="quickCmd('uptime')">运行时间</button>
          <button @click="quickCmd('settings put system pointer_location 1')">打开划线</button>
          <button @click="consoleLogs = []">清屏</button>
        </div>
        <div class="console-shortcuts danger">
           <button class="quit-btn" @click="quitAgent">强制退出 Agent 进程</button>
        </div>
        <div class="console-input-group">
          <input 
            v-model="inputCmd" 
            @keyup.enter="execCmd"
            placeholder="输入命令..."
            class="cmd-input"
          />
          <button @click="execCmd" class="send-btn">发送</button>
        </div>
      </div>

      <!-- ADB 调试视图 (xterm.js) -->
      <div v-show="activeTab === 'adb'" class="adb-container" ref="adbTermContainer">
        <div v-if="!isAdbConnected" class="adb-placeholder">
          <button class="adb-connect-btn" @click="startAdb">初始化 ADB over WebRTC</button>
          <p>建立 P2P 隧道并开启原生 ADB Shell</p>
        </div>
      </div>
    </div>

    <!-- 截图模态框 -->
    <ScreenshotModal
      v-if="showScreenshot"
      :image-data="screenshotData"
      @close="closeScreenshot"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useDeviceStore } from '@/stores/devices'
import { useWebRTC } from '@/composables/useWebRTC'
import { useAdb } from '@/composables/useAdb'
import ConnectionStatus from '@/components/ConnectionStatus.vue'
import ScreenshotModal from '@/components/ScreenshotModal.vue'

const props = defineProps({
  deviceId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['recommend-layout'])

const route = useRoute()
const currentId = computed(() => props.deviceId || route.params.deviceId)

const videoElement = ref(null)
const containerRef = ref(null)
const isFullscreen = ref(false)
const showScreenshot = ref(false)
const screenshotData = ref(null)

// 控制台状态
const showConsole = ref(false)
const inputCmd = ref('')
const consoleLogs = ref([])
const consoleRef = ref(null)
const adbTermContainer = ref(null)
const activeTab = ref('shell') // 'shell' | 'adb'

// 视频流统计信息
const videoStats = ref(null)
let statsInterval = null

let webrtc = useWebRTC(currentId.value)
const { isAdbConnected, initAdb, closeAdb } = useAdb(webrtc)

// 布局推荐相关
let layoutInterval = null

// 手机端和视频方向检测
const isMobile = ref(window.innerWidth <= 1024)
const isVideoLandscape = ref(false)

function updateMobileState() {
  isMobile.value = window.innerWidth <= 1024
}

function onVideoLoaded() { checkAndRecommendLayout() }
function onVideoResize() { checkAndRecommendLayout() }

// 响应式重新连接
watch(currentId, (newId) => {
  if (newId) {
    webrtc.disconnect()
    closeAdb()
    webrtc = useWebRTC(newId)
    setupWebRTC()
  }
})

function setupWebRTC() {
  webrtc.setVideoGetter(() => videoElement.value)
  webrtc.connect()
  
  // 设置截图回调
  webrtc.onScreenshot((data) => {
    screenshotData.value = data
    showScreenshot.value = true
  })

  // 设置命令结果回调
  webrtc.onCommandResult((res) => {
    const output = res.stdout || res.stderr || (res.exit_code === 0 ? '[Success]' : `[Failed] ExitCode: ${res.exit_code}`)
    consoleLogs.value.push({
      type: res.exit_code === 0 ? 'success' : 'error',
      text: output
    })
    scrollToBottom()
  })

  // 启动视频流统计轮询
  videoStats.value = null
  webrtc.resetStats()
  if (statsInterval) clearInterval(statsInterval)
  statsInterval = setInterval(async () => {
    const stats = await webrtc.getVideoStats()
    if (stats) videoStats.value = stats
  }, 1000)
}

onMounted(() => {
  setupWebRTC()
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
  // 定期检查布局
  layoutInterval = setInterval(checkAndRecommendLayout, 2000)
  // 监听窗口大小变化
  window.addEventListener('resize', updateMobileState)
})

onUnmounted(() => {
  webrtc.disconnect()
  closeAdb()
  if (layoutInterval) clearInterval(layoutInterval)
  if (statsInterval) clearInterval(statsInterval)
  window.removeEventListener('resize', updateMobileState)
})

const statusText = computed(() => {
  const map = {
    'connected': '已连接',
    'connecting': '连接中',
    'signaling': '信令中',
    'disconnected': '断开',
    'error': '错误'
  }
  return map[webrtc.status.value] || webrtc.status.value
})

const loadingText = computed(() => {
  if (webrtc.status.value === 'waiting_offer') return '等待设备...'
  return '建立连接...'
})

const showOverlay = computed(() => webrtc.status.value !== 'connected')

// 是否需要旋转坐标（手机端且视频横屏）
const needRotateCoords = computed(() => isMobile.value && isVideoLandscape.value)

// 存储视频实际尺寸用于坐标转换
const videoNaturalSize = ref({ width: 0, height: 0 })

function checkAndRecommendLayout() {
  const video = videoElement.value
  if (!video || !video.videoWidth) return
  const ratio = video.videoWidth / video.videoHeight
  const landscape = video.videoWidth > video.videoHeight
  isVideoLandscape.value = landscape
  videoNaturalSize.value = { width: video.videoWidth, height: video.videoHeight }
  emit('recommend-layout', { isLandscape: landscape, ratio: ratio })
}

// 旋转坐标转换
// 用户点击屏幕 -> 转换为"相当于点击在未旋转视频上的坐标"
function rotateCoords(clientX, clientY) {
  if (!needRotateCoords.value) return { x: clientX, y: clientY }
  
  const video = videoElement.value
  if (!video) return { x: clientX, y: clientY }
  
  const screenW = window.innerWidth
  const screenH = window.innerHeight
  const videoW = videoNaturalSize.value.width   // 原始视频宽度（横屏时 > 高度）
  const videoH = videoNaturalSize.value.height  // 原始视频高度
  
  if (!videoW || !videoH) return { x: clientX, y: clientY }
  
  // 视频 rotate(90deg) 后：
  // 原视频坐标系 -> 旋转后显示坐标系
  // (x, y) -> (videoH - y, x)
  // 
  // 逆变换：
  // 旋转后 (x', y') -> 原视频 (y', videoH - x')
  
  // 由于使用 object-fit: contain，视频完整显示可能有黑边
  // 屏幕坐标 -> 旋转后视频坐标 (归一化 0-1)
  
  // 旋转后的视频显示尺寸比例
  // 旋转后：宽=videoH，高=videoW
  const rotatedRatio = videoH / videoW  // 旋转后的宽高比
  const screenRatio = screenW / screenH
  
  let normInVideoX, normInVideoY  // 在旋转后视频内的归一化坐标
  
  if (screenRatio > rotatedRatio) {
    // 屏幕更宽，视频左右有黑边
    // 视频在屏幕上：高度填满，宽度有黑边
    const videoDisplayW = screenH * rotatedRatio  // 视频实际显示宽度
    const offsetX = (screenW - videoDisplayW) / 2  // 左右黑边
    
    // 屏幕 x -> 视频内 x
    const videoX = clientX - offsetX  // 相对于视频显示区域的 x 坐标
    
    normInVideoX = videoX / videoDisplayW
    normInVideoY = clientY / screenH
  } else {
    // 屏幕更高，视频上下有黑边
    const videoDisplayH = screenW / rotatedRatio
    const offsetY = (screenH - videoDisplayH) / 2
    
    const videoY = clientY - offsetY
    
    normInVideoX = clientX / screenW
    normInVideoY = videoY / videoDisplayH
  }
  
  // 旋转后视频内归一化坐标 -> 原视频归一化坐标
  // 旋转后 (x', y') -> 原视频 (y', 1 - x')
  const origNormX = normInVideoY
  const origNormY = 1 - normInVideoX
  
  // 归一化坐标 -> 原视频像素坐标
  const origX = origNormX * videoW
  const origY = origNormY * videoH
  
  return { x: origX, y: origY, isRotated: true }
}

function retry() {
  webrtc.disconnect()
  webrtc.connect()
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    containerRef.value?.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

function takeScreenshot() {
  webrtc.requestScreenshot()
}

function closeScreenshot() {
  showScreenshot.value = false
  screenshotData.value = null
}

// 命令执行
function execCmd() {
  if (!inputCmd.value.trim()) return
  const cmd = inputCmd.value
  consoleLogs.value.push({ type: 'info', cmd: cmd, text: '执行中...' })
  webrtc.sendCommand(cmd)
  inputCmd.value = ''
  scrollToBottom()
}

function quickCmd(cmd) {
  inputCmd.value = cmd
  execCmd()
}

// 切换控制台显示
function toggleConsole() {
  showConsole.value = !showConsole.value
  if (!showConsole.value) {
    console.log('[UI] Closing console drawer, force closing ADB...');
    closeAdb()
  }
}

function quickKey(cmd) {
  webrtc.sendCommand(cmd)
}

function startAdb() {
  if (adbTermContainer.value) {
    initAdb(adbTermContainer.value)
  }
}

function scrollToBottom() {
  setTimeout(() => {
    if (consoleRef.value) {
      consoleRef.value.scrollTop = consoleRef.value.scrollHeight
    }
  }, 50)
}

const deviceStore = useDeviceStore()
function quitAgent() {
  if (confirm(`警告：确定要停止设备 "${currentId.value}" 上的 Agent 进程吗？停止后该设备将下线。`)) {
    deviceStore.quitAgent(currentId.value)
  }
}

// 触控处理逻辑
let mouseDown = false
function onMouseDown(e) { 
  const coord = rotateCoords(e.clientX, e.clientY)
  mouseDown = true; 
  webrtc.sendTouch(0, e.clientX, e.clientY, 0, coord)
}
function onMouseMove(e) { 
  if (mouseDown) {
    const coord = rotateCoords(e.clientX, e.clientY)
    webrtc.sendTouch(2, e.clientX, e.clientY, 0, coord)
  }
}
function onMouseUp(e) { 
  const coord = rotateCoords(e.clientX, e.clientY)
  mouseDown = false; 
  webrtc.sendTouch(1, e.clientX, e.clientY, 0, coord)
}
function onMouseLeave(e) { 
  if (mouseDown) { 
    const coord = rotateCoords(e.clientX, e.clientY)
    mouseDown = false; 
    webrtc.sendTouch(1, e.clientX, e.clientY, 0, coord)
  }
}

function onTouchStart(e) {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i]
    const coord = rotateCoords(t.clientX, t.clientY)
    webrtc.sendTouch(0, t.clientX, t.clientY, t.identifier, coord)
  }
}
function onTouchMove(e) {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i]
    const coord = rotateCoords(t.clientX, t.clientY)
    webrtc.sendTouch(2, t.clientX, t.clientY, t.identifier, coord)
  }
}
function onTouchEnd(e) {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i]
    const coord = rotateCoords(t.clientX, t.clientY)
    webrtc.sendTouch(1, t.clientX, t.clientY, t.identifier, coord)
  }
}
</script>

<style scoped>
.device-panel-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #000;
  position: relative;
  overflow: hidden;
}

.fullscreen-fab {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
  transition: all 0.2s;
  font-size: 18px;
}

.fullscreen-fab:hover { background: rgba(0, 0, 0, 0.8); transform: scale(1.1); }

.stats-badge {
  position: absolute;
  top: 16px;
  left: 16px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  color: #0f0;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 4px;
  z-index: 100;
  pointer-events: none;
  white-space: nowrap;
}

.stat-delimiter { color: #555; margin: 0 2px; }
.stat-warn { color: #f85149; }

.video-wrapper {
  flex: 1;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  min-height: 0;
}

.video-stream {
  width: 100%;
  height: 100%;
  object-fit: contain;
  touch-action: none;
}

.panel-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.overlay-box { text-align: center; padding: 24px; }
.mini-spinner { width: 24px; height: 24px; border: 2px solid rgba(255,255,255,0.1); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 12px; }
@keyframes spin { to { transform: rotate(360deg); } }

.error-msg { color: var(--accent); font-weight: 600; }
.error-tip { font-size: 12px; color: #999; margin: 8px 0 16px; }

.retry-btn { background: var(--accent); color: white; border: none; padding: 6px 16px; border-radius: 4px; font-size: 12px; cursor: pointer; }

.panel-footer-actions {
  display: flex;
  background: #111;
  padding: 12px;
  gap: 8px;
  border-top: 1px solid var(--border);
}

.action-item {
  flex: 1;
  background: #222;
  border: 1px solid #333;
  color: #ccc;
  padding: 10px 4px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.action-item:hover { background: #333; border-color: var(--accent); color: white; }

.action-item.danger:hover { background: rgba(248, 81, 73, 0.2); border-color: var(--error); color: var(--error); }

/* 控制台样式 */
.console-drawer {
  position: absolute;
  bottom: 64px;
  left: 0;
  right: 0;
  height: 360px;
  background: #151515;
  border-top: 2px solid var(--accent);
  display: flex;
  flex-direction: column;
  z-index: 100;
  box-shadow: 0 -10px 30px rgba(0,0,0,0.6);
}

.console-header {
  background: #222;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #333;
}

.console-tabs { display: flex; }
.console-tabs button {
  background: none; border: none; color: #666; padding: 12px 16px; font-size: 12px; cursor: pointer; border-bottom: 2px solid transparent;
}
.console-tabs button.active { color: var(--accent); border-bottom-color: var(--accent); background: rgba(255,255,255,0.05); }

.close-console { background: none; border: none; color: #555; cursor: pointer; font-size: 18px; padding-right: 16px; }

.console-history { flex: 1; overflow-y: auto; padding: 16px; font-family: 'Fira Code', 'Courier New', monospace; font-size: 12px; background: #0a0a0a; }
.console-empty { color: #444; text-align: center; margin-top: 40px; }
.log-item { margin-bottom: 12px; }
.log-cmd { color: var(--accent); opacity: 0.8; font-weight: bold; }
.log-out { white-space: pre-wrap; word-break: break-all; margin: 4px 0 0 0; color: #eee; line-height: 1.4; }
.log-item.error .log-out { color: #ff5555; }
.log-item.success .log-out { color: #50fa7b; }

.console-shortcuts { display: flex; padding: 8px; gap: 8px; background: #1a1a1a; overflow-x: auto; border-top: 1px solid #333; }
.console-shortcuts button { background: #252525; border: 1px solid #333; color: #999; padding: 4px 10px; border-radius: 4px; font-size: 10px; white-space: nowrap; cursor: pointer; }

.console-shortcuts.danger { border-top: none; padding-top: 0; padding-bottom: 8px; }
.console-shortcuts .quit-btn { color: #f85149; border-color: rgba(248, 81, 73, 0.3); }
.console-shortcuts .quit-btn:hover { background: rgba(248, 81, 73, 0.1); border-color: #f85149; }

.console-input-group { display: flex; padding: 10px; gap: 8px; background: #222; }
.cmd-input { flex: 1; background: #000; border: 1px solid #444; color: #fff; padding: 8px 12px; border-radius: 4px; outline: none; }
.cmd-input:focus { border-color: var(--accent); }
.send-btn { background: var(--accent); color: white; border: none; padding: 0 16px; border-radius: 4px; font-weight: 600; cursor: pointer; }

.adb-container { flex: 1; background: #000; position: relative; overflow: hidden; }
.adb-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #666; text-align: center; padding: 20px; }
.adb-connect-btn { background: var(--accent); color: white; border: none; padding: 10px 20px; border-radius: 6px; margin-bottom: 12px; cursor: pointer; font-weight: 600; }

/* 手机端横屏视频全屏显示 - 长边对长边 */
@media (max-width: 1024px) {
  /* 横屏视频时，整个面板全屏 */
  .device-panel-view.mobile-landscape {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: #000;
  }
  
  /* 视频容器占满全屏 */
  .device-panel-view.mobile-landscape .video-wrapper {
    position: absolute;
    inset: 0;
    z-index: 1;
  }
  
  /* 视频旋转90度，完整显示（可能有黑边） */
  .device-panel-view.mobile-landscape .video-stream {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100vh;
    height: 100vw;
    transform: translate(-50%, -50%) rotate(90deg);
    object-fit: contain;  /* 完整显示视频，可能有黑边 */
  }
  
  /* 悬浮控制按钮 */
  .device-panel-view.mobile-landscape .panel-footer-actions {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .device-panel-view.mobile-landscape .panel-footer-actions .action-item {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
  }
  
  .device-panel-view.mobile-landscape .panel-footer-actions .action-item:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  /* 悬浮全屏按钮 */
  .device-panel-view.mobile-landscape .fullscreen-fab {
    z-index: 101;
  }
  
  /* 控制台在横屏时也需要悬浮 */
  .device-panel-view.mobile-landscape .console-drawer {
    position: fixed;
    bottom: 60px;
    left: 0;
    right: 0;
    z-index: 100;
  }
  
  /* 加载覆盖层 */
  .device-panel-view.mobile-landscape .panel-overlay {
    z-index: 50;
  }
}
</style>
