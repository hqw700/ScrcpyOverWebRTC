<template>
  <div class="admin-page-container">
    <div class="admin-card devices-panel">
      <div class="panel-header">
        <div class="header-left">
          <h2>📦 设备租约运营</h2>
          <span class="user-count">共 {{ filteredDevices.length }} / {{ allDevices.length }} 台设备</span>
        </div>
        <button class="refresh-btn" @click="refresh" :disabled="deviceStore.loading">⟳ 刷新</button>
      </div>

      <!-- 状态统计条 -->
      <div class="status-summary">
        <button
          v-for="s in statusSummary"
          :key="s.value"
          class="summary-chip"
          :class="[s.value, { active: statusFilter === s.value }]"
          @click="statusFilter = statusFilter === s.value ? 'all' : s.value"
        >
          <span class="chip-dot"></span>{{ s.label }} {{ s.count }}
        </button>
      </div>

      <!-- 筛选条 -->
      <div class="filter-bar">
        <div class="search-box">
          <input type="text" v-model="searchQuery" placeholder="🔍 搜索设备 ID / 型号..." />
        </div>
        <select v-model="tagFilter" class="tag-select">
          <option value="">全部标签</option>
          <option v-for="tag in tagStore.tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
        </select>
      </div>

      <div class="table-wrapper">
        <table class="premium-table">
          <thead>
            <tr>
              <th>租约状态</th>
              <th>设备 ID</th>
              <th>型号</th>
              <th>在线</th>
              <th>当前租户</th>
              <th>剩余时长</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dev in filteredDevices" :key="dev.id" :class="'lease-row-' + leaseStatus(dev)">
              <td>
                <span class="lease-chip" :class="leaseStatus(dev)">
                  <span class="chip-dot"></span>{{ leaseStatusLabel(dev) }}
                </span>
              </td>
              <td class="dev-id-cell" :title="dev.id">{{ dev.id }}</td>
              <td class="model-cell" :title="dev.info?.model">{{ dev.info?.model || '-' }}</td>
              <td>
                <div class="online-status-wrapper">
                  <span :class="['status-dot', { online: dev.status === 'online' }]"></span>
                  <span class="status-text">{{ dev.status === 'online' ? '在线' : '离线' }}</span>
                </div>
              </td>
              <td>
                <span class="tenant-name" v-if="dev.lease">{{ dev.lease.username }}</span>
                <span class="free-text" v-else-if="dev.status === 'online'">空闲</span>
                <span class="free-text" v-else>-</span>
                <div class="lease-note" v-if="dev.lease?.note" :title="dev.lease.note">{{ dev.lease.note }}</div>
              </td>
              <td>
                <span class="remain-text" :class="{ warn: leaseStatus(dev) === 'expiring', danger: leaseStatus(dev) === 'expired' }">
                  {{ dev.lease ? formatLeaseRemaining(dev.lease.remaining_seconds) : '-' }}
                </span>
              </td>
              <td class="actions-cell">
                <template v-if="!dev.lease">
                  <button class="op-btn primary" @click="openCreateModal(dev)">开租约</button>
                </template>
                <template v-else>
                  <button class="op-btn" @click="openExtendModal(dev)">续期</button>
                  <button class="op-btn danger" @click="confirmRevoke(dev)">收回</button>
                </template>
              </td>
            </tr>
            <tr v-if="filteredDevices.length === 0">
              <td colspan="7" class="empty-row">没有匹配的设备</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 开租约弹窗 -->
    <transition name="fade">
      <div class="modal-overlay" v-if="createTarget" @click.self="createTarget = null">
        <div class="glass-modal">
          <div class="modal-header">
            <h3>🔑 开租约：{{ createTarget.id }}</h3>
            <button class="close-modal" @click="createTarget = null">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>租户（用户）</label>
              <select v-model="createForm.username">
                <option value="" disabled>请选择用户</option>
                <option v-for="u in tenantUsers" :key="u.username" :value="u.username">
                  {{ u.username }}{{ u.role === 'admin' ? '（管理员）' : '' }}{{ u.note ? ' - ' + u.note : '' }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>租期时长</label>
              <select v-model="createForm.duration">
                <option :value="86400">1 天</option>
                <option :value="604800">7 天</option>
                <option :value="2592000">30 天</option>
                <option :value="7776000">90 天</option>
                <option :value="0">♾️ 永久</option>
                <option value="custom">⚙️ 自定义天数</option>
              </select>
              <input
                v-if="createForm.duration === 'custom'"
                v-model.number="createForm.customDays"
                type="number"
                min="1"
                placeholder="输入天数..."
                style="margin-top: 8px"
              />
            </div>
            <div class="form-group">
              <label>备注（订单号 / 渠道等，可选）</label>
              <input type="text" v-model="createForm.note" placeholder="例如：闲鱼订单 #123456" />
            </div>
          </div>
          <div class="modal-footer">
            <span v-if="modalError" class="modal-error">{{ modalError }}</span>
            <button class="modal-btn cancel" @click="createTarget = null">取消</button>
            <button class="modal-btn submit" @click="submitCreate" :disabled="modalSubmitting || !createForm.username">确认开租</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 续期弹窗 -->
    <transition name="fade">
      <div class="modal-overlay" v-if="extendTarget" @click.self="extendTarget = null">
        <div class="glass-modal">
          <div class="modal-header">
            <h3>⏳ 续期：{{ extendTarget.id }}</h3>
            <button class="close-modal" @click="extendTarget = null">✕</button>
          </div>
          <div class="modal-body">
            <p class="modal-info">
              当前租户：<b>{{ extendTarget.lease?.username }}</b>，
              {{ formatLeaseRemaining(extendTarget.lease?.remaining_seconds) }}
            </p>
            <div class="form-group">
              <label>追加时长（在当前到期时间上累加）</label>
              <select v-model="extendForm.duration">
                <option :value="86400">+1 天</option>
                <option :value="604800">+7 天</option>
                <option :value="2592000">+30 天</option>
                <option :value="7776000">+90 天</option>
                <option value="custom">⚙️ 自定义天数</option>
              </select>
              <input
                v-if="extendForm.duration === 'custom'"
                v-model.number="extendForm.customDays"
                type="number"
                min="1"
                placeholder="输入天数..."
                style="margin-top: 8px"
              />
            </div>
          </div>
          <div class="modal-footer">
            <span v-if="modalError" class="modal-error">{{ modalError }}</span>
            <button class="modal-btn cancel" @click="extendTarget = null">取消</button>
            <button class="modal-btn submit" @click="submitExtend" :disabled="modalSubmitting">确认续期</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { useTagStore } from '@/stores/tags'
import { authHeaders, readError } from '@/utils/api'
import { formatLeaseRemaining } from '@/utils/format'

const deviceStore = useDeviceStore()
const tagStore = useTagStore()

const EXPIRING_THRESHOLD = 7 * 86400 // 7 天内到期

// 在线 + 服务端记录的离线设备（租约与在线状态无关，离线机器同样可能在租）
const allDevices = computed(() => [...deviceStore.devices, ...deviceStore.offlineDevices])

// 租约状态分类：free 空闲(在线且可分配) / rented 出租中 / expiring 即将到期 / expired 已逾期 / offline 离线(不可分配)
function leaseStatus(dev) {
  const lease = dev.lease
  if (!lease) return dev.status === 'online' ? 'free' : 'offline'
  const r = lease.remaining_seconds
  if (r === -1 || r === undefined || r === null) return 'rented' // -1 = 永久
  if (r <= 0) return 'expired'
  if (r <= EXPIRING_THRESHOLD) return 'expiring'
  return 'rented'
}

const STATUS_LABELS = { free: '空闲', rented: '出租中', expiring: '即将到期', expired: '已逾期', offline: '离线' }
function leaseStatusLabel(dev) {
  return STATUS_LABELS[leaseStatus(dev)]
}

const statusSummary = computed(() => {
  const counts = { free: 0, rented: 0, expiring: 0, expired: 0, offline: 0 }
  for (const dev of allDevices.value) counts[leaseStatus(dev)]++
  return [
    { value: 'free', label: '空闲', count: counts.free },
    { value: 'rented', label: '出租中', count: counts.rented },
    { value: 'expiring', label: '即将到期', count: counts.expiring },
    { value: 'expired', label: '已逾期', count: counts.expired },
    { value: 'offline', label: '离线', count: counts.offline }
  ]
})

// 筛选：状态 / 标签 / 型号与 ID 搜索
const statusFilter = ref('all')
const tagFilter = ref('')
const searchQuery = ref('')

const filteredDevices = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return allDevices.value.filter(dev => {
    if (statusFilter.value !== 'all' && leaseStatus(dev) !== statusFilter.value) return false
    if (tagFilter.value && !tagStore.getTagIdsForDevice(dev.id).includes(tagFilter.value)) return false
    if (q) {
      const model = (dev.info?.model || '').toLowerCase()
      if (!dev.id.toLowerCase().includes(q) && !model.includes(q)) return false
    }
    return true
  })
})

