<template>
  <div class="admin-page-container">
    <!-- 左侧：用户列表 -->
    <div class="admin-card user-list-panel">
      <div class="panel-header">
        <div class="header-left">
          <h2>👥 用户管理与控制中心</h2>
          <span class="user-count">共 {{ users.length }} 个用户</span>
        </div>
        <button class="create-user-btn" @click="openCreateModal">+ 新建用户</button>
      </div>
      
      <div class="table-wrapper">
        <table class="premium-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>角色</th>
              <th>在线状态</th>
              <th>有效期</th>
              <th>已分配设备</th>
              <th>当前控制</th>
              <th>备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.username" :class="{ selected: selectedUser && selectedUser.username === user.username }">
              <td class="username-cell">
                <span class="avatar">{{ user.username[0].toUpperCase() }}</span>
                <span class="name">{{ user.username }}</span>
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
                <div class="expire-cell" :class="{ expired: isExpired(user.expires_at) }">{{ formatExpire(user.expires_at) }}</div>
                <div class="remain-cell">{{ formatRemain(user.expires_at) }}</div>
              </td>
              <td>
                <span class="device-count" @click="user.role !== 'admin' && selectUser(user)" :class="{ 'clickable': user.role !== 'admin' }" title="点击分配设备">
                  {{ user.assigned_devices ? user.assigned_devices.length : 0 }} 台
                </span>
              </td>
              <td>
                <div class="active-devices-wrapper" v-if="user.active_devices && user.active_devices.length > 0">
                  <div v-for="devId in user.active_devices" :key="devId" class="active-dev-tag">
                    <span class="pulse-icon"></span>
                    <span class="dev-tag-text">{{ devId }}</span>
                    <button class="kick-btn" @click="confirmKick(user.username, devId)" title="强行断开此设备的连接">✕</button>
                  </div>
                </div>
                <span class="no-active" v-else>-</span>
              </td>
              <td class="note-cell">
                <span class="note-text" :title="user.note || '无备注'">{{ user.note || '-' }}</span>
              </td>
              <td class="actions-cell">
                <button class="action-btn-mini assign" @click="selectUser(user)" v-if="user.role !== 'admin'" title="分配设备">🔑</button>
                <button class="action-btn-mini policy" @click="openPolicyModal(user)" v-if="user.role !== 'admin'" title="权限与有效期配置">⚙️</button>
                <button class="action-btn-mini note" @click="openEditNoteModal(user)" title="编辑备注">📝</button>
                <button class="action-btn-mini rename" @click="openRenameModal(user)" title="重命名用户">🏷️</button>
                <button class="action-btn-mini reset-pwd" @click="openResetPwdModal(user)" title="重置密码">🔒</button>
                <button class="action-btn-mini delete" @click="confirmDelete(user)" v-if="user.username !== authStore.username" title="删除用户">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 右侧：分配面板 -->
    <transition name="slide">
      <div class="admin-card assign-panel" v-if="selectedUser">
        <div class="panel-header">
          <div class="header-title">
            <h3>🔑 分配设备：<span class="target-name">{{ selectedUser.username }}</span></h3>
            <p class="subtitle">勾选在线设备或手动添加历史设备</p>
          </div>
          <button class="close-btn" @click="selectedUser = null">✕</button>
        </div>

        <div class="assign-body">
          <!-- 搜索/过滤 -->
          <div class="search-box">
            <input type="text" v-model="deviceSearch" placeholder="🔍 搜索在线设备..." />
          </div>

          <!-- 在线设备复选列表 -->
          <div class="device-selector-list">
            <div class="list-title">在线可分配设备 ({{ filteredOnlineDevices.length }}台)</div>
            <div class="device-checkbox-wrapper" v-if="filteredOnlineDevices.length > 0">
              <label 
                v-for="dev in filteredOnlineDevices" 
                :key="dev.id" 
                :class="['device-checkbox-item', { checked: isDeviceChecked(dev.id) }]"
              >
                <input 
                  type="checkbox" 
                  :value="dev.id" 
                  v-model="tempAssigned"
                />
                <span class="checkbox-box"></span>
                <div class="dev-info">
                  <span class="dev-id">{{ dev.id }}</span>
                  <span class="dev-status">在线 (online)</span>
                  <span v-if="deviceAssignees[dev.id]" class="dev-assigned" :title="deviceAssignees[dev.id].join('、')">
                    已分配: {{ deviceAssignees[dev.id].join('、') }}
                  </span>
                </div>
              </label>
            </div>
            <div class="empty-list" v-else>
              没有找到匹配的在线设备
            </div>
          </div>

          <!-- 手动添加非在线设备 -->
          <div class="manual-add-section">
            <div class="list-title">手动录入其他设备 ID (如离线机器)</div>
            <div class="input-row">
              <input 
                type="text" 
                v-model="manualDeviceId" 
                placeholder="请输入设备序列号或ID" 
                @keyup.enter="addManualDevice"
              />
              <button class="add-btn" @click="addManualDevice">添加</button>
            </div>
            
            <!-- 已手动添加或已分配的离线设备标签 -->
            <div class="custom-tags-container" v-if="offlineAssigned.length > 0">
              <span v-for="tag in offlineAssigned" :key="tag" class="custom-tag">
                {{ tag }}
                <button class="remove-tag-btn" @click="removeOfflineTag(tag)">✕</button>
              </span>
            </div>
          </div>
        </div>

        <div class="assign-footer">
          <div v-if="toastMsg" :class="['toast-alert', toastType]">{{ toastMsg }}</div>
          <button class="save-btn" @click="saveAssignment" :disabled="saving">
            <span v-if="saving" class="btn-spinner"></span>
            <span v-else>保存分配方案</span>
          </button>
        </div>
      </div>
      <div class="admin-card assign-panel empty" v-else>
        <div class="hint-content">
          <span class="hint-icon">⚙️</span>
          <p>请在左侧选择一个普通用户<br/>为其分配云手机设备访问权</p>
        </div>
      </div>
    </transition>

    <!-- 模态框 1：新建用户 -->
    <transition name="fade">
      <div class="modal-overlay" v-if="showCreateModal" @click.self="showCreateModal = false">
        <div class="glass-modal">
          <div class="modal-header">
            <h3>➕ 新建用户账户</h3>
            <button class="close-modal" @click="showCreateModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>用户名</label>
              <input type="text" v-model="createForm.username" placeholder="请输入用户名" />
            </div>
            <div class="form-group">
              <label>密码</label>
              <input type="password" v-model="createForm.password" placeholder="请输入密码" />
            </div>
            <div class="form-group">
              <label>角色</label>
              <select v-model="createForm.role">
                <option value="user">普通用户</option>
                <option value="admin">管理员</option>
              </select>
            </div>
            <div class="form-group">
              <label>账号有效期</label>
              <select v-model="createForm.expire_seconds">
                <option :value="0">♾️ 永久有效</option>
                <option :value="1800">30 分钟</option>
                <option :value="3600">1 小时</option>
                <option :value="43200">12 小时</option>
                <option :value="86400">1 天</option>
                <option :value="604800">7 天</option>
                <option value="custom">⚙️ 自定义天数</option>
              </select>
              <input
                v-if="createForm.expire_seconds === 'custom'"
                v-model.number="createForm.customDays"
                type="number"
                min="1"
                placeholder="输入有效天数..."
                style="margin-top: 8px"
              />
            </div>
            <div class="form-group">
              <label>备注</label>
              <input type="text" v-model="createForm.note" placeholder="例如：测试组A-王五" />
            </div>
          </div>
          <div class="modal-footer">
            <span v-if="modalError" class="modal-error">{{ modalError }}</span>
            <button class="modal-btn cancel" @click="showCreateModal = false">取消</button>
            <button class="modal-btn submit" @click="submitCreateUser" :disabled="modalSubmitting">确认创建</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 模态框 2：重置密码 -->
    <transition name="fade">
      <div class="modal-overlay" v-if="showResetPwdModal" @click.self="showResetPwdModal = false">
        <div class="glass-modal">
          <div class="modal-header">
            <h3>🔒 重置密码：{{ editingUser?.username }}</h3>
            <button class="close-modal" @click="showResetPwdModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>新密码</label>
              <input type="password" v-model="resetPwdForm.password" placeholder="请输入新的登录密码" />
            </div>
            <p class="modal-tip">重置密码后，系统将强制断开该用户当前的活跃会话，迫使其重新登录。</p>
          </div>
          <div class="modal-footer">
            <span v-if="modalError" class="modal-error">{{ modalError }}</span>
            <button class="modal-btn cancel" @click="showResetPwdModal = false">取消</button>
            <button class="modal-btn submit warning" @click="submitResetPwd" :disabled="modalSubmitting">确认重置</button>
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
    <!-- 模态框 5：用户权限与有效期配置 -->
    <UserPolicyModal
      v-if="policyUser"
      :user="policyUser"
      @close="policyUser = null"
      @saved="onPolicySaved"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDeviceStore } from '../stores/devices'
