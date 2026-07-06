<template>
  <div 
    class="device-card" 
    ref="cardElement" 
    :data-device-id="device.id" 
    :class="{ 'is-interactive-mode': deviceStore.globalInteractiveMode && device.status === 'online' }"
    @click="onCardClick"
  >
    <div class="preview-area" :class="{ 'is-landscape': isLandscape }">
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
        :class="{ 'is-landscape': isLandscape }"
      ></canvas>
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
          <button class="nav-btn connect-btn" @click="emit('connect', device.id)" title="进入详情控制">
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
        
        <!-- 聚焦时中央的淡雅提示 -->
        <div class="focus-indicator">⌨️ 输入已锁定</div>
      </div>
      <!-- 群控主控制遮罩（大字号+半透明） -->
      <div v-if="groupControlStore.isGroupControlActive && groupControlStore.masterId === device.id" class="master-full-overlay">
        <span class="master-full-text">主控</span>
      </div>
      <!-- 群控标识/勾选框 -->
      <div v-if="groupControlStore.isGroupControlActive && device.status === 'online'" class="group-select-overlay" @click.stop>
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
      <!-- 隐藏的预加载图片 -->
      <img v-if="nextSnapshotUrl" :src="nextSnapshotUrl" style="display: none;" @load="onNextSnapshotLoaded" />
      <div class="overlay" v-if="!deviceStore.globalInteractiveMode">
        <span class="play-hint">点击进入控制</span>
      </div>
      <!-- 悬浮页脚 -->
      <div class="card-footer-overlay" @click.stop>
        <div class="device-main-info">
          <h3 class="device-id-text" :title="device.id">{{ device.id }}</h3>
          <span class="status-badge" :class="statusClass">
            {{ statusText }}
          </span>
        </div>
        <div v-if="device.info?.model" class="device-meta">
          <span class="model-name">{{ device.info.model }}</span>
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
        <!-- 功能菜单按钮 -->
        <button class="menu-btn" @click.stop="toggleMenu" title="更多操作">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <circle cx="4" cy="8" r="1.5"/>
            <circle cx="8" cy="8" r="1.5"/>
            <circle cx="12" cy="8" r="1.5"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 下拉菜单 -->
    <div v-if="showMenu" class="card-menu" @click.stop>
      <button class="menu-item" @click="onSettings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        连接设置
      </button>
      <button class="menu-item" @click="onEditTags">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 12v7a1 1 0 0 1-1 1h-7L4 12V5a1 1 0 0 1 1-1h7l8 8z"></path><circle cx="8.5" cy="8.5" r="1.5"></circle></svg>
        编辑标签
      </button>
      <button class="menu-item danger" @click="onQuitAgent" :disabled="device.status !== 'online'">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v6M12 4.5a6 6 0 11-8 0"/></svg>
        退出 Agent
      </button>
    </div>
    
    <!-- 点击其他地方关闭菜单 -->
    <div v-if="showMenu" class="menu-overlay" @click.stop="showMenu = false"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDeviceStore } from '@/stores/devices'
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

const emit = defineEmits(['connect', 'settings', 'edit-tags'])
const deviceStore = useDeviceStore()
const groupControlStore = useGroupControlStore()
const showMenu = ref(false)
const imgLoaded = ref(false)

const isLandscape = computed(() => {
  // 建立响应式依赖
  const loaded = imgLoaded.value
  
  const canvas = previewCanvas.value
  // 只有当高频预览处于活动状态，并且首帧已经成功渲染（即 Canvas 已经被赋予了实际图像大小，排排除默认 300x150 大小的影响）时，才采用 Canvas 的高宽判断
  if (isPreviewActive.value && isFirstFrameRendered.value && canvas && canvas.width && canvas.height) {
    return canvas.width > canvas.height
  }
  
  const img = cardElement.value?.querySelector('.snapshot-img:not(canvas)')
  if (img && img.naturalWidth && img.naturalHeight) {
    return img.naturalWidth > img.naturalHeight
  }
  
  const display = props.device.info?.displays?.[0]
  if (display && display.x_res && display.y_res) {
    return display.x_res > display.y_res
  }
  return false
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
    if (!currentSnapshot.value) {
      currentSnapshot.value = newSnapshot
    } else {
      nextSnapshotUrl.value = newSnapshot
    }
  } else {
    currentSnapshot.value = ''
    nextSnapshotUrl.value = ''
  }
})

