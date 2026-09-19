<template>
  <div class="admin-page-container">
    <!-- 顶部概览统计卡片 -->
    <div class="stats-overview-grid">
      <div class="stat-card">
        <div class="stat-icon-wrap">👥</div>
        <div class="stat-content">
          <div class="stat-label">总用户数</div>
          <div class="stat-val">{{ users.length }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap">🟢</div>
        <div class="stat-content">
          <div class="stat-label">当前在线</div>
          <div class="stat-val text-online">{{ onlineUsersCount }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap">📱</div>
        <div class="stat-content">
          <div class="stat-label">活跃租约数</div>
          <div class="stat-val">{{ activeLeaseCount }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap">⏳</div>
        <div class="stat-content">
          <div class="stat-label">已停用 / 临近截止</div>
          <div class="stat-val" :class="{ 'text-warn': expiringUsersCount > 0 }">{{ expiringUsersCount }}</div>
        </div>
      </div>
    </div>

    <div class="admin-card user-list-panel">
      <div class="panel-header">
        <div class="header-left">
          <h2>👥 用户管理与控制中心</h2>
          <span class="user-count">共 {{ filteredUsers.length }} / {{ users.length }} 个用户</span>
        </div>
        <button class="create-user-btn" @click="openCreateModal">+ 新建用户</button>
      </div>

      <!-- 搜索与状态筛选 -->
      <div class="filter-bar">
        <div class="search-box">
          <input type="text" v-model="searchQuery" placeholder="🔍 搜索用户名 / 备注..." />
        </div>
        <div class="status-filters">
          <button
            v-for="opt in statusOptions"
            :key="opt.value"
            class="status-filter-btn"
            :class="{ active: statusFilter === opt.value }"
            @click="statusFilter = opt.value"
          >{{ opt.label }}</button>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="premium-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>角色</th>
              <th>在线状态</th>
              <th>活跃设备</th>
              <th>已分配(租约)</th>
              <th>账号截止日</th>
              <th>备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="user in filteredUsers"
              :key="user.username"
              class="user-row"
              :class="{ selected: drawerUser && drawerUser.username === user.username }"
              @click="openDrawer(user)"
            >
              <td class="username-cell">
                <span class="avatar">{{ user.username[0].toUpperCase() }}</span>
                <span class="name">{{ user.username }}</span>
                <span v-if="user.username === authStore.username" class="self-tag">当前登录</span>
              </td>
              <td>
                <span :class="['role-badge', user.role]">
                  {{ user.role === 'admin' ? '管理员' : '普通用户' }}
                </span>
                <div v-if="lockSummary(user)" class="lock-summary">{{ lockSummary(user) }}</div>
              </td>
              <td>
                <div class="online-status-wrapper">
                  <span :class="['status-dot', { online: user.online }]"></span>
                  <span class="status-text">{{ user.online ? '在线' : '离线' }}</span>
                </div>
              </td>
              <td>
                <span class="device-count">{{ user.active_devices ? user.active_devices.length : 0 }} 台</span>
              </td>
              <td>
                <template v-if="leaseSummaryOf(user.username).count > 0">
                  <span class="device-count lease">{{ leaseSummaryOf(user.username).count }} 台</span>
                  <div class="remain-cell" :class="{ warn: leaseSummaryOf(user.username).nearest && leaseSummaryOf(user.username).nearest.remaining_seconds <= 604800 }">
                    {{ leaseSummaryOf(user.username).nearest ? '最近到期: ' + formatLeaseRemaining(leaseSummaryOf(user.username).nearest.remaining_seconds) : '永久' }}
                  </div>
                </template>
                <span v-else class="no-lease-text">未分配</span>
              </td>
              <td>
                <div class="expire-cell" :class="{ expired: isExpiredAt(user.expires_at) }">{{ formatExpire(user.expires_at) }}</div>
                <div class="remain-cell">{{ formatRemain(user.expires_at) }}</div>
              </td>
              <td class="note-cell">
                <span class="note-text" :title="user.note || '无备注'">{{ user.note || '-' }}</span>
              </td>
              <td class="actions-cell" @click.stop>
                <button class="action-btn-mini policy" @click="openDrawer(user, 'policy')" v-if="user.role !== 'admin'" title="权限与有效期配置">⚙️</button>
                <button class="action-btn-mini note" @click="openEditNoteModal(user)" title="编辑备注">📝</button>
                <button class="action-btn-mini rename" @click="openRenameModal(user)" title="重命名用户">🏷️</button>
                <button class="action-btn-mini reset-pwd" @click="openResetPwdModal(user)" title="重置密码">🔒</button>
                <button class="action-btn-mini share" @click="openShareModal(user)" title="分享账号（复制登录信息）">📤</button>
                <button class="action-btn-mini delete" @click="confirmDelete(user)" v-if="user.username !== authStore.username" title="删除用户">🗑️</button>
              </td>
            </tr>
            <tr v-if="filteredUsers.length === 0">
              <td colspan="8" class="empty-row">没有匹配的用户</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 用户详情抽屉：基础与安全 / 设备租约 / 权限与有效期 / 操作记录 -->
    <UserDetailDrawer
      v-if="drawerUser"
      :user="drawerUser"
      :initial-tab="drawerTab"
      @close="drawerUser = null"
      @edit-note="openEditNoteModal"
      @rename="openRenameModal"
      @reset-pwd="openResetPwdModal"
      @share="openShareModal"
      @delete-user="confirmDelete"
      @kick="confirmKick"
      @updated="onDrawerUpdated"
    />

    <!-- 模态框 1：新建用户 -->
    <transition name="fade">
      <div class="modal-overlay" v-if="showCreateModal" @click.self="closeCreateModal">
        <div class="glass-modal">
          <div class="modal-header">
            <h3>➕ 新建用户账户</h3>
            <button class="close-modal" @click="closeCreateModal">✕</button>
          </div>
          <div class="modal-body" v-if="!createdCredentials">
            <div class="form-group">
              <label>用户名</label>
              <input type="text" v-model="createForm.username" placeholder="请输入用户名" />
            </div>
            <div class="form-group">
              <label>密码</label>
              <div class="pwd-input-row">
                <input :type="showCreatePassword ? 'text' : 'password'" v-model="createForm.password" placeholder="请输入密码" />
                <button type="button" class="pwd-tool-btn" @click="showCreatePassword = !showCreatePassword" :title="showCreatePassword ? '隐藏密码' : '显示密码'">{{ showCreatePassword ? '🙈' : '👁️' }}</button>
                <button type="button" class="pwd-tool-btn gen" @click="genRandomPassword" title="生成 8 位随机密码">🎲 随机</button>
              </div>
            </div>
            <div class="form-group">
              <label>角色</label>
              <select v-model="createForm.role">
                <option value="user">普通用户</option>
                <option value="admin">管理员</option>
              </select>
            </div>
            <div class="form-group">
              <label>备注</label>
              <input type="text" v-model="createForm.note" placeholder="例如：测试组A-王五" />
            </div>
          </div>
          <!-- 创建成功：账密展示与一键复制分享 -->
          <div class="modal-body" v-else>
            <div class="create-success-box">
              <div class="create-success-icon">✅</div>
              <p class="create-success-title">用户「{{ createdCredentials.username }}」创建成功</p>
              <div class="cred-row"><span class="cred-label">登录地址</span><code class="cred-val">{{ loginOrigin }}</code></div>
              <div class="cred-row"><span class="cred-label">账号</span><code class="cred-val">{{ createdCredentials.username }}</code></div>
              <div class="cred-row"><span class="cred-label">密码</span><code class="cred-val">{{ createdCredentials.password }}</code></div>
              <p class="create-success-tip">请立即复制并发送给租户，关闭本窗口后密码将无法再次查看。</p>
            </div>
          </div>
          <div class="modal-footer">
            <span v-if="modalError" class="modal-error">{{ modalError }}</span>
            <template v-if="!createdCredentials">
              <button class="modal-btn cancel" @click="closeCreateModal">取消</button>
              <button class="modal-btn submit" @click="submitCreateUser" :disabled="modalSubmitting">确认创建</button>
            </template>
            <template v-else>
              <button class="modal-btn submit" @click="copyCreatedCredentials">{{ credentialsCopied ? '✓ 已复制' : '📋 复制登录信息' }}</button>
              <button class="modal-btn cancel" @click="closeCreateModal">完成</button>
            </template>
          </div>
        </div>
      </div>
    </transition>

    <!-- 模态框 2：重置密码 -->
    <transition name="fade">
      <div class="modal-overlay" v-if="showResetPwdModal" @click.self="closeResetPwdModal">
        <div class="glass-modal">
          <div class="modal-header">
            <h3>🔒 重置密码：{{ editingUser?.username }}</h3>
            <button class="close-modal" @click="closeResetPwdModal">✕</button>
          </div>
          <div class="modal-body" v-if="!resetCredentials">
            <div class="form-group">
              <label>新密码</label>
              <div class="pwd-input-row">
                <input :type="showResetPassword ? 'text' : 'password'" v-model="resetPwdForm.password" placeholder="请输入新的登录密码" />
                <button type="button" class="pwd-tool-btn" @click="showResetPassword = !showResetPassword" :title="showResetPassword ? '隐藏密码' : '显示密码'">{{ showResetPassword ? '🙈' : '👁️' }}</button>
                <button type="button" class="pwd-tool-btn gen" @click="genResetPassword" title="生成 8 位随机密码">🎲 随机</button>
              </div>
            </div>
            <p class="modal-tip">重置密码后，系统将强制断开该用户当前的活跃会话，迫使其重新登录。</p>
          </div>
          <div class="modal-body" v-else>
            <div class="create-success-box">
              <div class="create-success-icon">✅</div>
              <p class="create-success-title">用户「{{ resetCredentials.username }}」密码已重置</p>
              <div class="cred-row"><span class="cred-label">登录地址</span><code class="cred-val">{{ loginOrigin }}</code></div>
              <div class="cred-row"><span class="cred-label">账号</span><code class="cred-val">{{ resetCredentials.username }}</code></div>
              <div class="cred-row"><span class="cred-label">新密码</span><code class="cred-val">{{ resetCredentials.password }}</code></div>
              <p class="create-success-tip">请立即复制并发送给租户，关闭本窗口后新密码将无法再次查看。</p>
            </div>
          </div>
          <div class="modal-footer">
            <span v-if="modalError" class="modal-error">{{ modalError }}</span>
            <template v-if="!resetCredentials">
              <button class="modal-btn cancel" @click="closeResetPwdModal">取消</button>
              <button class="modal-btn submit warning" @click="submitResetPwd" :disabled="modalSubmitting">确认重置</button>
            </template>
            <template v-else>
              <button class="modal-btn submit" @click="copyResetCredentials">{{ resetCopied ? '✓ 已复制' : '📋 复制登录信息' }}</button>
              <button class="modal-btn cancel" @click="closeResetPwdModal">完成</button>
            </template>
          </div>
        </div>
      </div>
    </transition>

    <!-- 模态框 2b：分享账号（现有用户的登录信息复制；密码为哈希存储不可查看，可重置为随机密码后再复制） -->
    <transition name="fade">
      <div class="modal-overlay" v-if="shareUser" @click.self="closeShareModal">
        <div class="glass-modal">
          <div class="modal-header">
            <h3>📤 分享账号：{{ shareUser?.username }}</h3>
            <button class="close-modal" @click="closeShareModal">✕</button>
          </div>
          <div class="modal-body">
            <div class="create-success-box">
              <div class="cred-row"><span class="cred-label">登录地址</span><code class="cred-val">{{ loginOrigin }}</code></div>
              <div class="cred-row"><span class="cred-label">账号</span><code class="cred-val">{{ shareUser?.username }}</code></div>
              <div class="cred-row" v-if="shareNewPassword"><span class="cred-label">新密码</span><code class="cred-val">{{ shareNewPassword }}</code></div>
              <p class="create-success-tip" v-if="!shareNewPassword">密码加密存储无法查看。如需完整账密，可重置为随机密码后复制（该用户会被强退）。</p>
              <p class="create-success-tip" v-else>密码已重置并强退旧会话，请立即复制发送给租户。</p>
            </div>
          </div>
          <div class="modal-footer">
            <span v-if="modalError" class="modal-error">{{ modalError }}</span>
            <button v-if="!shareNewPassword" class="modal-btn submit warning" @click="shareResetRandom" :disabled="modalSubmitting">🎲 重置为随机密码</button>
            <button class="modal-btn submit" @click="copyShareInfo">{{ shareCopied ? '✓ 已复制' : (shareNewPassword ? '📋 复制登录信息' : '📋 复制账号信息') }}</button>
            <button class="modal-btn cancel" @click="closeShareModal">关闭</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 模态框 3：编辑备注 -->
    <transition name="fade">
      <div class="modal-overlay" v-if="showEditNoteModal" @click.self="showEditNoteModal = false">
        <div class="glass-modal">
          <div class="modal-header">
            <h3>📝 编辑用户备注：{{ editingUser?.username }}</h3>
            <button class="close-modal" @click="showEditNoteModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>备注信息</label>
              <input type="text" v-model="editNoteForm.note" placeholder="例如：开发部-张三" />
            </div>
          </div>
          <div class="modal-footer">
            <span v-if="modalError" class="modal-error">{{ modalError }}</span>
            <button class="modal-btn cancel" @click="showEditNoteModal = false">取消</button>
            <button class="modal-btn submit" @click="submitEditNote" :disabled="modalSubmitting">保存备注</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 模态框 4：重命名用户 -->
    <transition name="fade">
      <div class="modal-overlay" v-if="showRenameModal" @click.self="showRenameModal = false">
        <div class="glass-modal">
          <div class="modal-header">
            <h3>🏷️ 重命名用户：{{ editingUser?.username }}</h3>
            <button class="close-modal" @click="showRenameModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>新用户名</label>
              <input type="text" v-model="renameForm.newUsername" placeholder="请输入新的用户名" />
            </div>
            <p class="modal-tip" v-if="editingUser?.username === authStore.username">
              ⚠️ 注意：您正在重命名自己当前登录的管理员账户。改名成功后，系统将自动同步更新您的本地账户缓存，无需重新登录。
            </p>
          </div>
          <div class="modal-footer">
            <span v-if="modalError" class="modal-error">{{ modalError }}</span>
            <button class="modal-btn cancel" @click="showRenameModal = false">取消</button>
            <button class="modal-btn submit" @click="submitRename" :disabled="modalSubmitting">保存新名字</button>
          </div>
        </div>
      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { authHeaders, readError } from '@/utils/api'
import { parseExpire, isExpiredAt, formatExpire, formatRemain, formatLeaseRemaining } from '@/utils/format'
import UserDetailDrawer from '@/components/admin/UserDetailDrawer.vue'

const authStore = useAuthStore()

const users = ref([])
const searchQuery = ref('')
const statusFilter = ref('all')
const drawerUser = ref(null)
const drawerTab = ref('basic')
const activeLeases = ref([]) // 全部活跃租约（统计卡片 + 表格"设备租约"列共用）
const activeLeaseCount = computed(() => activeLeases.value.length)

// 用户名 → 该用户活跃租约数组
const leasesByUser = computed(() => {
  const m = {}
  for (const l of activeLeases.value) {
    if (!m[l.username]) m[l.username] = []
    m[l.username].push(l)
  }
  return m
})

// 表格"设备租约"列：{ count, nearest } nearest = 最近到期的非永久租约（无则 null）
function leaseSummaryOf(username) {
  const ls = leasesByUser.value[username] || []
  const timed = ls.filter(l => l.remaining_seconds !== -1 && l.remaining_seconds != null)
    .sort((a, b) => a.remaining_seconds - b.remaining_seconds)
  return { count: ls.length, nearest: timed.length > 0 ? timed[0] : null }
}

const statusOptions = [
  { value: 'all', label: '全部' },
  { value: 'online', label: '在线' },
  { value: 'offline', label: '离线' },
  { value: 'expired', label: '已停用(过截止日)' },
  { value: 'expiring', label: '7天内到截止日' }
]

// 顶部统计卡片
const onlineUsersCount = computed(() => users.value.filter(u => u.online).length)
const expiringUsersCount = computed(() => {
  return users.value.filter(u => {
    const t = parseExpire(u.expires_at)
    if (!t) return false
    return t.getTime() <= Date.now() + 7 * 86400000
  }).length
})

const filteredUsers = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return users.value.filter(u => {
    if (q && !u.username.toLowerCase().includes(q) && !(u.note || '').toLowerCase().includes(q)) {
      return false
    }
    switch (statusFilter.value) {
      case 'online': return !!u.online
      case 'offline': return !u.online
      case 'expired': return isExpiredAt(u.expires_at)
      case 'expiring': {
        const t = parseExpire(u.expires_at)
        if (!t) return false
        const ms = t.getTime() - Date.now()
        return ms > 0 && ms <= 7 * 86400000
      }
      default: return true
    }
  })
})

// 模态框状态管理
const showCreateModal = ref(false)
const showResetPwdModal = ref(false)
const showEditNoteModal = ref(false)
const showRenameModal = ref(false)
const editingUser = ref(null)
const modalError = ref('')
const modalSubmitting = ref(false)

const renameForm = ref({ newUsername: '' })
const createForm = ref({ username: '', password: '', role: 'user', note: '' })
const resetPwdForm = ref({ password: '' })
const editNoteForm = ref({ note: '' })

// 加载用户列表
async function fetchUsers() {
  try {
    const res = await fetch('/api/admin/users', { headers: authHeaders() })
    if (!res.ok) throw new Error('无权访问用户管理数据')
    users.value = await res.json()
    // 抽屉打开时同步其中的用户数据（在线状态、备注等会轮询变化）
    if (drawerUser.value) {
      const fresh = users.value.find(u => u.username === drawerUser.value.username)
      if (fresh) {
        drawerUser.value = fresh
      } else {
        drawerUser.value = null // 用户已被删除/改名
      }
    }
  } catch (error) {
    console.error('Fetch users failed:', error)
  }
}

// 活跃租约数（统计卡片）
async function fetchActiveLeases() {
  try {
    const res = await fetch('/api/admin/leases?status=active', { headers: authHeaders() })
    if (!res.ok) return
    const data = await res.json()
    activeLeases.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Fetch active leases failed:', error)
  }
}

function openDrawer(user, tab = 'basic') {
  drawerTab.value = tab
  drawerUser.value = user
}

// 抽屉内操作（策略保存、租约变更）后刷新列表与统计
function onDrawerUpdated() {
  fetchUsers()
  fetchActiveLeases()
}

// 打开创建模态框
const createdCredentials = ref(null) // 创建成功后待分享的账密 {username, password}
const showCreatePassword = ref(false)
const credentialsCopied = ref(false)
const loginOrigin = window.location.origin

function openCreateModal() {
  createForm.value = { username: '', password: '', role: 'user', note: '' }
  modalError.value = ''
  createdCredentials.value = null
  showCreatePassword.value = false
  credentialsCopied.value = false
  showCreateModal.value = true
}

function closeCreateModal() {
  showCreateModal.value = false
  createdCredentials.value = null
}

// 生成 8 位随机密码（去除易混淆字符）
function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const arr = new Uint32Array(8)
  crypto.getRandomValues(arr)
  let pwd = ''
  for (let i = 0; i < 8; i++) pwd += chars[arr[i] % chars.length]
  return pwd
}

