<template>
  <div class="share-admin-page">
    <div class="page-header">
      <h2>🔗 分享与卡密管理</h2>
      <div class="header-actions">
        <button class="btn-card-connect" @click="showCardModal = true">🔑 卡密连接</button>
        <select v-model="selectedAddress" class="addr-select" title="复制链接时使用的服务器地址">
          <option v-for="addr in serverAddresses" :key="addr" :value="addr">{{ addr }}</option>
        </select>
        <button class="btn-refresh" :disabled="loading" @click="fetchShares">
          {{ loading ? '刷新中...' : '🔄 刷新' }}
        </button>
      </div>
    </div>

    <!-- 卡密直连弹窗（原侧边栏“卡密”入口，并入本页） -->
    <CardConnectModal :visible="showCardModal" @close="showCardModal = false" />

    <!-- 使用提示 -->
    <div class="tips-card">
      <div class="tips-header" @click="tipsCollapsed = !tipsCollapsed">
        <span>💡 使用说明</span>
        <span class="tips-toggle">{{ tipsCollapsed ? '展开 ▾' : '收起 ▴' }}</span>
      </div>
      <ul v-show="!tipsCollapsed" class="tips-list">
        <li><b>两种发放方式</b>：分享链接（直接打开）和卡密提取码（点本页右上角「卡密连接」，或在登录页输入后兑换），两者等价，卡密只是链接的短码形式。</li>
        <li><b>访客免登录</b>：访客打开链接即进入单设备页面，无需账号，也看不到后台其他设备。</li>
        <li><b>权限模式</b>：<span class="tag-full">⚡ 完整控制</span> 允许触控/按键注入；<span class="tag-view">👁️ 仅观看</span> 只能看画面和听声音，所有控制指令在服务端直接丢弃。</li>
        <li><b>访问密码</b>：设置 PIN 后，链接和卡密渠道都需要输入密码才能进入。</li>
        <li><b>有效期与撤销</b>：到期自动失效（服务端每 5 分钟清理并踢断在线访客）；"延时"可在原到期时间上顺延（已过期的从当前时间起算）；"撤销"立即断开该分享的所有在线访客。</li>
        <li><b>服务器地址</b>：右上角可选择生成链接使用的地址，访客跨网访问时请选对应网段的 IP（支持 IPv6）。</li>
        <li><b>重启恢复</b>：有效期内的分享持久化在服务端，服务器重启后仍有效；已过期的不会恢复。</li>
      </ul>
    </div>

    <!-- 列表 -->
    <div v-if="loading && shares.length === 0" class="state-block">加载分享记录中...</div>
    <div v-else-if="shares.length === 0" class="state-block">
      📭 暂无活跃的分享。到设备卡片的菜单里选择「分享设备 / 卡密」即可创建。
    </div>
    <div v-else class="table-wrapper">
      <table class="share-table">
        <thead>
          <tr>
            <th>卡密提取码</th>
            <th>目标设备</th>
            <th>权限模式</th>
            <th>连接状态</th>
            <th>到期时间</th>
            <th>备注</th>
            <th>创建者</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in shares" :key="item.token_id">
            <td><span class="card-badge">{{ item.card_code }}</span></td>
            <td class="device-cell">{{ item.device_id }}</td>
            <td>
              <span :class="['mode-badge', item.access_mode]">
                {{ item.access_mode === 'full' ? '⚡ 完整控制' : '👁️ 仅观看' }}
              </span>
            </td>
            <td>
              <span v-if="item.active_connections > 0" class="conn-badge online">
                🟢 {{ item.active_connections }} 人在线
              </span>
              <span v-else class="conn-badge idle">⚪ 空闲</span>
            </td>
            <td>
              <div class="time-cell">{{ formatExpire(item.expires_at) }}</div>
              <div class="remain-cell">{{ formatRemain(item.expires_at) }}</div>
            </td>
            <td class="desc-cell">{{ item.description || '-' }}</td>
            <td class="creator-cell">{{ item.creator }}</td>
            <td class="action-cell">
              <button class="table-btn copy-sm" @click="copyText(fullShareUrl(item.token_id), item.token_id)">
                {{ copiedId === item.token_id ? '已复制 ✓' : '复制链接' }}
              </button>
              <button v-if="parseExpire(item.expires_at)" class="table-btn extend-sm" @click.stop="openExtendMenu(item.token_id, $event)">
                延时 ▾
              </button>
              <button class="table-btn revoke-sm" @click="revokeShare(item.token_id)">撤销</button>
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
import CardConnectModal from '@/components/CardConnectModal.vue'

const shares = ref([])
const loading = ref(false)
const copiedId = ref('')
const serverAddresses = ref([])
const selectedAddress = ref('')
const showCardModal = ref(false)
const extendMenuFor = ref('')
const extendMenuPos = ref({ top: 0, left: 0 })
const extendOptions = [
  { label: '30分钟', sec: 1800 },
  { label: '1小时', sec: 3600 },
  { label: '12小时', sec: 43200 },
  { label: '1天', sec: 86400 },
  { label: '7天', sec: 604800 }
]

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
  const t = localStorage.getItem('auth_token') || ''
  const headers = { 'Content-Type': 'application/json' }
  if (t) headers['Authorization'] = `Bearer ${t}`
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
  if (!confirm('确定要撤销此分享吗？撤销后卡密与链接立即失效，在线访客将立即断开连接。')) return
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
      alert('延时失败: ' + (json.msg || ('HTTP ' + res.status)))
    }
  } catch (e) {
    alert('网络请求异常: ' + e.message)
  }
}

function parseExpire(expiresAt) {
  if (!expiresAt) return null
  const t = new Date(expiresAt)
  if (Number.isNaN(t.getTime()) || t.getFullYear() <= 1) return null // Go 零值时间 = 永久
  return t
}

function formatExpire(expiresAt) {
  const t = parseExpire(expiresAt)
  if (!t) return '♾️ 永久有效'
  return t.toLocaleString('zh-CN', { hour12: false })
}

function formatRemain(expiresAt) {
  const t = parseExpire(expiresAt)
  if (!t) return ''
  const ms = t.getTime() - Date.now()
  if (ms <= 0) return '已到期'
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `剩余 ${d} 天 ${h} 小时`
  if (h > 0) return `剩余 ${h} 小时 ${m} 分`
  return `剩余 ${m} 分`
}

// 连接状态近实时：页面驻留期间每 15s 静默刷新一次
let refreshTimer = null

onMounted(() => {
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
</style>