function refresh() {
  deviceStore.fetchDevices()
}

// --- 开租约 ---
const createTarget = ref(null)
const createForm = ref({ username: '', duration: 604800, customDays: 7, note: '' })
const tenantUsers = ref([])
const modalError = ref('')
const modalSubmitting = ref(false)

async function openCreateModal(dev) {
  createTarget.value = dev
  createForm.value = { username: '', duration: 604800, customDays: 7, note: '' }
  modalError.value = ''
  if (tenantUsers.value.length === 0) {
    try {
      const res = await fetch('/api/admin/users', { headers: authHeaders() })
      if (res.ok) tenantUsers.value = await res.json()
    } catch (err) {
      console.error('Fetch users for lease failed:', err)
    }
  }
}

async function submitCreate() {
  const dev = createTarget.value
  modalSubmitting.value = true
  modalError.value = ''
  try {
    const duration = createForm.value.duration === 'custom'
      ? Math.max(1, createForm.value.customDays || 1) * 86400
      : Number(createForm.value.duration)
    const res = await fetch('/api/admin/leases/create', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        username: createForm.value.username,
        device_id: dev.id,
        duration_seconds: duration,
        note: createForm.value.note
      })
    })
    if (res.status === 409) {
      // 设备已有活跃租约：提示现有租户
      let msg = '该设备已有活跃租约'
      try {
        const data = await res.json()
        if (data.existing_lease) {
          msg = `该设备已出租给「${data.existing_lease.username}」（${formatLeaseRemaining(data.existing_lease.remaining_seconds)}），请先收回原租约`
        }
      } catch (e) { /* ignore */ }
      throw new Error(msg)
    }
    if (!res.ok) throw new Error(await readError(res, '开租失败'))
    createTarget.value = null
    refresh()
  } catch (err) {
    modalError.value = err.message
  } finally {
    modalSubmitting.value = false
  }
}

