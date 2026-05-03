<template>
  <div class="device-panel-view" :class="{ 'is-mobile': isMobile, 'mobile-landscape': isMobile && isVideoLandscape }">
    <!-- 主内容区 -->
    <div class="main-content">

      <!-- 主视频容器 -->
      <div class="video-wrapper" ref="containerRef">
        <!-- 悬浮全屏按钮 (移入视频容器内，保证全屏时可见) -->
        <button class="fullscreen-fab" @click="toggleFullscreen" title="全屏">
          <svg class="icon" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
        </button>

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

        <!-- 悬浮菜单展开时的全屏点击遮罩 -->
        <div v-if="(isMobile || isFullscreen) && showMobileMenu" class="fab-overlay" @mousedown.stop.prevent="showMobileMenu = false" @touchstart.stop.prevent="showMobileMenu = false"></div>

        <!-- 手机端悬浮菜单 (移入视频容器内，保证全屏时可见) -->
        <div v-if="isMobile || isFullscreen" class="mobile-fab-container" :style="fabStyle">
          <button class="mobile-fab-main" :class="{ 'active': showMobileMenu }"
            @mousedown="onFabStart" @mousemove="onFabMove" @mouseup="onFabEnd" @mouseleave="onFabEnd"
            @touchstart.prevent="onFabStart" @touchmove.prevent="onFabMove" @touchend.prevent="onFabEnd">
            <svg v-if="showMobileMenu" class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            <svg v-else class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          </button>
          
          <div class="mobile-fab-menu" :class="{ 'show': showMobileMenu, 'align-left': isFabOnLeft, 'align-top': isFabOnTop }">
            <button class="fab-item" @click="quickKey('input keyevent 26'); showMobileMenu=false">
              <svg class="icon" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg> 电源
            </button>
            <button class="fab-item" @click="quickKey('input keyevent 3'); showMobileMenu=false">
              <svg class="icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> 首页
            </button>
            <button class="fab-item" @click="quickKey('input keyevent 4'); showMobileMenu=false">
              <svg class="icon" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg> 返回
            </button>
            <button class="fab-item" @click="showConsole = !showConsole; showMobileMenu=false">
              <svg class="icon" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg> 终端
            </button>
            <button class="fab-item" @click="keymapStore.setEditMode(true); showMobileMenu=false">
              <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg> 按键映射
            </button>
            <button class="fab-item" @click="keymapStore.toggleKeyHints(); showMobileMenu=false">
              <svg v-if="keymapStore.showKeyHints" class="icon" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              <svg v-else class="icon" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              {{ keymapStore.showKeyHints ? '隐藏提示' : '显示提示' }}
            </button>
            
            <div class="fab-divider" v-if="customButtons.length > 0"></div>
            <button v-for="(btn, idx) in customButtons" :key="idx" class="fab-item custom-item" @click="quickKey(btn.cmd); showMobileMenu=false" @contextmenu.prevent="removeCustomButton(idx)">
              <svg class="icon" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg> {{ btn.name }}
            </button>
            <button class="fab-item add-btn" @click="addCustomButton">
              <svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> 添加按键
            </button>
            
            <div class="fab-divider"></div>
            <button class="fab-item danger" @click="quitAgent; showMobileMenu=false">
              <svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg> 退出 Agent
            </button>
          </div>
        </div>

        <!-- 按键映射编辑器 -->
        <KeymapEditor :video-element="videoElement" />
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
    </div>

    <!-- PC 右侧控制栏 -->
    <div v-if="!isMobile" class="control-sidebar">
      <div class="sidebar-group">
        <button class="sidebar-btn" @click="quickKey('input keyevent 26')" title="电源">
          <svg class="icon" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
          <span class="btn-text">电源</span>
        </button>
        <button class="sidebar-btn" @click="quickKey('input keyevent 3')" title="HOME">
          <svg class="icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          <span class="btn-text">首页</span>
        </button>
        <button class="sidebar-btn" @click="quickKey('input keyevent 4')" title="BACK">
          <svg class="icon" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg>
          <span class="btn-text">返回</span>
        </button>
        <button class="sidebar-btn" @click="showConsole = !showConsole" title="控制台">
          <svg class="icon" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          <span class="btn-text">终端</span>
        </button>
        <button class="sidebar-btn" @click="keymapStore.setEditMode(true)" title="按键映射">
          <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
          <span class="btn-text">映射</span>
        </button>
        <button class="sidebar-btn" @click="keymapStore.toggleKeyHints()" :title="keymapStore.showKeyHints ? '隐藏按键提示' : '显示按键提示'">
          <svg v-if="keymapStore.showKeyHints" class="icon" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          <svg v-else class="icon" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
          <span class="btn-text">提示</span>
        </button>
      </div>
      
      <div class="sidebar-divider"></div>
      
      <div class="sidebar-group custom-group">
        <button v-for="(btn, idx) in customButtons" :key="idx" class="sidebar-btn custom-btn" @click="quickKey(btn.cmd)" @contextmenu.prevent="removeCustomButton(idx)" :title="btn.cmd + ' (右键删除)'">
          <svg class="icon" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
          <span class="btn-text">{{ btn.name }}</span>
        </button>
        <button class="sidebar-btn add-btn" @click="addCustomButton" title="添加按键">
          <svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span class="btn-text">添加</span>
        </button>
      </div>
      
      <div style="flex: 1"></div>
      
      <button class="sidebar-btn danger" @click="quitAgent" title="退出 Agent">
        <svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>
        <span class="btn-text">退出</span>
      </button>
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
import { useKeymapStore } from '@/stores/keymap'
import { KeymapEngine } from '@/utils/keymapEngine'
import ConnectionStatus from '@/components/ConnectionStatus.vue'
import ScreenshotModal from '@/components/ScreenshotModal.vue'
import KeymapEditor from '@/components/KeymapEditor.vue'

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

