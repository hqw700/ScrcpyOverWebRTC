<template>
  <div 
    class="device-card" 
    ref="cardElement" 
    :data-device-id="device.id" 
    :class="{ 
      'is-interactive-mode': deviceStore.globalInteractiveMode && device.status === 'online',
      'is-landscape': isLandscape,
      'is-landscape-grid': isLandscape
    }"
    :style="{ '--aspect-ratio': dynamicAspectRatio }"
    @click="onCardClick"
  >
    <div class="preview-area" :class="{ 'is-landscape': isLandscape }">
      <!-- 微光背景（填补异形屏边缘，消除黑边突兀感） -->
      <div v-if="currentSnapshot" class="ambient-glow-bg" :style="ambientBgStyle"></div>

      <!-- 展示快照或占位图 -->
      <img v-if="currentSnapshot && !isPreviewActive" :src="currentSnapshot" class="snapshot-img" @load="onImageLoad" />
      <div v-else-if="!currentSnapshot && !isPreviewActive" class="snapshot-placeholder">
        <span class="vm-icon">💻</span>
      </div>

      <!-- Canvas 用于高频预览模式下的硬件解码播放 -->
      <canvas
        v-show="isPreviewActive"
        ref="previewCanvas"
        class="snapshot-img"
      ></canvas>

      <!-- 顶部醒目“使用中”提示条 -->
      <div v-if="device.clientCount > 0" class="in-use-banner" :title="inUseTitle" @click.stop>
        <span class="in-use-pulse"></span>
        <span class="in-use-text">{{ primaryClientText }}</span>
      </div>

      <!-- 顶部右侧快捷操作区：群控勾选 + 三点菜单 -->
      <div class="card-header-right" @click.stop>
        <!-- 群控标识/勾选框 -->
        <div v-if="groupControlStore.isGroupControlActive && device.status === 'online'" class="group-select-wrap">
          <span v-if="groupControlStore.masterId === device.id" class="master-badge">主控</span>
          <template v-else>
            <input 
              type="checkbox" 
              :id="`group-select-${device.id}`" 
              :checked="groupControlStore.selectedSlaveIds.includes(device.id)"
              @change="onSlaveCheckboxChange"
              class="group-select-checkbox"
            />
            <label :for="`group-select-${device.id}`"></label>
          </template>
        </div>
        <!-- 功能菜单按钮 -->
        <button class="card-menu-btn" @click.stop="toggleMenu" title="更多操作">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <circle cx="4" cy="8" r="1.5"/>
            <circle cx="8" cy="8" r="1.5"/>
            <circle cx="12" cy="8" r="1.5"/>
          </svg>
        </button>
      </div>

      <!-- 群控主控制轻量边框徽标（不再全屏蒙版） -->
      <div v-if="groupControlStore.isGroupControlActive && groupControlStore.masterId === device.id" class="master-indicator">
        <span class="master-indicator-pill">群控·主控端</span>
      </div>

      <!-- 隐藏的预加载图片 -->
      <img v-if="nextSnapshotUrl" :src="nextSnapshotUrl" style="display: none;" @load="onNextSnapshotLoaded" />

      <!-- Hover 点击进入控制提示 -->
      <div class="hover-action-overlay" v-if="!deviceStore.globalInteractiveMode && device.status === 'online'">
        <span class="play-hint">进入控制</span>
      </div>
      <div class="hover-action-overlay offline" v-else-if="device.status !== 'online'">
        <span class="play-hint offline-hint">离线</span>
      </div>

      <!-- 预览直控覆盖交互层 -->
      <div
        v-if="deviceStore.globalInteractiveMode && device.status === 'online'"
        class="interactive-overlay"
        tabindex="0"
        @pointerdown.stop="handlePointerDown"
        @pointermove.stop="handlePointerMove"
        @pointerup.stop="handlePointerUp"
        @pointerleave.stop="handlePointerLeave"
        @wheel.stop="handleWheel"
        @keydown.stop.prevent="handleKeyDown"
        @click.stop
      >
        <!-- 悬浮毛玻璃虚拟按键栏 -->
        <div class="virtual-navbar" @pointerdown.stop @pointerup.stop @click.stop>
          <button class="nav-btn connect-btn" @click="deviceStore.setDeviceMode(device.id, 'display'); emit('connect', device.id)" title="进入详情控制">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </button>
          <button class="nav-btn" @click="sendKey(4)" title="返回 (BACK)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <button class="nav-btn" @click="sendKey(3)" title="主页 (HOME)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
          <button class="nav-btn" @click="sendKey(187)" title="最近任务 (RECENTS)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
          </button>
        </div>
      </div>
      <!-- 底部元信息栏 (Bottom Bar: 状态圆点 + 设备 ID + 标签) -->
      <div class="card-bottom-bar" @click.stop>
        <div class="bottom-left-info">
          <span class="status-dot" :class="statusClass"></span>
          <span class="device-name" :title="device.id">{{ device.id }}</span>
          <span v-if="isCameraMode" class="camera-mode-badge" title="当前设备正在以摄像头监控模式运行">📷 监控中</span>
          <span v-if="device.status !== 'online' && lastSeenText" class="offline-last-seen" :title="lastSeenText">{{ lastSeenText }}</span>
        </div>
        <div v-if="tags.length > 0" class="device-tags">
          <span
            v-for="tag in visibleTags"
            :key="tag.id"
            class="device-tag"
            :style="tagStyle(tag)"
            :title="tag.name"
          >
            {{ tag.name }}
          </span>
          <span v-if="hiddenTagCount > 0" class="device-tag more-tag">
            +{{ hiddenTagCount }}
          </span>
        </div>
      </div>
    </div>

    <!-- 下拉菜单 -->
    <div v-if="showMenu" class="card-menu" @click.stop>
      <button class="menu-item" @click.stop="onAddToMulti" v-if="device.status === 'online'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="8" height="18" rx="2"></rect><rect x="14" y="3" width="8" height="18" rx="2"></rect></svg>
        加入多机直连
      </button>
      <button class="menu-item" @click.stop="onCameraSettings" v-if="device.status === 'online'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
        摄像头监控模式
      </button>
      <button class="menu-item" @click.stop="onSettings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        连接设置
      </button>
      <button class="menu-item" @click.stop="onShareDevice" v-if="authStore.isAdmin">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
        分享设备 / 卡密
      </button>
      <button class="menu-item" @click.stop="onEditTags">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 12v7a1 1 0 0 1-1 1h-7L4 12V5a1 1 0 0 1 1-1h7l8 8z"></path><circle cx="8.5" cy="8.5" r="1.5"></circle></svg>
        编辑标签
      </button>
      <button class="menu-item danger" @click.stop="onQuitAgent" :disabled="device.status !== 'online'">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v6M12 4.5a6 6 0 11-8 0"/></svg>
        退出 Agent
      </button>
      <button v-if="device.status !== 'online'" class="menu-item danger" @click.stop="onDeleteRecord">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        移除记录
      </button>
    </div>
    
    <!-- 点击其他地方关闭菜单 -->
    <div v-if="showMenu" class="menu-overlay" @click.stop="showMenu = false"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { useAuthStore } from '@/stores/auth'