function onNextSnapshotLoaded() {
  if (nextSnapshotUrl.value) {
    currentSnapshot.value = nextSnapshotUrl.value
    nextSnapshotUrl.value = ''
  }
}

function onImageLoad(event) {
  imgLoaded.value = true
}

const statusClass = computed(() => {
  return props.device.status === 'online' ? 'online' : 'offline'
})

const statusText = computed(() => {
  return props.device.status === 'online' ? '在线' : '离线'
})

const visibleTags = computed(() => props.tags.slice(0, 3))
const hiddenTagCount = computed(() => Math.max(0, props.tags.length - visibleTags.value.length))

function onCardClick() {
  if (!showMenu.value) {
    emit('connect', props.device.id)
  }
}

function toggleMenu() {
  showMenu.value = !showMenu.value
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
  
  initDecoder(decoderMode)
  
  // 注册数据接收回调
  deviceStore.registerPreviewCallback(props.device.id, (nalu, isKey, ptsUs) => {
    feedFrame(nalu, isKey, ptsUs, decoderMode)
  })
  
  // 发送 start_preview 控制指令，带上定制的 fps, maxSize 和 bitrate
  deviceStore.sendPreviewControl('start_preview', props.device.id, fps, maxSize, bitrate)
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
  const isNotActiveControl = deviceStore.activeDeviceId !== props.device.id
  
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

// 监听当前活跃的控制设备变化 (当被控制时自动停用预览，断开时若大盘模式开启且可见则自动恢复)
watch(() => deviceStore.activeDeviceId, () => {
  evaluatePreviewState()
})

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
    decoder: settings.previewDecoder
  }
}, (newVal, oldVal) => {
  if (isPreviewActive.value) {
    if (newVal.fps !== oldVal.fps || newVal.maxSize !== oldVal.maxSize || newVal.decoder !== oldVal.decoder) {
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
  
  const display = props.device.info?.displays?.[0]
  const rawW = display?.x_res || 1080
  const rawH = display?.y_res || 1920
  
  // 判定逻辑分辨率（横屏模式下，物理高宽必须互换）
  const videoW = isLandscape.value ? Math.max(rawW, rawH) : Math.min(rawW, rawH)
  const videoH = isLandscape.value ? Math.min(rawW, rawH) : Math.max(rawW, rawH)
  
  const clientW = rect.width
  const clientH = rect.height
  
  // 考虑 object-fit: contain 下的真正渲染高宽及黑边偏移量
  // 如果是横屏（isLandscape.value = true），图像在 CSS 中被旋转了 90 度
  // 等于说在网页上展现的高宽比其实是 videoH / videoW
  const videoRatio = isLandscape.value ? (videoH / videoW) : (videoW / videoH)
  const clientRatio = clientW / clientH
  
  let actualW, actualH, offsetX, offsetY
  if (clientRatio > videoRatio) {
    // 左右有黑边 (Pillarbox)
    actualH = clientH
    actualW = clientH * videoRatio
    offsetX = (clientW - actualW) / 2
    offsetY = 0
  } else {
    // 上下有黑边 (Letterbox)
    actualW = clientW
    actualH = clientW / videoRatio
    offsetX = 0
    offsetY = (clientH - actualH) / 2
  }
  
  // 相对真正视频画面的坐标位置
  const relativeX = clientX - offsetX
  const relativeY = clientY - offsetY
  
  const normX = Math.max(0, Math.min(1, relativeX / actualW))
  const normY = Math.max(0, Math.min(1, relativeY / actualH))
  
  let result = null
  if (isLandscape.value) { // 顺时针旋转 90 度
    const origNormX = normY
    const origNormY = 1 - normX
    
    result = {
      x: Math.round(origNormX * videoW),
      y: Math.round(origNormY * videoH),
      w: videoW,
      h: videoH,
      isRotated: true
    }
  } else { // 正常竖屏
    result = {
      x: Math.round(normX * videoW),
      y: Math.round(normY * videoH),
      w: videoW,
      h: videoH,
      isRotated: false
    }
  }

  console.log(`[DirectControl Debug] [${props.device.id}] Coordinates Calc:`, {
    isLandscape: isLandscape.value,
    clientX: e.clientX,
    clientY: e.clientY,
    rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    relativeClick: { clientX, clientY },
    videoContentBounds: { actualW, actualH, offsetX, offsetY },
    normalized: { normX, normY },
    rawResolution: { rawW, rawH },
    videoResolution: { videoW, videoH },
    computedCoords: result,
    displaysInfo: display
  })

  return result
}

const sendDeviceControl = (payload) => {
  if (payload.type === 'touch' && payload.action !== 2) { // 过滤高频 Move，仅对 Down / Up 输出
    console.log(`[DirectControl WS Send] [${props.device.id}] Payload:`, payload)
  } else if (payload.type !== 'touch') {
    console.log(`[DirectControl WS Send] [${props.device.id}] Payload:`, payload)
  }
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
      id: e.pointerId,
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
    id: e.pointerId,
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
      id: e.pointerId,
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
  background: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid var(--border);
  position: relative;
}

.device-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  border-color: var(--accent);
}

.preview-area {
  aspect-ratio: 9 / 16;
  background: #111;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.snapshot-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.snapshot-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  transition: transform 0.3s ease, width 0.3s ease, height 0.3s ease;
}

/* 横屏时的旋转适配：强制以竖屏在 9:16 容器中显示 */
.preview-area.is-landscape .snapshot-img {
  position: absolute;
  width: 177.78%; /* 宽高对调：宽为容器的高（16/9 ≈ 177.78%） */
  height: 100%;   /* 高为容器的宽（100%） */
  top: 0;
  left: -38.89%;  /* 水平居中偏移：(177.78% - 100%) / 2 = 38.89% */
  object-fit: contain;
  transform: rotate(90deg); /* 顺时针旋转 90 度 */
}

.vm-icon {
  font-size: 48px;
  opacity: 0.3;
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.device-card:hover .overlay {
  opacity: 1;
}

.play-hint {
  background: var(--accent);
  color: white;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  transform: translateY(10px);
  transition: transform 0.2s;
}

.device-card:hover .play-hint {
  transform: translateY(0);
}

.card-footer-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(13, 17, 23, 0.95) 0%, rgba(13, 17, 23, 0.7) 60%, rgba(13, 17, 23, 0) 100%);
  padding: 12px 14px 10px;
  z-index: 5;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.device-main-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.device-id-text {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-primary);
  max-width: 140px;
}

