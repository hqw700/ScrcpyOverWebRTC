<template>
  <transition name="drawer">
    <div class="drawer-overlay" @click.self="$emit('close')">
      <aside class="user-drawer">
        <!-- 头部 -->
        <div class="drawer-header">
          <div class="drawer-user">
            <span class="avatar">{{ user.username[0].toUpperCase() }}</span>
            <div class="drawer-user-meta">
              <div class="drawer-username">{{ user.username }}</div>
              <div class="drawer-subline">
                <span :class="['role-badge', user.role]">{{ user.role === 'admin' ? '👑 管理员' : '普通用户' }}</span>
                <span class="online-chip" :class="{ online: user.online }">{{ user.online ? '在线' : '离线' }}</span>
              </div>
            </div>
          </div>
          <button class="drawer-close" @click="$emit('close')">✕</button>
        </div>

        <!-- Tab 导航 -->
        <div class="drawer-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="drawer-tab"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >{{ tab.label }}</button>
        </div>

        <div class="drawer-body">
          <!-- 操作反馈 -->
          <div v-if="toastMsg" class="drawer-toast" :class="toastType">{{ toastMsg }}</div>

          <!-- ================== Tab 1: 基础与安全 ================== -->
          <div v-if="activeTab === 'basic'" class="tab-pane">
            <section class="drawer-section">
              <div class="section-title">用户角色</div>
              <div class="role-display-card">
                <div class="role-display-name">
                  {{ user.role === 'admin' ? '👑 管理员 (Admin)' : '👤 普通用户 (User)' }}
                </div>
                <div class="role-display-sub">
                  {{ user.role === 'admin'
                    ? '拥有系统全局控制、用户管理与设备运营权限'
                    : '设备使用受租约管控，权限由「权限设置」页配置' }}
                </div>
              </div>
            </section>

            <section class="drawer-section">
              <div class="section-title">基本信息</div>
              <div class="info-row">
                <span class="info-label">备注</span>
                <span class="info-value" :title="user.note">{{ user.note || '-' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">账号截止日</span>
                <span class="info-value" :class="{ expired: isExpiredAt(user.expires_at) }">
                  {{ formatExpire(user.expires_at) }}
                  <span class="remain-text">{{ formatRemain(user.expires_at) }}</span>
                </span>
              </div>
              <div class="basic-actions">
                <button class="drawer-btn" @click="$emit('edit-note', user)">📝 编辑备注</button>
                <button class="drawer-btn" @click="$emit('rename', user)">🏷️ 重命名</button>
                <button class="drawer-btn" @click="$emit('reset-pwd', user)">🔒 重置密码</button>
                <button class="drawer-btn" @click="$emit('share', user)">📤 分享账号</button>
              </div>
            </section>

            <!-- 危险区 -->
            <section class="drawer-section danger-zone" v-if="user.username !== authStore.username">
              <div class="section-title danger-title">危险操作</div>
              <p class="danger-desc">删除用户将强制切断其所有在线连接并移除全部设备租约，该操作不可恢复。</p>
              <button class="danger-delete-btn" @click="$emit('delete-user', user)">🗑️ 删除该用户</button>
            </section>
          </div>

          <!-- ================== Tab 2: 设备租约 ================== -->
          <div v-if="activeTab === 'devices'" class="tab-pane">
            <!-- 当前控制（活跃设备，可踢下线） -->
            <section class="drawer-section" v-if="user.active_devices && user.active_devices.length > 0">
              <div class="section-title">当前控制（{{ user.active_devices.length }} 台）</div>
              <div class="active-dev-list">
                <div v-for="devId in user.active_devices" :key="devId" class="active-dev-tag">
                  <span class="pulse-icon"></span>
                  <span class="dev-tag-text">{{ devId }}</span>
                  <button class="kick-btn" @click="confirmKick(devId)" title="强行断开此设备的连接">✕</button>
                </div>
              </div>
            </section>

            <!-- 开租约 -->
            <section class="drawer-section">
              <div class="section-title lease-title">
                <span>设备租约</span>
                <span class="lease-title-btns">
                  <button class="lease-refresh" @click="fetchLeases" :disabled="leasesLoading" title="刷新租约">⟳</button>
                  <button class="drawer-btn small primary" v-if="!showCreateLease" @click="openCreateLease">＋ 开租约</button>
                </span>
              </div>

              <!-- 开租约内联表单 -->
              <div v-if="showCreateLease" class="create-lease-box">
                <div class="form-item">
                  <label class="item-label">空闲设备</label>
                  <select v-model="createLeaseForm.deviceId" class="drawer-select" :disabled="idleDevicesLoading">
                    <option value="" disabled>{{ idleDevicesLoading ? '加载设备中...' : (idleDevices.length ? '请选择设备' : '暂无空闲设备') }}</option>
                    <option v-for="dev in idleDevices" :key="dev.id" :value="dev.id">
                      {{ dev.id }}{{ dev.model ? `（${dev.model}）` : '' }}
                    </option>
                  </select>
                </div>
                <div class="form-item">
                  <label class="item-label">租期</label>
                  <div class="lease-duration-row">
                    <select v-model="createLeaseForm.duration" class="drawer-select">
                      <option :value="86400">1 天</option>
                      <option :value="604800">7 天</option>
                      <option :value="2592000">30 天</option>
                      <option value="custom">自定义天数</option>
                    </select>
                    <input
                      v-if="createLeaseForm.duration === 'custom'"
                      v-model.number="createLeaseForm.customDays"
                      type="number"
                      min="1"
                      placeholder="天数"
                      class="drawer-select custom-days-input"
                    />
                  </div>
                </div>
                <div class="form-item">
                  <label class="item-label">备注（可选）</label>
                  <input type="text" v-model="createLeaseForm.note" class="drawer-select" placeholder="例如：包月客户" />
                </div>
                <div class="create-lease-actions">
                  <button class="drawer-btn small" @click="showCreateLease = false">取消</button>
                  <button
                    class="drawer-btn small primary"
                    @click="submitCreateLease"
                    :disabled="!createLeaseForm.deviceId || leaseOperating"
                  >{{ leaseOperating ? '提交中...' : '确认开租' }}</button>
                </div>
              </div>

              <div v-if="leasesLoading" class="lease-empty">加载中...</div>
              <div v-else-if="leases.length === 0" class="lease-empty">该用户暂无设备租约，可点击「＋ 开租约」为其分配设备。</div>
              <div v-else class="lease-list">
                <div v-for="lease in leases" :key="lease.lease_id" class="lease-item" :class="{ inactive: !lease.active }">
                  <div class="lease-main">
                    <div class="lease-device-row">
                      <span class="lease-device">{{ lease.device_id }}</span>
                      <span class="lease-status-chip" :class="lease.revoked ? 'revoked' : (lease.active ? 'active' : 'expired')">
                        {{ lease.revoked ? '已收回' : (lease.active ? '生效中' : '已到期') }}
                      </span>
                    </div>
                    <div class="lease-remaining" :class="{ warn: lease.active && isLeaseExpiringSoon(lease) }">
                      {{ formatLeaseRemaining(lease.remaining_seconds) }}
                    </div>
                    <div class="lease-note" v-if="lease.note" :title="lease.note">备注：{{ lease.note }}</div>
                    <div class="lease-created">
                      创建：{{ formatTime(lease.created_at) }}
                      <template v-if="lease.revoked && lease.revoked_at"> · 收回：{{ formatTime(lease.revoked_at) }}</template>
                    </div>
                  </div>
                  <div class="lease-actions" v-if="lease.active">
                    <template v-if="extendingLeaseId === lease.lease_id">
                      <select v-model="extendChoice" class="extend-select">
                        <option :value="86400">+1 天</option>
                        <option :value="604800">+7 天</option>
                        <option :value="2592000">+30 天</option>
                        <option value="custom">自定义天数</option>
                      </select>
                      <input
                        v-if="extendChoice === 'custom'"
                        v-model.number="extendCustomDays"
                        type="number"
                        min="1"
                        placeholder="天数"
                        class="extend-days"
                      />
                      <button class="drawer-btn primary small" @click="submitExtend(lease)" :disabled="leaseOperating">确认</button>
                      <button class="drawer-btn small" @click="cancelExtend">取消</button>
                    </template>
                    <template v-else>
                      <button class="drawer-btn small" @click="startExtend(lease)">⏳ 续期</button>
                      <button class="drawer-btn small danger" @click="confirmRevoke(lease)" :disabled="leaseOperating">收回</button>
                    </template>
                  </div>
                </div>
              </div>
              <div v-if="leaseError" class="lease-error">{{ leaseError }}</div>
            </section>
          </div>

          <!-- ================== Tab 3: 权限与有效期 ================== -->
          <div v-if="activeTab === 'policy'" class="tab-pane">
            <!-- 账号截止日（可选）：日常时长由设备租约管理，此处仅用于彻底停用账号 -->
            <section class="drawer-section">
              <div class="section-title">账号截止日（可选）</div>
              <div class="expiry-status-box" :class="{ expired: isExpiredAt(user.expires_at) }">
                <div class="expiry-icon">⏳</div>
                <div class="expiry-info">
                  <div class="expiry-headline">
                    {{ isExpiredAt(user.expires_at) ? '账号已停用' : formatExpire(user.expires_at) }}
                  </div>
                  <div class="expiry-sub">
                    {{ isExpiredAt(user.expires_at) ? '已超过截止日无法登录，改为永久或未来日期即可恢复' : (formatRemain(user.expires_at) || '永久有效。日常时长通过「设备租约」管理，此处仅用于彻底停用账号') }}
                  </div>
                </div>
              </div>
              <div class="expire-edit-row">
                <select v-model="expireChoice" class="drawer-select">
                  <option value="keep">保持不变</option>
                  <option value="0">♾️ 永久有效</option>
                  <option value="86400">1 天（从现在开始）</option>
                  <option value="604800">7 天（从现在开始）</option>
                  <option value="2592000">30 天（从现在开始）</option>
                  <option value="7776000">90 天（从现在开始）</option>
                  <option value="31536000">1 年（从现在开始）</option>
                  <option value="custom">⚙️ 自定义天数…</option>
                </select>
                <input
                  v-if="expireChoice === 'custom'"
                  v-model.number="customDays"
                  type="number"
                  min="1"
                  placeholder="天数"
                  class="drawer-select custom-days-input"
                />
              </div>
            </section>

            <div class="section-divider"></div>

            <!-- 设置锁定（7 个 forbid 位） -->
            <section class="drawer-section">
              <div class="section-title">设置锁定（管控项）</div>
              <p class="section-desc">开启后用户端对应设置项将被锁定置灰，由服务端强制使用下方配置值，下次连接生效。</p>
              <div class="policy-toggle-grid">
                <label
                  v-for="dim in forbidDims"
                  :key="dim.key"
                  class="toggle-card"
                  :class="{ active: formPolicy[dim.key] }"
                >
                  <input type="checkbox" v-model="formPolicy[dim.key]" />
                  <div class="toggle-text">
                    <div class="toggle-title">🔒 {{ dim.title }}</div>
                    <div class="toggle-desc">{{ dim.desc }}</div>
                  </div>
                </label>
              </div>
            </section>

            <!-- 设置值 -->
            <section class="drawer-section">
              <div class="section-title">强制设置值</div>
              <div class="settings-summary">
                <template v-if="draftSettings">
                  <span>码率 {{ bitrateText }} · 帧率 {{ draftSettings.fps || '不限' }} · 分辨率 {{ draftSettings.size || '不限' }} · 音频 {{ draftSettings.audio ? '开' : '关' }}</span>
                </template>
                <template v-else>
                  <span class="settings-none">未配置（被锁定的项回落设备默认值）</span>
                </template>
              </div>
              <div class="basic-actions">
                <button class="drawer-btn" @click="openSettingsEditor">编辑设置值…</button>
                <button v-if="draftSettings" class="drawer-btn danger" @click="draftSettings = null">清除配置</button>
              </div>
            </section>

            <div class="action-footer">
              <button class="save-btn" @click="savePolicy" :disabled="saving">
                {{ saving ? '保存中...' : '💾 保存权限设置' }}
              </button>
            </div>
          </div>

          <!-- ================== Tab 4: 操作记录 ================== -->
          <div v-if="activeTab === 'audit'" class="tab-pane">
            <section class="drawer-section">
              <div class="section-title lease-title">
                <span>操作记录（针对该用户）</span>
                <button class="lease-refresh" @click="fetchAudit" :disabled="auditLoading" title="刷新">⟳</button>
              </div>
              <div v-if="auditLoading" class="lease-empty">加载中...</div>
              <div v-else-if="auditError" class="lease-error">{{ auditError }}</div>
              <div v-else-if="userAuditEntries.length === 0" class="lease-empty">最近 200 条审计日志中暂无针对该用户的操作记录。</div>
              <div v-else class="audit-table-wrapper">
                <table class="audit-table">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>动作</th>
                      <th>详情</th>
                      <th>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(entry, idx) in userAuditEntries" :key="idx">
                      <td class="audit-ts">{{ formatTime(entry.ts) }}</td>
                      <td><span class="audit-action-chip">{{ entry.action }}</span></td>
                      <td class="audit-detail" :title="entry.detail">{{ entry.detail || '-' }}</td>
                      <td class="audit-ip">{{ entry.ip || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </aside>

      <!-- 设置值编辑器（复用主控台设置面板） -->
      <SettingsModal
        v-if="showSettingsEditor"
        :settings="editorSettings"
        :is-connected="false"
        :is-global="false"
        :is-custom="false"
        @save="onSettingsEditorSave"
        @close="showSettingsEditor = false"
      />
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { authHeaders, readError } from '@/utils/api'
import { isExpiredAt, formatExpire, formatRemain, formatLeaseRemaining } from '@/utils/format'
import { getDeviceSettings } from '@/utils/settings'
import SettingsModal from '@/components/SettingsModal.vue'

const props = defineProps({
  user: { type: Object, required: true },
  initialTab: { type: String, default: 'basic' }
})
const emit = defineEmits(['close', 'edit-note', 'rename', 'reset-pwd', 'share', 'delete-user', 'kick', 'updated'])

const authStore = useAuthStore()

const tabs = [
  { key: 'basic', label: '👤 基础与安全' },
  { key: 'devices', label: '📱 设备租约' },
  { key: 'policy', label: '⚙️ 权限设置' },
  { key: 'audit', label: '📜 操作记录' }
]
const activeTab = ref(props.initialTab || 'basic')

// 操作反馈
const toastMsg = ref('')
const toastType = ref('success')
let toastTimer = null
function showToast(msg, type = 'success') {
  toastMsg.value = msg
  toastType.value = type
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 3500)
}

function formatTime(iso) {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return '-'
  return t.toLocaleString('zh-CN', { hour12: false })
}

// ---------------- Tab 2: 设备租约 ----------------
const leases = ref([])
const leasesLoading = ref(false)
const leaseError = ref('')
const leaseOperating = ref(false)

// 续期内联表单
const extendingLeaseId = ref(null)
const extendChoice = ref(604800)
const extendCustomDays = ref(7)

// 开租约内联表单
const showCreateLease = ref(false)
const idleDevices = ref([])
const idleDevicesLoading = ref(false)
const createLeaseForm = ref({ deviceId: '', duration: 604800, customDays: 7, note: '' })

function isLeaseExpiringSoon(lease) {
  return lease.remaining_seconds >= 0 && lease.remaining_seconds <= 7 * 86400
}

async function fetchLeases() {
  leasesLoading.value = true
  leaseError.value = ''
  try {
    const res = await fetch(`/api/admin/leases?user=${encodeURIComponent(props.user.username)}&status=all`, {
      headers: authHeaders()
    })
    if (!res.ok) throw new Error(await readError(res, '获取租约失败'))
    leases.value = await res.json()
  } catch (err) {
    leaseError.value = err.message
  } finally {
    leasesLoading.value = false
  }
}

async function openCreateLease() {
  showCreateLease.value = true
  createLeaseForm.value = { deviceId: '', duration: 604800, customDays: 7, note: '' }
  idleDevicesLoading.value = true
  try {
    // admin 视角：响应带 lease 字段，无 lease 即空闲设备
    const res = await fetch('/devices', { headers: authHeaders() })
    if (!res.ok) throw new Error(await readError(res, '获取设备列表失败'))
    const data = await res.json()
    const list = Array.isArray(data) ? data : (data.devices || [])
    // 空闲设备 = 在线 且 无租约（离线机器不算可分配，与设备运营页口径一致）
    idleDevices.value = list
      .filter(d => !d.lease && d.online !== false)
      .map(d => ({
        id: d.device_id || d.id,
        model: d.device_info?.model || d.info?.model || ''
      }))
      .filter(d => !!d.id)
    if (idleDevices.value.length > 0) {
      createLeaseForm.value.deviceId = idleDevices.value[0].id
    }
  } catch (err) {
    leaseError.value = err.message
  } finally {
    idleDevicesLoading.value = false
  }
}

async function submitCreateLease() {
  const form = createLeaseForm.value
  if (!form.deviceId) return
  const duration = form.duration === 'custom'
    ? Math.max(1, form.customDays || 1) * 86400
    : Number(form.duration)
  leaseOperating.value = true
  leaseError.value = ''
  try {
    const res = await fetch('/api/admin/leases/create', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        username: props.user.username,
        device_id: form.deviceId,
        duration_seconds: duration,
        note: form.note
      })
    })
    if (res.status === 409) {
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
    showCreateLease.value = false
    showToast(`已为 ${props.user.username} 开通设备 ${form.deviceId} 的租约`)
    await fetchLeases()
    emit('updated')
  } catch (err) {
    leaseError.value = err.message
  } finally {
    leaseOperating.value = false
  }
}

function startExtend(lease) {
  extendingLeaseId.value = lease.lease_id
  extendChoice.value = 604800
  extendCustomDays.value = 7
}

function cancelExtend() {
  extendingLeaseId.value = null
}

async function submitExtend(lease) {
  const seconds = extendChoice.value === 'custom'
    ? Math.max(1, extendCustomDays.value || 1) * 86400
    : Number(extendChoice.value)
  leaseOperating.value = true
  leaseError.value = ''
  try {
    const res = await fetch('/api/admin/leases/extend', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ lease_id: lease.lease_id, duration_seconds: seconds })
    })
    if (!res.ok) throw new Error(await readError(res, '续期失败'))
    extendingLeaseId.value = null
    await fetchLeases()
    emit('updated')
  } catch (err) {
    leaseError.value = err.message
  } finally {
    leaseOperating.value = false
  }
}

