<template>
  <div v-if="visible" class="modal-backdrop" @click.self.stop="close" @click.stop>
    <div class="modal-container dark-theme glow-border" @click.stop>
      <!-- 头部 Header -->
      <div class="modal-header">
        <div class="header-title">
          <span class="header-icon">🔗</span>
          <h3>{{ $t('share.modalTitle') }}</h3>
        </div>
        <div class="header-right-zone">
          <div class="header-device-badge" v-if="currentDeviceId" :title="currentDeviceId">
            <span class="badge-dot">●</span>
            <span class="badge-id">{{ currentDeviceId }}</span>
          </div>
          <button type="button" class="close-btn" @click.stop.prevent="close" title="Close">✕</button>
        </div>
      </div>

      <!-- Tab 切换: 新建分享 / 已有分享 -->
      <div class="tab-header-compact">
        <div class="tab-buttons">
          <button 
            type="button"
            :class="['tab-btn-compact', { active: activeTab === 'create' }]"
            @click.stop.prevent="activeTab = 'create'"
          >
            {{ $t('share.tabNewShare') }}
          </button>
          <button 
            type="button"
            :class="['tab-btn-compact', { active: activeTab === 'list' }]"
            @click.stop.prevent="fetchShareList(); activeTab = 'list'"
          >
            {{ $t('share.tabActiveShares', { count: shareList.length }) }}
            <span v-if="shareList.length > 0" class="tab-count-pill">{{ shareList.length }}</span>
          </button>
        </div>
      </div>

      <div class="modal-body custom-scrollbar">
        <!-- 新增分享 Tab 内容 -->
        <div v-if="activeTab === 'create'" class="form-section">
          <!-- 生成结果展示卡片：成功后原地展示，不撑长窗口 -->
          <transition name="fade-scale">
            <div v-if="createdResult" class="result-panel-compact">
              <div class="result-header">
                <span class="check-icon">✓</span>
                <h4>{{ $t('share.generateSuccessTitle') }}</h4>
              </div>

              <div class="result-box-grid">
                <div class="result-row card-code-row">
                  <span class="res-label">{{ $t('share.cardCodeLabel') }}</span>
                  <div class="code-copy-group">
                    <span class="code-box-compact highlight-card-code">{{ createdResult.card_code }}</span>
                    <button type="button" class="copy-btn-compact glow" @click.stop.prevent="copyText(createdResult.card_code, 'card')">
                      {{ copiedType === 'card' ? $t('share.copiedCheck') : $t('share.copyCardCode') }}
                    </button>
                  </div>
                </div>

                <div class="result-row url-row">
                  <span class="res-label">{{ $t('share.fullShareUrlLabel') }}</span>
                  <div class="url-copy-group">
                    <input type="text" readonly :value="fullShareUrl(createdResult.token)" class="url-input-compact" />
                    <button type="button" class="copy-btn-compact" @click.stop.prevent="copyText(fullShareUrl(createdResult.token), 'url')">
                      {{ copiedType === 'url' ? $t('share.copiedCheck') : $t('share.copyShareUrl') }}
                    </button>
                  </div>
                </div>
              </div>

              <div class="result-actions">
                <button type="button" class="btn-res-primary" @click.stop.prevent="copyAndFinish">
                  {{ $t('share.doneAndClose') }}
                </button>
                <button type="button" class="btn-res-secondary" @click.stop.prevent="createdResult = null">
                  {{ $t('share.createAnother') }}
                </button>
              </div>
            </div>
          </transition>

          <!-- 核心设置网格 (双列紧凑布局，彻底杜绝下拉) -->
          <div v-if="!createdResult" class="form-grid-compact">
            <!-- 全局呼出时无 props.deviceId，展示目标设备选择器 -->
            <div v-if="!props.deviceId" class="form-group span-2">
              <label class="form-label"><span>📱 {{ $t('share.selectDevice') }}</span></label>
              <select v-model="selectedDeviceId" class="custom-select compact" @change="fetchShareList">
                <option value="" disabled>{{ $t('share.selectDevicePlaceholder') }}</option>
                <option v-for="d in availableDevices" :key="d.id" :value="d.id">
                  {{ d.name ? `${d.name} (${d.id})` : d.id }}
                </option>
              </select>
            </div>

            <!-- 第 1 行左：控制模式分段控制器 -->
            <div class="form-group">
              <label class="form-label"><span>🎮 {{ $t('share.permissionsLabel') }}</span></label>
              <div class="seg-control">
                <button 
                  type="button" 
                  :class="['seg-btn', { active: accessMode === 'full' }]" 
                  @click.stop.prevent="accessMode = 'full'"
                  :title="$t('share.modeFullDesc')"
                >
                  ⚡ {{ $t('share.modeFull') }}
                </button>
                <button 
                  type="button" 
                  :class="['seg-btn', { active: accessMode === 'view_only' }]" 
                  @click.stop.prevent="accessMode = 'view_only'"
                  :title="$t('share.modeViewOnlyDesc')"
                >
                  👁️ {{ $t('share.modeViewOnly') }}
                </button>
              </div>
            </div>

            <!-- 第 1 行右：有效期设置 -->
            <div class="form-group">
              <label class="form-label"><span>⏱️ {{ $t('share.durationLabel') }}</span></label>
              <div class="duration-row">
                <select v-model="expireOption" class="custom-select compact">
                  <option :value="1800">{{ $t('share.duration30m') }}</option>
                  <option :value="3600">{{ $t('share.duration1h') }}</option>
                  <option :value="43200">{{ $t('share.duration12h') }}</option>
                  <option :value="86400">{{ $t('share.duration24h') }}</option>
                  <option :value="604800">{{ $t('share.duration7d') }}</option>
                  <option :value="0">{{ $t('share.durationForever') }}</option>
                  <option value="custom">{{ $t('share.durationCustom') }}</option>
                </select>
                <div v-if="expireOption === 'custom'" class="custom-days-wrap">
                  <input 
                    v-model.number="customDays" 
                    type="number" 
                    min="1" 
                    class="custom-input compact days-input"
                  />
                  <span class="days-unit">{{ $t('share.customDaysLabel') }}</span>
                </div>
              </div>
            </div>

            <!-- 第 2 行左：细粒度权限 -->
            <div class="form-group">
              <label class="form-label" :title="$t('share.permLockedHint')">
                <span>🎚️ {{ $t('share.guestEditableSettings') }}</span>
              </label>
              <div class="perm-checks-compact">
                <label class="perm-check-item">
                  <input type="checkbox" v-model="allowBitrate" />
                  <span>{{ $t('share.permBitrate') }}</span>
                </label>
                <label class="perm-check-item">
                  <input type="checkbox" v-model="allowFps" />
                  <span>{{ $t('share.permFps') }}</span>
                </label>
                <label class="perm-check-item">
                  <input type="checkbox" v-model="allowResolution" />
                  <span>{{ $t('share.permResolution') }}</span>
                </label>
                <label class="perm-check-item">
                  <input type="checkbox" v-model="allowAudio" />
                  <span>{{ $t('share.permAudio') }}</span>
                </label>
              </div>
            </div>

            <!-- 第 2 行右：可选访问密码 (PIN 码) -->
            <div class="form-group">
              <label class="form-label"><span>🔒 {{ $t('share.passwordLabel') }}</span></label>
              <input 
                v-model="password" 
                type="password" 
                :placeholder="$t('share.passwordPlaceholder')" 
                class="custom-input compact"
                autocomplete="new-password"
              />
            </div>

            <!-- 第 3 行左：分享链接地址 -->
            <div class="form-group">
              <label class="form-label" :title="$t('share.serverUrlHint')">
                <span>🌐 {{ $t('share.serverUrlLabel') }}</span>
              </label>
              <select v-model="selectedAddress" class="custom-select compact">
                <option v-for="addr in serverAddresses" :key="addr" :value="addr">{{ addr }}</option>
              </select>
            </div>

            <!-- 第 3 行右：分享备注 -->
            <div class="form-group">
              <label class="form-label"><span>📝 {{ $t('share.noteLabel') }}</span></label>
              <input 
                v-model="description" 
                type="text" 
                :placeholder="$t('share.notePlaceholder')" 
                class="custom-input compact"
              />
            </div>

            <!-- 底部操作栏 (跨双列) -->
            <div class="action-bar-compact span-2">
              <button 
                type="button" 
                class="btn-primary glow-btn compact-btn" 
                :disabled="loading || !currentDeviceId" 
                @click.stop.prevent="createShare"
              >
                <span v-if="loading" class="spinner"></span>
                <span v-else>{{ $t('share.btnGenerate') }}</span>
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
                    <span class="card-badge" @click="copyText(item.card_code, 'code-' + item.token_id)" :title="$t('share.copyCardCode')">
                      {{ item.card_code }}
                    </span>
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
                      {{ copiedType === 'list-' + item.token_id ? $t('share.copiedCheck') : $t('share.copyShareUrl') }}
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
import { useDeviceStore } from '@/stores/devices'