import { useAuthStore } from '../stores/auth'
import UserPolicyModal from '@/components/UserPolicyModal.vue'

const deviceStore = useDeviceStore()
const authStore = useAuthStore()

const users = ref([])
const selectedUser = ref(null)
const tempAssigned = ref([]) // 勾选的在线设备ID
const offlineAssigned = ref([]) // 分配的其他离线设备ID
const deviceSearch = ref('')
const manualDeviceId = ref('')
const saving = ref(false)
const toastMsg = ref('')
const toastType = ref('success')

// 模态框状态管理
const showCreateModal = ref(false)
const showResetPwdModal = ref(false)
const showEditNoteModal = ref(false)
const showRenameModal = ref(false)
const editingUser = ref(null)
const policyUser = ref(null)
const modalError = ref('')
const modalSubmitting = ref(false)

const renameForm = ref({
  newUsername: ''
})

const createForm = ref({
  username: '',
  password: '',
  role: 'user',
  note: '',
  expire_seconds: 0,
  customDays: 1
})

const resetPwdForm = ref({
  password: ''
})

const editNoteForm = ref({
  note: ''
})

// 获取在线的全部设备
const filteredOnlineDevices = computed(() => {
  const allOnline = deviceStore.devices
  if (!deviceSearch.value.trim()) return allOnline
  return allOnline.filter(d => d.id.toLowerCase().includes(deviceSearch.value.toLowerCase()))
})

