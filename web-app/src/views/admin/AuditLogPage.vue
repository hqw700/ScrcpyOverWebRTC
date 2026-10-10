<template>
  <div class="admin-page-container">
    <div class="admin-card audit-panel">
      <div class="panel-header">
        <div class="header-left">
          <h2>{{ $t('audit.pageTitle') }}</h2>
          <span class="user-count">{{ $t('audit.totalRecords', { count: total }) }}</span>
        </div>
        <button class="refresh-btn" @click="reload" :disabled="loading">{{ $t('audit.refreshBtn') }}</button>
      </div>

      <!-- 筛选条 -->
      <div class="filter-bar">
        <div class="search-box">
          <input type="text" v-model="adminQuery" :placeholder="$t('audit.searchPlaceholder')" />
        </div>
        <select v-model="actionFilter" class="action-select">
          <option value="">{{ $t('audit.allActions') }}</option>
          <option v-for="key in ACTION_KEYS" :key="key" :value="key">{{ actionLabel(key) }}</option>
        </select>
      </div>

      <div class="table-wrapper">
        <table class="premium-table">
          <thead>
            <tr>
              <th>{{ $t('audit.thTime') }}</th>
              <th>{{ $t('audit.thOperator') }}</th>
              <th>{{ $t('audit.thAction') }}</th>
              <th>{{ $t('audit.thTarget') }}</th>
              <th>{{ $t('audit.thDetails') }}</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(entry, idx) in filteredEntries" :key="idx">
              <td class="ts-cell">{{ formatTime(entry.ts) }}</td>
              <td class="admin-cell">{{ entry.admin }}</td>
              <td>
                <span class="action-chip" :class="actionCategory(entry.action)">{{ actionLabel(entry.action) }}</span>
              </td>
              <td class="target-cell" :title="entry.target">{{ entry.target || '-' }}</td>
              <td class="detail-cell" :title="entry.detail">{{ entry.detail || '-' }}</td>
              <td class="ip-cell">{{ entry.ip || '-' }}</td>
            </tr>
            <tr v-if="filteredEntries.length === 0 && !loading">
              <td colspan="6" class="empty-row">{{ entries.length === 0 ? $t('audit.noLogs') : $t('audit.noMatchedRecords') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="load-more-bar" v-if="entries.length < total">
        <button class="load-more-btn" @click="loadMore" :disabled="loading">
          {{ loading ? $t('common.loading') : $t('audit.loadMore', { shown: entries.length, total: total }) }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { authHeaders, readError } from '@/utils/api'

const { t, te, locale } = useI18n()

const PAGE_SIZE = 50

// action 英文标识列表
const ACTION_KEYS = [
  'user_create',
  'user_delete',
  'user_rename',
  'user_reset_password',
  'user_kick',
  'user_update',
  'user_update_note',
  'assign_devices',
  'share_create',
  'share_connect',
  'share_revoke',
  'share_extend',
  'share_update',
  'update_default_settings',
  'create_batch_task',
  'lease_create',
  'lease_extend',
  'lease_revoke',
  'lease_update'
]

function actionLabel(action) {
  if (!action) return '-'
  const i18nKey = `audit.actions.${action}`
  return te(i18nKey) ? t(i18nKey) : action
}

// 动作分类着色：user 用户类 / share 分享类 / lease 租约类 / system 其他
function actionCategory(action) {
  if (!action) return 'system'
  if (action.startsWith('lease_')) return 'lease'
  if (action.startsWith('share_')) return 'share'
  if (action.startsWith('user_') || action === 'assign_devices') return 'user'
  return 'system'
}

const entries = ref([])
const total = ref(0)
const loading = ref(false)
const adminQuery = ref('')
const actionFilter = ref('')

const filteredEntries = computed(() => {
  const q = adminQuery.value.trim().toLowerCase()
  return entries.value.filter(e => {
    if (q && !(e.admin || '').toLowerCase().includes(q)) return false
    if (actionFilter.value && e.action !== actionFilter.value) return false
    return true
  })
})

function formatTime(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso || '-'
  return date.toLocaleString(locale.value === 'en-US' ? 'en-US' : 'zh-CN', { hour12: false })
}

async function fetchPage(offset) {
  loading.value = true
  try {
    const res = await fetch(`/api/admin/audit?limit=${PAGE_SIZE}&offset=${offset}`, {
      headers: authHeaders()
    })
    if (!res.ok) throw new Error(await readError(res, '获取审计日志失败'))
    const data = await res.json()
    total.value = data.total || 0
    if (offset === 0) {
      entries.value = data.entries || []
    } else {
      entries.value = [...entries.value, ...(data.entries || [])]
    }
  } catch (err) {
    alert(t('audit.loadFailed') + err.message)
  } finally {
    loading.value = false
  }
}

function reload() {
  fetchPage(0)
}

function loadMore() {
  fetchPage(entries.value.length)
}

onMounted(() => {
  fetchPage(0)
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

.audit-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
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

.action-select {
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
  font-size: 13px;
}

.premium-table tr:hover {
  background: rgba(255, 255, 255, 0.015);
}

.ts-cell {
  color: #8b949e;
  font-size: 12px;
  white-space: nowrap;
  font-family: monospace;
}

.admin-cell {
  color: #58a6ff;
  font-weight: 600;
}

.action-chip {
  font-size: 11.5px;
  padding: 3px 10px;
  border-radius: 12px;
  white-space: nowrap;
}

.action-chip.user { background: rgba(56, 189, 248, 0.08); color: #7dd3fc; border: 1px solid rgba(56, 189, 248, 0.2); }
.action-chip.lease { background: rgba(16, 185, 129, 0.08); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25); }
.action-chip.share { background: rgba(163, 113, 247, 0.08); color: #d8b4fe; border: 1px solid rgba(163, 113, 247, 0.25); }
.action-chip.system { background: rgba(139, 148, 158, 0.08); color: #8b949e; border: 1px solid rgba(139, 148, 158, 0.2); }

.target-cell {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-cell {
  color: #8b949e;
  font-size: 12px;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ip-cell {
  color: #8b949e;
  font-family: monospace;
  font-size: 12px;
}

.empty-row {
  text-align: center;
  color: #4b5563;
  padding: 32px 0 !important;
}

.load-more-bar {
  flex-shrink: 0;
  padding-top: 14px;
  display: flex;
  justify-content: center;
}

.load-more-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  padding: 9px 22px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}

.load-more-btn:hover {
  background: #30363d;
  border-color: #8b949e;
}

.load-more-btn:disabled {
  opacity: 0.5;
  cursor: default;
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
    font-size: 12px;
    white-space: nowrap;
  }
}
</style>
