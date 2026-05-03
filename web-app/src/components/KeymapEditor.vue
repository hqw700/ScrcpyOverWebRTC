<template>
  <div class="keymap-editor" :class="{ 'is-editing': keymapStore.isEditMode }" v-if="keymapStore.isEditMode || keymapStore.showKeyHints" @mousedown="keymapStore.isEditMode && onBgMouseDown()" @touchstart.prevent="keymapStore.isEditMode && onBgTouchStart()">
    <!-- 顶部工具栏 (仅编辑模式) -->
    <div class="editor-toolbar" v-if="keymapStore.isEditMode" @mousedown.stop @touchstart.stop>
      <div class="toolbar-header">
        <div class="profile-selector">
          <select v-model="keymapStore.config.activeProfileId" @change="onProfileChange" class="profile-select">
            <option v-for="p in keymapStore.config.profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <button class="icon-btn" title="重命名配置" @click="renameCurrentProfile"><svg class="icon" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
          <button class="icon-btn" title="新建配置" @click="createNewProfile"><svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
          <div class="divider-v"></div>
          <button class="icon-btn" title="导出配置" @click="exportProfile"><svg class="icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button>
          <button class="icon-btn" title="导入配置" @click="importProfile"><svg class="icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg></button>
          <button class="icon-btn danger" title="删除配置" @click="deleteCurrentProfile" v-if="keymapStore.config.profiles.length > 1"><svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
        </div>
        <label class="hint-toggle">
          <input type="checkbox" v-model="keymapStore.showKeyHints" /> 显示提示
        </label>
      </div>
      <div class="toolbar-body">
        <div class="toolbar-tools">
          <button class="tool-btn" @click="addTap"><svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>点击键</button>
          <button class="tool-btn" @click="addSwipe"><svg class="icon" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>滑动键</button>
          <button class="tool-btn" @click="addJoystick"><svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8M8 12h8"></path></svg>虚拟摇杆</button>
        </div>
        <div class="toolbar-actions">
          <button class="action-btn cancel" @click="cancelEdit">取消</button>
          <button class="action-btn save" @click="saveEdit">保存配置</button>
        </div>
      </div>
    </div>

    <!-- 映射层 -->
    <div class="keymap-overlay" ref="overlayRef">
      <!-- 渲染黑边遮罩，直观展示有效区域 -->
      <div v-if="keymapStore.isEditMode && videoRect && overlayRect" class="video-area-indicator" :style="videoAreaStyle"></div>

      <!-- SVG 连线层 (滑动轨迹) -->
      <svg class="swipe-lines-svg" v-if="videoRect && overlayRect">
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.7)" />
          </marker>
        </defs>
        <template v-for="map in displayMappings" :key="map.id + '_line'">
          <line v-if="map.type === 'swipe'"
                :x1="getPosPixel(map.startPos).x"
                :y1="getPosPixel(map.startPos).y"
                :x2="getPosPixel(map.endPos).x"
                :y2="getPosPixel(map.endPos).y"
                stroke="rgba(255, 255, 255, 0.6)"
                stroke-width="3"
                stroke-dasharray="5,5"
                marker-end="url(#arrowhead)" />
        </template>
      </svg>

      <!-- 渲染节点 -->
      <template v-for="map in displayMappings" :key="map.id">
        <!-- Tap / Joystick / Swipe Start -->
        <div v-show="['tap', 'joystick', 'swipe'].includes(map.type)"
             class="key-node"
             :class="{'is-selected': keymapStore.isEditMode && selectedId === map.id, 'is-joystick': map.type === 'joystick', 'is-hint': !keymapStore.isEditMode, 'is-swipe': map.type === 'swipe'}"
             :style="getNodeStyle(map, 'start')"
             @mousedown.stop.prevent="keymapStore.isEditMode && onNodeMouseDown($event, map, 'start')"
             @touchstart.stop.prevent="keymapStore.isEditMode && onNodeTouchStart($event, map, 'start')">
          
          <div class="key-label" v-if="map.type === 'tap' || map.type === 'swipe'">{{ map.key ? map.key.toUpperCase() : '?' }}</div>
          <div class="joy-label" v-if="map.type === 'joystick'">WASD</div>
          
          <!-- 删除按钮 -->
          <button v-if="keymapStore.isEditMode && selectedId === map.id" class="delete-btn" @mousedown.stop.prevent="deleteMapping(map.id)" @touchstart.stop.prevent="deleteMapping(map.id)">×</button>

          <!-- 摇杆范围指示器 -->
          <div v-if="map.type === 'joystick' && (keymapStore.isEditMode || keymapStore.showKeyHints)" class="joystick-radius" :style="getJoystickRadiusStyle(map)"></div>
        </div>

        <!-- Swipe End Node -->
        <div v-if="map.type === 'swipe'"
             class="key-node swipe-end-node"
             :class="{'is-selected': keymapStore.isEditMode && selectedId === map.id, 'is-hint': !keymapStore.isEditMode}"
             :style="getNodeStyle(map, 'end')"
             @mousedown.stop.prevent="keymapStore.isEditMode && onNodeMouseDown($event, map, 'end')"
             @touchstart.stop.prevent="keymapStore.isEditMode && onNodeTouchStart($event, map, 'end')">
             <div class="swipe-end-label">终</div>
        </div>
      </template>
    </div>

    <!-- 节点设置面板 (仅编辑模式) -->
    <div v-if="keymapStore.isEditMode && selectedNode" class="node-settings" @mousedown.stop @touchstart.stop>
      <div class="settings-header">
        <h4>{{ selectedNode.type === 'joystick' ? '摇杆设置' : (selectedNode.type === 'swipe' ? '滑动设置' : '按键设置') }}</h4>
        <button class="close-settings-btn" @click="selectedId = null">✕</button>
      </div>
      <div class="setting-item" v-if="selectedNode.type === 'tap' || selectedNode.type === 'swipe'">
        <label>绑定按键:</label>
        <input type="text" class="key-input" :value="selectedNode.key" @keydown.prevent="onKeyBind" placeholder="请按键" readonly />
      </div>
      <div class="setting-item" v-if="selectedNode.type === 'swipe'">
        <label>滑动耗时:</label>
        <input type="number" class="key-input" v-model.number="selectedNode.duration" min="50" max="2000" step="50" @input="updateNode" style="max-width: 60px;" />
        <span style="color:#aaa; font-size:12px;">ms</span>
      </div>
      <div class="setting-item" v-if="selectedNode.type === 'joystick'">
        <label>摇杆大小:</label>
        <input type="range" v-model.number="selectedNode.radius" min="0.05" max="0.3" step="0.01" @input="updateNode" />
      </div>
      <p class="setting-tip" v-if="selectedNode.type === 'tap' || selectedNode.type === 'swipe'">选中上方输入框后，按键盘任意键进行绑定</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useKeymapStore } from '@/stores/keymap'