// 手机悬浮菜单状态及拖拽
const showMobileMenu = ref(false)
const fabStyle = ref({ right: '24px', bottom: '24px' })
const isFabOnLeft = ref(false)
const isFabOnTop = ref(false)
let isDragging = false
let dragStartTime = 0
let startX = 0
let startY = 0

function onFabStart(e) {
  isDragging = false
  dragStartTime = Date.now()
  const ev = e.touches ? e.touches[0] : e
  startX = ev.clientX
  startY = ev.clientY
}

function onFabMove(e) {
  if (!dragStartTime) return
  const ev = e.touches ? e.touches[0] : e
  const dx = ev.clientX - startX
  const dy = ev.clientY - startY
  if (!isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
    isDragging = true
  }
  if (isDragging) {
    let left = ev.clientX - 28 // 56/2 = 28 (center)
    let top = ev.clientY - 28
    
    if (left < 0) left = 0
    if (top < 0) top = 0
    if (left > window.innerWidth - 56) left = window.innerWidth - 56
    if (top > window.innerHeight - 56) top = window.innerHeight - 56
    
    isFabOnLeft.value = left < window.innerWidth / 2
    isFabOnTop.value = top < window.innerHeight / 2

    fabStyle.value = {
      left: left + 'px',
      top: top + 'px',
      right: 'auto',
      bottom: 'auto'
    }
  }
}

function onFabEnd(e) {
  if (dragStartTime && !isDragging && (Date.now() - dragStartTime < 500)) {
    showMobileMenu.value = !showMobileMenu.value
  }
  isDragging = false
  dragStartTime = 0
}

// 自定义按键
const customButtons = ref(JSON.parse(localStorage.getItem('cloudphone_custom_btns') || '[]'))

function addCustomButton() {
  const name = prompt('按钮名称 (最长4个字，如: 划线)')
  if (!name) return
  const cmd = prompt('ADB Shell 命令 (如: settings put system pointer_location 1)')
  if (!cmd) return
  customButtons.value.push({ name: name.substring(0, 4), cmd })
  localStorage.setItem('cloudphone_custom_btns', JSON.stringify(customButtons.value))
}

