<template>
  <div class="app-container" :class="{ 'is-resizing': isResizing }">
    <!-- 1. 全局侧边导航 (仅PC显示) -->
    <nav class="side-nav" v-if="!isMobile">
      <div class="nav-brand">📱</div>
      <div class="nav-links">
        <router-link to="/" class="nav-item" :class="{ active: $route.path === '/' || $route.path.startsWith('/device') }">🖥️</router-link>
        <router-link to="/deploy" class="nav-item" :class="{ active: $route.path === '/deploy' }">🚀</router-link>
      </div>
    </nav>

    <!-- 2. 主内容区域 -->
    <main class="main-content">
      <header class="top-bar" v-if="!isMobile">
        <h1 class="page-title">云虚机矩阵</h1>
        <div class="global-status">系统实时同步中</div>
      </header>
      
      <section class="viewport">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="$route.fullPath" />
          </transition>
        </router-view>
      </section>
    </main>

    <!-- 3. 右侧控制面板 (支持悬浮和拉伸) -->
    <aside 
      class="control-panel-wrapper" 
      :class="{ 
        'is-open': !!deviceStore.activeDeviceId,
        'is-floating': isFloating && !isMobile,
        'is-mobile': isMobile
      }"
      :style="panelStyle"
    >
      <!-- 调整大小的手柄 (PC固定模式) -->
      <div class="side-resizer" v-if="!isFloating && !isMobile" @mousedown="startResizing('left', $event)"></div>
      
      <!-- 悬浮模式的缩放手柄 -->
      <template v-if="isFloating && !isMobile">
        <div class="resize-handle top" @mousedown="startResizing('top', $event)"></div>
        <div class="resize-handle bottom" @mousedown="startResizing('bottom', $event)"></div>
        <div class="resize-handle left" @mousedown="startResizing('left', $event)"></div>
        <div class="resize-handle right" @mousedown="startResizing('right', $event)"></div>
        <div class="resize-corner br" @mousedown="startResizing('br', $event)"></div>
      </template>

      <!-- 面板内容区 -->
      <div class="panel-inner" v-if="deviceStore.activeDeviceId">
        <!-- 仅在 PC 端显示的头部 -->
        <header class="panel-top-bar" v-if="!isMobile" @mousedown="startDragging">
          <div class="vm-info">
            <span class="status-dot online"></span>
            <span class="vm-id">{{ deviceStore.activeDeviceId }}</span>
          </div>
          <div class="panel-tools" @mousedown.stop @click.stop>
            <button class="tool-btn" @click="toggleFloating" :title="isFloating ? '固定' : '悬浮'">
              {{ isFloating ? '📌' : '☁️' }}
            </button>
            <button class="tool-btn close" @click="closePanel">✕</button>
          </div>
        </header>

        <div class="panel-main">
           <!-- 渲染 DeviceClient -->
           <router-view name="panel" :deviceId="deviceStore.activeDeviceId" @recommend-layout="handleRecommendLayout" />
        </div>
      </div>

      <div class="panel-empty" v-else>
        <div class="hint-icon">👈</div>
        <p>在左侧选择虚机<br/>开启远程控制</p>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDeviceStore } from '@/stores/devices'

const route = useRoute()
const router = useRouter()
const deviceStore = useDeviceStore()

const isMobile = ref(window.innerWidth <= 1024)
const isFloating = ref(false)
const isResizing = ref(false)
const userAdjusted = ref(false)

const floatPos = ref({ x: 100, y: 100 })
const floatSize = ref({ w: 600, h: 800 })
const sideWidth = ref(420)

// 动态样式计算
const panelStyle = computed(() => {
  if (isMobile.value) return {}
  // 面板关闭时不设置宽度
  if (!deviceStore.activeDeviceId) return { width: '0px' }
  if (isFloating.value) {
    return {
      position: 'fixed',
      left: `${floatPos.value.x}px`,
      top: `${floatPos.value.y}px`,
      width: `${floatSize.value.w}px`,
      height: `${floatSize.value.h}px`,
      transform: 'none'
    }
  }
  return { width: `${sideWidth.value}px` }
})

// 处理子组件建议的布局
function handleRecommendLayout({ isLandscape, ratio }) {
  if (isMobile.value || userAdjusted.value) return
  
  if (isFloating.value) {
    const targetW = isLandscape ? Math.min(window.innerWidth * 0.7, 900) : 500
    const targetH = targetW / ratio
    floatSize.value = { w: targetW, h: Math.min(targetH, window.innerHeight * 0.85) }
  } else {
    if (isLandscape) {
      sideWidth.value = Math.min(window.innerWidth * 0.7, window.innerHeight * ratio + 40)
    } else {
      sideWidth.value = 420
    }
  }
}

function toggleFloating() {
  if (!isFloating.value) {
    floatPos.value = { x: window.innerWidth - floatSize.value.w - 40, y: 80 }
  }
  isFloating.value = !isFloating.value
}

// 拖拽逻辑
let dragOffset = { x: 0, y: 0 }
function startDragging(e) {
  if (!isFloating.value || isMobile.value) return
  isResizing.value = true
  dragOffset = { x: e.clientX - floatPos.value.x, y: e.clientY - floatPos.value.y }
  const onMove = (ev) => {
    floatPos.value.x = ev.clientX - dragOffset.x
    floatPos.value.y = ev.clientY - dragOffset.y
  }
  const onUp = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
}

