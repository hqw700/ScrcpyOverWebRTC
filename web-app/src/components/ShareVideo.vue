<template>
  <div class="share-video-container" ref="containerRef">
    <!-- 视频画面（始终静音自动播放以满足浏览器 autoplay 策略；首次点击页面再开声音） -->
    <video
      ref="videoEl"
      class="share-video"
      autoplay
      playsinline
      :muted="!soundOn"
      @click="onVideoAreaClick"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseLeave"
      @touchstart.prevent="onTouchStart"
      @touchmove.prevent="onTouchMove"
      @touchend.prevent="onTouchEnd"
      @wheel.prevent="onWheel"
      @contextmenu.prevent
    ></video>

    <!-- 开声音提示（有音轨且未开声音时显示） -->
    <button
      v-if="isConnected && localSettings.audio && !soundOn"
      class="sound-hint"
      @click.stop="enableSound"
    >🔊 点击开启声音</button>

    <!-- 连接中 / 等待信令 -->
    <div v-if="showConnecting" class="state-overlay">
      <div class="loading-spinner"></div>
      <p class="state-text">{{ statusText }}</p>
    </div>

    <!-- 错误 / 断开 -->
    <div v-else-if="showError" class="state-overlay">
      <div class="error-icon">⚠️</div>
      <p class="state-text error-text">{{ errorText }}</p>
      <button class="btn-reconnect" @click="reconnect">🔄 重新连接</button>
    </div>

    <!-- 悬浮菜单展开时的全屏点击遮罩（与主控台 fab 一致） -->
    <div v-if="showFabMenu" class="fab-overlay" @mousedown.stop.prevent="showFabMenu = false" @touchstart.stop.prevent="showFabMenu = false"></div>

    <!-- 悬浮按键栏（可拖动 FAB + 展开菜单，复用主控台交互） -->
    <div v-show="isConnected" class="fab-container" :style="fabStyle">
      <button class="fab-main" :class="{ 'active': showFabMenu }"
        @mousedown="onFabStart" @mousemove="onFabMove" @mouseup="onFabEnd" @mouseleave="onFabEnd"
        @touchstart.prevent="onFabStart" @touchmove.prevent="onFabMove" @touchend.prevent="onFabEnd">
        <svg v-if="showFabMenu" class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        <svg v-else class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
      </button>

      <div class="fab-menu" :class="{ 'show': showFabMenu, 'align-left': isFabOnLeft, 'align-top': isFabOnTop }">
        <template v-if="!isViewOnly">
          <button class="fab-item" @click="quickKey(26)">
            <svg class="icon" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg> 电源
          </button>
          <button class="fab-item" @click="quickKey(3)">
            <svg class="icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> 首页
          </button>
          <button class="fab-item" @click="quickKey(4)">
            <svg class="icon" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg> 返回
          </button>
          <button class="fab-item" @click="quickKey(187)">
            <svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg> 多任务
          </button>
          <button class="fab-item" @click="quickKey(24)">
            <svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="19" y1="9" x2="19" y2="15"></line><line x1="16" y1="12" x2="22" y2="12"></line></svg> 音量+
          </button>
          <button class="fab-item" @click="quickKey(25)">
            <svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="19" y1="12" x2="15" y2="12"></line><line x1="16" y1="12" x2="22" y2="12"></line></svg> 音量-
          </button>
          <div class="fab-divider"></div>
        </template>

        <button class="fab-item" @click="togglePageMute">
          <svg v-if="!localSettings.audio || !soundOn" class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
          <svg v-else class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15 9a5 5 0 0 1 0 6"></path><path d="M17.7 6.3a9 9 0 0 1 0 11.4"></path></svg>
          {{ (!localSettings.audio || !soundOn) ? '开启声音' : '页面静音' }}
        </button>
        <button class="fab-item" @click="openSettings">
          <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1"></path></svg> 设置
        </button>

        <div class="fab-divider"></div>
        <button class="fab-item" @click="onToggleFullscreen">
          <svg class="icon" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </button>
        <button v-if="!isMobile" class="fab-item" @click="onToggleWebFullscreen">
          <svg class="icon" viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
          {{ isWebFullscreen ? '退出页面全屏' : '页面全屏' }}
        </button>
        <button v-if="!isMobile && pictureInPictureSupported" class="fab-item" @click="onTogglePictureInPicture">
          <svg class="icon" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><rect x="11" y="9" width="9" height="7" rx="1" ry="1" fill="currentColor" stroke="none"></rect></svg>
          {{ isPiP ? '退出画中画' : '画中画' }}
        </button>
      </div>
    </div>

    <!-- 复用主控台连接设置面板 -->
    <SettingsModal
      v-if="showSettingsModal"
      :settings="localSettings"
      :is-connected="isConnected"
      :is-global="false"
      :is-custom="hasCustomShareSettings"
      :camera-support="cameraSupport"
      @close="showSettingsModal = false"
      @save="saveSettings"
      @reset="resetSettings"
    />
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted, onUnmounted, watch } from 'vue'
import { useWebRTC } from '@/composables/useWebRTC'
import { defaultSettings } from '@/utils/settings'
import SettingsModal from '@/components/SettingsModal.vue'