async function confirmRevoke(lease) {
  if (!confirm(`确定要收回用户 "${lease.username}" 对设备 "${lease.device_id}" 的租约吗？其在该设备上的会话将被踢断。`)) return
  leaseOperating.value = true
  leaseError.value = ''
  try {
    const res = await fetch('/api/admin/leases/revoke', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ lease_id: lease.lease_id })
    })
    if (!res.ok) throw new Error(await readError(res, '收回失败'))
    await fetchLeases()
    emit('updated')
  } catch (err) {
    leaseError.value = err.message
  } finally {
    leaseOperating.value = false
  }
}

function confirmKick(deviceId) {
  if (!confirm(`确定要断开用户 "${props.user.username}" 对云手机 "${deviceId}" 的控制连接吗？`)) return
  emit('kick', { username: props.user.username, deviceId })
}

// ---------------- Tab 3: 权限与有效期 ----------------
const saving = ref(false)

const forbidDims = [
  { key: 'forbid_bitrate', title: '锁定码率设置', desc: '禁止用户自行调整视频码率' },
  { key: 'forbid_fps', title: '锁定帧率设置', desc: '禁止用户自行调整最大帧率' },
  { key: 'forbid_resolution', title: '锁定分辨率', desc: '禁止用户自行切换分辨率' },
  { key: 'forbid_audio', title: '锁定音频开关', desc: '禁止用户自行开关音频通道' },
  { key: 'forbid_file_push', title: '禁止文件传输', desc: '禁止文件上传/下载' },
  { key: 'forbid_terminal', title: '禁止终端 Shell', desc: '禁止使用网页终端' },
  { key: 'forbid_share', title: '禁止创建分享', desc: '禁止生成分享链接' }
]
const formPolicy = ref({})
const draftSettings = ref(null)
const expireChoice = ref('keep')
const customDays = ref(7)

