<template>
  <div
    class="device-list-item"
    ref="rowElement"
    :class="{ offline: device.status !== 'online' }"
    @click="onRowClick"
  >
    <!-- 群控勾选 / 主控标识 -->
    <div v-if="groupControlStore.isGroupControlActive && device.status === 'online'" class="group-select-cell" @click.stop>
      <span v-if="groupControlStore.masterId === device.id" class="master-badge">主控</span>
      <input
        v-else
        type="checkbox"
        :checked="groupControlStore.selectedSlaveIds.includes(device.id)"
        @change="groupControlStore.toggleSlave(device.id)"
        class="group-select-checkbox"
      />
    </div>

    <!-- 缩略图 -->
    <div class="item-thumb">
      <img v-if="device.snapshot" :src="device.snapshot" class="thumb-img" alt="" loading="lazy" />
      <span v-else class="thumb-placeholder">📱</span>
      <span v-if="device.clientCount > 0" class="thumb-in-use" :title="`用户正在使用（${device.clientCount} 个连接）`">👤</span>
    </div>

    <!-- 设备信息 -->
    <div class="item-info">
      <div class="item-name-row">
        <span class="item-name" :title="device.id">{{ device.id }}</span>
        <span class="item-status-badge" :class="statusClass">{{ statusText }}</span>
      </div>
      <div class="item-sub">
        <span class="status-dot" :class="statusClass"></span>
        <span v-if="device.info?.model" class="item-model">{{ device.info.model }}</span>
        <span v-if="device.status !== 'online' && lastSeenText" class="item-last-seen">最后在线: {{ lastSeenText }}</span>
      </div>
      <div v-if="tags.length > 0" class="item-tags">
        <span
          v-for="tag in visibleTags"
          :key="tag.id"
          class="item-tag"
          :style="tagStyle(tag)"
          :title="tag.name"
        >{{ tag.name }}</span>
        <span v-if="hiddenTagCount > 0" class="item-tag more-tag">+{{ hiddenTagCount }}</span>
      </div>
    </div>

    <!-- 功能菜单 -->
    <button class="item-menu-btn" @click.stop="toggleMenu" title="更多操作">
      <svg viewBox="0 0 16 16" fill="currentColor">
        <circle cx="4" cy="8" r="1.5"/>
        <circle cx="8" cy="8" r="1.5"/>
        <circle cx="12" cy="8" r="1.5"/>
      </svg>
    </button>

    <!-- 进入箭头 -->
    <span class="item-arrow">›</span>

    <!-- 下拉菜单 -->
    <div v-if="showMenu" class="item-menu" @click.stop>
      <button class="menu-item" @click="onSettings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82.33l.06.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51-1z"></path></svg>
        连接设置
      </button>
      <button class="menu-item" @click="onShareDevice" v-if="authStore.isAdmin">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
        分享设备 / 卡密
      </button>
      <button class="menu-item" @click="onEditTags">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 12v7a1 1 0 0 1-1 1h-7L4 12V5a1 1 0 0 1 1-1h7l8 8z"></path><circle cx="8.5" cy="8.5" r="1.5"></circle></svg>
        编辑标签
      </button>
      <button class="menu-item danger" @click="onQuitAgent" :disabled="device.status !== 'online'">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v6M12 4.5a6 6 0 11-8 0"/></svg>
        退出 Agent
      </button>
      <button v-if="device.status !== 'online'" class="menu-item danger" @click="onDeleteRecord">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        移除记录
      </button>
    </div>
    <div v-if="showMenu" class="menu-overlay" @click.stop="showMenu = false"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { useGroupControlStore } from '@/stores/groupControl'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  device: {
    type: Object,
    required: true
  },
  tags: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['connect', 'settings', 'edit-tags', 'share'])
const deviceStore = useDeviceStore()
const groupControlStore = useGroupControlStore()
const authStore = useAuthStore()
const showMenu = ref(false)
const rowElement = ref(null)

const statusClass = computed(() => (props.device.status === 'online' ? 'online' : 'offline'))
const statusText = computed(() => (props.device.status === 'online' ? '在线' : '离线'))

const lastSeenText = computed(() => {
  if (!props.device.lastSeen) return ''
  const d = new Date(props.device.lastSeen)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString()
})

