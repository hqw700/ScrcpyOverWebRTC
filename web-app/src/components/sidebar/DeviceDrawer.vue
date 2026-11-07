<template>
  <aside
    class="device-drawer"
    :class="{
      'is-pinned': isPinned,
      'is-floating': !isPinned,
      'nav-expanded': navExpanded
    }"
    ref="drawerRef"
    @click.stop
  >
    <!-- 轻量级操作提示 Toast -->
    <transition name="drawer-toast-fade">
      <div v-if="toastMsg" class="drawer-toast">
        {{ toastMsg }}
      </div>
    </transition>

    <!-- 1. 抽屉头部 -->
    <div class="drawer-header">
      <div class="drawer-title-row">
        <div class="drawer-title-group">
          <svg class="drawer-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <line x1="12" y1="18" x2="12.01" y2="18"></line>
          </svg>
          <span class="drawer-title-text">{{ $t('deviceDrawer.title') }}</span>
          <span class="drawer-count-badge" :title="$t('deviceDrawer.tabAll')">{{ totalCount }}</span>
        </div>

        <div class="drawer-header-actions">
          <!-- 固定/取消固定 -->
          <button
            class="drawer-icon-btn pin-btn"
            :class="{ active: isPinned }"
            @click="$emit('toggle-pin')"
            :title="isPinned ? $t('deviceDrawer.unpinTip') : $t('deviceDrawer.pinTip')"
          >
            <svg class="pin-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="17" x2="12" y2="22"></line>
              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"></path>
            </svg>
          </button>
          <!-- 关闭 -->
          <button
            class="drawer-icon-btn close-btn"
            @click="$emit('close')"
            :title="$t('common.close')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- 2. 搜索框 -->
      <div class="drawer-search-wrap">
        <svg class="search-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          class="drawer-search-input"
          :placeholder="$t('deviceDrawer.searchPlaceholder')"
          @keydown.esc="searchQuery = ''"
        />
        <button v-if="searchQuery" class="search-clear-btn" @click="searchQuery = ''" title="Clear">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- 3. 状态过滤 Tabs -->
      <div class="drawer-filter-tabs">
        <button
          v-for="tab in filterTabs"
          :key="tab.key"
          class="filter-tab-btn"
          :class="{ active: currentTab === tab.key }"
          @click="currentTab = tab.key"
        >
          <span class="tab-label">{{ tab.label }}</span>
          <span class="tab-badge" :class="tab.key">{{ tab.count }}</span>
        </button>
      </div>
    </div>

    <!-- 4. 设备列表 -->
    <div class="drawer-list-wrap custom-scrollbar">
      <div v-if="filteredDevices.length > 0" class="drawer-device-list">
        <div
          v-for="dev in filteredDevices"
          :key="dev.id"
          class="drawer-device-item"
          :class="{
            'is-active-control': isDeviceActive(dev.id),
            'is-focused': isDeviceFocused(dev.id),
            'is-offline': dev.status !== 'online'
          }"
          @click="handleDeviceClick(dev)"
        >
          <!-- 状态指示点 -->
          <div class="item-status-col">
            <span class="device-status-dot" :class="getStatusDotClass(dev)"></span>
          </div>

          <!-- 缩略图或图标 -->
          <div class="item-thumb-col">
            <img v-if="dev.snapshot" :src="dev.snapshot" class="item-snapshot" alt="" loading="lazy" />
            <div v-else class="item-thumb-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
              </svg>
            </div>
          </div>

          <!-- 信息文本 -->
          <div class="item-info-col">
            <div class="item-name-row">
              <span class="item-name" :title="dev.displayName || dev.id">{{ dev.displayName || dev.id }}</span>
              <span v-if="isDeviceActive(dev.id)" class="item-active-pill" :title="$t('deviceDrawer.controlling')">
                {{ $t('deviceDrawer.controlling') }}
              </span>
            </div>
            <div class="item-sub-row">
              <span class="item-meta" :title="getDeviceMeta(dev)">{{ getDeviceMeta(dev) }}</span>
            </div>
          </div>

          <!-- 悬停快捷操作栏 -->
          <div class="item-actions-col" @click.stop>
            <!-- 快速直控/聚焦 -->
            <button
              class="quick-action-btn"
              :class="{ active: isDeviceActive(dev.id) }"
              :disabled="dev.status !== 'online'"
              @click.stop="quickControl(dev)"
              :title="isDeviceActive(dev.id) ? $t('deviceDrawer.focusWindow') : $t('deviceDrawer.openControl')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                <path d="M6 12h4m-2-2v4"></path>
                <circle cx="17" cy="10" r="0.8" fill="currentColor"></circle>
                <circle cx="15" cy="13" r="0.8" fill="currentColor"></circle>
              </svg>
            </button>
            <!-- 摄像头监控 -->
            <button
              class="quick-action-btn camera"
              :disabled="dev.status !== 'online'"
              @click.stop="quickCamera(dev)"
              :title="$t('deviceDrawer.cameraMonitor')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
            </button>
            <!-- 终端 (仅管理员且在线可见) -->
            <button
              v-if="authStore.isAdmin"
              class="quick-action-btn terminal"
              :disabled="dev.status !== 'online'"
              @click.stop="quickTerminal(dev)"
              :title="$t('nav.terminal')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" y1="19" x2="20" y2="19"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="drawer-empty-state">
        <div class="empty-icon-wrap">🔍</div>
        <p class="empty-text">{{ $t('deviceDrawer.noDevicesFound') }}</p>
      </div>
    </div>

    <!-- 5. 底部统计条 -->
    <div class="drawer-footer">
      <span class="footer-stat">
        <span class="stat-indicator online"></span>
        {{ $t('deviceDrawer.onlineCount', { count: onlineCount }) }}
      </span>
      <span class="footer-stat" v-if="activeCount > 0">
        <span class="stat-indicator active"></span>
        {{ $t('deviceDrawer.activeCount', { count: activeCount }) }}
      </span>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDeviceStore } from '@/stores/devices'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  isPinned: {
    type: Boolean,
    default: false
  },
  navExpanded: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close', 'toggle-pin'])