import { H264Decoder } from 'h264decoder'
import { getDeviceSettings } from '@/utils/settings'
import { useGroupControlStore } from '@/stores/groupControl'

const props = defineProps({
  device: {
    type: Object,
    required: true
  },
  tags: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['connect', 'settings', 'camera-settings', 'edit-tags', 'share'])
const deviceStore = useDeviceStore()
const groupControlStore = useGroupControlStore()
const authStore = useAuthStore()
const showMenu = ref(false)
const imgLoaded = ref(false)

// --- “使用中”遮罩：接入者（用户名/访客卡密）与剩余时间 ---
const clientsInfo = computed(() => props.device.clients || [])

function formatClientRemain(sec) {
  if (sec === undefined || sec === null || sec < 0) return '永久'
  if (sec === 0) return '已到期'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `剩余 ${d} 天`
  if (h > 0) return `剩余 ${h} 小时`
  return `剩余 ${Math.max(1, m)} 分`
}

const primaryClientText = computed(() => {
  const c = clientsInfo.value[0]
  if (!c) return ''
  const icon = c.kind === 'guest' ? '🔑' : '👤'
  const extra = clientsInfo.value.length > 1 ? ` 等${clientsInfo.value.length}人` : ''
  return `${icon} ${c.name} · ${formatClientRemain(c.remaining_seconds)}${extra}`
})

const inUseTitle = computed(() => {
  const lines = clientsInfo.value.map(c => `${c.name}（${formatClientRemain(c.remaining_seconds)}）`)
  return lines.length ? `当前接入：\n${lines.join('\n')}` : `当前有 ${props.device.clientCount} 个连接`
})

const snapshotWidth = ref(0)
const snapshotHeight = ref(0)

function updateSnapshotDimensions(url) {
  if (!url) {
    snapshotWidth.value = 0
    snapshotHeight.value = 0
    return
  }
  const img = new Image()
  img.onload = () => {
    snapshotWidth.value = img.naturalWidth || 0
    snapshotHeight.value = img.naturalHeight || 0
  }
  img.src = url
}

const isLandscape = computed(() => {
  const canvas = previewCanvas.value
  // 只有当高频预览处于活动状态，并且首帧已经成功渲染时，才采用 Canvas 的高宽判断
  if (isPreviewActive.value && isFirstFrameRendered.value && canvas && canvas.width && canvas.height) {
    return canvas.width > canvas.height
  }
  
  if (snapshotWidth.value > 0 && snapshotHeight.value > 0) {
    return snapshotWidth.value > snapshotHeight.value
  }
  
  const display = props.device.info?.displays?.[0]
  if (display && display.x_res && display.y_res) {
    return display.x_res > display.y_res
  }
  return false
})

const dynamicAspectRatio = computed(() => {
  const canvas = previewCanvas.value
  if (isPreviewActive.value && isFirstFrameRendered.value && canvas && canvas.width && canvas.height) {
    return `${canvas.width} / ${canvas.height}`
  }
  if (snapshotWidth.value > 0 && snapshotHeight.value > 0) {
    return `${snapshotWidth.value} / ${snapshotHeight.value}`
  }
  const display = props.device.info?.displays?.[0]
  if (display && display.x_res && display.y_res) {
    return `${display.x_res} / ${display.y_res}`
  }
  return isLandscape.value ? '16 / 9' : '9 / 16'
})

const ambientBgStyle = computed(() => {
  if (currentSnapshot.value) {
    return {
      backgroundImage: `url(${currentSnapshot.value})`
    }
  }
  return {}
})

function onSlaveCheckboxChange() {
  groupControlStore.toggleSlave(props.device.id)
}

const currentSnapshot = ref(props.device.snapshot || '')
const nextSnapshotUrl = ref('')
const isPreviewActive = ref(false)
const hasReceivedKeyFrame = ref(false)
const isFirstFrameRendered = ref(false)
const previewCanvas = ref(null)
const cardElement = ref(null)

watch(() => props.device.snapshot, (newSnapshot) => {
  if (newSnapshot) {
    updateSnapshotDimensions(newSnapshot)
    if (!currentSnapshot.value) {
      currentSnapshot.value = newSnapshot
    } else {
      nextSnapshotUrl.value = newSnapshot
    }
  } else {
    currentSnapshot.value = ''
    nextSnapshotUrl.value = ''
    snapshotWidth.value = 0
    snapshotHeight.value = 0
  }
}, { immediate: true })

function onNextSnapshotLoaded() {
  if (nextSnapshotUrl.value) {
    currentSnapshot.value = nextSnapshotUrl.value
    updateSnapshotDimensions(nextSnapshotUrl.value)
    nextSnapshotUrl.value = ''
  }
}

function onImageLoad(event) {
  imgLoaded.value = true
  if (event?.target) {
    snapshotWidth.value = event.target.naturalWidth || 0
    snapshotHeight.value = event.target.naturalHeight || 0
  }
}

const statusClass = computed(() => {
  return props.device.status === 'online' ? 'online' : 'offline'
})

const statusText = computed(() => {
  return props.device.status === 'online' ? '在线' : '离线'
})

const isCameraMode = computed(() => {
  return deviceStore.getDeviceMode(props.device.id) === 'camera' && deviceStore.activeDeviceIds.includes(props.device.id)
})

const lastSeenText = computed(() => {
  if (!props.device.lastSeen) return ''
  const d = new Date(props.device.lastSeen)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString()
})

const visibleTags = computed(() => props.tags.slice(0, 3))
const hiddenTagCount = computed(() => Math.max(0, props.tags.length - visibleTags.value.length))

function onCardClick(e) {
  // 离线设备不进入控制页（服务端会拒绝 TypeConnect）
  if (props.device.status !== 'online') return
  if (!showMenu.value) {
    // 默认点击卡片始终以屏幕连接为主
    deviceStore.setDeviceMode(props.device.id, 'display')
    if (e && (e.ctrlKey || e.metaKey || deviceStore.activeDeviceIds.length > 0)) {
      deviceStore.openDevice(props.device.id)
    } else {
      emit('connect', props.device.id)
    }
  }
}

function onAddToMulti() {
  showMenu.value = false
  deviceStore.setDeviceMode(props.device.id, 'display')
  deviceStore.openDevice(props.device.id)
}

function toggleMenu() {
  showMenu.value = !showMenu.value
}

function onShareDevice() {
  showMenu.value = false
  emit('share', props.device.id)
}

function onCameraSettings() {
  showMenu.value = false
  // 方案 A：一键直通专属安防监控大屏，右侧控制台自由换镜与调分辨率
  deviceStore.openDeviceAsCamera(props.device.id)
}

function onSettings() {
  showMenu.value = false
  emit('settings', props.device.id)
}

function onEditTags() {
  showMenu.value = false
  emit('edit-tags', props.device.id)
}

function tagStyle(tag) {
  return {
    color: tag.color,
    borderColor: `${tag.color}80`,
    background: `${tag.color}16`
  }
}

function onQuitAgent() {
  showMenu.value = false
  if (confirm(`警告：确定要停止设备 "${props.device.id}" 上的 Agent 进程吗？停止后该设备将下线。`)) {
    deviceStore.quitAgent(props.device.id)
  }
}

async function onDeleteRecord() {
  showMenu.value = false
  if (confirm(`确定要删除设备 "${props.device.id}" 的离线记录吗？删除后该设备将从列表中移除（不影响设备本身，重新上线后会再次注册）。`)) {
    try {
      await deviceStore.deleteOfflineDevice(props.device.id)
    } catch (e) {
      alert('删除离线记录失败: ' + (e.message || e))
    }
  }
}

function onClickOutside(event) {
  if (cardElement.value && !cardElement.value.contains(event.target)) {
    showMenu.value = false
  }
}

let h264Decoder = null  // WASM 软件解码器
let videoDecoder = null // WebCodecs 硬件解码器
let hasConfigured = false
let isCardVisible = false
let observer = null
let lastSps = null
let lastPps = null

// 比较两个 ArrayBuffer 是否相等
function areBuffersEqual(buf1, buf2) {
  if (!buf1 || !buf2) return false
  if (buf1.length !== buf2.length) return false
  for (let i = 0; i < buf1.length; i++) {
    if (buf1[i] !== buf2[i]) return false
  }
  return true
}

// 解析 H.264 Annex B 比特流分割为单独的 NALU
function parseAnnexB(buffer) {
  const naluList = []
  const len = buffer.length
  let i = 0
  
  while (i < len) {
    let startCodeLen = 0
    if (i + 2 < len && buffer[i] === 0 && buffer[i+1] === 0 && buffer[i+2] === 1) {
      startCodeLen = 3
    } else if (i + 3 < len && buffer[i] === 0 && buffer[i+1] === 0 && buffer[i+2] === 0 && buffer[i+3] === 1) {
      startCodeLen = 4
    }
    
    if (startCodeLen > 0) {
      const naluStart = i + startCodeLen
      i = naluStart
      while (i < len) {
        if (i + 2 < len && buffer[i] === 0 && buffer[i+1] === 0 && buffer[i+2] === 1) {
          break
        }
        if (i + 3 < len && buffer[i] === 0 && buffer[i+1] === 0 && buffer[i+2] === 0 && buffer[i+3] === 1) {
          break
        }
        i++
      }
      const naluEnd = i
      if (naluEnd > naluStart) {
        naluList.push(buffer.subarray(naluStart, naluEnd))
      }
    } else {
      i++
    }
  }
  return naluList
}

// 根据选择的解码模式初始化对应的解码器
function initDecoder(decoderMode) {
  if (decoderMode === 'webcodecs') {
    if (typeof VideoDecoder === 'undefined') {
      console.warn(`[WebCodecs] Browser does not support VideoDecoder. Falling back to WASM decoder for ${props.device.id}.`)
      initDecoder('wasm')
      return
    }

    if (videoDecoder) return

    videoDecoder = new VideoDecoder({
      output: (frame) => {
        const canvasEl = previewCanvas.value
        if (!canvasEl) {
          frame.close()
          return
        }
        const ctx = canvasEl.getContext('2d')
        // 动态调整 canvas 真实渲染分辨率
        if (canvasEl.width !== frame.displayWidth || canvasEl.height !== frame.displayHeight) {
          canvasEl.width = frame.displayWidth
          canvasEl.height = frame.displayHeight
        }
        ctx.drawImage(frame, 0, 0, canvasEl.width, canvasEl.height)
        frame.close() // 必须立刻关闭，释放显存
        isFirstFrameRendered.value = true
      },
      error: (e) => {
        console.error(`[WebCodecs] Decoder error for ${props.device.id}:`, e)
        stopPreviewFlow()
      }
    })
    hasConfigured = false
    lastSps = null
    lastPps = null
  } else {
    if (h264Decoder) return
    try {
      h264Decoder = new H264Decoder()
    } catch (err) {
      console.error(`[WASM-Decoder] Failed to initialize for ${props.device.id}:`, err)
    }
  }
}

// 高效地将 YUV420p 数据转换并绘制在 Canvas 上 (WASM 模式专用)
function renderYUV(canvasEl, yuv, width, height) {
  const ctx = canvasEl.getContext('2d')
  if (!ctx) return

  // 动态调整 canvas 真实渲染分辨率
  if (canvasEl.width !== width || canvasEl.height !== height) {
    canvasEl.width = width
    canvasEl.height = height
  }
  
  const imgData = ctx.createImageData(width, height)
  const buf = new ArrayBuffer(imgData.data.length)
  const buf8 = new Uint8ClampedArray(buf)
  const buf32 = new Uint32Array(buf)
  
  const ySize = width * height
  const chromaSize = ySize >> 2
  
  let i = 0
  for (let y = 0; y < height; y++) {
    const yOffset = y * width
    const uvRow = (y >> 1) * (width >> 1)
    for (let x = 0; x < width; x++) {
      const Y = yuv[yOffset + x]
      const uvCol = x >> 1
      const U = yuv[ySize + uvRow + uvCol] - 128
      const V = yuv[ySize + chromaSize + uvRow + uvCol] - 128
      
      let r = Y + 1.402 * V
      let g = Y - 0.344 * U - 0.714 * V
      let b = Y + 1.772 * U
      
      const R = r < 0 ? 0 : (r > 255 ? 255 : r | 0)
      const G = g < 0 ? 0 : (g > 255 ? 255 : g | 0)
      const B = b < 0 ? 0 : (b > 255 ? 255 : b | 0)
      
      // 以小端序 RGBA (A B G R) 格式直接写入 32 位整数
      buf32[i++] = (255 << 24) | (B << 16) | (G << 8) | R
    }
  }
  
  imgData.data.set(buf8)
  ctx.putImageData(imgData, 0, 0)
}

function feedFrame(nalu, isKey, ptsUs, decoderMode) {
  // 首帧关键帧过滤逻辑
  if (!hasReceivedKeyFrame.value) {
    if (!isKey) {
      // 丢弃首帧之前的 delta 帧，避免画面抖动或花屏
      return
    }
    hasReceivedKeyFrame.value = true
  }

  // 深度克隆 nalu 数组，规避底层内存共享与对齐 Bug
  const cleanNalu = new Uint8Array(nalu.length)
  cleanNalu.set(nalu)

  let activeMode = decoderMode
  if (activeMode === 'webcodecs' && typeof VideoDecoder === 'undefined') {
    activeMode = 'wasm'
  }

  if (activeMode === 'webcodecs') {
    if (!videoDecoder) {
      initDecoder(activeMode)
    }

    if (videoDecoder && videoDecoder.state === 'closed') {
      videoDecoder = null
      initDecoder(activeMode)
    }

    if (!videoDecoder) return

    // 解析 Annex B 并提取其中的各个 NALU
    const naluList = parseAnnexB(cleanNalu)
    let sps = null
    let pps = null
    const slices = []

    for (const n of naluList) {
      if (n.length === 0) continue
      const naluType = n[0] & 0x1F
      if (naluType === 7) {
        sps = n
      } else if (naluType === 8) {
        pps = n
      } else if (naluType === 5 || naluType === 1) {
        slices.push(n)
      }
    }

    // 动态生成配置并配置解码器 (当检测到 SPS/PPS 且和上次不同时)
    if (sps && pps && (!areBuffersEqual(sps, lastSps) || !areBuffersEqual(pps, lastPps))) {
      lastSps = sps
      lastPps = pps

      // 组装 AVCDecoderConfigurationRecord 作为 description 字节数组
      const record = new Uint8Array(11 + sps.length + pps.length)
      record[0] = 1 // configurationVersion
      record[1] = sps[1] // AVCProfileIndication
      record[2] = sps[2] // profile_compatibility
      record[3] = sps[3] // AVCLevelIndication
      record[4] = 0xff // lengthSizeMinusOne: 3 (4 bytes length)
      record[5] = 0xe1 // numOfSequenceParameterSets: 1
      
      // SPS 长度与数据
      record[6] = (sps.length >> 8) & 0xff
      record[7] = sps.length & 0xff
      record.set(sps, 8)
      
      // PPS 长度与数据
      const ppsOffset = 8 + sps.length
      record[ppsOffset] = 1 // numOfPictureParameterSets: 1
      record[ppsOffset+1] = (pps.length >> 8) & 0xff
      record[ppsOffset+2] = pps.length & 0xff
      record.set(pps, ppsOffset + 3)

      // 根据 SPS 动态生成 Codec 字符串 (avc1.xxxxxx)
      const codecStr = 'avc1.' + Array.from(sps.subarray(1, 4)).map(x => x.toString(16).padStart(2, '0')).join('')

      try {
        videoDecoder.configure({
          codec: codecStr,
          description: record,
          optimizeForLatency: true
        })
        hasConfigured = true
        console.log(`[WebCodecs] Successfully configured decoder for ${props.device.id} with codec ${codecStr}`)
      } catch (err) {
        console.error(`[WebCodecs] Configure failed for ${props.device.id}:`, err)
        return
      }
    }

    // 必须完成 configure 之后才能向解码器喂 Slice
    if (!hasConfigured) return

    if (slices.length > 0) {
      // 组装 AVCC 格式数据 (每个 slice 增加 4 字节的大端序长度前缀)
      let totalSize = 0
      for (const slice of slices) {
        totalSize += 4 + slice.length
      }

      const avccBuffer = new Uint8Array(totalSize)
      let offset = 0
      for (const slice of slices) {
        const len = slice.length
        avccBuffer[offset] = (len >> 24) & 0xff
        avccBuffer[offset+1] = (len >> 16) & 0xff
        avccBuffer[offset+2] = (len >> 8) & 0xff
        avccBuffer[offset+3] = len & 0xff
        avccBuffer.set(slice, offset + 4)
        offset += 4 + len
      }

      const chunk = new EncodedVideoChunk({
        type: isKey ? 'key' : 'delta',
        timestamp: ptsUs,
        data: avccBuffer
      })

      try {
        videoDecoder.decode(chunk)
      } catch (err) {
        console.warn(`[WebCodecs] Decode failed for ${props.device.id}:`, err)
      }
    }
  } else {
    // WASM 软件解码模式
    if (!h264Decoder) {
      initDecoder(activeMode)
    }

    if (!h264Decoder) return

    try {
      const result = h264Decoder.decode(cleanNalu)
      if (result === H264Decoder.PIC_RDY) {
        const canvas = previewCanvas.value
        if (canvas) {
          renderYUV(canvas, h264Decoder.pic, h264Decoder.width, h264Decoder.height)
          isFirstFrameRendered.value = true
        }
      }
    } catch (err) {
      console.warn(`[WASM-Decoder] Decode failed for ${props.device.id}:`, err)
    }
  }
}

// 预览流启停逻辑
function startPreviewFlow() {
  if (props.device.status !== 'online') return
  
  isPreviewActive.value = true
  
  // 获取设备的连接设置中配置的高频预览参数
  const settings = getDeviceSettings(props.device.id)
  const fps = settings.previewFps || 10
  const maxSize = settings.previewSize || 360
  const bitrate = settings.previewBitrate || 1
  const decoderMode = settings.previewDecoder || 'wasm'
  const stayAwake = settings.stayAwake || false
  
  initDecoder(decoderMode)
  
  // 注册数据接收回调
  deviceStore.registerPreviewCallback(props.device.id, (nalu, isKey, ptsUs) => {
    feedFrame(nalu, isKey, ptsUs, decoderMode)
  })
  
  // 发送 start_preview 控制指令，带上定制的 fps, maxSize, bitrate 和 stayAwake
  deviceStore.sendPreviewControl('start_preview', props.device.id, fps, maxSize, bitrate, stayAwake)
}

function stopPreviewFlow() {
  isPreviewActive.value = false
  hasReceivedKeyFrame.value = false
  isFirstFrameRendered.value = false
  
  // 注销回调
  deviceStore.unregisterPreviewCallback(props.device.id)
  
  // 发送 stop_preview 指令
  deviceStore.sendPreviewControl('stop_preview', props.device.id)
  
  // 释放 WebCodecs 解码器
  if (videoDecoder) {
    try {
      videoDecoder.close()
    } catch (e) {}
    videoDecoder = null
  }
  hasConfigured = false
  lastSps = null
  lastPps = null

  // 释放 WASM 解码器
  if (h264Decoder) {
    h264Decoder = null
  }
}

// 监控全局预览开关和可视区域变化
function evaluatePreviewState() {
  const isOnline = props.device.status === 'online'
  // 多机直连互斥：只要当前设备在多机直连打开列表中，就绝不启动大盘 H.264 预览流，杜绝双路推流冲突
  const isNotActiveControl = !deviceStore.activeDeviceIds.includes(props.device.id)
  
  // 如果此设备被选为群控从机，无论卡片是否可见，我们都强制它保持预览开启（保活 scrcpy 进程）
  const isSlaveSelected = groupControlStore.isGroupControlActive && 
                          groupControlStore.selectedSlaveIds.includes(props.device.id)

  const shouldPreview = (deviceStore.globalPreviewMode && (isCardVisible || isSlaveSelected)) && 
                        isOnline && 
                        isNotActiveControl
  
  if (shouldPreview) {
    if (!isPreviewActive.value) {
      startPreviewFlow()
    }
  } else {
    if (isPreviewActive.value) {
      stopPreviewFlow()
    }
  }
}

// 监听当前活跃的直连设备列表变化 (当被直连控制时自动停用大盘预览，断开时若大盘模式开启且可见则自动恢复)
watch(() => deviceStore.activeDeviceIds, () => {
  evaluatePreviewState()
}, { deep: true })

// 监听大盘模式的变化
watch(() => deviceStore.globalPreviewMode, () => {
  evaluatePreviewState()
})

// 监听在线状态变化（掉线自动清理）
watch(() => props.device.status, (newStatus) => {
  if (newStatus !== 'online' && isPreviewActive.value) {
    stopPreviewFlow()
  }
})

// 监听群控从机列表变化，动态启停预览
watch(() => groupControlStore.selectedSlaveIds, () => {
  evaluatePreviewState()
}, { deep: true })

// 监听群控模式开关状态变化
watch(() => groupControlStore.isGroupControlActive, () => {
  evaluatePreviewState()
})

// 监听该设备高频预览参数的变化 (实现无缝切换)
watch(() => {
  const settings = getDeviceSettings(props.device.id)
  return {
    fps: settings.previewFps,
    maxSize: settings.previewSize,
    decoder: settings.previewDecoder,
    stayAwake: settings.stayAwake
  }
}, (newVal, oldVal) => {
  if (isPreviewActive.value) {
    if (newVal.fps !== oldVal.fps || newVal.maxSize !== oldVal.maxSize || newVal.decoder !== oldVal.decoder || newVal.stayAwake !== oldVal.stayAwake) {
      console.log(`[PreviewSettings] Restarting preview flow for ${props.device.id} to apply new settings:`, newVal)
      stopPreviewFlow()
      startPreviewFlow()
    }
  }
}, { deep: true })

onMounted(() => {
  document.addEventListener('click', onClickOutside)

  // 监控可视区域
  if (cardElement.value) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isCardVisible = entry.isIntersecting
        evaluatePreviewState()
      })
    }, { threshold: 0 })
    
    observer.observe(cardElement.value)
  }

  // Demo 模式动画渲染
  if (import.meta.env.VITE_DEMO_MODE === 'true' && props.device.status === 'online') {
    let mockRipples = []
    const demoRenderInterval = setInterval(() => {
      if (previewCanvas.value) {
        mockRipples = mockRipples.map(r => ({ ...r, radius: r.radius + 1.5, alpha: r.alpha - 0.05 })).filter(r => r.alpha > 0)
        import('@/mock/demoEngine').then(({ renderMockScreenCanvas }) => {
          renderMockScreenCanvas(previewCanvas.value, props.device.id, mockRipples)
        })
      }
    }, 50)

    onUnmounted(() => {
      clearInterval(demoRenderInterval)
    })
  }
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  
  if (observer) {
    observer.disconnect()
  }
  
  if (isPreviewActive.value) {
    stopPreviewFlow()
  }
})

