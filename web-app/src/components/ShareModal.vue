<template>
  <div v-if="visible" class="modal-backdrop" @click.self.stop="close" @click.stop>
    <div class="modal-container dark-theme glow-border" @click.stop>
      <!-- 头部 Header -->
      <div class="modal-header">
        <div class="header-title">
          <span class="icon">🔗</span>
          <h3>{{ $t('share.modalTitle') }}</h3>
        </div>
        <button type="button" class="close-btn" @click.stop.prevent="close">✕</button>
      </div>

      <div class="modal-body custom-scrollbar">
        <!-- 设备信息 Banner -->
        <div class="device-badge">
          <span class="label">{{ $t('share.targetDevice') }}</span>
          <span class="device-id">{{ deviceId }}</span>
        </div>

        <!-- Tab 切换: 新建分享 / 已有分享 -->
        <div class="tab-header">
          <button 
            type="button"
            :class="['tab-btn', { active: activeTab === 'create' }]"
            @click.stop.prevent="activeTab = 'create'"
          >
            {{ $t('share.tabNewShare') }}
          </button>
          <button 
            type="button"
            :class="['tab-btn', { active: activeTab === 'list' }]"
            @click.stop.prevent="fetchShareList(); activeTab = 'list'"
          >
            {{ $t('share.tabActiveShares', { count: shareList.length }) }}
          </button>
        </div>

        <!-- 新增分享 Tab 内容 -->
        <div v-if="activeTab === 'create'" class="form-section">
          <!-- 核心设置网格 -->
          <div class="form-grid">
            <!-- 有效期设置 -->
            <div class="form-group">
              <label>{{ $t('share.durationLabel') }}</label>
              <select v-model="expireOption" class="custom-select">
                <option :value="1800">{{ $t('share.duration30m') }}</option>
                <option :value="3600">{{ $t('share.duration1h') }}</option>
                <option :value="43200">{{ $t('share.duration12h') }}</option>
                <option :value="86400">{{ $t('share.duration24h') }}</option>
                <option :value="604800">{{ $t('share.duration7d') }}</option>
                <option :value="0">{{ $t('share.durationForever') }}</option>
                <option value="custom">{{ $t('share.durationCustom') }}</option>
              </select>
              <input 
                v-if="expireOption === 'custom'" 
                v-model.number="customDays" 
                type="number" 
                min="1" 
                :placeholder="$t('share.durationCustomPlaceholder')" 
                class="custom-input mt-2"
              />
            </div>

            <!-- 控制模式 -->
            <div class="form-group">
              <label>{{ $t('share.permissionsLabel') }}</label>
              <div class="radio-group">
                <label :class="['radio-card', { selected: accessMode === 'full' }]">
                  <input type="radio" value="full" v-model="accessMode" />
                  <span class="radio-title">{{ $t('share.modeFull') }}</span>
                  <span class="radio-desc">{{ $t('share.modeFullDesc') }}</span>
                </label>
                <label :class="['radio-card', { selected: accessMode === 'view_only' }]">
                  <input type="radio" value="view_only" v-model="accessMode" />
                  <span class="radio-title">{{ $t('share.modeViewOnly') }}</span>
                  <span class="radio-desc">{{ $t('share.modeViewOnlyDesc') }}</span>
                </label>
              </div>
            </div>

            <!-- 细粒度设置权限 -->
            <div class="form-group">
              <label>{{ $t('share.guestEditableSettings') }}</label>
              <div class="perm-checks">
                <label class="perm-check"><input type="checkbox" v-model="allowBitrate" /> {{ $t('share.permBitrate') }}</label>
                <label class="perm-check"><input type="checkbox" v-model="allowFps" /> {{ $t('share.permFps') }}</label>
                <label class="perm-check"><input type="checkbox" v-model="allowResolution" /> {{ $t('share.permResolution') }}</label>
                <label class="perm-check"><input type="checkbox" v-model="allowAudio" /> {{ $t('share.permAudio') }}</label>
              </div>
              <span class="addr-hint">{{ $t('share.permLockedHint') }}</span>
            </div>

            <!-- 可选访问密码 -->
            <div class="form-group">
              <label>{{ $t('share.passwordLabel') }}</label>
              <input 
                v-model="password" 
                type="password" 
                :placeholder="$t('share.passwordPlaceholder')" 
                class="custom-input"
              />
            </div>

            <!-- 描述 / 备注 -->
            <div class="form-group">
              <label>{{ $t('share.noteLabel') }}</label>
              <input 
                v-model="description" 
                type="text" 
                :placeholder="$t('share.notePlaceholder')" 
                class="custom-input"
              />
            </div>

            <!-- 分享链接地址 -->
            <div class="form-group">
              <label>{{ $t('share.serverUrlLabel') }}</label>
              <select v-model="selectedAddress" class="custom-select">
                <option v-for="addr in serverAddresses" :key="addr" :value="addr">{{ addr }}</option>
              </select>
              <span class="addr-hint">{{ $t('share.serverUrlHint') }}</span>
            </div>
          </div>

          <div class="action-bar">
            <button type="button" class="btn-primary glow-btn" :disabled="loading" @click.stop.prevent="createShare">
              <span v-if="loading" class="spinner"></span>
              <span v-else>{{ $t('share.btnGenerate') }}</span>
            </button>
          </div>

          <!-- 生成结果展示 Banner -->
          <div v-if="createdResult" class="result-card">
            <div class="result-header">
              <span class="check-icon">✓</span>
              <h4>{{ $t('share.generateSuccessTitle') }}</h4>
            </div>

            <div class="result-row">
              <label>{{ $t('share.cardCodeLabel') }}</label>
              <div class="code-box highlight-card-code">{{ createdResult.card_code }}</div>
              <button type="button" class="copy-btn" @click.stop.prevent="copyText(createdResult.card_code, 'card')">
                {{ copiedType === 'card' ? $t('share.copiedCheck') : $t('share.copyCardCode') }}
              </button>
            </div>

            <div class="result-row mt-3">
              <label>{{ $t('share.fullShareUrlLabel') }}</label>
              <input type="text" readonly :value="fullShareUrl(createdResult.token)" class="url-input" />
              <button type="button" class="copy-btn" @click.stop.prevent="copyText(fullShareUrl(createdResult.token), 'url')">
                {{ copiedType === 'url' ? $t('share.copiedCheck') : $t('share.copyShareUrl') }}
              </button>
            </div>
          </div>
        </div>

        <!-- 活跃链接 & 卡密列表 Tab 内容 -->
        <div v-else class="list-section">
          <div v-if="listLoading" class="loading-state">{{ $t('share.loadingRecords') }}</div>
          <div v-else-if="shareList.length === 0" class="empty-state">
            <span>{{ $t('share.noActiveShares') }}</span>
          </div>
          <div v-else class="share-table-wrapper">
            <table class="share-table">
              <thead>
                <tr>
                  <th>{{ $t('share.thCardCode') }}</th>
                  <th>{{ $t('share.thMode') }}</th>
                  <th>{{ $t('share.thExpire') }}</th>
                  <th>{{ $t('share.thNote') }}</th>
                  <th>{{ $t('share.thActions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in shareList" :key="item.token_id">
                  <td>
                    <span class="card-badge">{{ item.card_code }}</span>
                  </td>
                  <td>
                    <span :class="['mode-badge', item.access_mode]">
                      {{ item.access_mode === 'full' ? $t('share.modeFull') : $t('share.modeViewOnly') }}
                    </span>
                  </td>
                  <td>
                    <span class="time-text">{{ formatTime(item.expires_at) }}</span>
                  </td>
                  <td class="desc-cell">{{ item.description || '-' }}</td>
                  <td class="action-cell">
                    <button type="button" class="table-btn copy-sm" @click.stop.prevent="copyText(fullShareUrl(item.token_id), 'list-' + item.token_id)">
                      {{ copiedType === 'list-' + item.token_id ? $t('share.copied') : $t('share.copyShareUrl') }}
                    </button>
                    <button type="button" class="table-btn revoke-sm" @click.stop.prevent="revokeShare(item.token_id)">
                      {{ $t('share.revoke') }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  visible: { type: Boolean, default: false },
  deviceId: { type: String, required: true }
})

const emit = defineEmits(['close'])

const activeTab = ref('create')
const expireOption = ref(86400)
const customDays = ref(1)
const accessMode = ref('full')
const allowBitrate = ref(true)
const allowFps = ref(true)
const allowResolution = ref(true)
const allowAudio = ref(true)
const password = ref('')
const description = ref('')
const loading = ref(false)
const listLoading = ref(false)
const createdResult = ref(null)
const shareList = ref([])
const copiedType = ref('')
const serverAddresses = ref([])
const selectedAddress = ref('')

function getAuthHeaders() {
  const token = localStorage.getItem('auth_token') || ''
  const headers = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function createShare() {
  loading.value = true
  createdResult.value = null

  let seconds = Number(expireOption.value)
  if (expireOption.value === 'custom') {
    seconds = (customDays.value || 1) * 86400
  }

  // 提取当前设备已配置的设置（如 1-4M），注入为访客默认设置
  let currentSettings = null
  try {
    const raw = localStorage.getItem('cloudphone_device_settings_' + props.deviceId) || localStorage.getItem('cloudphone_settings')
    if (raw) currentSettings = JSON.parse(raw)
  } catch (e) {}

  try {
    const res = await fetch('/api/share/create', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        device_id: props.deviceId,
        expire_seconds: seconds,
        access_mode: accessMode.value,
        password: password.value,
        description: description.value,
        forbid_bitrate: !allowBitrate.value,
        forbid_fps: !allowFps.value,
        forbid_resolution: !allowResolution.value,
        forbid_audio: !allowAudio.value,
        guest_settings: currentSettings || undefined
      })
    })

    if (!res.ok) {
      // 409 表示该设备已有活跃分享；优先展示服务端 JSON 里的 msg
      let errMsg = 'HTTP ' + res.status
      try {
        const errJson = await res.json()
        if (errJson && errJson.msg) errMsg = errJson.msg
      } catch (e) {}
      alert(t('share.createFailed') + errMsg)
      return
    }

    const json = await res.json()
    if (json.code === 0) {
      createdResult.value = json.data
      fetchShareList()
    } else {
      alert(t('share.createFailedAlert') + (json.msg || 'Error'))
    }
  } catch (err) {
    alert(t('share.networkError') + err.message)
  } finally {
    loading.value = false
  }
}