function genRandomPassword() {
  createForm.value.password = randomPassword()
  showCreatePassword.value = true
}

// 复制账密分享文案（含 http 局域网 clipboard API 不可用的降级）
async function copyCredentialsText(creds, copiedRef) {
  const text = `云手机登录信息\n登录地址：${loginOrigin}\n账号：${creds.username}\n密码：${creds.password}`
  try {
    await navigator.clipboard.writeText(text)
  } catch (e) {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copiedRef.value = true
  setTimeout(() => { copiedRef.value = false }, 2000)
}

async function copyCreatedCredentials() {
  if (!createdCredentials.value) return
  await copyCredentialsText(createdCredentials.value, credentialsCopied)
}

// --- 重置密码：随机生成 + 账密复制分享 ---
const resetCredentials = ref(null)
const showResetPassword = ref(false)
const resetCopied = ref(false)

function genResetPassword() {
  resetPwdForm.value.password = randomPassword()
  showResetPassword.value = true
}

function closeResetPwdModal() {
  showResetPwdModal.value = false
  resetCredentials.value = null
}

async function copyResetCredentials() {
  if (!resetCredentials.value) return
  await copyCredentialsText(resetCredentials.value, resetCopied)
}

// --- 分享账号（现有用户）：地址+账号直接复制；密码不可查看，可重置为随机密码后复制完整账密 ---
const shareUser = ref(null)
const shareNewPassword = ref('')
const shareCopied = ref(false)

function openShareModal(user) {
  shareUser.value = user
  shareNewPassword.value = ''
  shareCopied.value = false
  modalError.value = ''
}

function closeShareModal() {
  shareUser.value = null
  shareNewPassword.value = ''
}

// 重置为随机密码（复用重置接口，用户会被强退），成功后展示完整账密
async function shareResetRandom() {
  if (!shareUser.value) return
  modalSubmitting.value = true
  modalError.value = ''
  const newPwd = randomPassword()
  try {
    const res = await fetch('/api/admin/users/reset_password', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ username: shareUser.value.username, password: newPwd })
    })
    if (!res.ok) throw new Error(await readError(res, '重置失败'))
    shareNewPassword.value = newPwd
    fetchUsers()
  } catch (err) {
    modalError.value = err.message
  } finally {
    modalSubmitting.value = false
  }
}