// --- 预览直控交互逻辑 ---
const CONTROL_KEY_MAP = {
  'Backspace': 67,
  'Enter': 66,
  'Escape': 111,
  'ArrowUp': 19,
  'ArrowDown': 20,
  'ArrowLeft': 21,
  'ArrowRight': 22,
  'Space': 62,
  ' ': 62
}

let isPointerDown = false
let touchSeq = 0
let lastMoveSentTs = 0
let lastMoveSentX = -999
let lastMoveSentY = -999
const THROTTLE_INTERVAL_MS = 25
const MOVE_DISTANCE_THRESHOLD_SQ = 16 // 4px^2

const getAbsoluteCoords = (e) => {
  const canvas = previewCanvas.value
  const img = cardElement.value?.querySelector('.snapshot-img')
  const target = (canvas && isPreviewActive.value) ? canvas : (img || e.currentTarget)

  const rect = target.getBoundingClientRect()
  const clientX = e.clientX - rect.left
  const clientY = e.clientY - rect.top
  
  let videoW, videoH
  let rawW, rawH
  if (canvas && isPreviewActive.value && canvas.width && canvas.height) {
    videoW = canvas.width
    videoH = canvas.height
  } else if (img && img.naturalWidth && img.naturalHeight) {
    videoW = img.naturalWidth
    videoH = img.naturalHeight
  } else {
    const display = props.device.info?.displays?.[0]
    rawW = display?.x_res || 1080
    rawH = display?.y_res || 1920
    videoW = rawW
    videoH = rawH
  }
  
  const clientW = rect.width
  const clientH = rect.height
  
  // 考虑 object-fit: contain 下的真正渲染高宽及边框偏移量（正向画面）
  const videoRatio = videoW / videoH
  const clientRatio = clientW / clientH
  
  let actualW, actualH, offsetX, offsetY
  if (clientRatio > videoRatio) {
    // 左右有微小留白 (Pillarbox)
    actualH = clientH
    actualW = clientH * videoRatio
    offsetX = (clientW - actualW) / 2
    offsetY = 0
  } else {
    // 上下有微小留白 (Letterbox)
    actualW = clientW
    actualH = clientW / videoRatio
    offsetX = 0
    offsetY = (clientH - actualH) / 2
  }
  
  // 相对真正画面的归一化坐标 [0, 1]
  const relativeX = clientX - offsetX
  const relativeY = clientY - offsetY
  
  const normX = Math.max(0, Math.min(1, relativeX / actualW))
  const normY = Math.max(0, Math.min(1, relativeY / actualH))
  
  // 触控协议以设备逻辑分辨率为基准下发
  const displayInfo = props.device.info?.displays?.[0]
  const devW = displayInfo?.x_res || videoW || 1080
  const devH = displayInfo?.y_res || videoH || 1920

  return {
    x: Math.round(normX * devW),
    y: Math.round(normY * devH),
    w: devW,
    h: devH,
    isRotated: false
  }
}