const showSettingsEditor = ref(false)

const bitrateText = computed(() => {
  const s = draftSettings.value
  if (!s) return ''
  return s.bwe ? `${s.minBitrate}-${s.maxBitrate} Mbps (BWE)` : `${s.bitrate} Mbps`
})

// 清除后重新编辑：仍从全局默认配置起步
const editorSettings = computed(() => draftSettings.value || getDeviceSettings(''))

function resetPolicyForm() {
  const p = {}
  forbidDims.forEach(dim => { p[dim.key] = !!props.user[dim.key] })
  formPolicy.value = p
  draftSettings.value = props.user.settings
    ? { ...getDeviceSettings(''), ...props.user.settings }
    : null
  expireChoice.value = 'keep'
  customDays.value = 7
  showSettingsEditor.value = false
}

function openSettingsEditor() {
  showSettingsEditor.value = true
}

function onSettingsEditorSave(newSettings) {
  draftSettings.value = newSettings
  showSettingsEditor.value = false
}

async function savePolicy() {
  saving.value = true
  try {
    const policy = { settings: draftSettings.value }
    forbidDims.forEach(dim => { policy[dim.key] = !!formPolicy.value[dim.key] })
    const body = { username: props.user.username, policy }
    if (expireChoice.value === 'keep') {
      body.expire_seconds = -1 // -1 = 有效期不变
    } else if (expireChoice.value === 'custom') {
      body.expire_seconds = Math.max(1, customDays.value || 1) * 86400
    } else {
      body.expire_seconds = Number(expireChoice.value)
    }
    const res = await fetch('/api/admin/users/update', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(await readError(res, '保存失败'))
    showToast('权限设置已保存')
    emit('updated')
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    saving.value = false
  }
}

// ---------------- Tab 4: 操作记录 ----------------
const userAuditEntries = ref([])
const auditLoading = ref(false)
const auditError = ref('')
let auditLoadedFor = ''

async function fetchAudit() {
  auditLoading.value = true
  auditError.value = ''
  try {
    const res = await fetch('/api/admin/audit?limit=200', { headers: authHeaders() })
    if (!res.ok) throw new Error(await readError(res, '获取审计日志失败'))
    const data = await res.json()
    const entries = data.entries || []
    userAuditEntries.value = entries.filter(e => e.target === props.user.username)
    auditLoadedFor = props.user.username
  } catch (err) {
    auditError.value = err.message
  } finally {
    auditLoading.value = false
  }
}

// 切换到操作记录 Tab 时按需拉取
watch(activeTab, (tab) => {
  if (tab === 'audit' && auditLoadedFor !== props.user.username) {
    fetchAudit()
  }
})

// 切换用户（父组件轮询刷新 user 对象）时重置各表单并重新拉取租约
watch(() => props.user.username, () => {
  extendingLeaseId.value = null
  showCreateLease.value = false
  userAuditEntries.value = []
  auditError.value = ''
  resetPolicyForm()
  fetchLeases()
  if (activeTab.value === 'audit') fetchAudit()
}, { immediate: true })
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
}