// --- 续期 ---
const extendTarget = ref(null)
const extendForm = ref({ duration: 604800, customDays: 7 })

function openExtendModal(dev) {
  extendTarget.value = dev
  extendForm.value = { duration: 604800, customDays: 7 }
  modalError.value = ''
}

async function submitExtend() {
  const dev = extendTarget.value
  modalSubmitting.value = true
  modalError.value = ''
  try {
    const duration = extendForm.value.duration === 'custom'
      ? Math.max(1, extendForm.value.customDays || 1) * 86400
      : Number(extendForm.value.duration)
    const res = await fetch('/api/admin/leases/extend', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ lease_id: dev.lease.lease_id, duration_seconds: duration })
    })
    if (!res.ok) throw new Error(await readError(res, '续期失败'))
    extendTarget.value = null
    refresh()
  } catch (err) {
    modalError.value = err.message
  } finally {
    modalSubmitting.value = false
  }
}

// --- 收回 ---
async function confirmRevoke(dev) {
  const lease = dev.lease
  if (!lease) return
  if (!confirm(`确定要收回「${lease.username}」对设备 "${dev.id}" 的租约吗？其在该设备上的会话将被踢断。`)) return
  try {
    const res = await fetch('/api/admin/leases/revoke', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ lease_id: lease.lease_id })
    })
    if (!res.ok) throw new Error(await readError(res, '收回失败'))
    refresh()
  } catch (err) {
    alert('收回失败: ' + err.message)
  }
}

onMounted(() => {
  refresh()
})
</script>

<style scoped>
.admin-page-container {
  display: flex;
  gap: 20px;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 10px;
  background: #0d1117;
  color: #c9d1d9;
}

.admin-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 16px;
  padding: 24px;
  box-sizing: border-box;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
}

.devices-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #e6edf3;
}

.user-count {
  font-size: 12px;
  color: #8b949e;
  background: rgba(255, 255, 255, 0.05);
  padding: 4px 10px;
  border-radius: 20px;
}

.refresh-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}