const sendDeviceControl = (payload) => {
  // 调试日志（排查下发链路问题时再打开）
  // if (payload.type === 'touch' && payload.action !== 2) { // 过滤高频 Move，仅对 Down / Up 输出
  //   console.log(`[DirectControl WS Send] [${props.device.id}] Payload:`, payload)
  // } else if (payload.type !== 'touch') {
  //   console.log(`[DirectControl WS Send] [${props.device.id}] Payload:`, payload)
  // }
  deviceStore.sendGroupControlEvent([props.device.id], payload)
}

const handlePointerDown = (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  isPointerDown = true
  e.currentTarget.setPointerCapture(e.pointerId)
  
  // 点击时聚焦，使得可以接收按键事件
  e.currentTarget.focus()
  
  const coords = getAbsoluteCoords(e)
  if (coords) {
    touchSeq++
    lastMoveSentTs = 0
    lastMoveSentX = coords.x
    lastMoveSentY = coords.y
    
    sendDeviceControl({
      type: 'touch',
      action: 0, // DOWN
      x: coords.x,
      y: coords.y,
      w: coords.w,
      h: coords.h,
      id: e.pointerType === 'mouse' ? -1 : e.pointerId,
      seq: touchSeq,
      client_ts_ms: Date.now()
    })
  }
}