// 设备 -> 已分配的其他用户名（排除当前正在编辑的用户与通配符 '*'）。
// 用于分配面板上标注"这台机器已经被分给谁了"
const deviceAssignees = computed(() => {
  const map = {}
  for (const u of users.value) {
    if (selectedUser.value && u.username === selectedUser.value.username) continue
    for (const id of u.assigned_devices || []) {
      if (!id || id === '*') continue
      if (!map[id]) map[id] = []
      map[id].push(u.username)
    }
  }
  return map
})

// 加载用户列表
async function fetchUsers() {
  try {
    const res = await fetch('/api/admin/users')
    if (!res.ok) throw new Error('无权访问用户管理数据')
    users.value = await res.json()
  } catch (error) {
    console.error('Fetch users failed:', error)
  }
}

// 选中某个用户准备分配
function selectUser(user) {
  selectedUser.value = user
  toastMsg.value = ''
  
  // 区分在线设备和离线设备
  const userDevs = user.assigned_devices || []
  const onlineIds = deviceStore.devices.map(d => d.id)
  
  tempAssigned.value = userDevs.filter(id => onlineIds.includes(id))
  offlineAssigned.value = userDevs.filter(id => !onlineIds.includes(id))
}

function isDeviceChecked(id) {
  return tempAssigned.value.includes(id)
}