const props = defineProps({
  videoElement: {
    type: HTMLVideoElement,
    default: null
  }
})

const keymapStore = useKeymapStore()
const overlayRef = ref(null)

// 拷贝一份当前配置的 mappings 用于编辑
const editableMappings = ref([])
const selectedId = ref(null)

const displayMappings = computed(() => {
  return keymapStore.isEditMode ? editableMappings.value : (keymapStore.activeProfile?.mappings || [])
})

const selectedNode = computed(() => {
  return editableMappings.value.find(m => m.id === selectedId.value) || null
})

// 视频实际渲染区域 (相对于 viewport)
const videoRect = ref(null)
// Overlay 层区域 (相对于 viewport)
const overlayRect = ref(null)

let updateTimer = null

watch(() => keymapStore.isEditMode, (newVal) => {
  if (newVal) {
    const profile = keymapStore.activeProfile
    editableMappings.value = JSON.parse(JSON.stringify(profile.mappings || []))
    selectedId.value = null
  }
})

watch([() => keymapStore.isEditMode, () => keymapStore.showKeyHints], ([isEdit, showHints]) => {
  if (isEdit || showHints) {
    startRectUpdate()
  } else {
    stopRectUpdate()
  }
}, { immediate: true })

function startRectUpdate() {
  if (updateTimer) return
  updateRects()
  updateTimer = setInterval(updateRects, 500)
  window.addEventListener('resize', updateRects)
}

function stopRectUpdate() {
  if (updateTimer) {
    clearInterval(updateTimer)
    updateTimer = null
  }
  window.removeEventListener('resize', updateRects)
}

onMounted(() => {
  if (keymapStore.isEditMode || keymapStore.showKeyHints) startRectUpdate()
})

onUnmounted(() => {
  stopRectUpdate()
})