const handlePointerMove = (e) => {
  if (!isPointerDown) return
  const coords = getAbsoluteCoords(e)
  if (!coords) return
  
  const now = Date.now()
  const dx = coords.x - lastMoveSentX
  const dy = coords.y - lastMoveSentY
  const distSq = dx * dx + dy * dy
  
  if (now - lastMoveSentTs < THROTTLE_INTERVAL_MS && distSq < MOVE_DISTANCE_THRESHOLD_SQ) {
    return
  }
  
  lastMoveSentTs = now
  lastMoveSentX = coords.x
  lastMoveSentY = coords.y
  
  sendDeviceControl({
    type: 'touch',
    action: 2, // MOVE
    x: coords.x,
    y: coords.y,
    w: coords.w,
    h: coords.h,
    id: e.pointerType === 'mouse' ? -1 : e.pointerId,
    seq: ++touchSeq,
    client_ts_ms: now
  })
}

const handlePointerUp = (e) => {
  if (!isPointerDown) return
  isPointerDown = false
  try {
    e.currentTarget.releasePointerCapture(e.pointerId)
  } catch (err) {}
  
  const coords = getAbsoluteCoords(e)
  if (coords) {
    lastMoveSentTs = 0
    sendDeviceControl({
      type: 'touch',
      action: 1, // UP
      x: coords.x,
      y: coords.y,
      w: coords.w,
      h: coords.h,
      id: e.pointerType === 'mouse' ? -1 : e.pointerId,
      seq: ++touchSeq,
      client_ts_ms: Date.now()
    })
  }
}

