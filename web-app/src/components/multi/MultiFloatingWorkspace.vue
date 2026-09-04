<template>
  <div class="multi-floating-workspace" ref="workspaceRef">
    <!-- 浮窗工作台快捷整理栏 -->
    <div class="workspace-toolbar">
      <span class="toolbar-title">自由多浮窗工作台</span>
      <div class="toolbar-buttons">
        <button class="arrange-btn" @click="arrangeCascade" title="层叠排列">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="13" height="13" rx="2"></rect>
            <path d="M9 9h13v13H9z"></path>
          </svg>
          层叠
        </button>
        <button class="arrange-btn" @click="arrangeTile" title="横向均匀平铺">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="18" rx="1"></rect>
            <rect x="14" y="3" width="7" height="18" rx="1"></rect>
          </svg>
          并排
        </button>
        <button class="arrange-btn" @click="arrangeGrid" title="四角对齐排列">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="8" height="8" rx="1"></rect>
            <rect x="13" y="3" width="8" height="8" rx="1"></rect>
            <rect x="3" y="13" width="8" height="8" rx="1"></rect>
            <rect x="13" y="13" width="8" height="8" rx="1"></rect>
          </svg>
          四角
        </button>
      </div>
    </div>

    <!-- 浮动窗口区域 -->
    <div class="windows-container">
      <div 
        v-for="id in activeDeviceIds" 
        :key="id"
        class="floating-window"
        :class="{ 
          'is-focused': deviceStore.focusedDeviceId === id,
          'is-minimized': minimizedWindows.includes(id)
        }"
        :style="getWindowStyle(id)"
        @mousedown="bringToFront(id)"
      >
        <!-- 窗口拖拽标题栏 (集成状态、型号、主控、最小化、最大化、关闭) -->
        <div class="window-titlebar" @mousedown="startDrag(id, $event)">
          <div class="titlebar-left">
            <span class="dot-status" :class="{ online: getDeviceStatus(id) === 'online', offline: getDeviceStatus(id) !== 'online' }"></span>
            <span class="window-title" :title="id">{{ id }}</span>
            <span v-if="getDeviceModel(id)" class="device-model-badge" :title="getDeviceModel(id)">{{ getDeviceModel(id) }}</span>
          </div>
          <div class="titlebar-actions" @mousedown.stop @click.stop>
            <!-- 主控机标记/切换按钮 -->
            <button 
              class="win-btn master-btn" 
              :class="{ active: deviceStore.masterDeviceId === id }" 
              @click="deviceStore.setMasterDevice(id)" 
              :title="deviceStore.masterDeviceId === id ? '当前为主控机（指令广播源）' : '设为主控机'"
            >
              👑
            </button>
            <button class="win-btn" @click="toggleMinimize(id)" title="最小化到托盘">─</button>
            <button class="win-btn" @click="deviceStore.toggleMaximizeDevice(id)" :title="deviceStore.maximizedDeviceId === id ? '还原窗口' : '最大化'">
              {{ deviceStore.maximizedDeviceId === id ? '❐' : '⤢' }}
            </button>
            <button class="win-btn close" @click="closeWindow(id)" title="关闭">✕</button>
          </div>
        </div>

        <!-- 窗口内容区 (不重复渲染顶部标题栏) -->
        <div class="window-body" v-show="!minimizedWindows.includes(id)">
          <MultiDeviceItem 
            :deviceId="id" 
            :isMini="true" 
            :showHeader="false"
          />
        </div>

        <!-- 缩放手柄 -->
        <div 
          class="resize-handle se" 
          v-show="!minimizedWindows.includes(id)"
          @mousedown.stop.prevent="startResize(id, $event)"
        ></div>
      </div>
    </div>

    <!-- 底部最小化任务托盘 -->
    <div class="minimized-dock" v-if="minimizedWindows.length > 0">
      <span class="dock-label">托盘:</span>
      <div 
        v-for="id in minimizedWindows" 
        :key="id"
        class="dock-item"
        @click="toggleMinimize(id)"
      >
        📱 {{ id }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import MultiDeviceItem from './MultiDeviceItem.vue'

const deviceStore = useDeviceStore()
const activeDeviceIds = computed(() => deviceStore.activeDeviceIds)
const workspaceRef = ref(null)

const windowStates = reactive({})
const minimizedWindows = ref([])
let topZIndex = 10

function getDevice(id) {
  return deviceStore.devices.find(d => d.id === id) || deviceStore.offlineDevices.find(d => d.id === id)
}
function getDeviceStatus(id) {
  return getDevice(id)?.status || 'offline'
}
function getDeviceModel(id) {
  return getDevice(id)?.info?.model || ''
}

function initWindowState(id, index = 0) {
  if (!windowStates[id]) {
    const offsetX = 30 + (index % 6) * 40
    const offsetY = 30 + (index % 6) * 35
    windowStates[id] = {
      x: offsetX,
      y: offsetY,
      w: 360,
      h: 580,
      zIndex: ++topZIndex
    }
  }
}

watch(activeDeviceIds, (newIds) => {
  newIds.forEach((id, idx) => {
    initWindowState(id, idx)
  })
}, { immediate: true, deep: true })

function getWindowStyle(id) {
  const state = windowStates[id] || { x: 40, y: 40, w: 360, h: 580, zIndex: 10 }
  if (minimizedWindows.value.includes(id)) {
    return { display: 'none' }
  }
  return {
    transform: `translate3d(${state.x}px, ${state.y}px, 0)`,
    width: `${state.w}px`,
    height: `${state.h}px`,
    zIndex: state.zIndex
  }
}

function bringToFront(id) {
  deviceStore.focusDevice(id)
  if (windowStates[id]) {
    windowStates[id].zIndex = ++topZIndex
  }
}

function toggleMinimize(id) {
  const idx = minimizedWindows.value.indexOf(id)
  if (idx > -1) {
    minimizedWindows.value.splice(idx, 1)
    bringToFront(id)
  } else {
    minimizedWindows.value.push(id)
  }
}

function closeWindow(id) {
  const idx = minimizedWindows.value.indexOf(id)
  if (idx > -1) {
    minimizedWindows.value.splice(idx, 1)
  }
  delete windowStates[id]
  deviceStore.closeDevice(id)
}

// 窗口拖拽
function startDrag(id, e) {
  bringToFront(id)
  const state = windowStates[id]
  const startX = e.clientX
  const startY = e.clientY
  const initX = state.x
  const initY = state.y
  const containerW = workspaceRef.value?.clientWidth || window.innerWidth
  const containerH = workspaceRef.value?.clientHeight || window.innerHeight

  function onMouseMove(moveEvt) {
    const maxX = Math.max(0, containerW - 120)
    const maxY = Math.max(0, containerH - 40)
    state.x = Math.min(maxX, Math.max(0, initX + (moveEvt.clientX - startX)))
    state.y = Math.min(maxY, Math.max(0, initY + (moveEvt.clientY - startY)))
  }

  function onMouseUp() {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

// 窗口缩放
function startResize(id, e) {
  bringToFront(id)
  const state = windowStates[id]
  const startX = e.clientX
  const startY = e.clientY
  const initW = state.w
  const initH = state.h
  const containerW = workspaceRef.value?.clientWidth || window.innerWidth
  const containerH = workspaceRef.value?.clientHeight || window.innerHeight

  function onMouseMove(moveEvt) {
    const maxW = Math.max(260, containerW - state.x)
    const maxH = Math.max(380, containerH - state.y)
    state.w = Math.min(maxW, Math.max(260, initW + (moveEvt.clientX - startX)))
    state.h = Math.min(maxH, Math.max(380, initH + (moveEvt.clientY - startY)))
  }

  function onMouseUp() {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

// 快捷排列算法
function arrangeCascade() {
  activeDeviceIds.value.forEach((id, idx) => {
    if (windowStates[id]) {
      windowStates[id].x = 30 + idx * 35
      windowStates[id].y = 20 + idx * 30
      windowStates[id].w = 340
      windowStates[id].h = 560
      windowStates[id].zIndex = ++topZIndex
    }
  })
}

function arrangeTile() {
  const containerW = workspaceRef.value?.clientWidth || 1200
  const containerH = workspaceRef.value?.clientHeight || 800
  const count = activeDeviceIds.value.length
  if (count === 0) return
  const colW = Math.max(280, Math.floor((containerW - 24) / count) - 12)
  activeDeviceIds.value.forEach((id, idx) => {
    if (windowStates[id]) {
      windowStates[id].x = 12 + idx * (colW + 12)
      windowStates[id].y = 48
      windowStates[id].w = colW
      windowStates[id].h = containerH - 70
      windowStates[id].zIndex = ++topZIndex
    }
  })
}

function arrangeGrid() {
  const containerW = workspaceRef.value?.clientWidth || 1200
  const containerH = workspaceRef.value?.clientHeight || 800
  const halfW = Math.floor((containerW - 36) / 2)
  const halfH = Math.floor((containerH - 90) / 2)
  
  const positions = [
    { x: 12, y: 48 },
    { x: 24 + halfW, y: 48 },
    { x: 12, y: 58 + halfH },
    { x: 24 + halfW, y: 58 + halfH }
  ]

  activeDeviceIds.value.forEach((id, idx) => {
    const pos = positions[idx % 4]
    if (windowStates[id]) {
      windowStates[id].x = pos.x
      windowStates[id].y = pos.y
      windowStates[id].w = halfW
      windowStates[id].h = halfH
      windowStates[id].zIndex = ++topZIndex
    }
  })
}
</script>

<style scoped>
.multi-floating-workspace {
  position: relative;
  width: 100%;
  height: 100%;
  background: #090d13;
  overflow: hidden;
}

.workspace-toolbar {
  position: absolute;
  top: 8px;
  left: 12px;
  right: 12px;
  height: 36px;
  background: rgba(22, 27, 34, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid #30363d;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  z-index: 5;
}

.toolbar-title {
  font-size: 12px;
  color: #8b949e;
  font-weight: 600;
}

.toolbar-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.arrange-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.arrange-btn svg {
  width: 12px;
  height: 12px;
}

.arrange-btn:hover {
  background: #30363d;
  color: #38bdf8;
  border-color: #38bdf8;
}

.windows-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}

.floating-window {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

.floating-window.is-focused {
  border-color: #38bdf8;
  box-shadow: 0 0 0 1px #38bdf8, 0 12px 32px rgba(56, 189, 248, 0.25);
}

.window-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  background: #161b22;
  border-bottom: 1px solid #21262d;
  padding: 0 8px;
  user-select: none;
  cursor: move;
}

.is-focused .window-titlebar {
  background: #1c2128;
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2ea043;
}

.window-title {
  font-size: 12px;
  font-weight: 600;
  color: #c9d1d9;
}

.device-model-badge {
  font-size: 10px;
  color: #8b949e;
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 5px;
  border-radius: 4px;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.titlebar-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.win-btn {
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 11px;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.win-btn:hover {
  background: #21262d;
  color: #c9d1d9;
}

.win-btn.master-btn {
  opacity: 0.5;
  font-size: 10px;
}

.win-btn.master-btn:hover,
.win-btn.master-btn.active {
  opacity: 1;
  background: rgba(245, 158, 11, 0.2);
}

.win-btn.close:hover {
  background: rgba(248, 81, 73, 0.2);
  color: #f85149;
}

.window-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.resize-handle.se {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 14px;
  height: 14px;
  cursor: se-resize;
  background: linear-gradient(135deg, transparent 50%, #8b949e 50%);
}

.minimized-dock {
  position: absolute;
  bottom: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(22, 27, 34, 0.9);
  backdrop-filter: blur(8px);
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 4px 10px;
  z-index: 20;
}

.dock-label {
  font-size: 11px;
  color: #8b949e;
}

.dock-item {
  font-size: 11px;
  background: #21262d;
  color: #c9d1d9;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid #30363d;
}

.dock-item:hover {
  background: #38bdf8;
  color: #000;
  font-weight: 600;
}
</style>