function removeCustomButton(index) {
  if (confirm('确定删除此按键？')) {
    customButtons.value.splice(index, 1)
    localStorage.setItem('cloudphone_custom_btns', JSON.stringify(customButtons.value))
  }
}

// 视频流统计信息
const videoStats = ref(null)
let statsInterval = null

let webrtc = useWebRTC(currentId.value)
const { isAdbConnected, initAdb, closeAdb } = useAdb(webrtc)

const keymapStore = useKeymapStore()
const keymapEngine = new KeymapEngine(
  (action, cx, cy, id, coord) => webrtc.sendTouch(action, cx, cy, id, coord),
  (cmd) => webrtc.sendCommand(cmd)
)

watch(() => keymapStore.activeProfile, (newProfile) => {
  keymapEngine.updateProfile(newProfile)
}, { immediate: true, deep: true })

function onGlobalKeyDown(e) {
  if (keymapStore.isEditMode) return;
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
  if (!videoNaturalSize.value.width) return;

  if (keymapEngine.handleKeyEvent(e, true, videoNaturalSize.value.width, videoNaturalSize.value.height)) {
    e.preventDefault();
  }
}

function onGlobalKeyUp(e) {
  if (keymapStore.isEditMode) return;
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
  if (!videoNaturalSize.value.width) return;

  if (keymapEngine.handleKeyEvent(e, false, videoNaturalSize.value.width, videoNaturalSize.value.height)) {
    e.preventDefault();
  }
}

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
  document.addEventListener('keydown', onGlobalKeyDown)
  document.addEventListener('keyup', onGlobalKeyUp)
  // 定期检查布局
  layoutInterval = setInterval(checkAndRecommendLayout, 2000)
  // 监听窗口大小变化
  window.addEventListener('resize', updateMobileState)
})