const handlePointerLeave = (e) => {
  if (isPointerDown) {
    handlePointerUp(e)
  }
}

const handleWheel = (e) => {
  const coords = getAbsoluteCoords(e)
  if (coords) {
    sendDeviceControl({
      type: 'inject_scroll',
      x: coords.x,
      y: coords.y,
      w: coords.w,
      h: coords.h,
      scroll_h: e.deltaX > 0 ? 1 : (e.deltaX < 0 ? -1 : 0),
      scroll_v: e.deltaY > 0 ? 1 : (e.deltaY < 0 ? -1 : 0),
      seq: ++touchSeq,
      client_ts_ms: Date.now()
    })
  }
}

const handleKeyDown = (e) => {
  const androidCode = CONTROL_KEY_MAP[e.key]
  if (androidCode !== undefined) {
    sendDeviceControl({ type: 'inject_keycode', action: 0, keycode: androidCode })
    setTimeout(() => {
      sendDeviceControl({ type: 'inject_keycode', action: 1, keycode: androidCode })
    }, 50)
  }
}

const sendKey = (keycode) => {
  sendDeviceControl({ type: 'inject_keycode', action: 0, keycode })
  setTimeout(() => {
    sendDeviceControl({ type: 'inject_keycode', action: 1, keycode })
  }, 50)
}
</script>