.user-drawer {
  position: absolute;
  top: 0;
  right: 0;
  width: min(560px, 94vw);
  height: 100%;
  background: #161b22;
  border-left: 1px solid #30363d;
  box-shadow: -12px 0 40px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px;
  border-bottom: 1px solid #21262d;
  flex-shrink: 0;
}

.drawer-user {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #38bdf8;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  box-shadow: 0 3px 8px rgba(56, 189, 248, 0.2);
  flex-shrink: 0;
}

.drawer-user-meta {
  min-width: 0;
}

.drawer-username {
  font-size: 16px;
  font-weight: 700;
  color: #e6edf3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-subline {
  display: flex;
  gap: 6px;
  margin-top: 5px;
  align-items: center;
}

.role-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 12px;
  font-weight: 600;
}

.role-badge.admin {
  background: rgba(242, 193, 46, 0.1);
  color: #f2c12e;
  border: 1px solid rgba(242, 193, 46, 0.2);
}

.role-badge.user {
  background: rgba(56, 189, 248, 0.1);
  color: #bae6fd;
  border: 1px solid rgba(56, 189, 248, 0.2);
}

.online-chip {
  font-size: 11px;
  color: #8b949e;
}

.online-chip.online {
  color: #10b981;
}

.drawer-close {
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 18px;
  cursor: pointer;
}