.status-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
  text-transform: uppercase;
}

.status-badge.online {
  background: rgba(74, 222, 128, 0.1);
  color: #4ade80;
}

.status-badge.offline {
  background: rgba(255, 255, 255, 0.1);
  color: #999;
}

.device-meta {
  font-size: 11px;
  color: var(--text-secondary);
}

.model-name {
  opacity: 0.7;
}

.device-tags {
  display: flex;
  flex-wrap: nowrap; /* 强制不折行 */
  gap: 5px;
  overflow: hidden; /* 溢出隐藏 */
  padding-right: 28px;
  margin-top: auto; /* 自动推到最底端 */
}

.device-tag {
  max-width: 86px;
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border: 1px solid;
  border-radius: 999px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.more-tag {
  color: var(--text-secondary);
  border-color: var(--border);
  background: rgba(255, 255, 255, 0.06);
}

/* 菜单按钮 */
.menu-btn {
  position: absolute;
  right: 12px;
  bottom: 12px; /* 锁死在右下角，因为页脚固定高度，所以在纵向上也是完全对齐的 */
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08); /* 明显的磨砂质感背景 */
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  cursor: pointer;
  opacity: 0.8;
  transition: all 0.2s ease;
}

.menu-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.18);
  border-color: var(--accent);
}