async function fetchShareList() {
  listLoading.value = true
  try {
    const res = await fetch(`/api/share/list?device_id=${encodeURIComponent(props.deviceId)}`, {
      headers: getAuthHeaders()
    })
    if (res.ok) {
      const json = await res.json()
      if (json.code === 0) {
        shareList.value = json.data || []
      }
    }
  } catch (e) {
  } finally {
    listLoading.value = false
  }
}

async function revokeShare(tokenID) {
  if (!confirm(t('share.revokeConfirm'))) return
  try {
    const res = await fetch('/api/share/revoke', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ token: tokenID })
    })
    if (res.ok) {
      fetchShareList()
    }
  } catch (e) {}
}

function copyText(text, type) {
  navigator.clipboard.writeText(text).then(() => {
    copiedType.value = type
    setTimeout(() => {
      if (copiedType.value === type) copiedType.value = ''
    }, 2000)
  })
}

function close() {
  emit('close')
}

function fullShareUrl(token) {
  const host = selectedAddress.value || window.location.host
  return `${window.location.protocol}//${host}/share?token=${encodeURIComponent(token)}`
}

async function fetchServerAddresses() {
  try {
    const res = await fetch('/api/server/addresses', { headers: getAuthHeaders() })
    if (!res.ok) return
    const json = await res.json()
    if (json.code === 0 && json.data) {
      serverAddresses.value = json.data.addresses || []
      selectedAddress.value = json.data.current || serverAddresses.value[0] || ''
    }
  } catch (e) {}
}

