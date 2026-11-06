<template>
  <div class="floating-window-manager-root" v-if="displayFloatingDeviceIds.length > 0">
    <!-- 渲染所有激活的自由悬浮窗口 (除停靠在侧边栏的设备之外) -->
    <FloatingDeviceWindow
      v-for="id in displayFloatingDeviceIds"
      :key="id"
      :deviceId="id"
      :windowState="getOrCreateWindowState(id)"
      :isFocused="focusedDeviceId === id"
      :isMinimized="minimizedIds.includes(id)"
      @focus="bringToFront"
      @minimize="toggleMinimize"
      @close="closeDevice"
      @update-state="updateWindowState"
    />

    <!-- 底部任务托盘与快捷整理栏 (当有最小化或多开时常驻右下角) -->
    <aside 
      class="floating-dock-bar" 
      v-if="minimizedIds.length > 0 || activeDeviceIds.length > 1"
      @mousedown.stop
    >
      <!-- 最小化胶囊列表 -->
      <div class="minimized-capsules custom-scrollbar" v-if="minimizedIds.length > 0">
        <span class="dock-label">{{ $t('multi.trayLabel') }}</span>
        <button
          v-for="id in minimizedIds"
          :key="id"
          class="dock-capsule"
          @click="restoreWindow(id)"
          :title="`${$t('multi.restore')}: ${deviceStore.getDeviceDisplayName(id)}`"
        >
          <span class="capsule-dot"></span>
          <span class="capsule-text">{{ deviceStore.getDeviceDisplayName(id) }}</span>
        </button>
      </div>

      <!-- 多机快捷整理工具 -->
      <div class="dock-arrange-tools" v-if="activeDeviceIds.length > 1">
        <!-- 阶梯排列 -->
        <button 
          class="arrange-tool-btn" 
          @click="arrangeCascade" 
          :title="$t('multi.cascadeTitle')"
        >
          <svg class="tool-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="13" height="13" rx="2"></rect>
            <path d="M9 9h13v13H9z"></path>
          </svg>
          <span class="btn-text">{{ $t('multi.cascadeBtn') }}</span>
        </button>

        <!-- 左右并排 -->
        <button 
          class="arrange-tool-btn" 
          @click="arrangeSideBySide" 
          :title="$t('multi.sideBySideTitle')"
        >
          <svg class="tool-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="18" rx="1"></rect>
            <rect x="14" y="3" width="7" height="18" rx="1"></rect>
          </svg>
          <span class="btn-text">{{ $t('multi.sideBySideBtn') }}</span>
        </button>

        <!-- 全部最小化 / 全部恢复 -->
        <button 
          class="arrange-tool-btn" 
          @click="toggleMinimizeAll" 
          :title="allMinimized ? $t('multi.restore') : $t('multi.minimizeToTray')"
        >
          <span class="btn-text">{{ allMinimized ? `❐ ${$t('multi.restore')}` : `─ ${$t('multi.minimizeToTray')}` }}</span>
        </button>

        <!-- 全部关闭 -->
        <button 
          class="arrange-tool-btn close-all-tool" 
          @click="closeAllDevices" 
          :title="$t('multi.closeWorkspaceTitle')"
        >
          <svg class="tool-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import FloatingDeviceWindow from './FloatingDeviceWindow.vue'

const deviceStore = useDeviceStore()
const activeDeviceIds = computed(() => deviceStore.activeDeviceIds)
const focusedDeviceId = computed(() => deviceStore.focusedDeviceId)

// 自由悬浮窗口展示列表 (单机模式由侧边栏承载；多机模式展示除侧边栏停靠设备之外的所有自由浮窗)
const displayFloatingDeviceIds = computed(() => {
  if (deviceStore.directControlMode === 'single') {
    return []
  }
  if (!deviceStore.sidebarDockedDeviceId) {
    return activeDeviceIds.value
  }
  return activeDeviceIds.value.filter(id => id !== deviceStore.sidebarDockedDeviceId)
})

// 窗口状态表 (响应式记录每台设备的坐标与尺寸)
const windowStates = reactive({})
const minimizedIds = ref([])
let topZIndex = 1100

const allMinimized = computed(() => {
  return activeDeviceIds.value.length > 0 &&
    activeDeviceIds.value.every(id => minimizedIds.value.includes(id))
})

// 为新设备分配窗口初始尺寸与阶梯级联坐标
function getOrCreateWindowState(id) {
  if (!windowStates[id]) {
    const existingCount = Object.keys(windowStates).length
    const defaultW = 380
    const defaultH = Math.min(680, window.innerHeight - 100)

    // 智能阶梯级联定位：从右上方开始向下、向左适度级联
    const cascadeOffset = (existingCount % 6) * 36
    const startX = Math.max(40, window.innerWidth - defaultW - 50 - cascadeOffset)
    const startY = Math.max(60, 70 + cascadeOffset)

    windowStates[id] = {
      x: startX,
      y: startY,
      w: defaultW,
      h: defaultH,
      zIndex: ++topZIndex,
      userResized: false
    }
  }
  return windowStates[id]
}

// 监听活动设备变化，清理已移除设备的窗口记录
watch(activeDeviceIds, (newIds) => {
  newIds.forEach((id) => {
    getOrCreateWindowState(id)
  })
  // 清理不再存在的设备状态
  Object.keys(windowStates).forEach((savedId) => {
    if (!newIds.includes(savedId)) {
      delete windowStates[savedId]
      const minIdx = minimizedIds.value.indexOf(savedId)
      if (minIdx > -1) minimizedIds.value.splice(minIdx, 1)
    }
  })
}, { immediate: true, deep: true })

