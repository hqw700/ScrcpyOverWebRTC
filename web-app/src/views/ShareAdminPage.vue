<template>
  <div class="share-admin-page">
    <div class="page-header">
      <div class="title-wrap">
        <h2>{{ $t('share.adminPageTitle') }}</h2>
        <span class="shares-count-pill" v-if="shares.length > 0">{{ shares.length }}</span>
      </div>
      <div class="header-actions">
        <button class="btn-create-share" @click="showCreateModal = true">
          {{ $t('share.createShareBtn') }}
        </button>
        <button class="btn-card-connect" @click="showCardModal = true">{{ $t('share.cardConnectBtn') }}</button>
        <select v-model="selectedAddress" class="addr-select" :title="$t('share.serverAddrTitle')">
          <option v-for="addr in serverAddresses" :key="addr" :value="addr">{{ addr }}</option>
        </select>
        <button class="btn-refresh" :disabled="loading" @click="fetchShares">
          {{ loading ? $t('share.refreshing') : $t('share.refresh') }}
        </button>
      </div>
    </div>

    <!-- 新建免密/卡密分享弹窗 (支持选择设备或默认全量) -->
    <ShareModal
      :visible="showCreateModal"
      deviceId=""
      @close="showCreateModal = false"
      @created="onShareCreated"
    />

    <!-- 卡密直连弹窗 -->
    <CardConnectModal :visible="showCardModal" @close="showCardModal = false" />

    <!-- 访客权限与配置微调弹窗 -->
    <ShareGuestSettingsModal
      v-if="guestConfigFor"
      :share="guestConfigFor"
      @close="guestConfigFor = null"
      @saved="onGuestConfigSaved"
    />

    <!-- 使用提示 -->
    <div class="tips-card">
      <div class="tips-header" @click="tipsCollapsed = !tipsCollapsed">
        <span>{{ $t('share.instructionsTitle') }}</span>
        <span class="tips-toggle">{{ tipsCollapsed ? $t('share.expandTips') : $t('share.collapseTips') }}</span>
      </div>
      <ul v-show="!tipsCollapsed" class="tips-list">
        <li v-html="$t('share.tip1')"></li>
        <li v-html="$t('share.tip2')"></li>
        <li v-html="$t('share.tip3')"></li>
        <li v-html="$t('share.tip4')"></li>
        <li v-html="$t('share.tip5')"></li>
        <li v-html="$t('share.tip6')"></li>
        <li v-html="$t('share.tip7')"></li>
        <li v-html="$t('share.tip8')"></li>
      </ul>
    </div>

    <!-- 空状态 / 加载状态 -->
    <div v-if="loading && shares.length === 0" class="state-block">{{ $t('share.loadingRecords') }}</div>
    <div v-else-if="shares.length === 0" class="state-block empty-block">
      <div class="empty-icon">📭</div>
      <p class="empty-text">{{ $t('share.noSharesHint') }}</p>
      <button class="btn-create-empty" @click="showCreateModal = true">
        {{ $t('share.createShareBtn') }}
      </button>
    </div>

    <!-- 存在分享记录时的列表 -->
    <template v-else>
      <!-- 1. PC 桌面端大屏表格视图 (>= 769px) -->
      <div class="table-wrapper desktop-only-view">
        <table class="share-table">
          <thead>
            <tr>
              <th>{{ $t('share.thCardCode') }}</th>
              <th>{{ $t('share.thTargetDevice') }}</th>
              <th>{{ $t('share.thMode') }}</th>
              <th>{{ $t('share.thConnStatus') }}</th>
              <th>{{ $t('share.thUseCount') }}</th>
              <th>{{ $t('share.thExpire') }}</th>
              <th>{{ $t('share.thNote') }}</th>
              <th>{{ $t('share.thCreator') }}</th>
              <th>{{ $t('share.thActions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in shares" :key="item.token_id">
              <td>
                <span class="card-badge" @click="copyText(item.card_code, 'card-' + item.token_id)" :title="$t('share.copyCardCode')">
                  {{ item.card_code }}
                </span>
              </td>
              <td class="device-cell">{{ item.device_id }}</td>
              <td>
                <span :class="['mode-badge', item.access_mode]">
                  {{ item.access_mode === 'full' ? $t('share.modeFull') : $t('share.modeViewOnly') }}
                </span>
                <div v-if="lockSummary(item)" class="lock-summary">{{ lockSummary(item) }}</div>
              </td>
              <td>
                <span v-if="item.active_connections > 0" class="conn-badge online">
                  {{ $t('share.activeUsersCount', { count: item.active_connections }) }}
                </span>
                <span v-else class="conn-badge idle">{{ $t('share.idleStatus') }}</span>
              </td>
              <td>
                <span class="count-badge" :class="{ 'has-use': (item.use_count || 0) > 0 }" :title="item.last_used_at ? $t('share.lastUsedAt', { time: formatTime(item.last_used_at) }) : ''">
                  {{ item.use_count || 0 }}
                </span>
              </td>
              <td>
                <div class="time-cell">{{ formatExpire(item.expires_at) }}</div>
                <div class="remain-cell">{{ formatRemain(item.expires_at) }}</div>
              </td>
              <td class="desc-cell">{{ item.description || '-' }}</td>
              <td class="creator-cell">{{ item.creator }}</td>
              <td class="action-cell">
                <button class="table-btn copy-sm" @click="copyText(fullShareUrl(item.token_id), item.token_id)">
                  {{ copiedId === item.token_id ? $t('share.copiedCheck') : $t('share.copyShareUrl') }}
                </button>
                <button class="table-btn config-sm" :title="$t('share.configHint')" @click="guestConfigFor = item">{{ $t('share.configBtn') }}</button>
                <button v-if="parseExpire(item.expires_at)" class="table-btn extend-sm" @click.stop="openExtendMenu(item.token_id, $event)">
                  {{ $t('share.extendDropdown') }}
                </button>
                <button class="table-btn revoke-sm" @click="revokeShare(item.token_id)">{{ $t('share.revoke') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 2. 手机移动端卡片视图 (<= 768px, 触屏友好一屏速览) -->
      <div class="mobile-cards-wrapper mobile-only-view">
        <div v-for="item in shares" :key="item.token_id" class="m-share-card">
          <!-- 卡片头部：卡密提取码(点击复制) + 连接状态 + 控制模式 -->
          <div class="m-card-header">
            <div class="m-card-code" @click="copyText(item.card_code, 'card-' + item.token_id)" :title="$t('share.copyCardCode')">
              <span class="m-code-val">{{ item.card_code }}</span>
              <span class="m-copy-icon">{{ copiedId === 'card-' + item.token_id ? '✓' : '📋' }}</span>
            </div>
            <div class="m-card-badges">
              <span :class="['conn-badge', item.active_connections > 0 ? 'online' : 'idle']">
                {{ item.active_connections > 0 ? $t('share.activeUsersCount', { count: item.active_connections }) : $t('share.idleStatus') }}
              </span>
              <span :class="['mode-badge', item.access_mode]">
                {{ item.access_mode === 'full' ? $t('share.modeFull') : $t('share.modeViewOnly') }}
              </span>
            </div>
          </div>

          <!-- 卡片内容：设备ID、到期时间倒计时、使用频次、创建者、备注、锁定项 -->
          <div class="m-card-body">
            <div class="m-detail-row">
              <span class="m-label">{{ $t('share.thTargetDevice') }}:</span>
              <span class="m-device-id" @click="copyText(item.device_id, 'dev-' + item.token_id)">
                {{ item.device_id }}
                <span v-if="copiedId === 'dev-' + item.token_id" class="m-copied-mini">✓</span>
              </span>
            </div>
            <div class="m-detail-row">
              <span class="m-label">{{ $t('share.thExpire') }}:</span>
              <div class="m-expire-info">
                <span class="m-expire-time">{{ formatExpire(item.expires_at) }}</span>
                <span v-if="formatRemain(item.expires_at)" class="m-remain-pill">{{ formatRemain(item.expires_at) }}</span>
              </div>
            </div>
            <div class="m-detail-row" v-if="item.description">
              <span class="m-label">{{ $t('share.thNote') }}:</span>
              <span class="m-note-val">{{ item.description }}</span>
            </div>
            <div class="m-detail-row" v-if="lockSummary(item)">
              <span class="m-label">{{ $t('share.guestLockedHint') || '权限' }}:</span>
              <span class="m-lock-summary">{{ lockSummary(item) }}</span>
            </div>
            <div class="m-meta-line">
              <span class="m-meta-item">{{ $t('share.thUseCount') }}: <b>{{ item.use_count || 0 }}</b></span>
              <span class="m-meta-item">{{ $t('share.thCreator') }}: {{ item.creator }}</span>
            </div>
          </div>

          <!-- 卡片底部快捷操作栏 -->
          <div class="m-card-actions">
            <button class="m-action-btn btn-copy-link" @click="copyText(fullShareUrl(item.token_id), item.token_id)">
              {{ copiedId === item.token_id ? $t('share.copiedCheck') : $t('share.copyShareUrl') }}
            </button>
            <button class="m-action-btn btn-config" @click="guestConfigFor = item">
              {{ $t('share.configBtn') }}
            </button>
            <button v-if="parseExpire(item.expires_at)" class="m-action-btn btn-extend" @click.stop="openExtendMenu(item.token_id, $event)">
              {{ $t('share.extendDropdown') }}
            </button>
            <button class="m-action-btn btn-revoke" @click="revokeShare(item.token_id)">
              {{ $t('share.revoke') }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- 延时菜单：fixed 定位，针对移动端做边界防溢出处理 -->
    <div v-if="extendMenuFor" class="extend-overlay" @click="extendMenuFor = ''"></div>
    <div v-if="extendMenuFor" class="extend-menu" :style="extendMenuStyle" @click.stop>
      <button v-for="opt in extendOptions" :key="opt.sec" class="extend-item" @click="extendShare(extendMenuFor, opt.sec)">
        +{{ opt.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import CardConnectModal from '@/components/CardConnectModal.vue'
import ShareGuestSettingsModal from '@/components/ShareGuestSettingsModal.vue'
import ShareModal from '@/components/ShareModal.vue'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()

const shares = ref([])
const loading = ref(false)
const copiedId = ref('')
const serverAddresses = ref([])
const selectedAddress = ref('')
const showCardModal = ref(false)
const showCreateModal = ref(false)
const guestConfigFor = ref(null)
const extendMenuFor = ref('')
const extendMenuPos = ref({ top: 0, left: 0 })
const extendOptions = computed(() => [
  { label: t('share.extend30m'), sec: 1800 },
  { label: t('share.extend1h'), sec: 3600 },
  { label: t('share.extend12h'), sec: 43200 },
  { label: t('share.extend1d'), sec: 86400 },
  { label: t('share.extend7d'), sec: 604800 }
])

const EXTEND_MENU_WIDTH = 110
const extendMenuStyle = computed(() => ({
  top: extendMenuPos.value.top + 'px',
  left: extendMenuPos.value.left + 'px'
}))

function openExtendMenu(tokenID, e) {
  if (extendMenuFor.value === tokenID) {
    extendMenuFor.value = ''
    return
  }
  const rect = e.currentTarget.getBoundingClientRect()
  const menuHeight = extendOptions.value.length * 32 + 10
  let top = rect.bottom + 4
  // 下方空间不足则向上弹出
  if (top + menuHeight > window.innerHeight - 8) {
    top = rect.top - menuHeight - 4
  }
  let left = rect.right - EXTEND_MENU_WIDTH
  if (left + EXTEND_MENU_WIDTH > window.innerWidth - 8) {
    left = window.innerWidth - EXTEND_MENU_WIDTH - 8
  }
  if (left < 8) left = 8
  extendMenuPos.value = { top, left }
  extendMenuFor.value = tokenID
}

const tipsCollapsed = ref(localStorage.getItem('share_admin_tips_collapsed') === '1')

// 持久化提示卡折叠状态
watch(tipsCollapsed, (v) => {
  try { localStorage.setItem('share_admin_tips_collapsed', v ? '1' : '0') } catch (e) {}
})

function getAuthHeaders() {
  const token = localStorage.getItem('auth_token') || ''
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

async function fetchShares() {
  loading.value = true
  try {
    const res = await fetch('/api/share/list', { headers: getAuthHeaders() })
    if (res.ok) {
      const json = await res.json()
      if (json.code === 0) {
        shares.value = (json.data || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      }
    }
  } catch (e) {
  } finally {
    loading.value = false
  }
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

function fullShareUrl(token) {
  const host = selectedAddress.value || window.location.host
  return `${window.location.protocol}//${host}/share?token=${encodeURIComponent(token)}`
}

function copyText(text, id) {
  navigator.clipboard.writeText(text).then(() => {
    copiedId.value = id
    setTimeout(() => {
      if (copiedId.value === id) copiedId.value = ''
    }, 2000)
  })
}

async function revokeShare(tokenID) {
  if (!confirm(t('share.confirmRevoke'))) return
  try {
    const res = await fetch('/api/share/revoke', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ token: tokenID })
    })
    if (res.ok) fetchShares()
  } catch (e) {}
}

async function extendShare(tokenID, seconds) {
  extendMenuFor.value = ''
  try {
    const res = await fetch('/api/share/extend', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ token: tokenID, extend_seconds: seconds })
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.code === 0) {
      fetchShares()
    } else {
      alert(t('share.extendFailed') + (json.msg || ('HTTP ' + res.status)))
    }
  } catch (e) {
    alert(t('share.networkError') + e.message)
  }
}

function lockSummary(item) {
  const parts = []
  if (item.forbid_bitrate) parts.push(t('settings.bitrate'))
  if (item.forbid_fps) parts.push(t('settings.maxFps'))
  if (item.forbid_resolution) parts.push(t('settings.maxSize'))
  if (item.forbid_audio) parts.push(t('settings.audio'))
  return parts.length ? `🔒 ${parts.join('·')}` : ''
}

function onGuestConfigSaved() {
  guestConfigFor.value = null
  fetchShares()
}

function onShareCreated() {
  fetchShares()
}

function parseExpire(expiresAt) {
  if (!expiresAt) return null
  const expDate = new Date(expiresAt)
  if (Number.isNaN(expDate.getTime()) || expDate.getFullYear() <= 1) return null // Go 零值时间 = 永久
  return expDate
}

function formatExpire(expiresAt) {
  const tExp = parseExpire(expiresAt)
  if (!tExp) return t('share.neverExpire')
  return tExp.toLocaleString(undefined, { hour12: false })
}

function formatRemain(expiresAt) {
  const tExp = parseExpire(expiresAt)
  if (!tExp) return ''
  const ms = tExp.getTime() - Date.now()
  if (ms <= 0) return t('share.expired')
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return t('share.remainDaysHours', { d, h })
  if (h > 0) return t('share.remainHoursMins', { h, m })
  return t('share.remainMins', { m })
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { hour12: false })
}

let refreshTimer = null

onMounted(() => {
  const authStore = useAuthStore()
  if (!authStore.isAdmin) {
    window.dispatchEvent(new CustomEvent('cloudphone-navigate', { detail: '/' }))
    return
  }
  fetchShares()
  fetchServerAddresses()
  refreshTimer = setInterval(fetchShares, 15000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.share-admin-page {
  padding: 20px 24px;
  height: 100%;
  overflow-y: auto;
  color: #c9d1d9;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-header h2 {
  margin: 0;
  font-size: 1.18rem;
  font-weight: 600;
  color: #f1f5f9;
}

.shares-count-pill {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  font-size: 0.76rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.btn-create-share {
  padding: 7px 16px;
  background: linear-gradient(135deg, #0284c7, #6366f1);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3);
}

.btn-create-share:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(2, 132, 199, 0.45);
}

.btn-card-connect {
  padding: 7px 14px;
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 0.84rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-card-connect:hover {
  background: #30363d;
  color: #fff;
}

.addr-select {
  padding: 6px 10px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 0.82rem;
  max-width: 240px;
  height: 33px;
  box-sizing: border-box;
}

.btn-refresh {
  padding: 6px 14px;
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 0.84rem;
  cursor: pointer;
  height: 33px;
  box-sizing: border-box;
  transition: all 0.2s;
}

.btn-refresh:hover:not(:disabled) {
  background: #30363d;
  color: #fff;
}

/* 使用提示卡片 */
.tips-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 10px;
  margin-bottom: 16px;
  overflow: hidden;
}

.tips-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 14px;
  cursor: pointer;
  font-size: 0.86rem;
  font-weight: 600;
  user-select: none;
}

.tips-header:hover {
  background: rgba(88, 166, 255, 0.05);
}

.tips-toggle {
  color: #8b949e;
  font-size: 0.76rem;
  font-weight: 400;
}

.tips-list {
  margin: 0;
  padding: 0 14px 10px 28px;
  font-size: 0.8rem;
  line-height: 1.6;
  color: #8b949e;
}

.tips-list b {
  color: #c9d1d9;
}

/* 状态块 */
.state-block {
  padding: 40px;
  text-align: center;
  color: #8b949e;
  background: #161b22;
  border: 1px dashed #30363d;
  border-radius: 10px;
  font-size: 0.9rem;
}

.empty-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.empty-icon {
  font-size: 2.2rem;
}

.empty-text {
  margin: 0;
  max-width: 400px;
  line-height: 1.5;
}

.btn-create-empty {
  padding: 8px 20px;
  background: linear-gradient(135deg, #0284c7, #6366f1);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-weight: 600;
  font-size: 0.86rem;
  cursor: pointer;
  margin-top: 4px;
}

/* 1. PC 桌面端表格视图 */
.desktop-only-view {
  display: block;
}

.mobile-only-view {
  display: none !important;
}

.table-wrapper {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 10px;
  overflow-x: auto;
}

.share-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.share-table th, .share-table td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid #21262d;
  white-space: nowrap;
}

.share-table th {
  color: #8b949e;
  font-weight: 500;
  background: #0d1117;
}

.card-badge {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.card-badge:hover {
  background: rgba(56, 189, 248, 0.25);
}

.device-cell {
  font-family: monospace;
  font-size: 0.8rem;
}

.mode-badge {
  font-size: 0.78rem;
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

.time-cell {
  font-size: 0.82rem;
}

.remain-cell {
  font-size: 0.72rem;
  color: #8b949e;
}

.desc-cell {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.creator-cell {
  color: #8b949e;
}

.action-cell {
  display: flex;
  gap: 6px;
}

.table-btn {
  border: none;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 0.78rem;
  cursor: pointer;
}

.copy-sm {
  background: #30363d;
  color: #c9d1d9;
}

.copy-sm:hover {
  background: #0284c7;
  color: #fff;
}

.revoke-sm {
  background: rgba(244, 63, 94, 0.15);
  color: #f43f5e;
}

.revoke-sm:hover {
  background: #f43f5e;
  color: #fff;
}

.conn-badge {
  font-size: 0.78rem;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.conn-badge.online {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.conn-badge.idle {
  background: rgba(148, 163, 184, 0.12);
  color: #8b949e;
}

.count-badge {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(139, 148, 158, 0.12);
  color: #8b949e;
  font-variant-numeric: tabular-nums;
}

.count-badge.has-use {
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
}

.extend-sm {
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
}

.extend-sm:hover {
  background: #0284c7;
  color: #fff;
}

.config-sm {
  background: rgba(163, 113, 247, 0.12);
  color: #a371f7;
}

.config-sm:hover {
  background: #a371f7;
  color: #fff;
}

.lock-summary {
  font-size: 0.72rem;
  color: #fbbf24;
  margin-top: 4px;
  white-space: nowrap;
}

/* 2. 移动端卡片视图样式 (桌面端默认隐藏) */
.mobile-cards-wrapper {
  display: none;
  flex-direction: column;
  gap: 12px;
}

.m-share-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.m-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 10px;
}

.m-card-code {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.35);
  padding: 3px 10px;
  border-radius: 6px;
  cursor: pointer;
}

.m-code-val {
  font-family: monospace;
  font-weight: 700;
  font-size: 1rem;
  color: #38bdf8;
  letter-spacing: 0.5px;
}

.m-copy-icon {
  font-size: 0.8rem;
  color: #94a3b8;
}

.m-card-badges {
  display: flex;
  align-items: center;
  gap: 6px;
}

.m-card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.82rem;
}

.m-detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.m-label {
  color: #8b949e;
  width: 75px;
  flex-shrink: 0;
  font-size: 0.78rem;
}

.m-device-id {
  font-family: monospace;
  color: #cbd5e1;
  font-size: 0.84rem;
  cursor: pointer;
  word-break: break-all;
}

.m-copied-mini {
  color: #10b981;
  font-size: 0.75rem;
  margin-left: 4px;
}

.m-expire-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.m-expire-time {
  color: #f1f5f9;
}

.m-remain-pill {
  font-size: 0.72rem;
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  padding: 1px 6px;
  border-radius: 4px;
}

.m-note-val {
  color: #e2e8f0;
  word-break: break-all;
}

.m-lock-summary {
  font-size: 0.75rem;
  color: #fbbf24;
}

.m-meta-line {
  display: flex;
  justify-content: space-between;
  padding-top: 4px;
  border-top: 1px dashed rgba(255, 255, 255, 0.05);
  color: #8b949e;
  font-size: 0.75rem;
}

.m-meta-line b {
  color: #38bdf8;
}

.m-card-actions {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 6px;
  padding-top: 6px;
}

.m-action-btn {
  height: 32px;
  border: none;
  border-radius: 6px;
  font-size: 0.76rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  white-space: nowrap;
}

.m-action-btn.btn-copy-link {
  background: #21262d;
  color: #c9d1d9;
}

.m-action-btn.btn-config {
  background: rgba(163, 113, 247, 0.15);
  color: #a371f7;
}

.m-action-btn.btn-extend {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
}

.m-action-btn.btn-revoke {
  background: rgba(244, 63, 94, 0.15);
  color: #f43f5e;
}

/* 延时浮动菜单 */
.extend-menu {
  position: fixed;
  z-index: 60;
  width: 110px;
  padding: 4px;
  background: #1c2230;
  border: 1px solid #30363d;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.extend-item {
  background: transparent;
  border: none;
  color: #c9d1d9;
  font-size: 0.8rem;
  text-align: left;
  padding: 7px 10px;
  border-radius: 5px;
  cursor: pointer;
  white-space: nowrap;
}

.extend-item:hover {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
}

.extend-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
}

/* 移动端断点适配 (<= 768px) */
@media (max-width: 768px) {
  .share-admin-page {
    padding: 12px;
  }

  .desktop-only-view {
    display: none !important;
  }

  .mobile-only-view,
  .mobile-cards-wrapper {
    display: flex !important;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .title-wrap {
    justify-content: space-between;
  }

  .header-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    width: 100%;
  }

  .btn-create-share {
    grid-column: span 2;
    height: 36px;
    font-size: 0.88rem;
  }

  .btn-card-connect,
  .btn-refresh {
    height: 32px;
    font-size: 0.78rem;
    padding: 0 8px;
  }

  .addr-select {
    grid-column: span 2;
    max-width: none;
    width: 100%;
    height: 32px;
    font-size: 0.78rem;
  }

  .tips-list {
    padding: 0 12px 10px 24px;
    font-size: 0.76rem;
  }
}
</style>