.drawer-close:hover {
  color: #ffffff;
}

/* Tab 导航 */
.drawer-tabs {
  display: flex;
  background: #0d1117;
  padding: 0 12px;
  border-bottom: 1px solid #21262d;
  flex-shrink: 0;
  overflow-x: auto;
}

.drawer-tab {
  padding: 11px 14px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #8b949e;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.drawer-tab:hover {
  color: #c9d1d9;
}

.drawer-tab.active {
  color: #58a6ff;
  border-bottom-color: #58a6ff;
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  min-height: 0;
}

.drawer-toast {
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 16px;
}

.drawer-toast.success {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: #34d399;
}

.drawer-toast.error {
  background: rgba(248, 81, 73, 0.12);
  border: 1px solid rgba(248, 81, 73, 0.35);
  color: #f85149;
}

.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.drawer-section {
  margin-bottom: 18px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #8b949e;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.section-desc {
  font-size: 12px;
  color: #8b949e;
  margin: 0 0 10px 0;
  line-height: 1.5;
}

.section-divider {
  height: 1px;
  background: #21262d;
  margin: 2px 0 16px 0;
}

.info-row {
  display: flex;
  gap: 12px;
  padding: 5px 0;
  font-size: 13px;
}

.info-label {
  color: #8b949e;
  flex-shrink: 0;
  width: 72px;
}