// 更新窗口坐标或尺寸
function updateWindowState(id, partial) {
  if (!windowStates[id]) return
  Object.assign(windowStates[id], partial)
}

// 激活并置顶窗口
function bringToFront(id) {
  deviceStore.focusDevice(id)
  if (windowStates[id]) {
    windowStates[id].zIndex = ++topZIndex
  }
}

// 最小化切换
function toggleMinimize(id) {
  const idx = minimizedIds.value.indexOf(id)
  if (idx > -1) {
    minimizedIds.value.splice(idx, 1)
    bringToFront(id)
  } else {
    minimizedIds.value.push(id)
    // 若最小化的恰是当前焦点，平滑转移焦点到下一个未最小化的窗口
    if (focusedDeviceId.value === id) {
      const nextOpenId = activeDeviceIds.value.find(devId => !minimizedIds.value.includes(devId))
      if (nextOpenId) {
        bringToFront(nextOpenId)
      }
    }
  }
}

// 从托盘恢复窗口
function restoreWindow(id) {
  const idx = minimizedIds.value.indexOf(id)
  if (idx > -1) {
    minimizedIds.value.splice(idx, 1)
  }
  bringToFront(id)
}

// 全部最小化 / 全部还原
function toggleMinimizeAll() {
  if (allMinimized.value) {
    minimizedIds.value = []
    if (activeDeviceIds.value.length > 0) {
      bringToFront(activeDeviceIds.value[activeDeviceIds.value.length - 1])
    }
  } else {
    minimizedIds.value = [...activeDeviceIds.value]
  }
}

// 关闭单台设备
function closeDevice(id) {
  const idx = minimizedIds.value.indexOf(id)
  if (idx > -1) minimizedIds.value.splice(idx, 1)
  delete windowStates[id]
  deviceStore.closeDevice(id)
}

// 全部关闭
function closeAllDevices() {
  minimizedIds.value = []
  deviceStore.closeAllDevices()
}

// --- 快捷布局整理算法 ---
// 1. 阶梯排列 (Cascade)
function arrangeCascade() {
  minimizedIds.value = []
  const list = activeDeviceIds.value
  const defaultW = 380
  const defaultH = Math.min(660, window.innerHeight - 100)

  list.forEach((id, idx) => {
    const ws = getOrCreateWindowState(id)
    ws.w = defaultW
    ws.h = defaultH
    ws.x = 60 + idx * 40
    ws.y = 70 + idx * 36
    ws.zIndex = ++topZIndex
  })
  if (list.length > 0) {
    bringToFront(list[list.length - 1])
  }
}

// 2. 左右并排排列 (Side-by-Side Tile)
function arrangeSideBySide() {
  minimizedIds.value = []
  const list = activeDeviceIds.value
  const count = list.length
  if (count === 0) return

  const availableW = window.innerWidth - 60
  const availableH = window.innerHeight - 120
  const targetW = Math.max(280, Math.min(420, Math.floor(availableW / count) - 16))
  const targetH = Math.min(availableH, Math.round(targetW / (9 / 16)) + 38)

  list.forEach((id, idx) => {
    const ws = getOrCreateWindowState(id)
    ws.w = targetW
    ws.h = targetH
    ws.x = 30 + idx * (targetW + 16)
    ws.y = 80
    ws.zIndex = ++topZIndex
  })
}
</script>

<style scoped>
.floating-window-manager-root {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
  overflow: hidden;
}

.floating-window-manager-root > :deep(.floating-device-window) {
  pointer-events: auto;
}

/* 底部任务托盘与快捷整理栏 */
.floating-dock-bar {
  position: fixed;
  bottom: 20px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 30px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 16px rgba(56, 189, 248, 0.1);
  pointer-events: auto;
  z-index: 9999;
  user-select: none;
  animation: slideUpFade 0.25s ease-out;
}

@keyframes slideUpFade {
  from { transform: translateY(12px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* 最小化胶囊列表 */
.minimized-capsules {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 480px;
  overflow-x: auto;
  padding: 2px 0;
}

.dock-label {
  font-size: 11px;
  color: #94a3b8;
  margin-right: 4px;
  white-space: nowrap;
}

.dock-capsule {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(30, 41, 59, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  color: #e2e8f0;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.dock-capsule:hover {
  background: rgba(56, 189, 248, 0.2);
  border-color: rgba(56, 189, 248, 0.4);
  color: #38bdf8;
  transform: translateY(-1px);
}

.capsule-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 6px #38bdf8;
}

.capsule-text {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 多机整理工具栏 */
.dock-arrange-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 8px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.arrange-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  color: #cbd5e1;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.arrange-tool-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
}

.arrange-tool-btn.close-all-tool:hover {
  background: rgba(248, 81, 73, 0.2);
  border-color: rgba(248, 81, 73, 0.4);
  color: #f85149;
}

.tool-svg {
  width: 13px;
  height: 13px;
}

@media (max-width: 1024px) {
  .floating-dock-bar {
    bottom: 12px;
    right: 12px;
    left: 12px;
    justify-content: space-between;
    border-radius: 16px;
  }
}
</style>