const props = defineProps({
  deviceId: { type: String, required: true },
  shareToken: { type: String, default: '' },
  sharePassword: { type: String, default: '' },
  accessMode: { type: String, default: 'full' }
})

const isViewOnly = computed(() => props.accessMode === 'view_only')

const videoEl = ref(null)
// 声音开关：默认静音以保证 autoplay 合规（无用户手势时浏览器禁止有声自动播放），
// 用户首次点击页面/按钮后开声音
const soundOn = ref(false)
const showSettingsModal = ref(false)
const cameraSupport = ref(true)

// --- 访客本地流配置：与主控台同一 schema，但存分享专属 key，避免污染同浏览器管理员配置 ---
const shareSettingsKey = computed(() => `cloudphone_share_settings_${props.deviceId}`)
const shareDefaults = { ...defaultSettings, audio: true }

function loadShareSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(shareSettingsKey.value) || 'null')
    if (stored && typeof stored === 'object') {
      return { ...shareDefaults, ...stored }
    }
  } catch (e) {}
  return { ...shareDefaults }
}

const localSettings = ref(loadShareSettings())
const hasCustomShareSettings = computed(() => localStorage.getItem(shareSettingsKey.value) !== null)

// --- WebRTC 连接（配置变更时整页刷新生效，见 saveSettings） ---
const webrtc = shallowRef(null)
const status = ref('disconnected')
const error = ref(null)
let stopWatchers = []

function buildOptions() {
  const s = localSettings.value
  return {
    view_only: isViewOnly.value,
    max_fps: s.fps,
    max_size: s.size,
    bitrate: s.bitrate * 1000000,
    min_bitrate: (s.minBitrate || 8) * 1000000,
    max_bitrate: (s.maxBitrate || 20) * 1000000,
    bwe: s.bwe,
    audio: s.audio,
    audio_gain: s.audioGain,
    audio_source: s.audioSource,
    audio_dup: s.audioDup,
    audio_low_latency: s.audioLowLatency,
    power_off: s.powerOff
  }
}

function createConnection() {
  destroyConnection()
  const inst = useWebRTC(props.deviceId, buildOptions())
  webrtc.value = inst
  stopWatchers = [
    watch(inst.status, v => { status.value = v || 'disconnected' }, { immediate: true }),
    watch(inst.error, v => { error.value = v }, { immediate: true }),
    watch(inst.cameraSupport, v => { cameraSupport.value = v !== false }, { immediate: true })
  ]
  inst.setVideoGetter(() => videoEl.value)
  inst.connect(props.shareToken, props.sharePassword)
}

function destroyConnection() {
  stopWatchers.forEach(stop => stop())
  stopWatchers = []
  if (webrtc.value) {
    webrtc.value.disconnect()
    webrtc.value = null
  }
}

// 错误遮罩的“重新连接”：与右上角重连一致，整页刷新拿到干净状态
function reconnect() {
  window.location.reload()
}

// --- 设置面板回调（复用 SettingsModal） ---
function saveSettings(newSettings) {
  localSettings.value = newSettings
  try {
    localStorage.setItem(shareSettingsKey.value, JSON.stringify(newSettings))
  } catch (e) {}
  // 与右上角“重连”同一条路：整页刷新。
  // 配置已持久化，刷新后 loadShareSettings 自动读取；
  // 原地断开即连会撞上 Agent 停服/重启窗口（未打补丁版本），整页刷新天然规避。
  window.location.reload()
}

