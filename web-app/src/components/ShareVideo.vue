<template>
  <div class="share-video-container" ref="containerRef">
    <!-- WebCodecs 极速锁相 Canvas 画面 -->
    <canvas
      v-show="isWebCodecs"
      ref="canvasEl"
      class="share-video"
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
    ></canvas>

    <!-- HTML5 传统视频画面 (回退模式) -->
    <video
      v-show="!isWebCodecs"
      ref="videoEl"
      class="share-video"
      autoplay
      playsinline
      webkit-playsinline
      disableremoteplayback
      controlslist="nodownload nofullscreen noremoteplayback noplaybackrate"
      x-webkit-airplay="deny"
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

    <!-- 开声音：点击画面任意位置即可解除静音（满足浏览器 autoplay 策略），
         或通过悬浮菜单的"开启声音"切换 -->

    <!-- 连接中 / 等待信令 -->
    <div v-if="showConnecting" class="state-overlay">
      <div v-if="connMetaText" class="conn-meta">{{ connMetaText }}</div>
      <div class="loading-spinner"></div>
      <p class="state-text">{{ statusText }}</p>
    </div>

    <!-- 错误 / 断开 -->
    <div v-else-if="showError" class="state-overlay">
      <div class="error-icon">⚠️</div>
      <p class="state-text error-text">{{ errorText }}</p>
      <button class="btn-reconnect" @click="reconnect">{{ $t('console.reconnect') }}</button>
    </div>

    <!-- 沉浸全屏引导胶囊（连接成功后展示几秒，按任意键或点击即可进入全屏） -->
    <transition name="fade">
      <div
        v-if="isConnected && showFullscreenHint && !isFullscreen && nativeFullscreenSupported"
        class="fullscreen-hint-pill"
        @click.stop="onToggleFullscreen"
      >
        <svg class="hint-icon" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
        <span>{{ $t('share.enterFullscreenHint') }}</span>
      </div>
    </transition>

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
        <!-- 顶部信息区：倒计时与状态 -->
        <div class="fab-status-card" :class="{ 'warning': remainingSeconds >= 0 && remainingSeconds < 300 }">
          <div class="status-row countdown-row">
            <span class="status-icon">⏱️</span>
            <span class="countdown-label">{{ $t('share.remainingTime') }}</span>
            <span class="countdown-val">{{ formattedCountdown }}</span>
          </div>
          <div v-if="deviceName || cardCode" class="status-row meta-row">
            <span v-if="deviceName" class="meta-device" :title="deviceName">📱 {{ deviceName }}</span>
            <span v-if="cardCode" class="meta-card">🔑 {{ cardCode }}</span>
            <span :class="['meta-mode', accessMode]">
              {{ accessMode === 'full' ? $t('share.modeFull') : $t('share.modeViewOnly') }}
            </span>
          </div>
        </div>

        <div class="fab-divider"></div>

        <template v-if="!isViewOnly">
          <button class="fab-item" @click="quickKey(26)">
            <svg class="icon" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg> {{ $t('deviceClient.power') }}
          </button>
          <button class="fab-item" @click="quickKey(3)">
            <svg class="icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> {{ $t('deviceClient.home') }}
          </button>
          <button class="fab-item" @click="quickKey(4)">
            <svg class="icon" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg> {{ $t('deviceClient.back') }}
          </button>
          <button class="fab-item" @click="quickKey(187)">
            <svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg> {{ $t('deviceClient.recents') }}
          </button>
          <button class="fab-item" @click="quickKey(24)">
            <svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="19" y1="9" x2="19" y2="15"></line><line x1="16" y1="12" x2="22" y2="12"></line></svg> {{ $t('deviceClient.volumeUp') }}
          </button>
          <button class="fab-item" @click="quickKey(25)">
            <svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="19" y1="12" x2="15" y2="12"></line><line x1="16" y1="12" x2="22" y2="12"></line></svg> {{ $t('deviceClient.volumeDown') }}
          </button>
          <div class="fab-divider"></div>
        </template>

        <!-- 重连按钮 -->
        <button class="fab-item" @click="reconnect">
          <svg class="icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          {{ $t('share.reconnectBtn') }}
        </button>

        <button class="fab-item" @click="togglePageMute">
          <svg v-if="!localSettings.audio || !soundOn" class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
          <svg v-else class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15 9a5 5 0 0 1 0 6"></path><path d="M17.7 6.3a9 9 0 0 1 0 11.4"></path></svg>
          {{ (!localSettings.audio || !soundOn) ? $t('deviceClient.enableAudio') : $t('deviceClient.mutePage') }}
        </button>
        <button class="fab-item" @click="openSettings">
          <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1"></path></svg> {{ $t('settings.title') }}
        </button>

        <div class="fab-divider"></div>
        <button class="fab-item" @click="onToggleFullscreen">
          <svg class="icon" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
          {{ isFullscreen ? $t('deviceClient.exitFullscreen') : $t('deviceClient.enterFullscreen') }}
        </button>
        <button v-if="!isMobile && pictureInPictureSupported" class="fab-item" @click="onTogglePictureInPicture">
          <svg class="icon" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><rect x="11" y="9" width="9" height="7" rx="1" ry="1" fill="currentColor" stroke="none"></rect></svg>
          {{ isPiP ? $t('deviceClient.exitPip') : $t('deviceClient.enterPip') }}
        </button>
      </div>
    </div>

    <!-- 复用主控台连接设置面板（被禁维度置灰锁定；访客不开放预览/缩略图设置） -->
    <SettingsModal
      v-if="showSettingsModal"
      :settings="localSettings"
      :is-connected="isConnected"
      :is-global="false"
      :is-custom="hasCustomShareSettings"
      :camera-support="cameraSupport"
      :locked-sections="lockedSections"
      :show-preview-tab="false"
      @close="showSettingsModal = false"
      @save="saveSettings"
      @reset="resetSettings"
    />
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWebRTC } from '@/composables/useWebRTC'
import { defaultSettings } from '@/utils/settings'
import SettingsModal from '@/components/SettingsModal.vue'