// 手动添加设备
function addManualDevice() {
  const id = manualDeviceId.value.trim()
  if (!id) return
  
  const onlineIds = deviceStore.devices.map(d => d.id)
  // 如果是在线设备，直接放入在线勾选组
  if (onlineIds.includes(id)) {
    if (!tempAssigned.value.includes(id)) {
      tempAssigned.value.push(id)
    }
  } else {
    // 放入离线列表
    if (!offlineAssigned.value.includes(id)) {
      offlineAssigned.value.push(id)
    }
  }
  manualDeviceId.value = ''
}

// 移除离线设备标签
function removeOfflineTag(tag) {
  offlineAssigned.value = offlineAssigned.value.filter(t => t !== tag)
}

// 保存分配方案
async function saveAssignment() {
  if (!selectedUser.value) return
  
  saving.value = true
  toastMsg.value = ''

  // 融合在线和离线的设备ID
  const mergedDevices = [...tempAssigned.value, ...offlineAssigned.value]

  try {
    const res = await fetch('/api/admin/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: selectedUser.value.username,
        devices: mergedDevices
      })
    })

    if (!res.ok) {
      const txt = await res.text()
      throw new Error(txt || '保存失败')
    }

    toastType.value = 'success'
    toastMsg.value = '✨ 分配保存成功！'
    
    // 更新本地列表中该用户的分配数
    const idx = users.value.findIndex(u => u.username === selectedUser.value.username)
    if (idx !== -1) {
      users.value[idx].assigned_devices = mergedDevices
    }

    // 延迟 1.5 秒清除成功提示
    setTimeout(() => {
      toastMsg.value = ''
    }, 1500)
  } catch (error) {
    toastType.value = 'error'
    toastMsg.value = '⚠️ 保存失败: ' + error.message
  } finally {
    saving.value = false
  }
}

// 打开创建模态框
function openCreateModal() {
  createForm.value = {
    username: '',
    password: '',
    role: 'user',
    note: '',
    expire_seconds: 0,
    customDays: 1
  }
  modalError.value = ''
  showCreateModal.value = true
}

// --- 用户权限与有效期配置 ---
function openPolicyModal(user) {
  policyUser.value = user
}

function onPolicySaved() {
  policyUser.value = null
  fetchUsers()
}

// 细粒度权限锁定摘要：有禁止项时显示如 “🔒 码率·音频”
function lockSummary(user) {
  const parts = []
  if (user.forbid_bitrate) parts.push('码率')
  if (user.forbid_fps) parts.push('帧率')
  if (user.forbid_resolution) parts.push('分辨率')
  if (user.forbid_audio) parts.push('音频')
  return parts.length ? `🔒 ${parts.join('·')}` : ''
}

function parseExpire(expiresAt) {
  if (!expiresAt) return null
  const t = new Date(expiresAt)
  if (Number.isNaN(t.getTime()) || t.getFullYear() <= 1) return null // Go 零值时间 = 永久
  return t
}

function isExpired(expiresAt) {
  const t = parseExpire(expiresAt)
  return !!t && t.getTime() <= Date.now()
}

function formatExpire(expiresAt) {
  const t = parseExpire(expiresAt)
  if (!t) return '♾️ 永久'
  if (t.getTime() <= Date.now()) return '已到期'
  return t.toLocaleString('zh-CN', { hour12: false })
}

