<template>
  <div class="admin-page-container">
    <div class="admin-card devices-panel">
      <div class="panel-header">
        <div class="header-left">
          <h2>{{ $t('devicesAdmin.pageTitle') }}</h2>
          <span class="user-count">{{ $t('devicesAdmin.deviceCountStat', { filtered: filteredDevices.length, total: allDevices.length }) }}</span>
        </div>
        <button class="refresh-btn" @click="refresh" :disabled="deviceStore.loading">{{ $t('devicesAdmin.refreshBtn') }}</button>
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
          <input type="text" v-model="searchQuery" :placeholder="$t('devicesAdmin.searchPlaceholder')" />
        </div>
        <select v-model="tagFilter" class="tag-select">
          <option value="">{{ $t('devicesAdmin.allTags') }}</option>
          <option v-for="tag in tagStore.tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
        </select>
      </div>

      <div class="table-wrapper">
        <table class="premium-table">
          <thead>
            <tr>
              <th>{{ $t('devicesAdmin.thLeaseStatus') }}</th>
              <th>{{ $t('devicesAdmin.thDeviceId') }}</th>
              <th>{{ $t('devicesAdmin.thModel') }}</th>
              <th>{{ $t('devicesAdmin.thOnline') }}</th>
              <th>{{ $t('devicesAdmin.thTenant') }}</th>
              <th>{{ $t('devicesAdmin.thRemaining') }}</th>
              <th>{{ $t('devicesAdmin.thActions') }}</th>
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
                  <span class="status-text">{{ dev.status === 'online' ? $t('devicesAdmin.statusOnline') : $t('devicesAdmin.statusOffline') }}</span>
                </div>
              </td>
              <td>
                <span class="tenant-name" v-if="dev.lease">{{ dev.lease.username }}</span>
                <span class="free-text" v-else-if="dev.status === 'online'">{{ $t('devicesAdmin.statusFree') }}</span>
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
                  <button class="op-btn primary" @click="openCreateModal(dev)">{{ $t('devicesAdmin.btnCreateLease') }}</button>
                </template>
                <template v-else>
                  <button class="op-btn" @click="openExtendModal(dev)">{{ $t('devicesAdmin.btnExtendLease') }}</button>
                  <button class="op-btn danger" @click="confirmRevoke(dev)">{{ $t('devicesAdmin.btnRevokeLease') }}</button>
                </template>
              </td>
            </tr>
            <tr v-if="filteredDevices.length === 0">
              <td colspan="7" class="empty-row">{{ $t('devicesAdmin.noMatchedDevices') }}</td>
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
            <h3>{{ $t('devicesAdmin.createModalTitle', { id: createTarget.id }) }}</h3>
            <button class="close-modal" @click="createTarget = null">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>{{ $t('devicesAdmin.tenantLabel') }}</label>
              <select v-model="createForm.username">
                <option value="" disabled>{{ $t('devicesAdmin.selectUserPlaceholder') }}</option>
                <option v-for="u in tenantUsers" :key="u.username" :value="u.username">
                  {{ u.username }}{{ u.role === 'admin' ? $t('devicesAdmin.adminRoleSuffix') : '' }}{{ u.note ? ' - ' + u.note : '' }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>{{ $t('devicesAdmin.durationLabel') }}</label>
              <select v-model="createForm.duration">
                <option :value="1800">{{ $t('devicesAdmin.mins30') }}</option>
                <option :value="3600">{{ $t('devicesAdmin.hour1') }}</option>
                <option :value="7200">{{ $t('devicesAdmin.hours2') }}</option>
                <option :value="21600">{{ $t('devicesAdmin.hours6') }}</option>
                <option :value="86400">{{ $t('devicesAdmin.day1') }}</option>
                <option :value="604800">{{ $t('devicesAdmin.days7') }}</option>
                <option :value="2592000">{{ $t('devicesAdmin.days30') }}</option>
                <option :value="7776000">{{ $t('devicesAdmin.days90') }}</option>
                <option :value="0">{{ $t('devicesAdmin.permanent') }}</option>
                <option value="custom">{{ $t('devicesAdmin.customDuration') }}</option>
              </select>
              <div class="custom-duration-grid" v-if="createForm.duration === 'custom'">
                <input
                  v-model.number="createForm.customVal"
                  type="number"
                  min="1"
                  :placeholder="$t('devicesAdmin.enterDurationPlaceholder')"
                />
                <select v-model="createForm.customUnit">
                  <option value="minute">{{ $t('devicesAdmin.unitMinute') }}</option>
                  <option value="hour">{{ $t('devicesAdmin.unitHour') }}</option>
                  <option value="day">{{ $t('devicesAdmin.unitDay') }}</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>{{ $t('devicesAdmin.noteLabel') }}</label>
              <input type="text" v-model="createForm.note" :placeholder="$t('devicesAdmin.notePlaceholder')" />
            </div>
          </div>
          <div class="modal-footer">
            <span v-if="modalError" class="modal-error">{{ modalError }}</span>
            <button class="modal-btn cancel" @click="createTarget = null">{{ $t('common.cancel') }}</button>
            <button class="modal-btn submit" @click="submitCreate" :disabled="modalSubmitting || !createForm.username">{{ $t('devicesAdmin.confirmCreate') }}</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 续期弹窗 -->
    <transition name="fade">
      <div class="modal-overlay" v-if="extendTarget" @click.self="extendTarget = null">
        <div class="glass-modal">
          <div class="modal-header">
            <h3>{{ $t('devicesAdmin.extendModalTitle', { id: extendTarget.id }) }}</h3>
            <button class="close-modal" @click="extendTarget = null">✕</button>
          </div>
          <div class="modal-body">
            <p class="modal-info">
              {{ $t('devicesAdmin.currentTenantDesc', { username: extendTarget.lease?.username }) }}
              {{ formatLeaseRemaining(extendTarget.lease?.remaining_seconds) }}
            </p>
            <div class="form-group">
              <label>{{ $t('devicesAdmin.appendDurationLabel') }}</label>
              <select v-model="extendForm.duration">
                <option :value="1800">+{{ $t('devicesAdmin.mins30') }}</option>
                <option :value="3600">+{{ $t('devicesAdmin.hour1') }}</option>
                <option :value="7200">+{{ $t('devicesAdmin.hours2') }}</option>
                <option :value="21600">+{{ $t('devicesAdmin.hours6') }}</option>
                <option :value="86400">+{{ $t('devicesAdmin.day1') }}</option>
                <option :value="604800">+{{ $t('devicesAdmin.days7') }}</option>
                <option :value="2592000">+{{ $t('devicesAdmin.days30') }}</option>
                <option :value="7776000">+{{ $t('devicesAdmin.days90') }}</option>
                <option value="custom">{{ $t('devicesAdmin.customDuration') }}</option>
              </select>
              <div class="custom-duration-grid" v-if="extendForm.duration === 'custom'">
                <input
                  v-model.number="extendForm.customVal"
                  type="number"
                  min="1"
                  :placeholder="$t('devicesAdmin.enterDurationPlaceholder')"
                />
                <select v-model="extendForm.customUnit">
                  <option value="minute">{{ $t('devicesAdmin.unitMinute') }}</option>
                  <option value="hour">{{ $t('devicesAdmin.unitHour') }}</option>
                  <option value="day">{{ $t('devicesAdmin.unitDay') }}</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <span v-if="modalError" class="modal-error">{{ modalError }}</span>
            <button class="modal-btn cancel" @click="extendTarget = null">{{ $t('common.cancel') }}</button>
            <button class="modal-btn submit" @click="submitExtend" :disabled="modalSubmitting">{{ $t('devicesAdmin.confirmExtend') }}</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDeviceStore } from '@/stores/devices'