.refresh-btn:hover {
  background: #30363d;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

/* 状态统计条 */
.status-summary {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.summary-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: #0d1117;
  border: 1px solid #30363d;
  color: #8b949e;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.summary-chip.active {
  border-color: #58a6ff;
  color: #e6edf3;
  background: rgba(88, 166, 255, 0.08);
}

.chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.summary-chip.free .chip-dot, .lease-chip.free .chip-dot { background: #8b949e; }
.summary-chip.rented .chip-dot, .lease-chip.rented .chip-dot { background: #10b981; }
.summary-chip.expiring .chip-dot, .lease-chip.expiring .chip-dot { background: #fbbf24; }
.summary-chip.expired .chip-dot, .lease-chip.expired .chip-dot { background: #f85149; }
.summary-chip.offline .chip-dot, .lease-chip.offline .chip-dot { background: #4b5563; }

.filter-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 200px;
}

.search-box input {
  width: 100%;
  padding: 9px 14px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  color: #c9d1d9;
  outline: none;
  font-size: 13px;
  box-sizing: border-box;
}

.search-box input:focus {
  border-color: #58a6ff;
}

.tag-select {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  color: #c9d1d9;
  font-size: 12.5px;
  padding: 9px 12px;
}

.table-wrapper {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.premium-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.premium-table th {
  color: #8b949e;
  font-weight: 600;
  font-size: 13px;
  padding: 12px 10px;
  border-bottom: 1px solid #30363d;
}

.premium-table td {
  padding: 12px 10px;
  border-bottom: 1px solid #21262d;
  font-size: 13.5px;
}

.premium-table tr:hover {
  background: rgba(255, 255, 255, 0.015);
}

/* 行左侧按租约状态着色 */
.lease-row-expiring { background: rgba(251, 191, 36, 0.03); }
.lease-row-expired { background: rgba(248, 81, 73, 0.05); }

.lease-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  padding: 3px 10px;
  border-radius: 12px;
  white-space: nowrap;
}

.lease-chip.free { background: rgba(139, 148, 158, 0.08); color: #8b949e; border: 1px solid rgba(139, 148, 158, 0.2); }
.lease-chip.rented { background: rgba(16, 185, 129, 0.08); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25); }
.lease-chip.expiring { background: rgba(251, 191, 36, 0.08); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.25); }
.lease-chip.expired { background: rgba(248, 81, 73, 0.08); color: #f87171; border: 1px solid rgba(248, 81, 73, 0.3); }
.lease-chip.offline { background: rgba(75, 85, 99, 0.12); color: #6e7681; border: 1px solid rgba(110, 118, 129, 0.25); }

.dev-id-cell {
  font-family: monospace;
  font-weight: 600;
  color: #e6edf3;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-cell {
  color: #8b949e;
  font-size: 12.5px;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.online-status-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4b5563;
}

.status-dot.online {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.status-text {
  font-size: 12px;
  color: #8b949e;
}

.tenant-name {
  color: #58a6ff;
  font-weight: 600;
  font-size: 13px;
}

.free-text {
  color: #4b5563;
  font-size: 12.5px;
}

.lease-note {
  font-size: 11px;
  color: #8b949e;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remain-text {
  font-size: 12.5px;
  color: #c9d1d9;
}

.remain-text.warn { color: #fbbf24; }
.remain-text.danger { color: #f87171; font-weight: 600; }

.actions-cell {
  display: flex;
  gap: 6px;
}

.op-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #c9d1d9;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.op-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.op-btn.primary {
  color: #34d399;
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.06);
}

.op-btn.primary:hover {
  background: rgba(16, 185, 129, 0.18);
}

.op-btn.danger {
  color: #f85149;
  border-color: rgba(248, 81, 73, 0.25);
}

.op-btn.danger:hover {
  background: rgba(248, 81, 73, 0.15);
}

.empty-row {
  text-align: center;
  color: #4b5563;
  padding: 32px 0 !important;
}

/* --- 模态框（与用户管理页一致的毛玻璃风格） --- */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.glass-modal {
  background: rgba(22, 27, 34, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  width: 90%;
  max-width: 440px;
  padding: 24px;
  box-sizing: border-box;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #f0f6fc;
}

.close-modal {
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 16px;
  cursor: pointer;
}

.close-modal:hover {
  color: #ffffff;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-info {
  margin: 0;
  font-size: 13px;
  color: #8b949e;
}

.modal-info b {
  color: #58a6ff;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12px;
  color: #8b949e;
  font-weight: 600;
}

.form-group input, .form-group select {
  padding: 10px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  color: #c9d1d9;
  outline: none;
  font-size: 13.5px;
  box-sizing: border-box;
  width: 100%;
}

.form-group input:focus, .form-group select:focus {
  border-color: #58a6ff;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
  align-items: center;
  flex-wrap: wrap;
}

.modal-error {
  color: #f85149;
  font-size: 12px;
  margin-right: auto;
}

.modal-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-sizing: border-box;
}

.modal-btn.cancel {
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
}

.modal-btn.cancel:hover {
  background: #30363d;
}

.modal-btn.submit {
  background: #238636;
  border: none;
  color: #ffffff;
}

.modal-btn.submit:hover:not(:disabled) {
  background: #2ea44f;
}

.modal-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

@media (max-width: 1024px) {
  .admin-page-container {
    padding: 8px;
  }

  .admin-card {
    padding: 14px;
    border-radius: 12px;
  }

  .table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .premium-table th, .premium-table td {
    padding: 8px;
    font-size: 12.5px;
    white-space: nowrap;
  }

  .glass-modal {
    width: min(92vw, 440px);
    padding: 16px;
  }
}
</style>