const { t } = useI18n()
const deviceStore = useDeviceStore()

const props = defineProps({
  visible: { type: Boolean, default: false },
  deviceId: { type: String, default: '' }
})

const emit = defineEmits(['close', 'created'])

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
const selectedDeviceId = ref('')

const availableDevices = computed(() => deviceStore.devices || [])

const currentDeviceId = computed(() => {
  return props.deviceId || selectedDeviceId.value || (availableDevices.value[0]?.id || '')
})

function getAuthHeaders() {
  const token = localStorage.getItem('auth_token') || ''
  const headers = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function createShare() {
  if (!currentDeviceId.value) {
    alert(t('share.selectDevicePlaceholder'))
    return
  }

  loading.value = true
  createdResult.value = null

  let seconds = Number(expireOption.value)
  if (expireOption.value === 'custom') {
    seconds = (customDays.value || 1) * 86400
  }

  // 提取当前设备已配置的设置（如 1-4M），注入为访客默认设置
  let currentSettings = null
  try {
    const raw = localStorage.getItem('cloudphone_device_settings_' + currentDeviceId.value) || localStorage.getItem('cloudphone_settings')
    if (raw) currentSettings = JSON.parse(raw)
  } catch (e) {}

  try {
    const res = await fetch('/api/share/create', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        device_id: currentDeviceId.value,
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
      await fetchShareList()
      if (shareList.value.length > 0) {
        activeTab.value = 'list'
      }
      return
    }

    const json = await res.json()
    if (json.code === 0) {
      createdResult.value = json.data
      emit('created', json.data)
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
  if (!currentDeviceId.value) {
    shareList.value = []
    return
  }
  listLoading.value = true
  try {
    const res = await fetch(`/api/share/list?device_id=${encodeURIComponent(currentDeviceId.value)}`, {
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
      emit('created', null)
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

function copyAndFinish() {
  if (createdResult.value && createdResult.value.card_code) {
    navigator.clipboard.writeText(createdResult.value.card_code).then(() => {
      close()
    }).catch(() => {
      close()
    })
  } else {
    close()
  }
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
  if (dateObj.getFullYear() <= 1) return t('share.durationForever')
  return dateObj.toLocaleString('zh-CN', { hour12: false })
}

watch(() => props.visible, async (val) => {
  if (val) {
    createdResult.value = null
    if (!props.deviceId && availableDevices.value.length > 0 && !selectedDeviceId.value) {
      selectedDeviceId.value = availableDevices.value[0].id
    }
    fetchServerAddresses()
    await fetchShareList()
    if (shareList.value.length > 0) {
      activeTab.value = 'list'
    } else {
      activeTab.value = 'create'
    }
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
  width: 660px;
  max-width: 94vw;
  max-height: 88vh;
  background: #141824;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.15);
  display: flex;
  flex-direction: column;
  color: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
}

/* 紧凑 Header */
.modal-header {
  padding: 12px 18px;
  background: #1a2030;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  font-size: 1.1rem;
}

.header-title h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  background: linear-gradient(135deg, #38bdf8, #818cf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header-right-zone {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-device-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-family: monospace;
  color: #38bdf8;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-dot {
  font-size: 0.6rem;
  color: #38bdf8;
}

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.15rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #f43f5e;
}

/* 紧凑 Tab 栏 */
.tab-header-compact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(15, 23, 42, 0.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0 16px;
}

.tab-buttons {
  display: flex;
  gap: 6px;
}

.tab-btn-compact {
  background: none;
  border: none;
  color: #94a3b8;
  padding: 8px 12px;
  font-size: 0.86rem;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.tab-btn-compact:hover {
  color: #cbd5e1;
}

.tab-btn-compact.active {
  color: #38bdf8;
  border-bottom-color: #38bdf8;
  font-weight: 600;
}

.tab-count-pill {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
  border: 1px solid rgba(245, 158, 11, 0.4);
}

.modal-body {
  padding: 14px 18px;
  overflow-y: auto;
}

/* 核心设置网格 (PC 双列响应式布局) */
.form-grid-compact {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
}

.span-2 {
  grid-column: span 2;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #cbd5e1;
  margin-bottom: 4px;
  font-weight: 500;
}

/* 紧凑控件 */
.custom-select.compact,
.custom-input.compact {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #f8fafc;
  font-size: 0.84rem;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.custom-select.compact:focus,
.custom-input.compact:focus {
  border-color: #38bdf8;
}

/* 分段开关 (Segmented Control) */
.seg-control {
  display: flex;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  height: 32px;
  padding: 2px;
  box-sizing: border-box;
  gap: 2px;
}

.seg-btn {
  flex: 1;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #94a3b8;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.seg-btn:hover {
  color: #e2e8f0;
}

.seg-btn.active {
  background: rgba(56, 189, 248, 0.16);
  color: #38bdf8;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* 有效期灵活行 */
.duration-row {
  display: flex;
  gap: 6px;
}

.custom-days-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.days-input {
  width: 60px !important;
  text-align: center;
}

.days-unit {
  font-size: 0.78rem;
  color: #94a3b8;
}

/* 紧凑 4 权限复选框 */
.perm-checks-compact {
  display: flex;
  height: 32px;
  align-items: center;
  justify-content: space-between;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 0 8px;
  box-sizing: border-box;
}

.perm-check-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.76rem;
  color: #cbd5e1;
  cursor: pointer;
  user-select: none;
}

.perm-check-item input {
  accent-color: #6366f1;
  cursor: pointer;
  margin: 0;
}

/* 操作栏 */
.action-bar-compact {
  margin-top: 6px;
}

.btn-primary.compact-btn {
  width: 100%;
  height: 36px;
  padding: 0;
  background: linear-gradient(135deg, #0284c7, #6366f1);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-primary.compact-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(2, 132, 199, 0.4);
}

.btn-primary.compact-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 生成结果卡片 (紧凑内联展示) */
.result-panel-compact {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.35);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #10b981;
}

.check-icon {
  font-weight: bold;
  background: rgba(16, 185, 129, 0.2);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
}

.result-header h4 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
}

.result-box-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.res-label {
  font-size: 0.78rem;
  color: #94a3b8;
  width: 90px;
  flex-shrink: 0;
}

.code-copy-group,
.url-copy-group {
  flex: 1;
  display: flex;
  gap: 8px;
  align-items: center;
}

.code-box-compact {
  background: #0f172a;
  border: 1px solid #38bdf8;
  color: #38bdf8;
  padding: 4px 12px;
  border-radius: 6px;
  font-family: monospace;
  font-weight: bold;
  font-size: 1.05rem;
  letter-spacing: 1px;
}

.url-input-compact {
  flex: 1;
  height: 30px;
  background: #0f172a;
  border: 1px solid #334155;
  color: #f1f5f9;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 0.8rem;
  box-sizing: border-box;
}

.copy-btn-compact {
  height: 30px;
  padding: 0 12px;
  background: #334155;
  border: none;
  color: #f8fafc;
  border-radius: 6px;
  font-size: 0.78rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.copy-btn-compact.glow {
  background: #0284c7;
}

.copy-btn-compact:hover {
  background: #0284c7;
}

.result-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 2px;
}

.btn-res-primary {
  padding: 6px 14px;
  background: #10b981;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-res-primary:hover {
  background: #059669;
}

.btn-res-secondary {
  padding: 6px 14px;
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-res-secondary:hover {
  background: #30363d;
  color: #fff;
}

/* 列表 Tab */
.list-section {
  min-height: 180px;
}

.share-table-wrapper {
  overflow-x: auto;
}

.share-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.share-table th, .share-table td {
  padding: 8px 10px;
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
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.card-badge:hover {
  background: rgba(56, 189, 248, 0.25);
}

.mode-badge {
  font-size: 0.76rem;
  padding: 2px 5px;
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
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.74rem;
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

.empty-state, .loading-state {
  padding: 36px 0;
  text-align: center;
  color: #94a3b8;
  font-size: 0.86rem;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 移动端媒体查询自适应 */
@media (max-width: 640px) {
  .modal-container {
    width: 96vw;
  }

  .form-grid-compact {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .span-2 {
    grid-column: span 1;
  }

  .result-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .res-label {
    width: auto;
  }

  .code-copy-group,
  .url-copy-group {
    width: 100%;
  }
}
</style>