const { t } = useI18n()

const props = defineProps({
  deviceId: { type: String, required: true },
  deviceName: { type: String, default: '' },
  shareToken: { type: String, default: '' },
  sharePassword: { type: String, default: '' },
  accessMode: { type: String, default: 'full' },
  // 分享细粒度权限：禁止访客修改的设置维度（服务端信令层同步强制）
  forbidBitrate: { type: Boolean, default: false },
  forbidFps: { type: Boolean, default: false },
  forbidResolution: { type: Boolean, default: false },
  forbidAudio: { type: Boolean, default: false },
  // 分享者配置的访客端设置值（settings.js schema，null 表示未配置）
  guestSettings: { type: Object, default: null },
  // 蒙板展示用：卡密与分享剩余秒数（-1 = 永久）
  cardCode: { type: String, default: '' },
  remainingSeconds: { type: Number, default: -1 }
})

const isViewOnly = computed(() => props.accessMode === 'view_only')

// 被禁维度 -> SettingsModal 锁定分区
const lockedSections = computed(() => {
  const arr = []
  if (props.forbidBitrate) arr.push('bitrate')
  if (props.forbidFps) arr.push('fps')
  if (props.forbidResolution) arr.push('size')
  if (props.forbidAudio) arr.push('audio')
  return arr
})

const videoEl = ref(null)
const canvasEl = ref(null)
// 声音开关：默认静音以保证 autoplay 合规（无用户手势时浏览器禁止有声自动播放），
// 用户首次点击页面/按钮后开声音
const soundOn = ref(false)
const showSettingsModal = ref(false)
const cameraSupport = ref(true)

// --- 访客本地流配置：与主控台同一 schema，但存分享专属 key，避免污染同浏览器管理员配置 ---
const shareSettingsKey = computed(() => `cloudphone_share_settings_${props.deviceId}`)
const shareDefaults = { ...defaultSettings, audio: true }

// 设置维度 -> settings.js 键：被禁维度忽略访客本地值，以分享者配置为准
const DIM_KEYS = {
  bitrate: ['bitrate', 'minBitrate', 'maxBitrate', 'bwe'],
  fps: ['fps'],
  resolution: ['size'],
  audio: ['audio', 'audioGain', 'audioSource', 'audioDup', 'audioLowLatency']
}

function loadShareSettings() {
  // 分享者配置（服务端下发）优先于默认值
  const base = { ...shareDefaults, ...(props.guestSettings || {}) }
  try {
    const stored = JSON.parse(localStorage.getItem(shareSettingsKey.value) || 'null')
    if (stored && typeof stored === 'object') {
      const forbidden = new Set()
      if (props.forbidBitrate) DIM_KEYS.bitrate.forEach(k => forbidden.add(k))
      if (props.forbidFps) DIM_KEYS.fps.forEach(k => forbidden.add(k))
      if (props.forbidResolution) DIM_KEYS.resolution.forEach(k => forbidden.add(k))
      if (props.forbidAudio) DIM_KEYS.audio.forEach(k => forbidden.add(k))
      for (const [k, v] of Object.entries(stored)) {
        if (!forbidden.has(k)) base[k] = v
      }
    }
  } catch (e) {}

  // 历史旧缓存自愈防御：若访客本地残留了旧的 8Mbps/20Mbps 默认值且分享未显式指定，自动对齐
  if (base.minBitrate >= 8 && (!props.guestSettings || !props.guestSettings.minBitrate)) {
    base.minBitrate = 1
  }
  if (base.maxBitrate >= 20 && (!props.guestSettings || !props.guestSettings.maxBitrate)) {
    base.maxBitrate = 4
  }

  return base
}

