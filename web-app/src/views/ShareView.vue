<template>
  <div class="share-page-container">


    <!-- 主体显示区 -->
    <main class="share-main">
      <!-- 1. 加载中状态 -->
      <div v-if="loading" class="state-container">
        <div class="loading-spinner"></div>
        <p class="loading-text">{{ $t('share.verifyingCredentials') }}</p>
      </div>

      <!-- 2. 需要访问密码 -->
      <div v-else-if="needPassword" class="state-container">
        <div class="pwd-icon">🔒</div>
        <h2>{{ $t('share.passwordRequiredTitle') }}</h2>
        <p class="pwd-desc">{{ $t('share.passwordRequiredDesc') }}</p>
        <input
          v-model="password"
          type="password"
          class="pwd-input"
          :placeholder="$t('share.passwordPlaceholderShort')"
          @keyup.enter="submitPassword"
        />
        <div v-if="pwdError" class="pwd-error">⚠️ {{ pwdError }}</div>
        <button class="pwd-submit" @click="submitPassword">{{ $t('share.confirmAndConnect') }}</button>
      </div>

      <!-- 3. 过期 / 无效状态 -->
      <div v-else-if="error" class="state-container error-state">
        <div class="error-icon">🚫</div>
        <h2>{{ $t('share.expiredTitle') }}</h2>
        <p class="error-desc">{{ error }}</p>
        <div class="error-actions">
          <router-link to="/" class="btn-home">{{ $t('share.backToHome') }}</router-link>
          <button class="btn-card-reconnect" @click="showCardModal = true">{{ $t('share.connectOtherCode') }}</button>
        </div>
      </div>

      <!-- 4. 连接与视讯渲染区 -->
      <div v-else-if="shareInfo" class="console-wrapper">
        <ShareVideo
          :key="shareInfo.token"
          :deviceId="shareInfo.device_id"
          :deviceName="shareInfo.device_name || shareInfo.device_id"
          :shareToken="shareInfo.token"
          :sharePassword="password"
          :accessMode="shareInfo.access_mode"
          :guestSettings="shareInfo.guest_settings"
          :forbidBitrate="!!shareInfo.forbid_bitrate"
          :forbidFps="!!shareInfo.forbid_fps"
          :forbidResolution="!!shareInfo.forbid_resolution"
          :forbidAudio="!!shareInfo.forbid_audio"
          :cardCode="shareInfo.card_code"
          :remainingSeconds="remainingSeconds"
        />

        <!-- 只读模式水波纹 / 提示 Overlay -->
        <div v-if="shareInfo.access_mode === 'view_only'" class="view-only-overlay">
          <div class="view-only-banner">
            <span class="eye-icon">👁️</span>
            <span>{{ $t('share.viewOnlyWarning') }}</span>
          </div>
        </div>
      </div>
    </main>

    <!-- 弹窗 -->
    <CardConnectModal :visible="showCardModal" @close="showCardModal = false" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import ShareVideo from '@/components/ShareVideo.vue'
import CardConnectModal from '@/components/CardConnectModal.vue'

const route = useRoute()
const loading = ref(true)
const error = ref('')
const shareInfo = ref(null)
const remainingSeconds = ref(0)
const showCardModal = ref(false)
const password = ref('')
const needPassword = ref(false)
const pwdError = ref('')
let timer = null

function startCountdown(seconds) {
  if (timer) clearInterval(timer)
  timer = null
  if (seconds > 0) {
    timer = setInterval(() => {
      if (remainingSeconds.value > 0) {
        remainingSeconds.value--
      } else {
        clearInterval(timer)
        timer = null
        error.value = '分享链接已到期失效。'
      }
    }, 1000)
  }
}

async function verifyToken() {
  const tokenStr = route.query.token || route.query.stoken || ''
  if (!tokenStr) {
    loading.value = false
    error.value = '未提供有效 Token 或卡密提取码。'
    return
  }

  try {
    let url = `/api/share/info?token=${encodeURIComponent(tokenStr)}`
    if (password.value) {
      url += `&password=${encodeURIComponent(password.value)}`
    }
    const res = await fetch(url)
    if (!res.ok) {
      loading.value = false
      error.value = '分享链接不存在或已经到期被撤销。'
      return
    }

    const json = await res.json()
    if (json.code === 401) {
      // 需要访问密码（或密码错误）：切换到密码输入态
      loading.value = false
      needPassword.value = true
      if (password.value) {
        pwdError.value = json.msg || '密码错误，请重试'
        password.value = ''
      }
      return
    }
    if (json.code === 0 && json.data) {
      needPassword.value = false
      pwdError.value = ''
      shareInfo.value = json.data
      remainingSeconds.value = json.data.remaining_seconds
      startCountdown(remainingSeconds.value)
    } else {
      error.value = json.msg || '无法解析分享信息'
    }
  } catch (err) {
    error.value = '网络连接失败: ' + err.message
  } finally {
    loading.value = false
  }
}

function submitPassword() {
  if (!password.value) return
  pwdError.value = ''
  loading.value = true
  verifyToken()
}

onMounted(() => {
  // 卡密兑换成功后通过 history.state 带入已验证过的密码，避免二次输入
  password.value = (window.history.state && window.history.state.sharePwd) || ''
  verifyToken()
})

// 同一路由下更换 token（错误页使用其他卡密连接成功）时重新校验
watch(() => route.query.token, (val, old) => {
  if (val && val !== old) {
    if (timer) { clearInterval(timer); timer = null }
    loading.value = true
    error.value = ''
    shareInfo.value = null
    needPassword.value = false
    pwdError.value = ''
    password.value = (window.history.state && window.history.state.sharePwd) || ''
    verifyToken()
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.share-page-container {
  position: fixed;
  inset: 0;
  width: 100%;
  width: 100vw;
  height: 100%;
  height: 100dvh;
  background: #000;
  display: flex;
  flex-direction: column;
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
  touch-action: none;
  -webkit-touch-callout: none;
}

.share-main {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.state-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}

.pwd-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.pwd-desc {
  margin: 8px 0 20px;
  font-size: 0.9rem;
}

.pwd-input {
  width: 260px;
  padding: 12px 14px;
  background: #0f172a;
  border: 1px solid #38bdf8;
  border-radius: 8px;
  color: #f8fafc;
  font-size: 1rem;
  outline: none;
  text-align: center;
  letter-spacing: 1px;
}

.pwd-error {
  margin-top: 12px;
  color: #f43f5e;
  font-size: 0.85rem;
}

.pwd-submit {
  margin-top: 18px;
  padding: 10px 28px;
  background: linear-gradient(135deg, #0284c7, #6366f1);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
  font-size: 0.92rem;
  cursor: pointer;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(56, 189, 248, 0.1);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: spin 1s infinite linear;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state .error-icon {
  font-size: 3.5rem;
  margin-bottom: 16px;
}

.error-state h2 {
  color: #f43f5e;
  margin: 0 0 8px 0;
}

.error-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn-home, .btn-card-reconnect {
  padding: 10px 20px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  border: none;
}

.btn-home {
  background: #334155;
  color: #fff;
}

.btn-card-reconnect {
  background: linear-gradient(135deg, #0284c7, #6366f1);
  color: #fff;
}

.console-wrapper {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.view-only-overlay {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 50;
}

.view-only-banner {
  background: rgba(245, 158, 11, 0.85);
  backdrop-filter: blur(4px);
  color: #000;
  padding: 6px 16px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}
</style>