.menu-btn svg {
  width: 14px;
  height: 14px;
  color: var(--text-primary);
}

/* 下拉菜单 */
.card-menu {
  position: absolute;
  bottom: 42px; /* 呈现在右下角按钮的上方 */
  right: 12px;
  min-width: 140px;
  background: #161b22 !important; /* 强制不透明底色 */
  opacity: 1 !important; /* 强制不透明 */
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  z-index: 100;
  padding: 4px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
}

.menu-item:hover:not(:disabled) {
  background: var(--bg-hover);
}

.menu-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.menu-item.danger {
  color: var(--error);
}

.menu-item svg {
  width: 14px;
  height: 14px;
}

.menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
}

/* 移动端卡片优化 */
@media (max-width: 1024px) {
  .device-card {
    height: 100%;
  }
  .preview-area {
    aspect-ratio: unset;
    flex: 1;
    min-height: 0;
  }
  .card-footer-overlay {
    padding: 8px 10px;
  }
  .device-id-text {
    font-size: 13px;
    max-width: 80px;
  }
  .status-badge {
    font-size: 9px;
    padding: 1px 4px;
  }
  .vm-icon {
    font-size: 32px;
  }
  .device-tags {
    gap: 4px;
    padding-right: 22px;
  }
  .device-tag {
    max-width: 70px;
    height: 18px;
    padding: 0 6px;
    font-size: 9px;
  }
  .menu-btn {
    opacity: 1;
  }
}

/* 群控主控遮罩 - 半透明蒙版+大字主控 */
.master-full-overlay {
  position: absolute;
  inset: 0;
  z-index: 12;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  border-radius: inherit;
}

.master-full-text {
  font-size: clamp(28px, 8vw, 64px);
  font-weight: 900;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.6), 0 0 40px rgba(255, 159, 67, 0.5);
  letter-spacing: 0.15em;
  user-select: none;
  -webkit-text-stroke: 1px rgba(255, 159, 67, 0.4);
}

/* 群控勾选框样式 */
.group-select-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 15;
  background: rgba(10, 12, 16, 0.6);
  border-radius: 8px;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

.group-select-overlay:hover {
  background: rgba(26, 115, 232, 0.2);
  border-color: var(--accent);
}

.group-select-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--accent);
  margin: 0;
}

.master-badge {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: #ff9f43;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(255, 159, 67, 0.4);
}

/* 预览直控相关样式 */
.device-card.is-interactive-mode {
  border-color: rgba(56, 139, 253, 0.4);
  box-shadow: 0 0 10px rgba(56, 139, 253, 0.15);
  animation: pulse-border 2.5s infinite ease-in-out;
}

@keyframes pulse-border {
  0% { box-shadow: 0 0 6px rgba(56, 139, 253, 0.15); }
  50% { box-shadow: 0 0 14px rgba(56, 139, 253, 0.4); border-color: rgba(56, 139, 253, 0.7); }
  100% { box-shadow: 0 0 6px rgba(56, 139, 253, 0.15); }
}

.interactive-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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
  top: 10px;
  left: 50%;
  transform: translateX(-50%) translateY(-10px);
  display: flex;
  gap: 8px;
  padding: 4px 10px;
  background: rgba(22, 27, 34, 0.75);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  opacity: 0;
  pointer-events: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 25;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.interactive-overlay:hover .virtual-navbar,
.interactive-overlay:focus-within .virtual-navbar {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
  pointer-events: auto;
}

.nav-btn {
  width: 28px;
  height: 28px;
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
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  transform: scale(1.1);
}

.nav-btn.connect-btn:hover {
  background: #388bfd;
  color: #ffffff;
}

.nav-btn svg {
  width: 14px;
  height: 14px;
}

/* 键盘锁定指示器 */
.focus-indicator {
  position: absolute;
  bottom: 50px;
  left: 50%;
  transform: translate(-50%, 10px);
  background: rgba(35, 134, 54, 0.85);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  color: #ffffff;
  opacity: 0;
  transition: all 0.25s ease;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.interactive-overlay:focus .focus-indicator {
  opacity: 1;
  transform: translate(-50%, 0);
}
</style>