.info-value {
  color: #c9d1d9;
  overflow: hidden;
  text-overflow: ellipsis;
}

.info-value.expired {
  color: #f85149;
  font-weight: 600;
}

.remain-text {
  color: #8b949e;
  font-size: 11px;
  margin-left: 6px;
}

.basic-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.drawer-btn {
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 8px;
  color: #c9d1d9;
  font-size: 12.5px;
  padding: 7px 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.drawer-btn:hover {
  background: #30363d;
  border-color: #8b949e;
}

.drawer-btn.primary {
  background: rgba(88, 166, 255, 0.12);
  border-color: rgba(88, 166, 255, 0.35);
  color: #58a6ff;
}

.drawer-btn.primary:hover {
  background: rgba(88, 166, 255, 0.22);
}

.drawer-btn.small {
  padding: 5px 10px;
  font-size: 12px;
}

.drawer-btn.danger {
  color: #f85149;
  border-color: rgba(248, 81, 73, 0.3);
}

.drawer-btn.danger:hover {
  background: rgba(248, 81, 73, 0.15);
}

.drawer-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 角色展示卡 */
.role-display-card {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 10px;
  padding: 12px 14px;
}

.role-display-name {
  font-size: 13.5px;
  font-weight: 700;
  color: #e6edf3;
}

.role-display-sub {
  font-size: 11.5px;
  color: #8b949e;
  margin-top: 4px;
  line-height: 1.5;
}

/* 危险区 */
.danger-zone {
  border: 1px solid rgba(248, 81, 73, 0.35);
  border-radius: 10px;
  padding: 14px;
  background: rgba(248, 81, 73, 0.04);
}

.danger-title {
  color: #f85149;
  margin-bottom: 6px;
}

.danger-desc {
  font-size: 12px;
  color: #8b949e;
  margin: 0 0 12px 0;
  line-height: 1.5;
}

.danger-delete-btn {
  background: rgba(248, 81, 73, 0.12);
  border: 1px solid rgba(248, 81, 73, 0.4);
  color: #f85149;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.danger-delete-btn:hover {
  background: #f85149;
  color: #ffffff;
}

/* 当前控制 */
.active-dev-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.active-dev-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
}