const localSettings = ref(loadShareSettings())
const hasCustomShareSettings = computed(() => localStorage.getItem(shareSettingsKey.value) !== null)

// --- WebRTC 连接（配置变更时整页刷新生效，见 saveSettings） ---
const webrtc = shallowRef(null)
const isWebCodecs = computed(() => Boolean(webrtc.value?.isWebCodecsActive?.value))
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
    min_bitrate: (s.minBitrate || 1) * 1000000,
    max_bitrate: (s.maxBitrate || 4) * 1000000,
    bwe: s.bwe,
    audio: s.audio,
    audio_gain: s.audioGain,
    audio_source: s.audioSource,
    audio_dup: s.audioDup,
    audio_low_latency: s.audioLowLatency,
    power_off: s.powerOff,
    video_source: s.videoSource,
    camera_facing: s.cameraFacing,
    camera_id: s.cameraId,
    camera_size: s.cameraSize,
    camera_fps: s.cameraFps,
    camera_high_speed: s.cameraHighSpeed,
    camera_ar: s.cameraAr
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
  inst.setCanvasGetter(() => canvasEl.value)
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
  tryEnterFullscreenOnFirstGesture()
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
    case 'signaling': return t('share.signalingDesc')
    case 'waiting_offer': return t('share.waitingOffer')
    case 'connecting_webrtc': return t('share.connectingWebrtc')
    default: return t('share.connectingDevice')
  }
})
const errorText = computed(() => {
  if (!error.value) return t('share.connectionLost')
  const str = String(error.value)
  if (
    str === 'SHARE_IN_USE' ||
    str.includes('当前分享已被其他访客占用') ||
    str.toLowerCase().includes('already in use')
  ) {
    return t('share.shareInUse')
  }
  if (
    str === 'SIGNALING_ERROR' ||
    str.includes('信令连接异常')
  ) {
    return t('share.signalingError')
  }
  return error.value
})

// 蒙板上方：当前访客（卡密）+ 分享剩余时间
const connMetaText = computed(() => {
  let text = props.cardCode ? `🔑 ${props.cardCode}` : ''
  const sec = props.remainingSeconds
  let remain = ''
  if (sec < 0) {
    remain = t('share.neverExpire')
  } else if (sec > 0) {
    const d = Math.floor(sec / 86400)
    const h = Math.floor((sec % 86400) / 3600)
    const m = Math.floor((sec % 3600) / 60)
    if (d > 0) remain = t('common.remainDaysHours', { d, h })
    else if (h > 0) remain = t('common.remainHoursMins', { h, m })
    else remain = t('common.remainMins', { m: Math.max(1, m) })
  } else if (sec === 0) {
    remain = t('common.expired')
  }
  if (remain) text = text ? `${text} · ${remain}` : remain
  return text
})

// 悬浮菜单展开时展示的倒计时
const formattedCountdown = computed(() => {
  const sec = props.remainingSeconds
  if (sec < 0) return t('share.neverExpire') || '♾️ 永久有效'
  if (sec === 0) return '00:00:00 (已到期)'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600).toString().padStart(2, '0')
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0')
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return d > 0 ? `${d}d ${h}:${m}:${s}` : `${h}:${m}:${s}`
})

// --- 悬浮 FAB（拖动 + 点击展开，与主控台 mobile-fab 同一交互） ---
const isMobile = ref(window.innerWidth <= 1024)
const showFabMenu = ref(false)
// 移动端默认抬升悬浮球位置（避开屏幕底栏与手势条），PC端保持合适边距
const fabStyle = ref(
  isMobile.value
    ? { right: '18px', bottom: '64px' }
    : { right: '24px', bottom: '24px' }
)
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
    const maxTop = window.innerHeight - (isMobile.value ? 76 : 56)
    if (top > maxTop) top = maxTop
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

// --- 全屏 / 画中画（免密页面默认铺满视口显示） ---
const containerRef = ref(null)
const isFullscreen = ref(false)
const showFullscreenHint = ref(true)
let hasAutoFullscreenTriggered = false