async function copyShareInfo() {
  if (!shareUser.value) return
  let text = `云手机登录信息\n登录地址：${loginOrigin}\n账号：${shareUser.value.username}`
  if (shareNewPassword.value) text += `\n密码：${shareNewPassword.value}`
  try {
    await navigator.clipboard.writeText(text)
  } catch (e) {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  shareCopied.value = true
  setTimeout(() => { shareCopied.value = false }, 2000)
}

// --- 用户权限与有效期配置 ---
// 已内嵌到详情抽屉的「权限与有效期」Tab（行内 ⚙️ 直接打开抽屉对应 Tab）

// 细粒度权限锁定摘要：有禁止项时显示如 “🔒 码率·音频”
function lockSummary(user) {
  const parts = []
  if (user.forbid_bitrate) parts.push('码率')
  if (user.forbid_fps) parts.push('帧率')
  if (user.forbid_resolution) parts.push('分辨率')
  if (user.forbid_audio) parts.push('音频')
  if (user.forbid_file_push) parts.push('文件')
  if (user.forbid_terminal) parts.push('终端')
  if (user.forbid_share) parts.push('分享')
  return parts.length ? `🔒 ${parts.join('·')}` : ''
}

// 提交创建用户
async function submitCreateUser() {
  const form = createForm.value
  if (!form.username.trim() || !form.password.trim()) {
    modalError.value = '用户名和密码不能为空'
    return
  }
  modalSubmitting.value = true
  modalError.value = ''
  try {
    // 新账号默认永久有效（expire_seconds=0），时长由设备租约管理；
    // 如需停用账号，在详情抽屉「权限设置」里设置账号截止日
    const res = await fetch('/api/admin/users/create', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        username: form.username,
        password: form.password,
        role: form.role,
        note: form.note,
        expire_seconds: 0
      })
    })
    if (!res.ok) {
      throw new Error(await readError(res, '创建用户失败'))
    }
    // 创建成功：留在弹窗内展示账密供管理员复制分享
    createdCredentials.value = { username: form.username.trim(), password: form.password }
    fetchUsers()
  } catch (err) {
    modalError.value = err.message
  } finally {
    modalSubmitting.value = false
  }
}