function resetSettings() {
  localStorage.removeItem(shareSettingsKey.value)
  window.location.reload()
}

function openSettings() {
  showFabMenu.value = false
  showSettingsModal.value = true
}

// --- 声音控制（本地播放侧，立即生效） ---
function enableSound() {
  if (!videoEl.value || !localSettings.value.audio) return
  soundOn.value = true
  videoEl.value.muted = false
  videoEl.value.play().catch(() => {})
}

function onVideoAreaClick() {
  // 首次点击画面区域时顺便开声音（此时已有用户手势，autoplay 限制解除）
  if (!soundOn.value) enableSound()
}

function togglePageMute() {
  showFabMenu.value = false
  if (soundOn.value) {
    soundOn.value = false
    if (videoEl.value) videoEl.value.muted = true
  } else {
    enableSound()
  }
}

const isConnected = computed(() => status.value === 'connected')
const showConnecting = computed(() =>
  !error.value && ['connecting', 'signaling', 'waiting_offer', 'connecting_webrtc'].includes(status.value)
)
const showError = computed(() => !!error.value || status.value === 'error' || status.value === 'disconnected')
const statusText = computed(() => {
  switch (status.value) {
    case 'signaling': return '信令通道已建立，协商连接参数...'
    case 'waiting_offer': return '等待设备推流...'
    case 'connecting_webrtc': return '正在建立 P2P 视频通道...'
    default: return '正在连接设备...'
  }
})
const errorText = computed(() => error.value || '连接已断开')

// --- 悬浮 FAB（拖动 + 点击展开，与主控台 mobile-fab 同一交互） ---
const showFabMenu = ref(false)
const fabStyle = ref({ right: '24px', bottom: '24px' })
const isFabOnLeft = ref(false)
const isFabOnTop = ref(false)
let isDragging = false
let dragStartTime = 0
let startX = 0
let startY = 0
let fabPressed = false

function onFabStart(e) {
  fabPressed = true
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
    let left = ev.clientX - 28
    let top = ev.clientY - 28
    if (left < 0) left = 0
    if (top < 0) top = 0
    if (left > window.innerWidth - 56) left = window.innerWidth - 56
    if (top > window.innerHeight - 56) top = window.innerHeight - 56
    isFabOnLeft.value = left < window.innerWidth / 2
    isFabOnTop.value = top < window.innerHeight / 2
    fabStyle.value = { left: left + 'px', top: top + 'px' }
  }
}

function onFabEnd(e) {
  // 鼠标滑出按钮不算“点击”：仅在按住拖动时收尾拖动状态。
  // 否则菜单打开后鼠标一移开就会被误判为再次点击而关闭。
  if (e.type === 'mouseleave') {
    if (fabPressed) {
      isDragging = false
      dragStartTime = 0
      fabPressed = false
    }
    return
  }
  // mouseup / touchend：未拖动视为一次点击，切换菜单
  const wasDragging = isDragging
  isDragging = false
  dragStartTime = 0
  fabPressed = false
  if (!wasDragging) {
    showFabMenu.value = !showFabMenu.value
  }
}

// --- 悬浮按键：Android 键值注入（view_only 不渲染入口，composable 二次拦截兜底） ---
function quickKey(keycode) {
  showFabMenu.value = false
  if (isViewOnly.value || !webrtc.value) return
  webrtc.value.sendInjectKeycode(0, keycode)
  webrtc.value.sendInjectKeycode(1, keycode)
}

// --- 全屏 / 页面全屏 / 画中画（移植自主控台 DeviceClient） ---
const containerRef = ref(null)
const isFullscreen = ref(false)
const isWebFullscreen = ref(false)
const isMobile = ref(window.innerWidth <= 1024)

function updateMedia() {
  isMobile.value = window.innerWidth <= 1024
}

