<template>
  <div class="guest-config-overlay" @click.self="$emit('close')">
    <div class="guest-config-modal">
      <div class="gc-header">
        <span>⚙️ 用户配置 — {{ user.username }}</span>
        <button class="gc-close" @click="$emit('close')">×</button>
      </div>

      <div class="gc-body">
        <div class="gc-section-title">可修改项（设置锁定）</div>
        <label class="gc-toggle-row" v-for="dim in dims" :key="dim.key">
          <input type="checkbox" v-model="dim.allow.value" />
          <span>{{ dim.label }}</span>
        </label>
        <div class="gc-hint">取消勾选的项：该用户的设置面板置灰锁定，且服务端在信令层强制使用下方配置值，下次连接生效。</div>

        <div class="gc-section-title">设置值</div>
        <div class="gc-summary">
          <template v-if="draftSettings">
            <span>码率 {{ bitrateText }} · 帧率 {{ draftSettings.fps || '不限' }} · 分辨率 {{ draftSettings.size || '不限' }} · 音频 {{ draftSettings.audio ? '开' : '关' }}</span>
          </template>
          <template v-else>
            <span class="gc-none">未配置（被禁项回落设备默认值）</span>
          </template>
        </div>
        <div class="gc-actions-row">
          <button class="gc-btn" @click="openEditor">编辑设置值…</button>
          <button v-if="draftSettings" class="gc-btn gc-btn-danger" @click="draftSettings = null">清除配置</button>
        </div>

        <div class="gc-section-title">账号有效期</div>
        <div class="gc-summary">
          <span>当前：{{ expiryText }}</span>
        </div>
        <div class="gc-expire-row">
          <select v-model="expireChoice" class="gc-select">
            <option value="keep">保持不变</option>
            <option value="0">♾️ 永久有效</option>
            <option value="1800">30 分钟（从现在开始）</option>
            <option value="3600">1 小时（从现在开始）</option>
            <option value="43200">12 小时（从现在开始）</option>
            <option value="86400">1 天（从现在开始）</option>
            <option value="604800">7 天（从现在开始）</option>
            <option value="custom">⚙️ 自定义天数…</option>
          </select>
          <input
            v-if="expireChoice === 'custom'"
            v-model.number="customDays"
            type="number"
            min="1"
            placeholder="天数"
            class="gc-select gc-minutes"
          />
        </div>
        <div class="gc-hint">到期后该用户无法登录，在线会话将被踢断；重新设置有效期即可恢复。</div>
      </div>

      <div class="gc-footer">
        <span v-if="error" class="gc-error">{{ error }}</span>
        <div style="flex: 1"></div>
        <button class="gc-btn" @click="$emit('close')">取消</button>
        <button class="gc-btn gc-btn-primary" :disabled="saving" @click="save">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>

    <!-- 复用主控台连接设置面板编辑草稿 -->
    <SettingsModal
      v-if="showEditor"
      :settings="editorSettings"
      :is-connected="false"
      :is-global="false"
      :is-custom="false"
      @save="onEditorSave"
      @close="showEditor = false"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SettingsModal from '@/components/SettingsModal.vue'
import { getDeviceSettings } from '@/utils/settings'

const props = defineProps({
  user: { type: Object, required: true }
})
const emit = defineEmits(['close', 'saved'])

// 允许项 = forbid 取反；初值来自用户现有配置
const dims = [
  { key: 'bitrate', label: '允许修改码率（含 BWE / 上下限）', allow: ref(!props.user.forbid_bitrate) },
  { key: 'fps', label: '允许修改帧率', allow: ref(!props.user.forbid_fps) },
  { key: 'resolution', label: '允许修改分辨率', allow: ref(!props.user.forbid_resolution) },
  { key: 'audio', label: '允许修改音频', allow: ref(!props.user.forbid_audio) }
]

// 草稿：以全局默认配置为底，叠加已保存的用户设置值
const draftSettings = ref(
  props.user.settings
    ? { ...getDeviceSettings(''), ...props.user.settings }
    : null
)

const expireChoice = ref('keep')
const customDays = ref(1)
const showEditor = ref(false)
const saving = ref(false)
const error = ref('')