<style scoped>
.device-card {
  background: var(--bg-secondary, #161b22);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s ease;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  position: relative;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.device-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
  border-color: var(--accent, #388bfd);
}

/* 桌面端横屏卡片在网格中跨 2 列 */
@media (min-width: 1025px) {
  .device-card.is-landscape-grid {
    grid-column: span 2;
  }
}

.preview-area {
  aspect-ratio: var(--aspect-ratio, 9 / 16);
  background: #090d13;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

/* 环境光微光背景：提取快照虚化填充异形边框 */
.ambient-glow-bg {
  position: absolute;
  inset: -15%;
  background-size: cover;
  background-position: center;
  filter: blur(28px) brightness(0.35) saturate(1.3);
  opacity: 0.65;
  pointer-events: none;
  z-index: 0;
  transform: scale(1.1);
}

.snapshot-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  z-index: 1;
}

.snapshot-img {
  position: relative;
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  z-index: 1;
  transition: transform 0.2s ease;
}

.vm-icon {
  font-size: 40px;
  opacity: 0.35;
}

/* 顶部醒目“使用中”提示条 */
.in-use-banner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 4px 10px;
  background: linear-gradient(180deg, rgba(2, 132, 199, 0.95) 0%, rgba(2, 132, 199, 0.8) 100%);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  border-bottom: 1px solid rgba(56, 189, 248, 0.4);
}

.in-use-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 6px #38bdf8;
  animation: pulse-glow 1.8s infinite;
  flex-shrink: 0;
}

.in-use-text {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  max-width: calc(100% - 70px);
}