function formatRemain(expiresAt) {
  const t = parseExpire(expiresAt)
  if (!t) return ''
  const ms = t.getTime() - Date.now()
  if (ms <= 0) return ''
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `剩余 ${d} 天 ${h} 小时`
  if (h > 0) return `剩余 ${h} 小时 ${m} 分`
  return `剩余 ${m} 分`
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
    const expireSeconds = form.expire_seconds === 'custom'
      ? Math.max(1, form.customDays || 1) * 86400
      : Number(form.expire_seconds)
    const res = await fetch('/api/admin/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.username,
        password: form.password,
        role: form.role,
        note: form.note,
        expire_seconds: expireSeconds
      })
    })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(txt || '创建用户失败')
    }
    showCreateModal.value = false
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username })
    })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(txt || '删除失败')
    }
    if (selectedUser.value && selectedUser.value.username === user.username) {
      selectedUser.value = null
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: editingUser.value.username,
        password: form.password
      })
    })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(txt || '重置失败')
    }
    showResetPwdModal.value = false
    alert(`用户 "${editingUser.value.username}" 的密码已成功重置，其所有活动会话已被强退。`)
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: editingUser.value.username,
        note: editNoteForm.value.note
      })
    })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(txt || '保存失败')
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        old_username: editingUser.value.username,
        new_username: newName
      })
    })

    if (!res.ok) {
      const txt = await res.text()
      throw new Error(txt || '重命名失败')
    }

    // 如果修改的是自己登录的管理员账户，同步更新前端 Auth 缓存
    if (editingUser.value.username === authStore.username) {
      authStore.username = newName
      localStorage.setItem('auth_user', newName)
    }

    toastType.value = 'success'
    toastMsg.value = '✨ 用户重命名成功！'
    setTimeout(() => {
      toastMsg.value = ''
    }, 1500)

    showRenameModal.value = false
    fetchUsers()
  } catch (err) {
    modalError.value = err.message
  } finally {
    modalSubmitting.value = false
  }
}