function updateRects() {
  if (!props.videoElement || !overlayRef.value) return
  
  const video = props.videoElement
  const rect = video.getBoundingClientRect()
  const videoW = video.videoWidth
  const videoH = video.videoHeight
  if (!videoW || !videoH) return

  const videoRatio = videoW / videoH
  const clientRatio = rect.width / rect.height

  let actualW, actualH, offsetX, offsetY
  if (clientRatio > videoRatio) {
    actualH = rect.height
    actualW = rect.height * videoRatio
    offsetX = (rect.width - actualW) / 2
    offsetY = 0
  } else {
    actualW = rect.width
    actualH = rect.width / videoRatio
    offsetX = 0
    offsetY = (rect.height - actualH) / 2
  }
  
  videoRect.value = {
    left: rect.left + offsetX,
    top: rect.top + offsetY,
    width: actualW,
    height: actualH
  }
  
  overlayRect.value = overlayRef.value.getBoundingClientRect()
}

const videoAreaStyle = computed(() => {
  if (!videoRect.value || !overlayRect.value) return {}
  return {
    left: (videoRect.value.left - overlayRect.value.left) + 'px',
    top: (videoRect.value.top - overlayRect.value.top) + 'px',
    width: videoRect.value.width + 'px',
    height: videoRect.value.height + 'px'
  }
})

function clientToNormalized(clientX, clientY) {
  if (!videoRect.value) return { x: 0.5, y: 0.5 }
  const v = videoRect.value
  let x = (clientX - v.left) / v.width
  let y = (clientY - v.top) / v.height
  x = Math.max(0, Math.min(1, x))
  y = Math.max(0, Math.min(1, y))
  return { x, y }
}

function getPosPixel(pos) {
  if (!videoRect.value || !overlayRect.value) return { x: 0, y: 0 }
  const v = videoRect.value
  const o = overlayRect.value
  return {
    x: v.left + pos.x * v.width - o.left,
    y: v.top + pos.y * v.height - o.top
  }
}

function getNodeStyle(map, type = null) {
  if (!videoRect.value || !overlayRect.value) return { display: 'none' }
  let pos;
  if (map.type === 'joystick') pos = map.center;
  else if (map.type === 'swipe') pos = type === 'end' ? map.endPos : map.startPos;
  else pos = map.pos;
  
  const v = videoRect.value
  const o = overlayRect.value
  
  const clientX = v.left + pos.x * v.width
  const clientY = v.top + pos.y * v.height
  
  return {
    left: (clientX - o.left) + 'px',
    top: (clientY - o.top) + 'px'
  }
}

function getJoystickRadiusStyle(map) {
  if (!videoRect.value) return {}
  const radiusPx = map.radius * videoRect.value.width
  return {
    width: (radiusPx * 2) + 'px',
    height: (radiusPx * 2) + 'px',
    left: (-radiusPx + 30) + 'px', // 30 is half of node size (60/2)
    top: (-radiusPx + 30) + 'px'
  }
}

// 交互逻辑

function onProfileChange() {
  keymapStore.save()
  const profile = keymapStore.activeProfile
  editableMappings.value = JSON.parse(JSON.stringify(profile.mappings || []))
  selectedId.value = null
}

function createNewProfile() {
  const name = prompt('请输入新配置名称：', '新配置')
  if (name) {
    keymapStore.addProfile(name)
    onProfileChange()
  }
}

function renameCurrentProfile() {
  const profile = keymapStore.activeProfile
  if (!profile) return
  const newName = prompt('重命名配置：', profile.name)
  if (newName && newName !== profile.name) {
    keymapStore.renameProfile(profile.id, newName)
  }
}

function deleteCurrentProfile() {
  if (keymapStore.config.profiles.length <= 1) return
  if (confirm('确定要删除当前配置吗？此操作无法撤销。')) {
    keymapStore.deleteProfile(keymapStore.activeProfile.id)
    onProfileChange()
  }
}

function exportProfile() {
  const profile = keymapStore.activeProfile
  if (!profile) return
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profile, null, 2))
  const downloadAnchorNode = document.createElement('a')
  downloadAnchorNode.setAttribute("href", dataStr)
  downloadAnchorNode.setAttribute("download", `cloudphone_keymap_${profile.name}.json`)
  document.body.appendChild(downloadAnchorNode)
  downloadAnchorNode.click()
  downloadAnchorNode.remove()
}