const { t } = useI18n()
const deviceStore = useDeviceStore()
const authStore = useAuthStore()

const drawerRef = ref(null)
const searchQuery = ref('')
const currentTab = ref('all') // 'all' | 'online' | 'active' | 'offline'

// Toast 提示
const toastMsg = ref('')
let toastTimer = null
function showToast(msg) {
  toastMsg.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMsg.value = ''
  }, 2200)
}

// 全部机器：在线机器与离线机器去重合并（在线优先）
const allDevices = computed(() => {
  const map = new Map()
  // 先置入在线设备
  for (const dev of deviceStore.devices) {
    map.set(dev.id, dev)
  }
  // 离线设备补齐
  for (const dev of deviceStore.offlineDevices) {
    if (!map.has(dev.id)) {
      map.set(dev.id, dev)
    }
  }
  return Array.from(map.values())
})

// 各种状态计数
const totalCount = computed(() => allDevices.value.length)
const onlineCount = computed(() => deviceStore.onlineDevices.length)
const activeCount = computed(() => deviceStore.activeDeviceIds.length)
const offlineCount = computed(() => deviceStore.offlineDevices.length)

// 过滤 Tabs
const filterTabs = computed(() => [
  { key: 'all', label: t('deviceDrawer.tabAll'), count: totalCount.value },
  { key: 'online', label: t('deviceDrawer.tabOnline'), count: onlineCount.value },
  { key: 'active', label: t('deviceDrawer.tabActive'), count: activeCount.value },
  { key: 'offline', label: t('deviceDrawer.tabOffline'), count: offlineCount.value }
])

// 过滤后的机器列表
const filteredDevices = computed(() => {
  let list = allDevices.value

  // 1. Tab 过滤
  if (currentTab.value === 'online') {
    list = list.filter(d => d.status === 'online')
  } else if (currentTab.value === 'active') {
    list = list.filter(d => deviceStore.activeDeviceIds.includes(d.id))
  } else if (currentTab.value === 'offline') {
    list = list.filter(d => d.status !== 'online')
  }

  // 2. 搜索关键词过滤
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(d => {
      const name = (d.displayName || '').toLowerCase()
      const id = (d.id || '').toLowerCase()
      const model = (d.info?.model || '').toLowerCase()
      const ip = (d.info?.ip || d.ip || '').toLowerCase()
      return name.includes(q) || id.includes(q) || model.includes(q) || ip.includes(q)
    })
  }

  return list
})

function isDeviceActive(deviceId) {
  return deviceStore.activeDeviceIds.includes(deviceId)
}

function isDeviceFocused(deviceId) {
  return deviceStore.focusedDeviceId === deviceId
}

function getStatusDotClass(dev) {
  if (isDeviceActive(dev.id)) return 'active'
  if (dev.status === 'online') return 'online'
  return 'offline'
}

function getDeviceMeta(dev) {
  const parts = []
  if (dev.info?.model) {
    parts.push(dev.info.model)
  }
  if (dev.info?.displays?.[0]) {
    const disp = dev.info.displays[0]
    parts.push(`${disp.x_res}×${disp.y_res}`)
  } else if (dev.id) {
    parts.push(dev.id.substring(0, 14))
  }
  return parts.join(' · ') || dev.id
}