// 删除用户
async function confirmDelete(user) {
  if (!confirm(`确定要删除用户 "${user.username}" 吗？该操作将强制切断其所有在线连接。`)) return
  try {
    const res = await fetch('/api/admin/users/delete', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ username: user.username })
    })
    if (!res.ok) {
      throw new Error(await readError(res, '删除失败'))
    }
    if (drawerUser.value && drawerUser.value.username === user.username) {
      drawerUser.value = null
    }
    fetchUsers()
  } catch (err) {
    alert('删除失败: ' + err.message)
  }
}

// 打开重置密码模态框
function openResetPwdModal(user) {
  editingUser.value = user
  resetPwdForm.value.password = ''
  modalError.value = ''
  resetCredentials.value = null
  showResetPassword.value = false
  resetCopied.value = false
  showResetPwdModal.value = true
}

// 提交密码重置
async function submitResetPwd() {
  const form = resetPwdForm.value
  if (!form.password.trim()) {
    modalError.value = '密码不能为空'
    return
  }
  modalSubmitting.value = true
  modalError.value = ''
  try {
    const res = await fetch('/api/admin/users/reset_password', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        username: editingUser.value.username,
        password: form.password
      })
    })
    if (!res.ok) {
      throw new Error(await readError(res, '重置失败'))
    }
    // 重置成功：留在弹窗内展示新账密供管理员复制分享（会话已被后端强退）
    resetCredentials.value = { username: editingUser.value.username, password: form.password }
    fetchUsers()
  } catch (err) {
    modalError.value = err.message
  } finally {
    modalSubmitting.value = false
  }
}