function importProfile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = e => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const importedProfile = JSON.parse(event.target.result)
        if (importedProfile && Array.isArray(importedProfile.mappings)) {
          // 防止 ID 冲突
          importedProfile.id = 'p_' + Date.now()
          keymapStore.importProfile(importedProfile)
          onProfileChange()
          alert('导入成功！')
        } else {
          alert('无效的配置文件格式！')
        }
      } catch (err) {
        alert('读取配置文件失败！')
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

function addTap() {
  editableMappings.value.push({
    id: 'm_' + Date.now(),
    type: 'tap',
    key: '',
    pos: { x: 0.5, y: 0.5 }
  })
  selectedId.value = editableMappings.value[editableMappings.value.length - 1].id
}

function addSwipe() {
  editableMappings.value.push({
    id: 'm_' + Date.now(),
    type: 'swipe',
    key: '',
    startPos: { x: 0.4, y: 0.5 },
    endPos: { x: 0.6, y: 0.5 },
    duration: 150
  })
  selectedId.value = editableMappings.value[editableMappings.value.length - 1].id
}

function addJoystick() {
  if (editableMappings.value.find(m => m.type === 'joystick')) {
    alert('目前仅支持一个摇杆')
    return
  }
  editableMappings.value.push({
    id: 'm_' + Date.now(),
    type: 'joystick',
    keys: { up: 'w', down: 's', left: 'a', right: 'd' },
    center: { x: 0.2, y: 0.75 },
    radius: 0.1
  })
  selectedId.value = editableMappings.value[editableMappings.value.length - 1].id
}

function deleteMapping(id) {
  editableMappings.value = editableMappings.value.filter(m => m.id !== id)
  if (selectedId.value === id) selectedId.value = null
}

function updateNode() {
  // 触发响应式更新
  editableMappings.value = [...editableMappings.value]
}

function onKeyBind(e) {
  const node = selectedNode.value
  if (!node || (node.type !== 'tap' && node.type !== 'swipe')) return
  // 过滤一些无用按键
  if (['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock'].includes(e.key)) return
  node.key = e.key.toLowerCase()
  updateNode()
  e.target.blur() // 绑定完取消焦点
}

function onBgMouseDown() {
  selectedId.value = null
}
function onBgTouchStart() {
  selectedId.value = null
}

// 拖拽逻辑
let draggingMap = null
let draggingTarget = null

function onNodeMouseDown(e, map, target = null) {
  selectedId.value = map.id
  draggingMap = map
  draggingTarget = target
  document.addEventListener('mousemove', onNodeMove)
  document.addEventListener('mouseup', onNodeEnd)
}

function onNodeTouchStart(e, map, target = null) {
  selectedId.value = map.id
  draggingMap = map
  draggingTarget = target
  document.addEventListener('touchmove', onNodeTouchMove, { passive: false })
  document.addEventListener('touchend', onNodeEnd)
}

function updateDragging(clientX, clientY) {
  if (!draggingMap) return
  const norm = clientToNormalized(clientX, clientY)
  if (draggingMap.type === 'joystick') {
    draggingMap.center = norm
  } else if (draggingMap.type === 'swipe') {
    if (draggingTarget === 'start') draggingMap.startPos = norm
    else if (draggingTarget === 'end') draggingMap.endPos = norm
  } else {
    draggingMap.pos = norm
  }
  updateNode()
}

function onNodeMove(e) {
  updateDragging(e.clientX, e.clientY)
}

function onNodeTouchMove(e) {
  e.preventDefault()
  const touch = e.touches[0]
  updateDragging(touch.clientX, touch.clientY)
}

function onNodeEnd() {
  draggingMap = null
  draggingTarget = null
  document.removeEventListener('mousemove', onNodeMove)
  document.removeEventListener('mouseup', onNodeEnd)
  document.removeEventListener('touchmove', onNodeTouchMove)
  document.removeEventListener('touchend', onNodeEnd)
}

function cancelEdit() {
  keymapStore.setEditMode(false)
}

function saveEdit() {
  const profile = keymapStore.activeProfile
  profile.mappings = editableMappings.value
  keymapStore.updateProfile(profile)
  keymapStore.setEditMode(false)
}
</script>

<style scoped>
.keymap-editor {
  position: absolute;
  inset: 0;
  z-index: 1000;
  pointer-events: none; /* 提示模式下不阻挡点击 */
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.keymap-editor.is-editing {
  background: rgba(0, 0, 0, 0.4);
  pointer-events: auto; /* 编辑模式下阻挡点击 */
}

/* 优化后的顶部工具栏 */
.editor-toolbar {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(25, 25, 25, 0.95);
  backdrop-filter: blur(12px);
  padding: 16px 20px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 12px 40px rgba(0,0,0,0.6);
  z-index: 1001;
  min-width: 320px;
}

.toolbar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 12px;
}

.profile-selector {
  display: flex;
  align-items: center;
  gap: 6px;
}

.profile-select {
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  cursor: pointer;
  max-width: 140px;
}

.divider-v {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 4px;
}

.icon-btn {
  background: transparent;
  border: none;
  color: #ccc;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.icon-btn .icon {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.icon-btn.danger:hover {
  background: rgba(220, 53, 69, 0.2);
  color: #ff4d4f;
}

.toolbar-title {
  color: #fff;
  font-weight: 600;
  font-size: 15px;
}

.hint-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #aaa;
  font-size: 12px;
  cursor: pointer;
}
.hint-toggle input {
  cursor: pointer;
}