function formatTime(expiresAt) {
  if (!expiresAt) return '-'
  const dateObj = new Date(expiresAt)
  if (Number.isNaN(dateObj.getTime())) return '-'
  // Go time.Time 零值序列化为 "0001-01-01T00:00:00Z"，代表永久有效
  if (dateObj.getFullYear() <= 1) return t('share.durationForever')
  return dateObj.toLocaleString('zh-CN', { hour12: false })
}

watch(() => props.visible, (val) => {
  if (val) {
    createdResult.value = null
    activeTab.value = 'create'
    fetchShareList()
    fetchServerAddresses()
  }
})
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(10, 12, 20, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-container {
  width: 580px;
  max-width: 92vw;
  max-height: 90vh;
  background: #141824;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.15);
  display: flex;
  flex-direction: column;
  color: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
}

.modal-header {
  padding: 16px 20px;
  background: #1a2030;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-title h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  background: linear-gradient(135deg, #38bdf8, #818cf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.3rem;
  cursor: pointer;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #f43f5e;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.device-badge {
  background: rgba(30, 41, 59, 0.8);
  border: 1px dashed rgba(56, 189, 248, 0.3);
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.device-badge .label {
  color: #94a3b8;
}

.device-badge .device-id {
  color: #38bdf8;
  font-weight: 600;
  font-family: monospace;
}

.tab-header {
  display: flex;
  gap: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 20px;
}

.tab-btn {
  background: none;
  border: none;
  color: #94a3b8;
  padding: 8px 16px;
  font-size: 0.95rem;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-btn.active {
  color: #38bdf8;
  border-bottom-color: #38bdf8;
  font-weight: 600;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group label {
  display: block;
  font-size: 0.88rem;
  color: #cbd5e1;
  margin-bottom: 6px;
  font-weight: 500;
}

.custom-select, .custom-input {
  width: 100%;
  padding: 10px 14px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #f8fafc;
  font-size: 0.92rem;
  outline: none;
  transition: border-color 0.2s;
}

.custom-select:focus, .custom-input:focus {
  border-color: #38bdf8;
}

.addr-hint {
  display: block;
  margin-top: 6px;
  font-size: 0.75rem;
  color: #64748b;
}

.perm-checks {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.perm-check {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.85rem;
  color: #c9d1d9;
  cursor: pointer;
}

.perm-check input {
  accent-color: #6366f1;
}

.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }

.radio-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.radio-card {
  padding: 12px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.2s;
}

.radio-card input {
  display: none;
}

.radio-card.selected {
  border-color: #38bdf8;
  background: rgba(56, 189, 248, 0.08);
}

.radio-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: #f1f5f9;
}

.radio-desc {
  font-size: 0.76rem;
  color: #94a3b8;
  line-height: 1.3;
}

.action-bar {
  margin-top: 24px;
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #0284c7, #6366f1);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
  font-size: 0.98rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(2, 132, 199, 0.4);
}

.result-card {
  margin-top: 20px;
  padding: 16px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 12px;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #10b981;
  margin-bottom: 12px;
}

.result-header h4 {
  margin: 0;
  font-size: 0.95rem;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.result-row label {
  font-size: 0.85rem;
  color: #94a3b8;
  width: 100px;
  flex-shrink: 0;
}

.code-box {
  background: #0f172a;
  border: 1px solid #38bdf8;
  color: #38bdf8;
  padding: 6px 14px;
  border-radius: 6px;
  font-family: monospace;
  font-weight: bold;
  font-size: 1.1rem;
  letter-spacing: 1px;
}

.url-input {
  flex: 1;
  background: #0f172a;
  border: 1px solid #334155;
  color: #f1f5f9;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.82rem;
}

.copy-btn {
  background: #334155;
  border: none;
  color: #f8fafc;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 0.82rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}

.copy-btn:hover {
  background: #0284c7;
}

.share-table-wrapper {
  overflow-x: auto;
}

.share-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.share-table th, .share-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #1e293b;
}

.share-table th {
  color: #94a3b8;
  font-weight: 500;
  background: #0f172a;
}

.card-badge {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-weight: 600;
}

.mode-badge {
  font-size: 0.8rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.mode-badge.full {
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
}

.mode-badge.view_only {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.action-cell {
  display: flex;
  gap: 6px;
}

.table-btn {
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.78rem;
  cursor: pointer;
}

.copy-sm {
  background: #334155;
  color: #f1f5f9;
}

.revoke-sm {
  background: rgba(244, 63, 94, 0.2);
  color: #f43f5e;
}

.revoke-sm:hover {
  background: #f43f5e;
  color: #fff;
}
</style>
