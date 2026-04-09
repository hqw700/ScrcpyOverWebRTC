<template>
  <div class="device-list-page">
    <header class="page-header">
      <div class="header-left">
        <h2 class="page-title">所有虚机</h2>
        <span class="device-count">{{ deviceStore.devices.length }} 台在线</span>
      </div>
      
      <div class="header-controls">
        <button class="deploy-btn" @click="router.push('/deploy')">
          🚀 部署新设备
        </button>
        <div class="size-control">
          <span class="label">缩略图大小</span>
          <input
            type="range"
            v-model="cardSize"
            min="150"
            max="400"
            step="10"
            class="size-slider"
          >
          <span class="size-value">{{ cardSize }}px</span>
        </div>
      </div>
    </header>

    <main class="grid-container">
      <div v-if="deviceStore.loading && deviceStore.devices.length === 0" class="state-view">
        <div class="spinner"></div>
        <p>正在获取虚机列表...</p>
      </div>

      <div v-else-if="deviceStore.devices.length === 0" class="state-view">
        <div class="empty-icon">📵</div>
        <h3>暂无在线虚机</h3>
        <p>请确保 Agent 已启动并注册到 Signaling Server</p>
      </div>

      <div 
        v-else 
        class="device-grid" 
        :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))` }"
      >
        <DeviceCard
          v-for="device in deviceStore.devices"
          :key="device.id"
          :device="device"
          @connect="connectDevice"
        />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDeviceStore } from '@/stores/devices'
import DeviceCard from '@/components/DeviceCard.vue'

const router = useRouter()
const deviceStore = useDeviceStore()
const cardSize = ref(280)

let refreshInterval = null

onMounted(() => {
  deviceStore.fetchDevices()
  refreshInterval = setInterval(() => {
    deviceStore.fetchDevices()
  }, 10000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

function connectDevice(deviceId) {
  router.push(`/device/${deviceId}`)
}
</script>

<style scoped>
.device-list-page {
  padding: 24px;
  min-height: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.device-count {
  font-size: 13px;
  color: var(--text-secondary);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 24px;
}

.deploy-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--accent);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.deploy-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.size-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.size-control .label {
  font-size: 13px;
  color: var(--text-secondary);
}

.size-slider {
  width: 120px;
  height: 4px;
  -webkit-appearance: none;
  background: var(--border);
  border-radius: 2px;
  outline: none;
}

.size-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: var(--accent);
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s;
}

.size-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.size-value {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 40px;
}

.btn-refresh-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-refresh-icon:hover {
  background: rgba(255, 255, 255, 0.05);
}

.grid-container {
  width: 100%;
}

.device-grid {
  display: grid;
  gap: 20px;
}

.state-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 0;
  color: var(--text-secondary);
  text-align: center;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.state-view h3 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .device-list-page {
    padding: 12px;
    height: calc(100vh - 100px);
    display: flex;
    flex-direction: column;
  }
  
  .size-control {
    display: none !important;
  }

  .grid-container {
    flex: 1;
    display: flex;
    align-items: center;
    overflow: hidden;
  }

  .device-grid {
    /* 移动端采用左右滑动模式 */
    display: flex !important;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    gap: 16px;
    padding: 20px 12px;
    width: 100%;
    -webkit-overflow-scrolling: touch;
  }

  .device-grid::-webkit-scrollbar {
    display: none; /* 隐藏滑动条 */
  }

  .device-grid > * {
    /* 每个卡片宽度占据屏幕大部 */
    min-width: 80vw;
    max-width: 80vw;
    scroll-snap-align: center;
  }
  
  .page-title {
    font-size: 18px;
  }
}
</style>