function onToggleFullscreen() {
  showFabMenu.value = false
  if (!document.fullscreenElement) {
    // 若处于页面全屏，先退出，避免样式污染系统全屏元素
    if (isWebFullscreen.value) {
      document.body.classList.remove('web-fullscreen')
      isWebFullscreen.value = false
    }
    containerRef.value?.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

function onToggleWebFullscreen() {
  showFabMenu.value = false
  if (!isWebFullscreen.value) {
    // 若处于系统全屏，先退出
    if (document.fullscreenElement) {
      document.exitFullscreen()
    }
    document.body.classList.add('web-fullscreen')
    isWebFullscreen.value = true
  } else {
    document.body.classList.remove('web-fullscreen')
    isWebFullscreen.value = false
  }
}

const pictureInPictureSupported = computed(() => {
  return !!('documentPictureInPicture' in window) || !!document.pictureInPictureEnabled
})
const isPiP = ref(false)
let pipWindow = null

async function onTogglePictureInPicture() {
  showFabMenu.value = false
  if (!videoEl.value) return

  // 已在画中画：退出
  if (isPiP.value) {
    if (pipWindow) {
      pipWindow.close()
    } else if (document.pictureInPictureElement) {
      await document.exitPictureInPicture()
    }
    isPiP.value = false
    return
  }

  // 优先 Document PiP（保留交互）
  if ('documentPictureInPicture' in window) {
    try {
      const video = videoEl.value
      const vw = video.videoWidth || 480
      const vh = video.videoHeight || 854
      const scale = Math.min(400 / vw, 700 / vh, 1)
      const pipW = Math.round(vw * scale)
      const pipH = Math.round(vh * scale)

      pipWindow = await window.documentPictureInPicture.requestWindow({
        width: pipW,
        height: pipH,
      })

      const styles = document.querySelectorAll('style, link[rel="stylesheet"]')
      styles.forEach(s => {
        pipWindow.document.head.appendChild(s.cloneNode(true))
      })

      const pipStyle = pipWindow.document.createElement('style')
      pipStyle.textContent = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #000; overflow: hidden; width: 100%; height: 100vh; display: flex; align-items: center; justify-content: center; }
        .pip-video-container { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; }
        video { width: 100%; height: 100%; object-fit: contain; display: block; }
      `
      pipWindow.document.head.appendChild(pipStyle)

      const container = pipWindow.document.createElement('div')
      container.className = 'pip-video-container'
      container.appendChild(video)
      pipWindow.document.body.appendChild(container)

      isPiP.value = true

      // PiP 窗口关闭时把 video 移回原容器（原为第一个子节点）
      pipWindow.addEventListener('pagehide', () => {
        const mainContainer = containerRef.value
        if (mainContainer && video) {
          mainContainer.insertBefore(video, mainContainer.firstChild)
        }
        isPiP.value = false
        pipWindow = null
      })

      return
    } catch (err) {
      console.warn('Document PiP failed, falling back to standard PiP:', err)
      pipWindow = null
    }
  }

  // 回退：标准 PiP（仅观看）
  try {
    await videoEl.value.requestPictureInPicture()
    isPiP.value = true
    videoEl.value.addEventListener('leavepictureinpicture', () => {
      isPiP.value = false
    }, { once: true })
  } catch (err) {
    console.error('PiP error:', err)
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

// --- 触控/鼠标/滚轮输入注入 ---
let mouseDown = false

function onMouseDown(e) {
  if (isViewOnly.value || !webrtc.value) return
  if (e.button === 1) { // 中键 -> HOME
    webrtc.value.sendInjectKeycode(0, 3)
    e.preventDefault()
    return
  }
  if (e.button === 2) { // 右键 -> BACK
    webrtc.value.sendInjectKeycode(0, 4)
    e.preventDefault()
    return
  }
  mouseDown = true
  webrtc.value.sendTouch(0, e.clientX, e.clientY, -1)
  e.preventDefault()
}

function onMouseMove(e) {
  if (isViewOnly.value || !mouseDown || !webrtc.value) return
  webrtc.value.sendTouch(2, e.clientX, e.clientY, -1)
}

function onMouseUp(e) {
  if (isViewOnly.value || !webrtc.value) return
  if (e.button === 1) {
    webrtc.value.sendInjectKeycode(1, 3)
    e.preventDefault()
    return
  }
  if (e.button === 2) {
    webrtc.value.sendInjectKeycode(1, 4)
    e.preventDefault()
    return
  }
  if (!mouseDown) return
  mouseDown = false
  webrtc.value.sendTouch(1, e.clientX, e.clientY, -1)
}

function onMouseLeave(e) {
  if (isViewOnly.value || !mouseDown || !webrtc.value) return
  mouseDown = false
  webrtc.value.sendTouch(1, e.clientX, e.clientY, -1)
}

function onTouchStart(e) {
  if (isViewOnly.value || !webrtc.value) return
  for (const t of e.changedTouches) {
    webrtc.value.sendTouch(0, t.clientX, t.clientY, t.identifier)
  }
}

function onTouchMove(e) {
  if (isViewOnly.value || !webrtc.value) return
  for (const t of e.changedTouches) {
    webrtc.value.sendTouch(2, t.clientX, t.clientY, t.identifier)
  }
}

function onTouchEnd(e) {
  if (isViewOnly.value || !webrtc.value) return
  for (const t of e.changedTouches) {
    webrtc.value.sendTouch(1, t.clientX, t.clientY, t.identifier)
  }
}

function wheelDeltaToScroll(delta) {
  if (!delta) return 0
  const magnitude = Math.max(1, Math.min(16, Math.round(Math.abs(delta) / 8)))
  return -Math.sign(delta) * magnitude
}

function onWheel(e) {
  if (isViewOnly.value || !webrtc.value) return
  const scrollV = wheelDeltaToScroll(e.deltaY)
  const scrollH = wheelDeltaToScroll(e.deltaX)
  if (!scrollV && !scrollH) return
  webrtc.value.sendScroll(e.clientX, e.clientY, scrollH, scrollV)
}

onMounted(() => {
  createConnection()
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('resize', updateMedia)
})

onUnmounted(() => {
  destroyConnection()
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('resize', updateMedia)
  if (isWebFullscreen.value) {
    document.body.classList.remove('web-fullscreen')
  }
  if (pipWindow) {
    pipWindow.close()
    pipWindow = null
  }
})
</script>

<style scoped>
.share-video-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 页面全屏：占满整个视口（与主控台 web-fullscreen 同思路） */
.web-fullscreen .share-video-container {
  position: fixed;
  inset: 0;
  z-index: 2500;
}

.share-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.state-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(10, 12, 20, 0.75);
  color: #94a3b8;
  z-index: 10;
}

.loading-spinner {
  width: 42px;
  height: 42px;
  border: 4px solid rgba(56, 189, 248, 0.1);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: spin 1s infinite linear;
  margin-bottom: 14px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.state-text {
  font-size: 0.92rem;
}

.error-icon {
  font-size: 2.5rem;
  margin-bottom: 10px;
}

.error-text {
  color: #f43f5e;
  margin-bottom: 16px;
}

.btn-reconnect {
  padding: 9px 22px;
  background: linear-gradient(135deg, #0284c7, #6366f1);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}

/* 开声音提示浮标 */
.sound-hint {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  padding: 8px 18px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(56, 189, 248, 0.5);
  border-radius: 20px;
  color: #38bdf8;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  animation: hint-pulse 2s infinite;
}

@keyframes hint-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.35); }
  50% { box-shadow: 0 0 0 8px rgba(56, 189, 248, 0); }
}

/* 悬浮 FAB（与主控台 mobile-fab 同一视觉语言） */
.fab-overlay {
  position: absolute;
  inset: 0;
  z-index: 25;
}

.fab-container {
  position: absolute;
  z-index: 30;
}

.fab-main {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(56, 189, 248, 0.35);
  color: #38bdf8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  touch-action: none;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  transition: background 0.15s;
}

.fab-main.active,
.fab-main:hover {
  background: rgba(2, 132, 199, 0.5);
}

.fab-main .icon {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.fab-menu {
  position: absolute;
  bottom: 58px;
  right: 0;
  min-width: 132px;
  padding: 6px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 12px;
  backdrop-filter: blur(6px);
  display: none;
  flex-direction: column;
  gap: 2px;
}

.fab-menu.show {
  display: flex;
}

.fab-menu.align-left {
  right: auto;
  left: 0;
}

.fab-menu.align-top {
  bottom: auto;
  top: 58px;
}

.fab-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #cbd5e1;
  font-size: 0.86rem;
  cursor: pointer;
  white-space: nowrap;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}

.fab-item:hover {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
}

.fab-item .icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.fab-divider {
  height: 1px;
  background: rgba(148, 163, 184, 0.2);
  margin: 4px 6px;
}
</style>