@keyframes pulse-glow {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.3);
  }
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.online {
  background: #4ade80;
  box-shadow: 0 0 6px rgba(74, 222, 128, 0.8);
}

.status-dot.offline {
  background: #64748b;
}

.device-name {
  font-size: 11px;
  font-weight: 700;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.02em;
}

/* 顶部右侧快捷操作区 */
.card-header-right {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 12;
  display: flex;
  align-items: center;
  gap: 6px;
}

.group-select-wrap {
  display: flex;
  align-items: center;
  background: rgba(13, 17, 23, 0.75);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 2px 4px;
}

.group-select-checkbox {
  width: 15px;
  height: 15px;
  cursor: pointer;
  accent-color: var(--accent, #388bfd);
  margin: 0;
}

.master-badge {
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  background: #ff9f43;
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(255, 159, 67, 0.4);
}

.card-menu-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(13, 17, 23, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.85;
  transition: all 0.2s;
  backdrop-filter: blur(8px);
  padding: 0;
}

.card-menu-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  transform: scale(1.08);
}

.card-menu-btn svg {
  width: 13px;
  height: 13px;
}

/* 主控端轻量指示器 */
.master-indicator {
  position: absolute;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 11;
  pointer-events: none;
}

.master-indicator-pill {
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  background: rgba(255, 159, 67, 0.92);
  padding: 2px 10px;
  border-radius: 999px;
  box-shadow: 0 2px 10px rgba(255, 159, 67, 0.5);
  letter-spacing: 0.05em;
  white-space: nowrap;
}

/* Hover 点击进入控制蒙版 */
.hover-action-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 8;
  pointer-events: none;
}

.device-card:hover .hover-action-overlay {
  opacity: 1;
}

.play-hint {
  background: var(--accent, #388bfd);
  color: white;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(56, 139, 253, 0.4);
  transform: translateY(6px);
  transition: transform 0.2s;
  letter-spacing: 0.02em;
}

.device-card:hover .play-hint {
  transform: translateY(0);
}

.offline-hint {
  background: rgba(30, 41, 59, 0.85);
  color: #94a3b8;
  box-shadow: none;
}

/* 底部元信息栏 */
.card-bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 6px 8px;
  background: linear-gradient(to top, rgba(13, 17, 23, 0.9) 0%, rgba(13, 17, 23, 0.5) 60%, transparent 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  z-index: 5;
  pointer-events: none;
  opacity: 0.95;
  transition: opacity 0.2s ease;
}

.device-card:hover .card-bottom-bar {
  opacity: 1;
}

.bottom-left-info {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  pointer-events: auto;
}

.camera-mode-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.35);
  font-weight: 700;
  white-space: nowrap;
}

.offline-last-seen {
  font-size: 9px;
  color: rgba(226, 232, 240, 0.5);
  margin-left: 2px;
}

.device-tags {
  display: flex;
  gap: 3px;
  overflow: hidden;
  flex-shrink: 0;
}

.device-tag {
  max-width: 65px;
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 5px;
  border: 1px solid;
  border-radius: 999px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}

.more-tag {
  color: var(--text-secondary, #94a3b8);
  border-color: var(--border, rgba(255, 255, 255, 0.12));
  background: rgba(255, 255, 255, 0.08);
}

/* 下拉菜单 */
.card-menu {
  position: absolute;
  top: 36px;
  right: 8px;
  min-width: 140px;
  background: #161b22 !important;
  opacity: 1 !important;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  z-index: 100;
  padding: 4px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  background: transparent;
  border: none;
  border-radius: 5px;
  font-size: 12px;
  color: var(--text-primary, #f1f5f9);
  cursor: pointer;
  text-align: left;
}

.menu-item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.menu-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.menu-item.danger {
  color: #f85149;
}

.menu-item svg {
  width: 13px;
  height: 13px;
}

.menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
}

/* 预览直控相关样式 */
.device-card.is-interactive-mode {
  border-color: rgba(56, 139, 253, 0.6);
  box-shadow: 0 0 14px rgba(56, 139, 253, 0.25);
}

.interactive-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  cursor: crosshair;
  background: transparent;
  outline: none;
}

.interactive-overlay:focus {
  background: rgba(56, 139, 253, 0.03);
  box-shadow: inset 0 0 0 2px #388bfd;
}

/* 浮动虚拟按键栏 */
.virtual-navbar {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%) translateY(-10px);
  display: flex;
  gap: 6px;
  padding: 3px 8px;
  background: rgba(22, 27, 34, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  opacity: 0;
  pointer-events: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 25;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}

.interactive-overlay:hover .virtual-navbar,
.interactive-overlay:focus-within .virtual-navbar {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
  pointer-events: auto;
}

.nav-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: #c9d1d9;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  transform: scale(1.1);
}

.nav-btn.connect-btn:hover {
  background: #388bfd;
  color: #ffffff;
}

.nav-btn svg {
  width: 13px;
  height: 13px;
}

/* 移动端紧凑卡片优化 */
@media (max-width: 1024px) {
  .device-card {
    border-radius: 8px;
  }
  .device-pill {
    padding: 2px 6px;
    gap: 3px;
  }
  .device-name {
    font-size: 10px;
  }
  .card-header-left {
    top: 4px;
    left: 4px;
  }
  .card-header-right {
    top: 4px;
    right: 4px;
    gap: 4px;
  }
  .card-menu-btn {
    width: 20px;
    height: 20px;
  }
  .card-menu-btn svg {
    width: 11px;
    height: 11px;
  }
  .card-bottom-bar {
    padding: 2px 4px;
  }
  .model-name {
    font-size: 9px;
  }
}
</style>