// 点击设备 Item
function handleDeviceClick(dev) {
  if (dev.status !== 'online') {
    showToast(t('deviceDrawer.offlineTip'))
    return
  }

  if (isDeviceActive(dev.id)) {
    deviceStore.focusDevice(dev.id)
  } else {
    deviceStore.openDevice(dev.id)
  }
}

// 快速直控/聚焦
function quickControl(dev) {
  if (dev.status !== 'online') return
  if (isDeviceActive(dev.id)) {
    deviceStore.focusDevice(dev.id)
  } else {
    deviceStore.openDevice(dev.id)
  }
}

// 摄像头监控
function quickCamera(dev) {
  if (dev.status !== 'online') return
  deviceStore.openDeviceAsCamera(dev.id)
}

// 终端
function quickTerminal(dev) {
  if (dev.status !== 'online') return
  deviceStore.openGlobalConsole(dev.id, 'shell')
}
</script>

<style scoped>
.device-drawer {
  display: flex;
  flex-direction: column;
  background: rgba(22, 27, 34, 0.96);
  border-right: 1px solid var(--border, #30363d);
  box-sizing: border-box;
  overflow: hidden;
  user-select: none;
  transition: width 0.22s cubic-bezier(0.4, 0, 0.2, 1),
              left 0.22s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

/* 固定常驻态 (Pinned) */
.device-drawer.is-pinned {
  position: relative;
  width: 270px;
  flex-shrink: 0;
  height: 100vh;
  height: 100dvh;
  z-index: 100;
  box-shadow: none;
}

/* 悬浮滑出态 (Floating) */
.device-drawer.is-floating {
  position: fixed;
  top: 0;
  bottom: 0;
  left: var(--nav-width, 64px);
  width: 280px;
  height: 100vh;
  height: 100dvh;
  z-index: 1050;
  background: rgba(18, 22, 28, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 10px 0 36px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.device-drawer.is-floating.nav-expanded {
  left: 180px;
}

/* 轻量 Toast */
.drawer-toast {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30, 38, 48, 0.95);
  color: #f0f6fc;
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(88, 166, 255, 0.4);
  z-index: 2000;
  white-space: nowrap;
  pointer-events: none;
}

.drawer-toast-fade-enter-active,
.drawer-toast-fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.drawer-toast-fade-enter-from,
.drawer-toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}

/* 1. 头部 */
.drawer-header {
  padding: 16px 14px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(22, 27, 34, 0.5);
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

.drawer-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drawer-title-icon {
  width: 17px;
  height: 17px;
  color: var(--accent, #58a6ff);
  stroke-width: 2.2;
}

.drawer-title-text {
  font-size: 14px;
  font-weight: 600;
  color: #f0f6fc;
  letter-spacing: 0.2px;
}

.drawer-count-badge {
  font-size: 11px;
  font-weight: 600;
  background: rgba(88, 166, 255, 0.15);
  color: var(--accent, #58a6ff);
  padding: 1px 7px;
  border-radius: 10px;
  border: 1px solid rgba(88, 166, 255, 0.25);
}

.drawer-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.drawer-icon-btn {
  background: transparent;
  border: none;
  color: #8b949e;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s, transform 0.15s;
}

.drawer-icon-btn svg {
  width: 15px;
  height: 15px;
}

.drawer-icon-btn:hover {
  color: #f0f6fc;
  background: rgba(255, 255, 255, 0.08);
}

.drawer-icon-btn.pin-btn.active {
  color: var(--accent, #58a6ff);
  background: rgba(88, 166, 255, 0.15);
  transform: rotate(45deg);
}

.drawer-icon-btn.close-btn:hover {
  color: #f85149;
  background: rgba(248, 81, 73, 0.12);
}

/* 2. 搜索框 */
.drawer-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.drawer-search-wrap .search-svg {
  position: absolute;
  left: 10px;
  width: 13px;
  height: 13px;
  color: #8b949e;
  pointer-events: none;
}

.drawer-search-input {
  width: 100%;
  height: 32px;
  background: rgba(13, 17, 23, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: #f0f6fc;
  font-size: 12px;
  padding: 0 28px 0 30px;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.15s, background-color 0.15s, box-shadow 0.15s;
}

.drawer-search-input:focus {
  border-color: var(--accent, #58a6ff);
  background: rgba(13, 17, 23, 0.95);
  box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.2);
}

.drawer-search-input::placeholder {
  color: #6e7681;
}

.search-clear-btn {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: #8b949e;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: color 0.15s, background 0.15s;
}

.search-clear-btn svg {
  width: 12px;
  height: 12px;
}

.search-clear-btn:hover {
  color: #f0f6fc;
  background: rgba(255, 255, 255, 0.12);
}

/* 3. 状态过滤 Tabs */
.drawer-filter-tabs {
  display: flex;
  background: rgba(13, 17, 23, 0.5);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.filter-tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 11px;
  font-weight: 500;
  padding: 4px 4px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.filter-tab-btn:hover {
  color: #f0f6fc;
}

.filter-tab-btn.active {
  background: rgba(255, 255, 255, 0.1);
  color: #f0f6fc;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.filter-tab-btn .tab-badge {
  font-size: 10px;
  padding: 0 4px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  color: #8b949e;
  line-height: 14px;
}

.filter-tab-btn.active .tab-badge {
  background: rgba(88, 166, 255, 0.2);
  color: var(--accent, #58a6ff);
}

.filter-tab-btn.active .tab-badge.active {
  background: rgba(56, 189, 248, 0.25);
  color: #38bdf8;
}

/* 4. 列表区 */
.drawer-list-wrap {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px 8px;
}

.drawer-device-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 列表单项 */
.drawer-device-item {
  display: flex;
  align-items: center;
  padding: 7px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid transparent;
  cursor: pointer;
  gap: 8px;
  transition: background-color 0.15s, border-color 0.15s, transform 0.12s;
  position: relative;
}

.drawer-device-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

/* 直控中样式高亮 */
.drawer-device-item.is-active-control {
  background: rgba(56, 189, 248, 0.08);
  border-color: rgba(56, 189, 248, 0.35);
}

/* 聚焦窗口样式高亮 */
.drawer-device-item.is-focused {
  background: rgba(88, 166, 255, 0.12);
  border-color: var(--accent, #58a6ff);
  box-shadow: inset 3px 0 0 var(--accent, #58a6ff);
}

/* 离线项置灰 */
.drawer-device-item.is-offline {
  opacity: 0.6;
}
.drawer-device-item.is-offline:hover {
  opacity: 0.85;
}

/* 状态圆点 */
.item-status-col {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.device-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #6e7681;
}

.device-status-dot.online {
  background: #2ea043;
  box-shadow: 0 0 6px rgba(46, 160, 67, 0.8);
}

.device-status-dot.active {
  background: #38bdf8;
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.9);
  animation: pulse-glow 2s infinite ease-in-out;
}

@keyframes pulse-glow {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.25); opacity: 0.85; }
}

.device-status-dot.offline {
  background: #484f58;
}

/* 缩略图 */
.item-thumb-col {
  width: 30px;
  height: 38px;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-snapshot {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-thumb-placeholder {
  color: #6e7681;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-thumb-placeholder svg {
  width: 16px;
  height: 16px;
}

/* 信息文本列 */
.item-info-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.item-name {
  font-size: 13px;
  font-weight: 500;
  color: #f0f6fc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-active-pill {
  font-size: 9px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.4);
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 13px;
}

.item-sub-row {
  display: flex;
  align-items: center;
}

.item-meta {
  font-size: 11px;
  color: #8b949e;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 快捷操作栏 */
.item-actions-col {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0.15;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
}

.drawer-device-item:hover .item-actions-col {
  opacity: 1;
}

.quick-action-btn {
  background: transparent;
  border: none;
  color: #8b949e;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.12s ease;
}

.quick-action-btn svg {
  width: 14px;
  height: 14px;
}

.quick-action-btn:hover:not(:disabled) {
  color: #f0f6fc;
  background: rgba(255, 255, 255, 0.12);
}

.quick-action-btn.active {
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.15);
}

.quick-action-btn.camera:hover:not(:disabled) {
  color: #3fb950;
  background: rgba(63, 185, 80, 0.15);
}

.quick-action-btn.terminal:hover:not(:disabled) {
  color: #d29922;
  background: rgba(210, 153, 34, 0.15);
}

.quick-action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* 空状态 */
.drawer-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 10px;
  color: #8b949e;
  text-align: center;
  gap: 8px;
}

.empty-icon-wrap {
  font-size: 26px;
  opacity: 0.6;
}

.empty-text {
  font-size: 12px;
  margin: 0;
}

/* 5. 底部统计条 */
.drawer-footer {
  padding: 9px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(13, 17, 23, 0.5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #8b949e;
  flex-shrink: 0;
}

.footer-stat {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stat-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.stat-indicator.online {
  background: #2ea043;
}

.stat-indicator.active {
  background: #38bdf8;
}

/* 滚动条极简处理 */
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