// 缩放逻辑
function startResizing(type, e) {
  e.preventDefault(); e.stopPropagation()
  isResizing.value = true; userAdjusted.value = true
  const initial = { 
    x: floatPos.value.x, y: floatPos.value.y, 
    w: floatSize.value.w, h: floatSize.value.h, 
    sw: sideWidth.value, px: e.clientX, py: e.clientY 
  }
  const onMove = (ev) => {
    const dx = ev.clientX - initial.px, dy = ev.clientY - initial.py
    if (!isFloating.value) {
      const newWidth = initial.sw - dx
      if (newWidth > 300 && newWidth < window.innerWidth * 0.9) sideWidth.value = newWidth
      return
    }
    if (type.includes('right')) floatSize.value.w = Math.max(300, initial.w + dx)
    if (type.includes('left')) { const newW = initial.w - dx; if (newW > 300) { floatSize.value.w = newW; floatPos.value.x = initial.x + dx } }
    if (type.includes('bottom')) floatSize.value.h = Math.max(300, initial.h + dy)
    if (type.includes('top')) { const newH = initial.h - dy; if (newH > 300) { floatSize.value.h = newH; floatPos.value.y = initial.y + dy } }
  }
  const onUp = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
}

const updateMedia = () => {
  isMobile.value = window.innerWidth <= 1024
  if (isMobile.value) isFloating.value = false
}

onMounted(() => {
  deviceStore.fetchDevices(); deviceStore.initSignaling()
  window.addEventListener('resize', updateMedia)
  if (route.params.deviceId) deviceStore.setActiveDevice(route.params.deviceId)
})
onUnmounted(() => window.removeEventListener('resize', updateMedia))

watch(() => route.params.deviceId, (newId) => {
  if (newId) deviceStore.setActiveDevice(newId)
  else { deviceStore.clearActiveDevice(); isFloating.value = false; userAdjusted.value = false }
})

function closePanel() {
  deviceStore.clearActiveDevice()
  router.push('/')
}
</script>

<style>
:root { --nav-width: 64px; --bg-primary: #0d1117; --bg-secondary: #161b22; --border: #30363d; --accent: #58a6ff; }
body { margin: 0; background: var(--bg-primary); color: #c9d1d9; font-family: -apple-system, sans-serif; overflow: hidden; }

.app-container { display: flex; height: 100vh; width: 100vw; position: relative; }
.is-resizing * { transition: none !important; user-select: none !important; }

.side-nav { 
  width: var(--nav-width); 
  background: var(--bg-secondary); 
  border-right: 1px solid var(--border); 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  padding: 20px 0; 
  flex-shrink: 0; 
  box-sizing: border-box;
}
.nav-brand { 
  font-size: 24px; 
  margin-bottom: 40px; 
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-links { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  width: 100%;
}
.nav-item { 
  font-size: 20px; 
  padding: 10px; 
  border-radius: 12px; 
  margin-bottom: 20px; 
  opacity: 0.5; 
  text-decoration: none; 
  color: inherit; 
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-item.active { opacity: 1; color: var(--accent); background: rgba(88,166,255,0.1); }

.main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.top-bar { height: 60px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); }
.page-title { font-size: 16px; font-weight: 600; color: #e6edf3; }
.global-status { color: #888; font-size: 13px; }
.viewport { flex: 1; overflow-y: auto; padding: 12px; }

/* 侧边面板容器 */
.control-panel-wrapper {
  height: 100vh; background: var(--bg-secondary); border-left: 1px solid var(--border);
  display: flex; flex-direction: column; position: absolute; right: 0; top: 0; z-index: 200;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), width 0.2s ease;
  transform: translateX(100%); /* 初始在屏幕右侧隐藏 */
  width: 0; /* 关闭时宽度为0 */
  overflow: hidden;
}
.control-panel-wrapper.is-open { 
  transform: translateX(0); 
  /* 宽度由panelStyle控制 */
}

/* 悬浮模式 */
.control-panel-wrapper.is-floating {
  position: fixed; border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 30px 60px rgba(0,0,0,0.6); z-index: 1000; transform: none; transition: none;
}

/* 缩放手柄 */
.side-resizer { position: absolute; left: -4px; top: 0; bottom: 0; width: 8px; cursor: col-resize; z-index: 100; }
.resize-handle { position: absolute; z-index: 100; }
.resize-handle.top { top: -5px; left: 0; right: 0; height: 10px; cursor: ns-resize; }
.resize-handle.bottom { bottom: -5px; left: 0; right: 0; height: 10px; cursor: ns-resize; }
.resize-handle.left { left: -5px; top: 0; bottom: 0; width: 10px; cursor: ew-resize; }
.resize-handle.right { right: -5px; top: 0; bottom: 0; width: 10px; cursor: ew-resize; }
.resize-corner.br { position: absolute; right: -5px; bottom: -5px; width: 20px; height: 20px; cursor: nwse-resize; z-index: 101; }

.panel-inner { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-secondary); border-radius: 12px; }
.panel-top-bar { height: 50px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); cursor: grab; }
.vm-info { display: flex; align-items: center; gap: 8px; pointer-events: none; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
.vm-id { font-weight: 600; font-size: 14px; }
.tool-btn { background: none; border: none; color: #888; cursor: pointer; padding: 6px; border-radius: 4px; font-size: 16px; }
.tool-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
.tool-btn.close:hover { color: #f85149; }

.panel-main { flex: 1; overflow: hidden; background: #000; }

.panel-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #888; text-align: center; opacity: 0.3; }
.hint-icon { font-size: 48px; margin-bottom: 16px; }

/* 移动端适配 */
@media (max-width: 1024px) {
  .control-panel-wrapper.is-mobile { position: fixed; inset: 0; width: 100vw !important; height: 100vh !important; transform: translateX(100%); z-index: 2000; border: none; }
  .control-panel-wrapper.is-mobile.is-open { transform: translateX(0); }
  .panel-inner { border-radius: 0; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>