function updateMedia() {
  isMobile.value = window.innerWidth <= 1024
}

const nativeFullscreenSupported = ref(!!document.fullscreenEnabled)

function tryEnterFullscreenOnFirstGesture() {
  showFullscreenHint.value = false
  if (hasAutoFullscreenTriggered) return
  hasAutoFullscreenTriggered = true
  if (nativeFullscreenSupported.value && !document.fullscreenElement) {
    const el = containerRef.value || document.documentElement
    if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => {})
    } else if (el?.webkitRequestFullscreen) {
      el.webkitRequestFullscreen()
    }
  }
}

function onGlobalAnyKeyOrGesture(e) {
  if (document.fullscreenElement) {
    showFullscreenHint.value = false
    return
  }
  // 忽略功能键（如 F5、F12、Ctrl/Cmd 组合键）
  if (e.type === 'keydown' && (e.key === 'F5' || e.key === 'F12' || e.ctrlKey || e.metaKey)) {
    return
  }
  tryEnterFullscreenOnFirstGesture()
  if (!soundOn.value) {
    enableSound()
  }
}

function onToggleFullscreen() {
  showFabMenu.value = false
  showFullscreenHint.value = false
  if (!nativeFullscreenSupported.value) return
  if (!document.fullscreenElement) {
    containerRef.value?.requestFullscreen().catch(() => {})
  } else {
    document.exitFullscreen().catch(() => {})
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
  tryEnterFullscreenOnFirstGesture()
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
  tryEnterFullscreenOnFirstGesture()
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
  window.addEventListener('keydown', onGlobalAnyKeyOrGesture)
  window.addEventListener('pointerdown', onGlobalAnyKeyOrGesture, { passive: true })
  setTimeout(() => {
    showFullscreenHint.value = false
  }, 6000)
})

onUnmounted(() => {
  destroyConnection()
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('resize', updateMedia)
  window.removeEventListener('keydown', onGlobalAnyKeyOrGesture)
  window.removeEventListener('pointerdown', onGlobalAnyKeyOrGesture)
  if (pipWindow) {
    pipWindow.close()
    pipWindow = null
  }
})
</script>

<style scoped>
.share-video-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
  -webkit-touch-callout: none;
}

.share-video {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  display: block;
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

.conn-meta {
  font-size: 0.78rem;
  color: #64748b;
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
  min-width: 170px;
  max-width: 260px;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px;
  background: rgba(15, 23, 42, 0.94);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 14px;
  backdrop-filter: blur(8px);
  display: none;
  flex-direction: column;
  gap: 3px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
}

.fab-status-card {
  padding: 8px 10px;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  user-select: none;
}

.fab-status-card.warning {
  background: rgba(244, 63, 94, 0.15);
  border-color: rgba(244, 63, 94, 0.45);
}

.status-row {
  display: flex;
  align-items: center;
}

.countdown-row {
  gap: 6px;
  font-size: 0.82rem;
}

.status-icon {
  font-size: 0.95rem;
}

.countdown-label {
  color: #94a3b8;
  font-size: 0.78rem;
  white-space: nowrap;
}

.countdown-val {
  font-family: monospace;
  font-weight: 700;
  color: #38bdf8;
  margin-left: auto;
  font-size: 0.92rem;
}

.fab-status-card.warning .countdown-val {
  color: #f43f5e;
}

.meta-row {
  gap: 6px;
  font-size: 0.74rem;
  color: #cbd5e1;
  flex-wrap: wrap;
  padding-top: 3px;
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
}

.meta-device {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #e2e8f0;
}

.meta-card {
  font-family: monospace;
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  padding: 1px 4px;
  border-radius: 4px;
  font-weight: 600;
}

.meta-mode {
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.7rem;
}

.meta-mode.full {
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
}

.meta-mode.view_only {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
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

.fullscreen-hint-pill {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(56, 189, 248, 0.4);
  color: #38bdf8;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.82rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  backdrop-filter: blur(8px);
  cursor: pointer;
  z-index: 40;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  user-select: none;
  transition: all 0.2s ease;
}

.fullscreen-hint-pill .hint-icon {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.fullscreen-hint-pill:active {
  transform: translateX(-50%) scale(0.96);
  background: rgba(2, 132, 199, 0.4);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .fab-container {
    bottom: max(56px, calc(36px + env(safe-area-inset-bottom, 0px)));
  }
  .fab-main {
    width: 46px;
    height: 46px;
  }
}
</style>
