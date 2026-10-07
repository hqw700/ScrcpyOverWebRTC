<template>
  <div class="share-admin-page">
    <div class="page-header">
      <h2>{{ $t('share.adminPageTitle') }}</h2>
      <div class="header-actions">
        <button class="btn-card-connect" @click="showCardModal = true">{{ $t('share.cardConnectBtn') }}</button>
        <select v-model="selectedAddress" class="addr-select" :title="$t('share.serverAddrTitle')">
          <option v-for="addr in serverAddresses" :key="addr" :value="addr">{{ addr }}</option>
        </select>
        <button class="btn-refresh" :disabled="loading" @click="fetchShares">
          {{ loading ? $t('share.refreshing') : $t('share.refresh') }}
        </button>
      </div>
    </div>

    <!-- 卡密直连弹窗（原侧边栏“卡密”入口，并入本页） -->
    <CardConnectModal :visible="showCardModal" @close="showCardModal = false" />

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

    <!-- 列表 -->
    <div v-if="loading && shares.length === 0" class="state-block">{{ $t('share.loadingRecords') }}</div>
    <div v-else-if="shares.length === 0" class="state-block">
      {{ $t('share.noSharesHint') }}
    </div>
    <div v-else class="table-wrapper">
      <table class="share-table">
        <thead>
          <tr>
            <th>{{ $t('share.thCardCode') }}</th>
            <th>{{ $t('share.thTargetDevice') }}</th>
            <th>{{ $t('share.thMode') }}</th>
            <th>{{ $t('share.thConnStatus') }}</th>
            <th>{{ $t('share.thExpire') }}</th>
            <th>{{ $t('share.thNote') }}</th>
            <th>{{ $t('share.thCreator') }}</th>
            <th>{{ $t('share.thActions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in shares" :key="item.token_id">
            <td><span class="card-badge">{{ item.card_code }}</span></td>
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

    <!-- 延时菜单：fixed 定位，避免被表格 overflow 容器裁剪 -->
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
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()

const shares = ref([])
const loading = ref(false)
const copiedId = ref('')
const serverAddresses = ref([])
const selectedAddress = ref('')
const showCardModal = ref(false)
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

const EXTEND_MENU_WIDTH = 100
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
  const menuHeight = extendOptions.length * 32 + 10
  let top = rect.bottom + 4
  // 下方空间不足则向上弹出
  if (top + menuHeight > window.innerHeight - 8) {
    top = rect.top - menuHeight - 4
  }
  let left = rect.right - EXTEND_MENU_WIDTH
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
    // 不带 device_id：返回当前用户可见的全部分享
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

// 连接状态近实时：页面驻留期间每 15s 静默刷新一次
let refreshTimer = null

onMounted(() => {
  // 分享管理仅管理员可用：普通用户直达此页时强制回首页
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
  padding: 24px;
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
  gap: 10px;
}

.page-header h2 {
  margin: 0;
  font-size: 1.15rem;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.addr-select {
  padding: 7px 10px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 0.82rem;
  max-width: 260px;
}

.btn-refresh {
  padding: 7px 16px;
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 0.84rem;
  cursor: pointer;
}

.btn-refresh:hover {
  background: #30363d;
}

.btn-card-connect {
  padding: 7px 16px;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
}

.tips-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 10px;
  margin-bottom: 18px;
  overflow: hidden;
}

.tips-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  user-select: none;
}

.tips-header:hover {
  background: rgba(88, 166, 255, 0.05);
}

.tips-toggle {
  color: #8b949e;
  font-size: 0.78rem;
  font-weight: 400;
}

.tips-list {
  margin: 0;
  padding: 0 14px 12px 32px;
  font-size: 0.82rem;
  line-height: 1.7;
  color: #8b949e;
}

.tips-list b {
  color: #c9d1d9;
}

.tips-list code {
  background: #0d1117;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.78rem;
}

.tag-full { color: #818cf8; }
.tag-view { color: #fbbf24; }

.state-block {
  padding: 48px;
  text-align: center;
  color: #8b949e;
  background: #161b22;
  border: 1px dashed #30363d;
  border-radius: 10px;
  font-size: 0.9rem;
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

.extend-menu {
  position: fixed;
  z-index: 60;
  width: 100px;
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

/* 移动端适配 (<=1024px)：头部换行堆叠、表格横向滚动、操作按钮收纳换行 */
@media (max-width: 1024px) {
  .share-admin-page {
    padding: 12px;
  }

  /* 页头与操作行换行堆叠 */
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .page-header h2 {
    font-size: 1.05rem;
  }

  .header-actions {
    flex-wrap: wrap;
    width: 100%;
  }

  .addr-select {
    flex: 1;
    min-width: 0;
    max-width: none;
    font-size: 0.78rem;
  }

  .btn-card-connect,
  .btn-refresh {
    padding: 7px 12px;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .tips-list {
    padding: 0 12px 10px 26px;
    font-size: 0.78rem;
  }

  .state-block {
    padding: 28px 14px;
  }

  /* 数据表容器横向滚动，单元格压缩 */
  .table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .share-table {
    font-size: 0.78rem;
  }

  .share-table th,
  .share-table td {
    padding: 8px 10px;
  }

  .desc-cell {
    max-width: 120px;
  }

  /* 操作按钮收纳换行 */
  .action-cell {
    flex-wrap: wrap;
    gap: 4px;
    min-width: 140px;
  }

  .table-btn {
    padding: 4px 8px;
    font-size: 0.74rem;
  }

  /* 延时菜单限宽防溢出 */
  .extend-menu {
    max-width: 94vw;
  }
}
</style>
