<template>
  <div 
    class="multi-device-item" 
    :class="{ 
      'is-focused': isFocused, 
      'is-mini': isMini,
      'is-maximized': isMaximized
    }"
    @mousedown="onFocusThis"
    tabindex="0"
  >
    <!-- 卡片顶部工具栏 -->
    <header class="item-header" v-if="showHeader" @mousedown="onFocusThis">
      <div class="header-left">
        <span class="status-dot" :class="{ online: isOnline, offline: !isOnline }"></span>
        <span class="device-id-title" :title="deviceId">{{ currentDevice?.displayName || deviceId }}</span>
        <span v-if="deviceModel" class="device-model-badge" :title="deviceModel">{{ deviceModel }}</span>
      </div>

      <div class="header-right" @mousedown.stop @click.stop>
        <!-- 网页全屏按钮 -->
        <button 
          class="item-btn webfullscreen-btn" 
          :class="{ active: deviceClientRef?.isWebFullscreen }"
          @click="deviceClientRef?.toggleWebFullscreen()"
          :title="deviceClientRef?.isWebFullscreen ? $t('deviceClient.webFsActiveHoverHint') : $t('deviceClient.enterWebFullscreen')"
          :data-tooltip="deviceClientRef?.isWebFullscreen ? $t('deviceClient.webFsActiveHoverHint') : $t('deviceClient.enterWebFullscreen')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
          <span v-if="deviceClientRef?.isWebFullscreen" class="active-dot"></span>
        </button>

        <!-- 音频静音开关 -->
        <button 
          class="item-btn audio-btn" 
          :class="{ muted: isMuted }" 
          @click="toggleMute"
          :title="isMuted ? $t('multi.unmute') : $t('multi.mute')"
          :data-tooltip="isMuted ? $t('multi.unmute') : $t('multi.mute')"
        >
          <svg v-if="!isMuted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <line x1="23" y1="9" x2="17" y2="15"></line>
            <line x1="17" y1="9" x2="23" y2="15"></line>
          </svg>
        </button>

        <!-- 独立关闭按钮 -->
        <button 
          class="item-btn close-btn" 
          @click="closeThis"
          :title="$t('multi.closeDeviceConn')"
          :data-tooltip="$t('multi.closeDeviceConn')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </header>

    <!-- 画面渲染区 (内嵌 DeviceClient) -->
    <div class="item-body">
      <DeviceClient 
        ref="deviceClientRef"
        :deviceId="deviceId" 
        :key="`${deviceId}_${deviceStore.getDeviceMode(deviceId)}`"
        :is-mini="isMini"
        :is-focused="isFocused"
        :audio-muted="isMuted"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import DeviceClient from '@/views/DeviceClient.vue'

const props = defineProps({
  deviceId: {
    type: String,
    required: true
  },
  isMini: {
    type: Boolean,
    default: false
  },
  showHeader: {
    type: Boolean,
    default: true
  }
})

const deviceClientRef = ref(null)

const deviceStore = useDeviceStore()
const isFocused = computed(() => 
  deviceStore.activeDeviceIds.length <= 1 || 
  deviceStore.focusedDeviceId === props.deviceId ||
  (!deviceStore.focusedDeviceId && deviceStore.activeDeviceIds[0] === props.deviceId)
)
const isMaximized = computed(() => deviceStore.maximizedDeviceId === props.deviceId)

const currentDevice = computed(() => 
  deviceStore.devices.find(d => d.id === props.deviceId) || 
  deviceStore.offlineDevices.find(d => d.id === props.deviceId)
)
const isOnline = computed(() => currentDevice.value?.status === 'online')
const deviceModel = computed(() => currentDevice.value?.info?.model || '')

// 音频独立静音控制
const isManualMuted = ref(false)
const isMuted = computed(() => {
  if (isManualMuted.value) return true
  // 单机直连时绝不自动静音
  if (deviceStore.activeDeviceIds.length <= 1) return false
  // 如果处于多开独占音频模式，且自己不是当前焦点，则自动静音
  if (deviceStore.audioFocusMode === 'exclusive' && !isFocused.value) {
    return true
  }
  return false
})

function onFocusThis() {
  deviceStore.focusDevice(props.deviceId)
}

function toggleMute() {
  isManualMuted.value = !isManualMuted.value
}

function closeThis() {
  deviceStore.closeDevice(props.deviceId)
}
</script>

<style scoped>
.multi-device-item {
  display: flex;
  flex-direction: column;
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 8px;
  overflow: hidden;
  height: 100%;
  width: 100%;
  position: relative;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  outline: none;
}

.multi-device-item.is-focused {
  border-color: #38bdf8;
  box-shadow: 0 0 0 1px #38bdf8, 0 4px 16px rgba(56, 189, 248, 0.25);
  z-index: 2;
}

.multi-device-item.is-master {
  border-color: #f59e0b;
}

.multi-device-item.is-master.is-focused {
  border-color: #f59e0b;
  box-shadow: 0 0 0 1px #f59e0b, 0 4px 16px rgba(245, 158, 11, 0.3);
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: #161b22;
  border-bottom: 1px solid #21262d;
  height: 36px;
  flex-shrink: 0;
  user-select: none;
  cursor: pointer;
  position: relative;
  z-index: 50;
  overflow: visible;
}

.is-focused .item-header {
  background: #1c2128;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6e7681;
  flex-shrink: 0;
}

.status-dot.online {
  background: #2ea043;
  box-shadow: 0 0 6px rgba(46, 160, 67, 0.6);
}

.status-dot.offline {
  background: #f85149;
}

.device-id-title {
  font-size: 12px;
  font-weight: 600;
  color: #c9d1d9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.is-focused .device-id-title {
  color: #58a6ff;
}

.device-model-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  background: #21262d;
  color: #8b949e;
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.item-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: #8b949e;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  height: 24px;
  min-width: 24px;
  transition: all 0.15s ease;
  position: relative;
}

.item-btn svg {
  width: 14px;
  height: 14px;
}

.item-btn:hover {
  background: #21262d;
  color: #c9d1d9;
}

.item-btn.active {
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.16);
  box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.4);
}

.item-btn .active-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 4px #38bdf8;
  pointer-events: none;
}

.header-right .item-btn[data-tooltip]::after {
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
  z-index: 9999;
}

.header-right .item-btn[data-tooltip]:hover::after {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}

.header-right .item-btn:last-child[data-tooltip]::after {
  left: auto;
  right: 0;
  transform: translateY(-2px);
}

.header-right .item-btn:last-child[data-tooltip]:hover::after {
  transform: translateY(0);
}

.header-right .item-btn.active[data-tooltip]::after {
  border-color: rgba(56, 189, 248, 0.6);
  color: #38bdf8;
}

.item-btn.master-btn {
  font-size: 11px;
  gap: 2px;
  padding: 2px 6px;
  color: #8b949e;
}

.item-btn.master-btn.active {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  font-weight: 600;
}

.crown-icon {
  font-size: 12px;
}

.item-btn.audio-btn.muted {
  color: #f85149;
}

.item-btn.close-btn:hover {
  background: rgba(248, 81, 73, 0.2);
  color: #f85149;
}

.item-body {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
  background: #000;
}
</style>
