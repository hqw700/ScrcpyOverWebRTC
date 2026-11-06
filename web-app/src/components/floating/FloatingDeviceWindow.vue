<template>
  <div 
    class="floating-device-window"
    :class="{
      'is-focused': isFocused,
      'is-maximized': isMaximized,
      'is-minimized': isMinimized
    }"
    :style="windowStyle"
    @mousedown="onWindowMouseDown"
  >
    <!-- 窗口顶部拖拽标题栏 -->
    <header class="window-titlebar" @mousedown="onTitlebarMouseDown">
      <div class="titlebar-left">
        <span class="status-dot" :class="{ online: isOnline, offline: !isOnline }"></span>
        <span class="device-title" :title="deviceId">
          {{ displayName }}
        </span>
        <span v-if="deviceModel" class="device-model-badge" :title="deviceModel">
          {{ deviceModel }}
        </span>
        <span v-if="isFocused" class="focus-pill">{{ $t('multi.focusedTag') }}</span>
      </div>

      <div class="titlebar-actions" @mousedown.stop @click.stop>
        <!-- 画中画 (PiP) -->
        <button 
          v-if="deviceClientRef?.pictureInPictureSupported && !deviceClientRef?.isCanvasRendering"
          class="win-btn pip-btn" 
          :class="{ active: deviceClientRef?.isPiP }"
          @click="deviceClientRef?.togglePictureInPicture()" 
          :title="deviceClientRef?.isPiP ? $t('deviceClient.pipActiveHoverHint') : $t('deviceClient.enterPip')"
          :data-tooltip="deviceClientRef?.isPiP ? $t('deviceClient.pipActiveHoverHint') : $t('deviceClient.enterPip')"
        >
          <svg class="btn-svg" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><rect x="11" y="9" width="9" height="7" rx="1" ry="1" fill="currentColor" stroke="none"></rect></svg>
        </button>

        <!-- 网页全屏 / 窗口最大化 -->
        <button 
          class="win-btn max-btn" 
          :class="{ active: isMaximized }"
          @click="toggleMaximize" 
          :title="isMaximized ? $t('multi.restore') : $t('multi.maximize')"
          :data-tooltip="isMaximized ? $t('multi.restore') : $t('multi.maximize')"
        >
          <svg v-if="isMaximized" class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="4 14 10 14 10 20"></polyline>
            <polyline points="20 10 14 10 14 4"></polyline>
            <line x1="14" y1="10" x2="21" y2="3"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
          <svg v-else class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        </button>

        <!-- 最小化到托盘 -->
        <button 
          class="win-btn min-btn" 
          @click="emit('minimize', deviceId)" 
          :title="$t('multi.minimizeToTray')"
          :data-tooltip="$t('multi.minimizeToTray')"
        >
          <svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

        <!-- 关闭断开此窗口 -->
        <button 
          class="win-btn close-btn" 
          @click="emit('close', deviceId)" 
          :title="$t('deviceClient.closeConn')"
          :data-tooltip="$t('deviceClient.closeConn')"
        >
          <svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </header>

    <!-- 窗口主体：内嵌核心 DeviceClient -->
    <main class="window-body">
      <DeviceClient 
        ref="deviceClientRef"
        :deviceId="deviceId"
        :key="`${deviceId}_${deviceStore.getDeviceMode(deviceId)}`"
        :is-mini="true"
        :is-focused="isFocused"
        :audio-muted="!isFocused && audioFocusMode === 'exclusive'"
        @recommend-layout="onRecommendLayout"
      />
    </main>

    <!-- 自由缩放手柄（最大化时不显示） -->
    <template v-if="!isMaximized && !isMinimized">
      <div class="resize-handle right" @mousedown.stop.prevent="startResize('right', $event)"></div>
      <div class="resize-handle bottom" @mousedown.stop.prevent="startResize('bottom', $event)"></div>
      <div class="resize-corner bottom-right" @mousedown.stop.prevent="startResize('bottom-right', $event)"></div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import DeviceClient from '@/views/DeviceClient.vue'