const bitrateText = computed(() => {
  const s = draftSettings.value
  if (!s) return ''
  return s.bwe ? `${s.minBitrate}-${s.maxBitrate} Mbps (BWE)` : `${s.bitrate} Mbps`
})

// 清除后重新编辑：仍从全局默认配置起步
const editorSettings = computed(() => draftSettings.value || getDeviceSettings(''))

function parseExpire(expiresAt) {
  if (!expiresAt) return null
  const t = new Date(expiresAt)
  if (Number.isNaN(t.getTime()) || t.getFullYear() <= 1) return null // Go 零值时间 = 永久
  return t
}

const expiryText = computed(() => {
  const t = parseExpire(props.user.expires_at)
  if (!t) return '♾️ 永久有效'
  const ms = t.getTime() - Date.now()
  if (ms <= 0) return `已到期（${t.toLocaleString('zh-CN', { hour12: false })}）`
  return `${t.toLocaleString('zh-CN', { hour12: false })} 到期`
})

function openEditor() {
  showEditor.value = true
}

function onEditorSave(newSettings) {
  draftSettings.value = newSettings
  showEditor.value = false
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    const body = {
      username: props.user.username,
      forbid_bitrate: !dims[0].allow.value,
      forbid_fps: !dims[1].allow.value,
      forbid_resolution: !dims[2].allow.value,
      forbid_audio: !dims[3].allow.value,
      settings: draftSettings.value
    }
    if (expireChoice.value === 'keep') {
      body.expire_seconds = -1
    } else if (expireChoice.value === 'custom') {
      body.expire_seconds = Math.max(1, customDays.value || 1) * 86400
    } else {
      body.expire_seconds = Number(expireChoice.value)
    }

    const res = await fetch('/api/admin/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (res.ok) {
      emit('saved')
      emit('close')
    } else {
      const txt = await res.text()
      error.value = '保存失败: ' + (txt || ('HTTP ' + res.status))
    }
  } catch (e) {
    error.value = '网络请求异常: ' + e.message
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.guest-config-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(10, 12, 16, 0.65);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
}

.guest-config-modal {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  width: 100%;
  max-width: 420px;
  max-height: 88vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
}

.gc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #21262d;
  font-size: 0.95rem;
  font-weight: 600;
  color: #c9d1d9;
}

.gc-close {
  background: none;
  border: none;
  color: #8b949e;
  font-size: 1.3rem;
  cursor: pointer;
  line-height: 1;
}

.gc-close:hover {
  color: #fff;
}

.gc-body {
  padding: 14px 16px;
}

.gc-section-title {
  font-size: 0.8rem;
  color: #8b949e;
  font-weight: 600;
  margin: 14px 0 8px;
}

.gc-section-title:first-child {
  margin-top: 0;
}

.gc-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  font-size: 0.86rem;
  color: #c9d1d9;
  cursor: pointer;
}

.gc-toggle-row input {
  accent-color: #6366f1;
}

.gc-hint {
  font-size: 0.75rem;
  color: #8b949e;
  line-height: 1.5;
  margin-top: 6px;
}

.gc-summary {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 0.82rem;
  color: #c9d1d9;
  line-height: 1.5;
}

.gc-none {
  color: #8b949e;
}

.gc-actions-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.gc-expire-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.gc-select {
  flex: 1;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 0.82rem;
  padding: 7px 10px;
}

.gc-minutes {
  flex: 0 0 90px;
}

.gc-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #21262d;
}

.gc-error {
  color: #f43f5e;
  font-size: 0.78rem;
}

.gc-btn {
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 0.82rem;
  padding: 7px 14px;
  cursor: pointer;
}

.gc-btn:hover {
  background: #30363d;
}

.gc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.gc-btn-primary {
  background: linear-gradient(135deg, #6366f1, #a855f7);
  border: none;
  color: #fff;
  font-weight: 600;
}

.gc-btn-danger {
  color: #f43f5e;
}

.gc-btn-danger:hover {
  background: rgba(244, 63, 94, 0.15);
}
</style>