const visibleTags = computed(() => props.tags.slice(0, 3))
const hiddenTagCount = computed(() => Math.max(0, props.tags.length - visibleTags.value.length))

function onRowClick() {
  // 离线设备不进入控制页（服务端会拒绝 TypeConnect）
  if (props.device.status !== 'online') return
  if (!showMenu.value) {
    emit('connect', props.device.id)
  }
}

function toggleMenu() {
  showMenu.value = !showMenu.value
}

function onSettings() {
  showMenu.value = false
  emit('settings', props.device.id)
}

function onShareDevice() {
  showMenu.value = false
  emit('share', props.device.id)
}

function onEditTags() {
  showMenu.value = false
  emit('edit-tags', props.device.id)
}

function tagStyle(tag) {
  return {
    color: tag.color,
    borderColor: `${tag.color}80`,
    background: `${tag.color}16`
  }
}

function onQuitAgent() {
  showMenu.value = false
  if (confirm(`警告：确定要停止设备 "${props.device.id}" 上的 Agent 进程吗？停止后该设备将下线。`)) {
    deviceStore.quitAgent(props.device.id)
  }
}

async function onDeleteRecord() {
  showMenu.value = false
  if (confirm(`确定要删除设备 "${props.device.id}" 的离线记录吗？删除后该设备将从列表中移除（不影响设备本身，重新上线后会再次注册）。`)) {
    try {
      await deviceStore.deleteOfflineDevice(props.device.id)
    } catch (e) {
      alert('删除离线记录失败: ' + (e.message || e))
    }
  }
}

function onClickOutside(event) {
  if (rowElement.value && !rowElement.value.contains(event.target)) {
    showMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<style scoped>
.device-list-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-card, #16213e);
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.device-list-item:hover {
  border-color: rgba(88, 166, 255, 0.4);
  background: rgba(255, 255, 255, 0.03);
}

.device-list-item.offline {
  filter: grayscale(0.55);
  opacity: 0.72;
  cursor: default;
}

.device-list-item.offline:hover {
  filter: grayscale(0.2);
  opacity: 0.95;
}

.group-select-cell {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
}

.group-select-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--accent);
  margin: 0;
}

.master-badge {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: #ff9f43;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.item-thumb {
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  background: #1a1a2e;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-placeholder {
  font-size: 26px;
}

.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.item-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.item-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.item-status-badge {
  flex: 0 0 auto;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 700;
}

.item-status-badge.online {
  background: rgba(74, 222, 128, 0.1);
  color: #4ade80;
}

.item-status-badge.offline {
  background: rgba(255, 255, 255, 0.1);
  color: #999;
}

.item-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.status-dot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8b949e;
}

.status-dot.online {
  background: #4ade80;
}

.item-model,
.item-last-seen {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.item-tags {
  display: flex;
  gap: 5px;
  overflow: hidden;
}

.item-tag {
  max-width: 86px;
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 7px;
  border: 1px solid;
  border-radius: 999px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.more-tag {
  color: var(--text-secondary);
  border-color: var(--border);
  background: rgba(255, 255, 255, 0.06);
}

.item-menu-btn {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
}

.item-menu-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: var(--text-primary);
}

.item-menu-btn svg {
  width: 14px;
  height: 14px;
}

.item-arrow {
  flex: 0 0 auto;
  font-size: 20px;
  color: var(--accent);
  line-height: 1;
}

.offline .item-arrow {
  color: var(--text-secondary);
}

/* 下拉菜单 */
.item-menu {
  position: absolute;
  top: calc(100% - 8px);
  right: 12px;
  min-width: 140px;
  background: #161b22;
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  z-index: 100;
  padding: 4px;
}

.thumb-in-use {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(2, 132, 199, 0.9);
  border-radius: 6px 0 0 0;
  font-size: 9px;
  line-height: 1;
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
  background: rgba(255, 255, 255, 0.06);
}

.menu-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.menu-item.danger {
  color: #f85149;
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

@media (max-width: 1024px) {
  .device-list-item {
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
  }

  .item-thumb {
    width: 42px;
    height: 42px;
  }

  .item-name {
    font-size: 14px;
  }
}
</style>
