<template>
  <div class="multi-tabs-container">
    <!-- 顶部 Tab 栏 -->
    <div class="tabs-header-bar">
      <div class="tabs-scroll-area">
        <div 
          v-for="id in activeDeviceIds" 
          :key="id"
          class="tab-pill"
          :class="{ active: currentTab === id, 'is-master': deviceStore.masterDeviceId === id }"
          @click="currentTab = id; deviceStore.focusDevice(id)"
        >
          <span class="tab-status-dot" :class="{ online: isOnline(id) }"></span>
          <span class="tab-crown" v-if="deviceStore.masterDeviceId === id" title="主控机">👑</span>
          <span class="tab-title" :title="id">{{ id }}</span>
          <button class="tab-close-btn" @click.stop="closeTab(id)" title="关闭标签页">
            ✕
          </button>
        </div>
      </div>

      <div class="tabs-actions">
        <button 
          class="tab-action-btn" 
          :class="{ active: isSplitMode }" 
          @click="isSplitMode = !isSplitMode"
          :title="isSplitMode ? '关闭双栏分屏' : '向右拆分分屏 (双Tab同时查看)'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"></rect>
            <line x1="12" y1="3" x2="12" y2="21"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- Tab 内容区 -->
    <div class="tabs-content-viewport" :class="{ 'is-split': isSplitMode && activeDeviceIds.length >= 2 }">
      <!-- 主窗格 (Primary Pane) -->
      <div class="pane-primary">
        <div 
          v-for="id in activeDeviceIds" 
          :key="id"
          v-show="currentTab === id"
          class="tab-pane-instance"
        >
          <MultiDeviceItem :deviceId="id" :isMini="false" />
        </div>
      </div>

      <!-- 拆分副窗格 (Secondary Pane) -->
      <div class="pane-secondary" v-if="isSplitMode && secondaryTabId">
        <div class="secondary-header">
          <span class="split-label">分屏副视窗:</span>
          <select v-model="secondaryTabId" class="split-select">
            <option 
              v-for="id in activeDeviceIds" 
              :key="id" 
              :value="id"
              :disabled="id === currentTab"
            >
              {{ id }} {{ id === currentTab ? '(主窗已打开)' : '' }}
            </option>
          </select>
        </div>
        <div class="split-pane-body">
          <MultiDeviceItem :deviceId="secondaryTabId" :isMini="false" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import MultiDeviceItem from './MultiDeviceItem.vue'

const deviceStore = useDeviceStore()
const activeDeviceIds = computed(() => deviceStore.activeDeviceIds)

const currentTab = ref(deviceStore.focusedDeviceId || activeDeviceIds.value[0] || null)
const isSplitMode = ref(false)
const secondaryTabId = ref(activeDeviceIds.value[1] || null)

watch(() => deviceStore.focusedDeviceId, (newId) => {
  if (newId && activeDeviceIds.value.includes(newId)) {
    currentTab.value = newId
  }
})

watch(currentTab, (newTabId) => {
  if (isSplitMode.value && newTabId && secondaryTabId.value === newTabId) {
    // 若主 Tab 切到与分屏副视窗相同的设备，自动将副视窗让出给其他设备，防止同 ID 重复挂载
    const other = activeDeviceIds.value.find(id => id !== newTabId)
    secondaryTabId.value = other || null
    if (!other) {
      isSplitMode.value = false
    }
  }
})

watch(activeDeviceIds, (newList) => {
  if (!newList.includes(currentTab.value)) {
    currentTab.value = newList[0] || null
  }
  if (!newList.includes(secondaryTabId.value)) {
    secondaryTabId.value = newList.find(id => id !== currentTab.value) || null
  }
  if (newList.length < 2 && isSplitMode.value) {
    isSplitMode.value = false
  }
}, { deep: true })

function isOnline(id) {
  const d = deviceStore.devices.find(dev => dev.id === id)
  return d?.status === 'online'
}

function closeTab(id) {
  deviceStore.closeDevice(id)
}
</script>

<style scoped>
.multi-tabs-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #090d13;
  overflow: hidden;
}

.tabs-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #161b22;
  border-bottom: 1px solid #21262d;
  height: 40px;
  padding: 0 8px;
  flex-shrink: 0;
}

.tabs-scroll-area {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  flex: 1;
  scrollbar-width: none;
}
.tabs-scroll-area::-webkit-scrollbar {
  display: none;
}

.tab-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #0d1117;
  border: 1px solid #21262d;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  color: #8b949e;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
  max-width: 200px;
}

.tab-pill:hover {
  background: #1c2128;
  color: #c9d1d9;
}

.tab-pill.active {
  background: #090d13;
  color: #38bdf8;
  border-color: #38bdf8;
  border-bottom: 1px solid #090d13;
  font-weight: 600;
}

.tab-pill.is-master {
  border-top: 2px solid #f59e0b;
}

.tab-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6e7681;
}

.tab-status-dot.online {
  background: #2ea043;
}

.tab-crown {
  font-size: 11px;
}

.tab-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 11px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  margin-left: 2px;
}

.tab-close-btn:hover {
  background: rgba(248, 81, 73, 0.2);
  color: #f85149;
}

.tabs-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
}

.tab-action-btn {
  background: transparent;
  border: 1px solid #30363d;
  color: #8b949e;
  border-radius: 4px;
  padding: 4px 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.tab-action-btn svg {
  width: 14px;
  height: 14px;
}

.tab-action-btn:hover, .tab-action-btn.active {
  background: #21262d;
  color: #38bdf8;
  border-color: #38bdf8;
}

.tabs-content-viewport {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
  padding: 12px;
  gap: 12px;
  box-sizing: border-box;
}

.pane-primary {
  flex: 1;
  height: 100%;
  display: flex;
  overflow: hidden;
}

.tab-pane-instance {
  width: 100%;
  height: 100%;
  display: flex;
}

.pane-secondary {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #21262d;
  padding-left: 12px;
  overflow: hidden;
}

.secondary-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.split-label {
  font-size: 11px;
  color: #8b949e;
}

.split-select {
  background: #161b22;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  outline: none;
}

.split-pane-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
</style>
