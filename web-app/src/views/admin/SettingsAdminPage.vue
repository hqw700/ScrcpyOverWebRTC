<template>
  <div class="admin-page-container">
    <div class="settings-grid">
      <!-- 全局默认设置 -->
      <div class="admin-card settings-card">
        <div class="panel-header">
          <div class="header-left">
            <h2>⚙️ 全局默认设置</h2>
          </div>
        </div>
        <p class="card-desc">
          所有未单独配置的设备连接时使用的默认画质与功能参数，保存后实时同步到服务端并广播给在线客户端。
        </p>
        <div class="settings-summary">
          <div class="summary-item">
            <span class="summary-label">视频码率</span>
            <span class="summary-value">{{ bitrateText }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">帧率</span>
            <span class="summary-value">{{ globalSettings.fps }} fps</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">分辨率</span>
            <span class="summary-value">{{ globalSettings.size || '原始' }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">音频</span>
            <span class="summary-value">{{ globalSettings.audio ? '开启' : '关闭' }}</span>
          </div>
        </div>
        <button class="open-editor-btn" @click="openEditor">编辑全局默认设置…</button>
      </div>

      <!-- 授权管理 -->
      <div class="admin-card settings-card">
        <div class="panel-header">
          <div class="header-left">
            <h2>🔐 系统授权</h2>
          </div>
          <span class="license-chip" :class="deviceStore.licenseBadgeClass">{{ deviceStore.licenseBadgeText }}</span>
        </div>
        <p class="card-desc">
          查看当前授权状态、虚机用量与到期时间，或提交新的激活码。
        </p>
        <div class="settings-summary" v-if="deviceStore.licenseDetailsLoaded">
          <div class="summary-item">
            <span class="summary-label">虚机用量</span>
            <span class="summary-value">{{ deviceStore.licenseUsedCount }} / {{ deviceStore.licenseMaxDevices }} 台</span>
          </div>
          <div class="summary-item" v-if="deviceStore.licenseActivated">
            <span class="summary-label">剩余有效期</span>
            <span class="summary-value">{{ deviceStore.licenseDaysRemaining }} 天</span>
          </div>
          <div class="summary-item" v-if="deviceStore.licenseExpiresAt">
            <span class="summary-label">到期时间</span>
            <span class="summary-value">{{ deviceStore.licenseExpiresAt }}</span>
          </div>
        </div>
        <button class="open-editor-btn" @click="showLicensePanel = true">打开授权管理…</button>
      </div>
    </div>

    <!-- 全局设置编辑器（与主控台同款弹窗） -->
    <SettingsModal
      v-if="showSettingsModal"
      :settings="editorSettings"
      :is-connected="false"
      :is-global="true"
      :is-custom="false"
      :show-preview-tab="true"
      @close="showSettingsModal = false"
      @save="onSaveGlobalSettings"
    />

    <!-- 授权管理面板（顶栏徽标同款组件） -->
    <LicensePanel :visible="showLicensePanel" @close="showLicensePanel = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import SettingsModal from '@/components/SettingsModal.vue'
import LicensePanel from '@/components/LicensePanel.vue'
import { getDeviceSettings, saveDeviceSettings } from '@/utils/settings'

const deviceStore = useDeviceStore()

const showSettingsModal = ref(false)
const showLicensePanel = ref(false)

// 页面内展示的全局默认设置快照（每次打开编辑器前重新读取）
const globalSettings = ref(getDeviceSettings(''))

const bitrateText = computed(() => {
  const s = globalSettings.value
  return s.bwe ? `${s.minBitrate}-${s.maxBitrate} Mbps (BWE)` : `${s.bitrate} Mbps`
})

const editorSettings = computed(() => getDeviceSettings(''))

function openEditor() {
  showSettingsModal.value = true
}

function onSaveGlobalSettings(newSettings) {
  saveDeviceSettings('', newSettings)
  globalSettings.value = getDeviceSettings('')
  showSettingsModal.value = false
}

onMounted(() => {
  deviceStore.fetchLicenseStatus()
})
</script>

<style scoped>
.admin-page-container {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 10px;
  background: #0d1117;
  color: #c9d1d9;
  overflow-y: auto;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 20px;
}

.admin-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 16px;
  padding: 24px;
  box-sizing: border-box;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #e6edf3;
}

.license-chip {
  font-size: 12px;
  color: #8b949e;
  background: rgba(255, 255, 255, 0.05);
  padding: 4px 10px;
  border-radius: 20px;
}

.license-chip.badge-warn {
  color: #fbbf24;
}

.license-chip.badge-danger {
  color: #f85149;
}

.card-desc {
  margin: 0 0 16px;
  font-size: 12.5px;
  color: #8b949e;
  line-height: 1.6;
}

.settings-summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 16px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  font-size: 13px;
}

.summary-label {
  color: #8b949e;
}

.summary-value {
  color: #c9d1d9;
  font-weight: 600;
}

.open-editor-btn {
  margin-top: auto;
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  padding: 10px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.open-editor-btn:hover {
  background: #30363d;
  border-color: #58a6ff;
  color: #58a6ff;
}
</style>