// 打开修改备注模态框
function openEditNoteModal(user) {
  editingUser.value = user
  editNoteForm.value.note = user.note || ''
  modalError.value = ''
  showEditNoteModal.value = true
}

// 提交备注修改
async function submitEditNote() {
  modalSubmitting.value = true
  modalError.value = ''
  try {
    const res = await fetch('/api/admin/users/update_note', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        username: editingUser.value.username,
        note: editNoteForm.value.note
      })
    })
    if (!res.ok) {
      throw new Error(await readError(res, '保存失败'))
    }
    showEditNoteModal.value = false
    fetchUsers()
  } catch (err) {
    modalError.value = err.message
  } finally {
    modalSubmitting.value = false
  }
}

function openRenameModal(user) {
  editingUser.value = user
  renameForm.value.newUsername = user.username
  modalError.value = ''
  showRenameModal.value = true
}

async function submitRename() {
  const newName = renameForm.value.newUsername.trim()
  if (!newName) {
    modalError.value = '用户名不能为空'
    return
  }
  modalSubmitting.value = true
  modalError.value = ''
  try {
    const res = await fetch('/api/admin/users/rename', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        old_username: editingUser.value.username,
        new_username: newName
      })
    })

    if (!res.ok) {
      throw new Error(await readError(res, '重命名失败'))
    }

    // 如果修改的是自己登录的管理员账户：后端已吊销旧 token 并踢断会话，直接跳转重新登录
    if (editingUser.value.username === authStore.username) {
      showRenameModal.value = false
      alert('用户名已修改，请使用新用户名重新登录')
      authStore.logout()
      return
    }

    showRenameModal.value = false
    fetchUsers()
  } catch (err) {
    modalError.value = err.message
  } finally {
    modalSubmitting.value = false
  }
}