.toolbar-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.toolbar-tools {
  display: flex;
  gap: 8px;
}

.tool-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #ddd;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}
.tool-btn .icon {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
}
.tool-btn:hover {
  background: rgba(255,255,255,0.15);
  color: #fff;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}
.action-btn {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.action-btn.cancel {
  background: transparent;
  color: #ccc;
}
.action-btn.cancel:hover { color: #fff; }
.action-btn.save {
  background: var(--accent, #007bff);
  color: white;
}
.action-btn.save:hover { filter: brightness(1.1); }

.keymap-overlay {
  position: absolute;
  inset: 0;
  z-index: 1000;
}

/* 视频实际区域指示器 (虚线框) */
.video-area-indicator {
  position: absolute;
  border: 2px dashed rgba(255, 255, 255, 0.3);
  pointer-events: none;
}

.swipe-lines-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 999;
}

.key-node {
  position: absolute;
  width: 60px;
  height: 60px;
  margin-left: -30px;
  margin-top: -30px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: move;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  user-select: none;
  touch-action: none;
  transition: opacity 0.2s, background 0.2s;
}

.key-node.swipe-end-node {
  width: 40px;
  height: 40px;
  margin-left: -20px;
  margin-top: -20px;
  background: rgba(255, 100, 100, 0.2);
  border-color: rgba(255, 100, 100, 0.8);
}
.swipe-end-label {
  color: #fff;
  font-size: 14px;
  font-weight: bold;
}

.key-node.is-joystick {
  background: rgba(100, 200, 255, 0.2);
  border-color: rgba(100, 200, 255, 0.8);
}

.key-node.is-selected {
  background: rgba(255, 200, 0, 0.4);
  border-color: #ffc107;
  z-index: 10;
}

/* 提示模式样式 */
.key-node.is-hint {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: none;
  pointer-events: none; /* 提示模式下不阻挡底层视频点击 */
  cursor: default;
}
.key-node.is-hint .key-label {
  font-size: 18px;
  opacity: 0.6;
}
.key-node.is-hint .joy-label {
  font-size: 12px;
  opacity: 0.6;
}
.key-node.is-hint.is-joystick {
  background: rgba(100, 200, 255, 0.1);
  border: 1px solid rgba(100, 200, 255, 0.2);
}

.key-label {
  color: #fff;
  font-size: 24px;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(0,0,0,0.8);
}

.joy-label {
  color: #fff;
  font-size: 14px;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(0,0,0,0.8);
}

.delete-btn {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #dc3545;
  color: white;
  border: 2px solid #fff;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 11;
  padding: 0;
  line-height: 1;
}

.joystick-radius {
  position: absolute;
  border: 2px dashed rgba(100, 200, 255, 0.4);
  border-radius: 50%;
  pointer-events: none;
}

.node-settings {
  position: absolute;
  right: 24px;
  top: 80px;
  width: 200px;
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 12px 16px;
  z-index: 1002;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.node-settings h4 {
  margin: 0;
  color: #fff;
  font-size: 14px;
}

.close-settings-btn {
  background: transparent;
  border: none;
  color: #aaa;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
}
.close-settings-btn:hover {
  color: #fff;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.setting-item label {
  color: #aaa;
  font-size: 12px;
  white-space: nowrap;
}

.key-input {
  flex: 1;
  background: rgba(0,0,0,0.5);
  border: 1px solid #444;
  color: #fff;
  padding: 6px;
  border-radius: 6px;
  text-align: center;
  font-size: 14px;
  font-weight: bold;
  outline: none;
  cursor: pointer;
  text-transform: uppercase;
  max-width: 80px;
}
.key-input:focus {
  border-color: var(--accent, #007bff);
  box-shadow: 0 0 0 2px rgba(0,123,255,0.3);
}

.setting-tip {
  margin: 0;
  font-size: 11px;
  color: #888;
  text-align: center;
}
</style>