.pulse-icon {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.dev-tag-text {
  color: #a7f3d0;
  font-family: monospace;
}

.kick-btn {
  background: transparent;
  border: none;
  color: #ef4444;
  cursor: pointer;
  padding: 0 2px;
  font-weight: bold;
  font-size: 11px;
}

.kick-btn:hover {
  color: #f87171;
}

/* 租约 */
.lease-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lease-title-btns {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lease-refresh {
  background: transparent;
  border: none;
  color: #58a6ff;
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
}

.lease-refresh:disabled {
  opacity: 0.5;
  cursor: default;
}

.create-lease-box {
  background: rgba(88, 166, 255, 0.05);
  border: 1px solid rgba(88, 166, 255, 0.2);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item-label {
  font-size: 12px;
  color: #8b949e;
  font-weight: 600;
}

.drawer-select {
  width: 100%;
  box-sizing: border-box;
  background: #0d1117;
  border: 1px solid #30363d;
  color: #c9d1d9;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}

.drawer-select:focus {
  border-color: #58a6ff;
}

.lease-duration-row,
.expire-edit-row {
  display: flex;
  gap: 8px;
}

.custom-days-input {
  flex: 0 0 90px;
  width: 90px;
}

.create-lease-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.lease-empty {
  font-size: 12.5px;
  color: #4b5563;
  padding: 14px 0;
  line-height: 1.6;
}

.lease-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lease-item {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 10px;
  padding: 12px;
}

.lease-item.inactive {
  opacity: 0.55;
}

.lease-device-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.lease-device {
  font-weight: 600;
  color: #e6edf3;
  font-size: 13.5px;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lease-status-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  flex-shrink: 0;
}

.lease-status-chip.active {
  background: rgba(16, 185, 129, 0.1);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.lease-status-chip.expired {
  background: rgba(139, 148, 158, 0.1);
  color: #8b949e;
  border: 1px solid rgba(139, 148, 158, 0.2);
}

.lease-status-chip.revoked {
  background: rgba(248, 81, 73, 0.08);
  color: #f87171;
  border: 1px solid rgba(248, 81, 73, 0.25);
}

.lease-remaining {
  font-size: 12.5px;
  color: #58a6ff;
  margin-top: 6px;
}

.lease-remaining.warn {
  color: #fbbf24;
}

.lease-note {
  font-size: 11.5px;
  color: #8b949e;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lease-created {
  font-size: 11px;
  color: #4b5563;
  margin-top: 4px;
}

.lease-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.extend-select, .extend-days {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 12px;
  padding: 5px 8px;
}

.extend-days {
  width: 64px;
}

.lease-error {
  margin-top: 10px;
  font-size: 12px;
  color: #f85149;
}

/* 有效期状态框 */
.expiry-status-box {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.expiry-status-box.expired {
  border-color: rgba(248, 81, 73, 0.5);
  background: rgba(248, 81, 73, 0.05);
}

.expiry-icon {
  font-size: 22px;
}

.expiry-headline {
  font-size: 13px;
  font-weight: 700;
  color: #e6edf3;
}

.expiry-status-box.expired .expiry-headline {
  color: #f85149;
}

.expiry-sub {
  font-size: 11.5px;
  color: #8b949e;
  margin-top: 3px;
}

/* 权限开关卡片 */
.policy-toggle-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.toggle-card {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-card:hover {
  border-color: #58a6ff;
}

.toggle-card.active {
  border-color: rgba(251, 191, 36, 0.5);
  background: rgba(251, 191, 36, 0.06);
}

.toggle-card input {
  accent-color: #fbbf24;
  margin-top: 2px;
}

.toggle-title {
  font-size: 12px;
  font-weight: 700;
  color: #e6edf3;
}

.toggle-desc {
  font-size: 11px;
  color: #8b949e;
  margin-top: 2px;
}

/* 设置值摘要 */
.settings-summary {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12.5px;
  color: #c9d1d9;
  line-height: 1.5;
}

.settings-none {
  color: #8b949e;
}

.action-footer {
  margin-top: 4px;
}

.save-btn {
  background: #238636;
  border: 1px solid rgba(240, 246, 252, 0.1);
  color: #ffffff;
  border-radius: 8px;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
}

.save-btn:hover:not(:disabled) {
  background: #2ea44f;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 操作记录 */
.audit-table-wrapper {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  overflow: hidden;
  max-height: 420px;
  overflow-y: auto;
}

.audit-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.audit-table th, .audit-table td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid #21262d;
  vertical-align: top;
}

.audit-table th {
  background: rgba(255, 255, 255, 0.03);
  color: #8b949e;
  font-weight: 600;
  position: sticky;
  top: 0;
}

.audit-ts {
  color: #8b949e;
  white-space: nowrap;
  font-size: 11px;
}

.audit-action-chip {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 8px;
  background: rgba(88, 166, 255, 0.1);
  color: #58a6ff;
  border: 1px solid rgba(88, 166, 255, 0.2);
  white-space: nowrap;
}

.audit-detail {
  color: #c9d1d9;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audit-ip {
  color: #8b949e;
  font-family: monospace;
  font-size: 11px;
}

/* 抽屉滑入动画 */
.drawer-enter-active, .drawer-leave-active {
  transition: opacity 0.25s ease;
}
.drawer-enter-active .user-drawer, .drawer-leave-active .user-drawer {
  transition: transform 0.25s ease;
}
.drawer-enter-from, .drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from .user-drawer, .drawer-leave-to .user-drawer {
  transform: translateX(40px);
}
</style>
