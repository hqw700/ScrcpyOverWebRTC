<template>
  <div class="device-card" @click="onCardClick">
    <div class="preview-area">
      <!-- 展示快照或占位图 -->
      <img v-if="device.snapshot" :src="device.snapshot" class="snapshot-img" />
      <div v-else class="snapshot-placeholder">
        <span class="vm-icon">💻</span>
      </div>
      <div class="overlay">
        <span class="play-hint">点击进入控制</span>
      </div>
    </div>
    
    <div class="card-footer">
      <div class="device-main-info">
        <h3 class="device-id-text">{{ device.id }}</h3>
        <span class="status-badge" :class="statusClass">
          {{ statusText }}
        </span>
      </div>
      <div class="device-meta">
        <span class="model-name">{{ device.info?.model || 'Android VM' }}</span>
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

    <!-- 下拉菜单 -->
    <div v-if="showMenu" class="card-menu" @click.stop>
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDeviceStore } from '@/stores/devices'

const props = defineProps({
  device: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['connect'])
const deviceStore = useDeviceStore()
const showMenu = ref(false)

const statusClass = computed(() => {
  return props.device.status === 'online' ? 'online' : 'offline'
})

const statusText = computed(() => {
  return props.device.status === 'online' ? '在线' : '离线'
})

function onCardClick() {
  if (!showMenu.value) {
    emit('connect', props.device.id)
  }
}

function toggleMenu() {
  showMenu.value = !showMenu.value
}

function onQuitAgent() {
  showMenu.value = false
  if (confirm(`警告：确定要停止设备 "${props.device.id}" 上的 Agent 进程吗？停止后该设备将下线。`)) {
    deviceStore.quitAgent(props.device.id)
  }
}

function onClickOutside() {
  if (showMenu.value) showMenu.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
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
  object-fit: cover;
  display: block;
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

.card-footer {
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  position: relative;
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

/* 菜单按钮 */
.menu-btn {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.5;
  transition: all 0.15s ease;
}

.menu-btn:hover {
  opacity: 1;
  background: var(--bg-hover);
}

.menu-btn svg {
  width: 14px;
  height: 14px;
  color: var(--text-secondary);
}

/* 下拉菜单 */
.card-menu {
  position: absolute;
  bottom: 36px;
  right: 8px;
  min-width: 140px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
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
@media (max-width: 768px) {
  .card-footer {
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
  .menu-btn {
    opacity: 1;
  }
}
</style>