// 强制断开云手机连接（由详情抽屉触发）
async function confirmKick({ username, deviceId }) {
  try {
    const res = await fetch('/api/admin/users/kick', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        username: username,
        device_id: deviceId
      })
    })
    if (!res.ok) {
      throw new Error(await readError(res, '强断失败'))
    }

    // 延迟半秒重新获取最新用户在线状态
    setTimeout(() => {
      fetchUsers()
    }, 500)
  } catch (err) {
    alert('操作失败: ' + err.message)
  }
}

// 轮询定时器用于刷新在线状态和活跃设备 (5秒一次)
let refreshTimer = null

onMounted(() => {
  fetchUsers()
  fetchActiveLeases()
  refreshTimer = setInterval(() => {
    fetchUsers()
    fetchActiveLeases()
  }, 5000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.admin-page-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 10px;
  background: #0d1117;
  color: #c9d1d9;
}

/* 概览统计卡片 */
.stats-overview-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  flex-shrink: 0;
}

.stat-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: transform 0.2s, border-color 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  border-color: rgba(88, 166, 255, 0.3);
}

.stat-icon-wrap {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  flex-shrink: 0;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 12px;
  color: #8b949e;
  font-weight: 500;
}

.stat-val {
  font-size: 22px;
  font-weight: 800;
  color: #f0f6fc;
  font-variant-numeric: tabular-nums;
}