const props = defineProps({
  deviceId: {
    type: String,
    required: true
  },
  windowState: {
    type: Object,
    required: true
  },
  isFocused: {
    type: Boolean,
    default: false
  },
  isMinimized: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['focus', 'minimize', 'close', 'update-state'])

const deviceStore = useDeviceStore()
const deviceClientRef = ref(null)

const isMaximized = ref(false)
const preMaximizedState = ref(null)

const currentDevice = computed(() => {
  return deviceStore.devices.find(d => d.id === props.deviceId) ||
    deviceStore.offlineDevices.find(d => d.id === props.deviceId)
})

const isOnline = computed(() => currentDevice.value?.status === 'online')
const displayName = computed(() => deviceStore.getDeviceDisplayName(props.deviceId))
const deviceModel = computed(() => currentDevice.value?.info?.model || '')
const audioFocusMode = computed(() => deviceStore.audioFocusMode || 'exclusive')

// 动态窗口样式计算
const windowStyle = computed(() => {
  if (props.isMinimized) {
    return { display: 'none' }
  }
  if (isMaximized.value) {
    return {
      position: 'fixed',
      left: '0px',
      top: '0px',
      width: '100vw',
      height: '100vh',
      transform: 'none',
      borderRadius: '0px',
      zIndex: props.windowState.zIndex + 500
    }
  }
  return {
    position: 'fixed',
    left: `${props.windowState.x}px`,
    top: `${props.windowState.y}px`,
    width: `${props.windowState.w}px`,
    height: `${props.windowState.h}px`,
    zIndex: props.windowState.zIndex
  }
})

function onWindowMouseDown() {
  emit('focus', props.deviceId)
}

function toggleMaximize() {
  if (!isMaximized.value) {
    preMaximizedState.value = { ...props.windowState }
    isMaximized.value = true
  } else {
    isMaximized.value = false
  }
  emit('focus', props.deviceId)
}

// 子组件视频画面尺寸探测并建议布局
function onRecommendLayout({ isLandscape, ratio }) {
  if (props.windowState.userResized || isMaximized.value) return
  const currentW = props.windowState.w
  let newH = Math.round(currentW / (ratio || (9 / 16)))
  // 增加 36px 标题栏高度
  newH += 36
  newH = Math.min(newH, window.innerHeight - 80)
  emit('update-state', props.deviceId, {
    h: Math.max(newH, 380)
  })
}

// --- 窗口拖拽漫游逻辑 ---
function onTitlebarMouseDown(e) {
  if (isMaximized.value) return
  emit('focus', props.deviceId)

  const startX = e.clientX
  const startY = e.clientY
  const initX = props.windowState.x
  const initY = props.windowState.y

  function onMouseMove(moveEvt) {
    const deltaX = moveEvt.clientX - startX
    const deltaY = moveEvt.clientY - startY

    // 边界安全钳制：防止窗口完全拖出屏幕找不回
    const maxX = Math.max(0, window.innerWidth - 100)
    const maxY = Math.max(0, window.innerHeight - 40)
    const nextX = Math.min(maxX, Math.max(10 - props.windowState.w + 100, initX + deltaX))
    const nextY = Math.min(maxY, Math.max(0, initY + deltaY))

    emit('update-state', props.deviceId, { x: nextX, y: nextY })
  }

  function onMouseUp() {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

// --- 窗口八向缩放逻辑 ---
function startResize(direction, e) {
  if (isMaximized.value) return
  emit('focus', props.deviceId)

  const startX = e.clientX
  const startY = e.clientY
  const initW = props.windowState.w
  const initH = props.windowState.h

  function onMouseMove(moveEvt) {
    const deltaX = moveEvt.clientX - startX
    const deltaY = moveEvt.clientY - startY
    const updates = { userResized: true }

    if (direction.includes('right')) {
      const maxW = Math.max(260, window.innerWidth - props.windowState.x)
      updates.w = Math.min(maxW, Math.max(260, initW + deltaX))
    }
    if (direction.includes('bottom')) {
      const maxH = Math.max(380, window.innerHeight - props.windowState.y)
      updates.h = Math.min(maxH, Math.max(380, initH + deltaY))
    }

    emit('update-state', props.deviceId, updates)
  }

  function onMouseUp() {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

defineExpose({
  deviceClientRef
})
</script>

<style scoped>
.floating-device-window {
  display: flex;
  flex-direction: column;
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow: hidden;
  user-select: none;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.floating-device-window.is-focused {
  border-color: rgba(56, 189, 248, 0.5);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.7), 0 0 20px rgba(56, 189, 248, 0.25);
}

.floating-device-window.is-maximized {
  border-radius: 0;
  border: none;
}

/* 标题栏 */
.window-titlebar {
  height: 38px;
  min-height: 38px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(22, 27, 34, 0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  cursor: grab;
  position: relative;
  z-index: 20;
}

.window-titlebar:active {
  cursor: grabbing;
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  pointer-events: none;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.online {
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
}

.status-dot.offline {
  background: #8b949e;
}

.device-title {
  font-size: 13px;
  font-weight: 600;
  color: #c9d1d9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.is-focused .device-title {
  color: #38bdf8;
}

.device-model-badge {
  font-size: 10px;
  color: #8b949e;
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.focus-pill {
  font-size: 10px;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.3);
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 500;
}

/* 标题栏操作按钮组 */
.titlebar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.win-btn {
  background: none;
  border: none;
  color: #8b949e;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  position: relative;
}

.win-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

.win-btn.active {
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.16);
}

.win-btn.close-btn:hover {
  color: #f85149;
  background: rgba(248, 81, 73, 0.18);
}

.btn-svg {
  width: 14px;
  height: 14px;
}

/* 按钮即时浮现气泡 Tooltip */
.titlebar-actions .win-btn[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%) translateY(-2px);
  padding: 4px 8px;
  background: rgba(15, 23, 42, 0.96);
  backdrop-filter: blur(8px);
  color: #f1f5f9;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
  z-index: 99999;
}

.titlebar-actions .win-btn[data-tooltip]:hover::after {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}

.titlebar-actions .win-btn:last-child[data-tooltip]::after {
  left: auto;
  right: 0;
  transform: translateY(-2px);
}

.titlebar-actions .win-btn:last-child[data-tooltip]:hover::after {
  transform: translateY(0);
}

/* 主体内容区 */
.window-body {
  flex: 1;
  width: 100%;
  height: calc(100% - 38px);
  overflow: hidden;
  background: #000000;
  position: relative;
}

/* 缩放手柄 */
.resize-handle.right {
  position: absolute;
  top: 38px;
  right: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  z-index: 10;
}

.resize-handle.bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 8px;
  cursor: ns-resize;
  z-index: 10;
}

.resize-corner.bottom-right {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  z-index: 20;
}

.resize-corner.bottom-right::after {
  content: '';
  position: absolute;
  bottom: 3px;
  right: 3px;
  width: 6px;
  height: 6px;
  border-right: 2px solid rgba(255, 255, 255, 0.25);
  border-bottom: 2px solid rgba(255, 255, 255, 0.25);
}
</style>