import { useTagStore } from '@/stores/tags'
import { authHeaders, readError } from '@/utils/api'
import { formatLeaseRemaining } from '@/utils/format'

const { t } = useI18n()

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

function leaseStatusLabel(dev) {
  const status = leaseStatus(dev)
  const map = {
    free: t('devicesAdmin.statusFree'),
    rented: t('devicesAdmin.statusRented'),
    expiring: t('devicesAdmin.statusExpiring'),
    expired: t('devicesAdmin.statusExpired'),
    offline: t('devicesAdmin.statusOffline')
  }
  return map[status] || status
}

const statusSummary = computed(() => {
  const counts = { free: 0, rented: 0, expiring: 0, expired: 0, offline: 0 }
  for (const dev of allDevices.value) counts[leaseStatus(dev)]++
  return [
    { value: 'free', label: t('devicesAdmin.statusFree'), count: counts.free },
    { value: 'rented', label: t('devicesAdmin.statusRented'), count: counts.rented },
    { value: 'expiring', label: t('devicesAdmin.statusExpiring'), count: counts.expiring },
    { value: 'expired', label: t('devicesAdmin.statusExpired'), count: counts.expired },
    { value: 'offline', label: t('devicesAdmin.statusOffline'), count: counts.offline }
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

const unitMultipliers = { minute: 60, hour: 3600, day: 86400 }

// --- 开租约 ---
const createTarget = ref(null)
const createForm = ref({ username: '', duration: 604800, customVal: 1, customUnit: 'hour', note: '' })
const tenantUsers = ref([])
const modalError = ref('')
const modalSubmitting = ref(false)

async function openCreateModal(dev) {
  createTarget.value = dev
  createForm.value = { username: '', duration: 604800, customVal: 1, customUnit: 'hour', note: '' }
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
    const mult = unitMultipliers[createForm.value.customUnit] || 86400
    const duration = createForm.value.duration === 'custom'
      ? Math.max(1, createForm.value.customVal || 1) * mult
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
      let msg = t('devicesAdmin.hasActiveLease')
      try {
        const data = await res.json()
        if (data.existing_lease) {
          msg = t('devicesAdmin.alreadyRentedTo', {
            user: data.existing_lease.username,
            remain: formatLeaseRemaining(data.existing_lease.remaining_seconds)
          })
        }
      } catch (e) { /* ignore */ }
      throw new Error(msg)
    }
    if (!res.ok) throw new Error(await readError(res, t('devicesAdmin.btnCreateLease')))
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
const extendForm = ref({ duration: 604800, customVal: 1, customUnit: 'hour' })

function openExtendModal(dev) {
  extendTarget.value = dev
  extendForm.value = { duration: 604800, customVal: 1, customUnit: 'hour' }
  modalError.value = ''
}

async function submitExtend() {
  const dev = extendTarget.value
  modalSubmitting.value = true
  modalError.value = ''
  try {
    const mult = unitMultipliers[extendForm.value.customUnit] || 86400
    const duration = extendForm.value.duration === 'custom'
      ? Math.max(1, extendForm.value.customVal || 1) * mult
      : Number(extendForm.value.duration)
    const res = await fetch('/api/admin/leases/extend', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ lease_id: dev.lease.lease_id, duration_seconds: duration })
    })
    if (!res.ok) throw new Error(await readError(res, t('devicesAdmin.btnExtendLease')))
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
  if (!confirm(t('devicesAdmin.confirmRevoke', { username: lease.username, id: dev.id }))) return
  try {
    const res = await fetch('/api/admin/leases/revoke', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ lease_id: lease.lease_id })
    })
    if (!res.ok) throw new Error(await readError(res, t('devicesAdmin.btnRevokeLease')))
    refresh()
  } catch (err) {
    alert(t('devicesAdmin.revokeFailed') + err.message)
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

.custom-duration-grid {
  display: grid;
  grid-template-columns: 1fr 100px;
  gap: 8px;
  margin-top: 6px;
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