.stat-val.text-online { color: #34d399; }
.stat-val.text-warn { color: #f2c12e; }

.admin-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 16px;
  padding: 24px;
  box-sizing: border-box;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
}

.user-list-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
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

.create-user-btn {
  background: linear-gradient(90deg, #238636, #2ea44f);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(46, 164, 79, 0.15);
  transition: all 0.2s;
}

.create-user-btn:hover {
  filter: brightness(1.1);
  box-shadow: 0 4px 16px rgba(46, 164, 79, 0.3);
}

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

.status-filters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.status-filter-btn {
  background: #0d1117;
  border: 1px solid #30363d;
  color: #8b949e;
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.status-filter-btn:hover {
  border-color: #58a6ff;
  color: #c9d1d9;
}

.status-filter-btn.active {
  background: rgba(88, 166, 255, 0.12);
  border-color: #58a6ff;
  color: #58a6ff;
  font-weight: 600;
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

.user-row {
  cursor: pointer;
}

.premium-table tr.selected {
  background: rgba(88, 166, 255, 0.06);
}

.premium-table tr:hover {
  background: rgba(255, 255, 255, 0.015);
}

.empty-row {
  text-align: center;
  color: #4b5563;
  padding: 32px 0 !important;
}

.username-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #38bdf8;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  box-shadow: 0 3px 8px rgba(56, 189, 248, 0.2);
  flex-shrink: 0;
}

.self-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(88, 166, 255, 0.12);
  color: #58a6ff;
  border: 1px solid rgba(88, 166, 255, 0.25);
  white-space: nowrap;
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
  animation: pulse 1.5s infinite;
}

.status-text {
  font-size: 12px;
  color: #8b949e;
}

.device-count {
  font-weight: 600;
  color: #8b949e;
}

.device-count.lease { color: #58a6ff; }

.no-lease-text {
  font-size: 12.5px;
  color: #4b5563;
}

.remain-cell.warn { color: #fbbf24; }

.note-cell {
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-text {
  color: #8b949e;
  font-size: 12px;
}

.actions-cell {
  display: flex;
  gap: 6px;
}

.action-btn-mini {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #c9d1d9;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 0.2s;
}

.action-btn-mini:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.action-btn-mini.policy {
  color: #a371f7;
  border-color: rgba(163, 113, 247, 0.2);
  background: rgba(163, 113, 247, 0.05);
}

.action-btn-mini.policy:hover {
  background: #a371f7;
  color: #ffffff;
}

.lock-summary {
  font-size: 0.68rem;
  color: #fbbf24;
  margin-top: 4px;
  white-space: nowrap;
}

.expire-cell {
  font-size: 0.82rem;
}

.expire-cell.expired {
  color: #f85149;
  font-weight: 600;
}

.remain-cell {
  font-size: 0.7rem;
  color: #8b949e;
}

.action-btn-mini.delete {
  color: #f85149;
  border-color: rgba(248, 81, 73, 0.2);
  background: rgba(248, 81, 73, 0.05);
}

.action-btn-mini.delete:hover {
  background: #f85149;
  color: #ffffff;
}

/* --- 模态框及毛玻璃特效样式 --- */
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

.modal-tip {
  font-size: 11.5px;
  color: #ff7b72;
  margin: 4px 0 0 0;
  line-height: 1.4;
}

/* 密码输入行 + 随机生成 */
.pwd-input-row {
  display: flex;
  gap: 6px;
}

.pwd-input-row input {
  flex: 1;
  min-width: 0;
}

.pwd-tool-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  border-radius: 8px;
  padding: 0 10px;
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
}

.pwd-tool-btn:hover { background: #30363d; }
.pwd-tool-btn.gen { color: #58a6ff; border-color: rgba(88, 166, 255, 0.35); }

/* 创建成功账密展示 */
.create-success-box {
  text-align: center;
  padding: 8px 4px;
}

.create-success-icon { font-size: 34px; margin-bottom: 8px; }

.create-success-title {
  font-size: 14.5px;
  font-weight: 600;
  color: #e6edf3;
  margin: 0 0 16px 0;
}

.cred-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 9px 12px;
  margin-bottom: 8px;
  text-align: left;
}

.cred-label {
  flex-shrink: 0;
  font-size: 12px;
  color: #8b949e;
  width: 56px;
}

.cred-val {
  font-family: monospace;
  font-size: 13px;
  color: #58a6ff;
  word-break: break-all;
  user-select: all;
}

.create-success-tip {
  font-size: 11.5px;
  color: #fbbf24;
  margin: 10px 0 0 0;
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

.modal-btn.submit.warning {
  background: #da3633;
}

.modal-btn.submit.warning:hover:not(:disabled) {
  background: #f85149;
}

.modal-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.5; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.5; }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* 移动端适配 (<=1024px)：统计卡片两列、表格横向滚动、弹窗限宽 */
@media (max-width: 1024px) {
  .admin-page-container {
    flex-direction: column;
    height: auto;
    min-height: 100%;
    overflow-y: auto;
    padding: 8px;
    gap: 12px;
  }

  .stats-overview-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .stat-card {
    padding: 10px 12px;
    gap: 10px;
  }

  .stat-icon-wrap {
    width: 34px;
    height: 34px;
    font-size: 16px;
  }

  .stat-val {
    font-size: 18px;
  }

  .admin-card {
    padding: 14px;
    border-radius: 12px;
  }

  .panel-header {
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }

  .header-left {
    flex-wrap: wrap;
    gap: 8px;
  }

  .panel-header h2 {
    font-size: 15px;
  }

  .create-user-btn {
    padding: 7px 12px;
    font-size: 12px;
  }

  .table-wrapper {
    overflow-x: auto;
    overflow-y: visible;
    -webkit-overflow-scrolling: touch;
  }

  .premium-table th {
    padding: 8px 8px;
    font-size: 12px;
    white-space: nowrap;
  }

  .premium-table td {
    padding: 8px 8px;
    font-size: 12.5px;
  }

  .avatar {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }

  .note-cell {
    max-width: 80px;
  }

  .actions-cell {
    flex-wrap: wrap;
    gap: 4px;
    min-width: 96px;
  }

  .action-btn-mini {
    width: 28px;
    height: 28px;
  }

  .glass-modal {
    width: min(92vw, 440px);
    max-width: 92vw;
    padding: 16px;
  }

  .modal-footer {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