// 强制断开云手机连接
async function confirmKick(username, deviceId) {
  if (!confirm(`确定要断开用户 "${username}" 对云手机 "${deviceId}" 的控制连接吗？`)) return
  try {
    const res = await fetch('/api/admin/users/kick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username,
        device_id: deviceId
      })
    })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(txt || '强断失败')
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
  deviceStore.fetchDevices()
  refreshTimer = setInterval(() => {
    fetchUsers()
  }, 5000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
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

.user-list-panel {
  flex: 1.6;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-header h2, .panel-header h3 {
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

.premium-table tr.selected {
  background: rgba(88, 166, 255, 0.04);
}

.premium-table tr:hover {
  background: rgba(255, 255, 255, 0.015);
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

.device-count.clickable {
  color: #58a6ff;
  cursor: pointer;
  text-decoration: underline;
}

.active-devices-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.active-dev-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  padding: 3px 6px;
  border-radius: 6px;
  font-size: 11.5px;
}

.pulse-icon {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
  animation: pulse 1.2s infinite;
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
  font-size: 10px;
}

.kick-btn:hover {
  color: #f87171;
}

.no-active {
  color: #4b5563;
}

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

.action-btn-mini.assign {
  color: #58a6ff;
  border-color: rgba(88, 166, 255, 0.2);
  background: rgba(88, 166, 255, 0.05);
}

.action-btn-mini.assign:hover {
  background: #58a6ff;
  color: #ffffff;
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

.assign-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.assign-panel.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.35;
}

.hint-content {
  text-align: center;
}

.hint-icon {
  font-size: 48px;
  margin-bottom: 12px;
  display: block;
}

.hint-content p {
  font-size: 14px;
  line-height: 1.5;
  color: #8b949e;
}

.header-title .subtitle {
  font-size: 11px;
  color: #8b949e;
  margin: 4px 0 0;
}

.target-name {
  color: #38bdf8;
  font-weight: 700;
}

.close-btn {
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 18px;
  cursor: pointer;
}

.close-btn:hover {
  color: #ffffff;
}

.assign-body {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 20px;
  min-height: 0;
}

.search-box {
  margin-bottom: 20px;
}

.search-box input {
  width: 100%;
  padding: 10px 14px;
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

.list-title {
  font-size: 12px;
  font-weight: 600;
  color: #8b949e;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.device-checkbox-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid #30363d;
  background: #0d1117;
  border-radius: 8px;
  padding: 10px;
}

.device-checkbox-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  box-sizing: border-box;
}

.device-checkbox-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.device-checkbox-item input {
  display: none;
}

.checkbox-box {
  width: 16px;
  height: 16px;
  border: 2px solid #475569;
  border-radius: 4px;
  margin-right: 12px;
  display: inline-block;
  position: relative;
  transition: all 0.2s;
  flex-shrink: 0;
}

.device-checkbox-item.checked .checkbox-box {
  border-color: #38bdf8;
  background: #38bdf8;
}

.device-checkbox-item.checked .checkbox-box::after {
  content: "✓";
  color: #ffffff;
  font-size: 11px;
  font-weight: bold;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.dev-info {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-size: 13px;
}

.dev-id {
  font-weight: 600;
  color: #e6edf3;
}

.dev-status {
  font-size: 11px;
  color: #10b981;
}

.dev-assigned {
  font-size: 11px;
  color: #fbbf24;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-list {
  font-size: 12px;
  color: #8b949e;
  text-align: center;
  padding: 20px;
}

.manual-add-section {
  margin-top: 20px;
}

.input-row {
  display: flex;
  gap: 10px;
}

.input-row input {
  flex: 1;
  padding: 8px 12px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  color: #c9d1d9;
  outline: none;
  font-size: 13px;
}

.input-row input:focus {
  border-color: #58a6ff;
}

.add-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.add-btn:hover {
  background: #30363d;
  border-color: #8b949e;
}

.custom-tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.custom-tag {
  background: rgba(248, 81, 73, 0.15);
  border: 1px solid rgba(248, 81, 73, 0.3);
  color: #ff7b72;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.remove-tag-btn {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  font-size: 10px;
}

.remove-tag-btn:hover {
  color: #ffffff;
}

.assign-footer {
  flex-shrink: 0;
}

.save-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(90deg, #38bdf8, #0ea5e9);
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(14, 165, 233, 0.2);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.save-btn:hover {
  filter: brightness(1.1);
  box-shadow: 0 6px 20px rgba(14, 165, 233, 0.35);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s infinite linear;
}

.toast-alert {
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  text-align: center;
}

.toast-alert.success {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: #a7f3d0;
}

.toast-alert.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
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

@keyframes spin {
  to { transform: rotate(360deg); }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.slide-enter-active, .slide-leave-active {
  transition: all 0.3s ease;
}
.slide-enter-from, .slide-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* 移动端适配 (<=1024px)：左右面板纵向堆叠、表格横向滚动、弹窗限宽 */
@media (max-width: 1024px) {
  .admin-page-container {
    flex-direction: column;
    height: auto;
    min-height: 100%;
    overflow-y: auto;
    padding: 8px;
    gap: 12px;
  }

  .admin-card {
    padding: 14px;
    border-radius: 12px;
  }

  /* 面板头部换行不挤压 */
  .panel-header {
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }

  .header-left {
    flex-wrap: wrap;
    gap: 8px;
  }

  .panel-header h2,
  .panel-header h3 {
    font-size: 15px;
  }

  .create-user-btn {
    padding: 7px 12px;
    font-size: 12px;
  }

  /* 用户表格容器横向滚动，单元格压缩 */
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

  /* 操作按钮收纳换行 */
  .actions-cell {
    flex-wrap: wrap;
    gap: 4px;
    min-width: 96px;
  }

  .action-btn-mini {
    width: 28px;
    height: 28px;
  }

  /* 分配面板限高，内部列表滚动 */
  .assign-panel {
    max-height: 72vh;
  }

  .assign-panel.empty {
    min-height: 120px;
  }

  .assign-body {
    max-height: 48vh;
  }

  .dev-assigned {
    max-width: 120px;
  }

  .input-row {
    flex-wrap: wrap;
  }

  /* 弹窗宽度 min(92vw, 原宽)，内边距压缩 */
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