onUnmounted(() => {
  webrtc.disconnect()
  closeAdb()
  document.removeEventListener('keydown', onGlobalKeyDown)
  document.removeEventListener('keyup', onGlobalKeyUp)
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
function rotateCoords(clientX, clientY) {
  if (!needRotateCoords.value) return { x: clientX, y: clientY }
  
  const video = videoElement.value
  if (!video) return { x: clientX, y: clientY }
  
  const screenW = window.innerWidth
  const screenH = window.innerHeight
  const videoW = videoNaturalSize.value.width
  const videoH = videoNaturalSize.value.height
  
  if (!videoW || !videoH) return { x: clientX, y: clientY }
  
  const rotatedRatio = videoH / videoW
  const screenRatio = screenW / screenH
  
  let normInVideoX, normInVideoY
  
  if (screenRatio > rotatedRatio) {
    const videoDisplayW = screenH * rotatedRatio
    const offsetX = (screenW - videoDisplayW) / 2
    const videoX = clientX - offsetX
    normInVideoX = videoX / videoDisplayW
    normInVideoY = clientY / screenH
  } else {
    const videoDisplayH = screenW / rotatedRatio
    const offsetY = (screenH - videoDisplayH) / 2
    const videoY = clientY - offsetY
    normInVideoX = clientX / screenW
    normInVideoY = videoY / videoDisplayH
  }
  
  const origNormX = normInVideoY
  const origNormY = 1 - normInVideoX
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

function toggleConsole() {
  showConsole.value = !showConsole.value
  if (!showConsole.value) {
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

let mouseDown = false
function onMouseDown(e) { 
  const coord = rotateCoords(e.clientX, e.clientY)
  mouseDown = true; 
  webrtc.sendTouch(0, e.clientX, e.clientY, -1, coord)
}
function onMouseMove(e) { 
  if (mouseDown) {
    const coord = rotateCoords(e.clientX, e.clientY)
    webrtc.sendTouch(2, e.clientX, e.clientY, -1, coord)
  }
}
function onMouseUp(e) { 
  const coord = rotateCoords(e.clientX, e.clientY)
  mouseDown = false; 
  webrtc.sendTouch(1, e.clientX, e.clientY, -1, coord)
}
function onMouseLeave(e) { 
  if (mouseDown) { 
    const coord = rotateCoords(e.clientX, e.clientY)
    mouseDown = false; 
    webrtc.sendTouch(1, e.clientX, e.clientY, -1, coord)
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
  flex-direction: row;
  background: #000;
  position: relative;
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 0;
}

.icon {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
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
}
.fullscreen-fab .icon { width: 18px; height: 18px; }
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

/* PC 右侧栏 */
.control-sidebar {
  width: 64px;
  background: #111;
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  gap: 12px;
  overflow-y: auto;
  z-index: 10;
}

.sidebar-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  align-items: center;
}

.sidebar-btn {
  background: #222;
  border: 1px solid #333;
  color: #ccc;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.sidebar-btn .icon {
  margin-bottom: 2px;
}

.sidebar-btn .btn-text {
  font-size: 10px;
  white-space: nowrap;
}

.sidebar-btn:hover { background: #333; border-color: var(--accent); color: white; }
.sidebar-btn.danger:hover { background: rgba(248, 81, 73, 0.2); border-color: var(--error); color: var(--error); }
.sidebar-btn.danger { color: #888; }
.sidebar-btn.add-btn { border-style: dashed; }

.sidebar-divider {
  width: 32px;
  height: 1px;
  background: #333;
  margin: 4px 0;
}

/* 悬浮菜单全屏遮罩 */
.fab-overlay {
  position: fixed;
  inset: 0;
  z-index: 99;
}

/* 手机悬浮菜单 */
.mobile-fab-container {
  position: fixed;
  z-index: 100;
  width: 56px;
  height: 56px;
}

.mobile-fab-main {
  position: absolute;
  top: 0;
  left: 0;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.2s;
  touch-action: none;
  z-index: 2;
}
.mobile-fab-main .icon {
  width: 24px;
  height: 24px;
}
.mobile-fab-main:active { cursor: grabbing; transform: scale(0.95); }
.mobile-fab-main.active { background: #555; }

.mobile-fab-menu {
  position: absolute;
  bottom: 68px;
  right: 0;
  width: max-content;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(20, 20, 20, 0.9);
  backdrop-filter: blur(10px);
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  opacity: 0;
  pointer-events: none;
  transform: translateY(20px);
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  max-height: 60vh;
  overflow-y: auto;
  z-index: 1;
}

.mobile-fab-menu.align-left {
  right: auto;
  left: 0;
}

.mobile-fab-menu.align-top {
  bottom: auto;
  top: 68px;
  transform: translateY(-20px);
}

.mobile-fab-menu.show {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.fab-item {
  background: #2a2a2a;
  border: 1px solid #444;
  color: #eee;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  display: flex;
  align-items: center;
}

.fab-item .icon {
  margin-right: 8px;
  width: 18px;
  height: 18px;
}

.fab-item:active { background: var(--accent); }
.fab-item.danger { color: #f85149; }
.fab-item.add-btn { background: transparent; border-style: dashed; justify-content: center; }
.fab-divider { height: 1px; background: rgba(255,255,255,0.1); margin: 4px 0; }

/* 控制台样式 */
.console-drawer {
  position: absolute;
  bottom: 0;
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
  .device-panel-view.mobile-landscape {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: #000;
  }
  
  .device-panel-view.mobile-landscape .video-wrapper {
    position: absolute;
    inset: 0;
    z-index: 1;
  }
  
  .device-panel-view.mobile-landscape .video-stream {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100vh;
    height: 100vw;
    transform: translate(-50%, -50%) rotate(90deg);
    object-fit: contain;
  }
  
  .device-panel-view.mobile-landscape .fullscreen-fab {
    z-index: 101;
  }
  
  .device-panel-view.mobile-landscape .console-drawer {
    position: fixed;
    bottom: 60px;
    left: 0;
    right: 0;
    z-index: 100;
  }
  
  .device-panel-view.mobile-landscape .panel-overlay {
    z-index: 50;
  }
}
</style>
