<template>
  <div v-if="visible" class="modal-backdrop" @click.self.stop="close" @click.stop>
    <div class="modal-container dark-theme glow-border" @click.stop>
      <div class="modal-header">
        <div class="header-title">
          <span class="icon">🔑</span>
          <h3>卡密连接设备</h3>
        </div>
        <button type="button" class="close-btn" @click.stop.prevent="close">✕</button>
      </div>

      <div class="modal-body">
        <p class="subtitle">请输入管理员或设备拥有者发放的 8 位卡密提取码免登录快速操控/观看云手机。</p>

        <div class="form-group">
          <label>卡密提取码 (Card Code)</label>
          <input 
            v-model="cardCode" 
            type="text" 
            placeholder="例如: CP-8A9F-2C3D" 
            class="card-input"
            @keyup.enter.stop.prevent="connectWithCard"
          />
        </div>

        <div class="form-group mt-3" v-if="needPassword">
          <label>🔒 访问密码</label>
          <input 
            v-model="password" 
            type="password" 
            placeholder="请输入该卡密的访问密码" 
            class="card-input"
            @keyup.enter.stop.prevent="connectWithCard"
          />
        </div>

        <div v-if="errorMsg" class="error-banner mt-3">
          ⚠️ {{ errorMsg }}
        </div>

        <div class="action-bar">
          <button type="button" class="btn-connect glow-btn" :disabled="loading || !cardCode.trim()" @click.stop.prevent="connectWithCard">
            <span v-if="loading">正在校验卡密...</span>
            <span v-else>🚀 立即连接设备</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])
const router = useRouter()

const cardCode = ref('')
const password = ref('')
const needPassword = ref(false)
const errorMsg = ref('')
const loading = ref(false)

function close() {
  emit('close')
}

async function connectWithCard() {
  if (!cardCode.value.trim()) return
  loading.value = true
  errorMsg.value = ''

  try {
    const res = await fetch('/api/share/redeem_card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_code: cardCode.value.trim(),
        password: password.value
      })
    })

    const json = await res.json()
    if (json.code === 0 && json.data) {
      // 成功，跳转至 /share?token=st_xxx
      // 已验证过的密码通过 history.state 携带（不进 URL），ShareView 免二次输入
      close()
      router.push({
        path: '/share',
        query: { token: json.data.token },
        state: password.value ? { sharePwd: password.value } : undefined
      })
    } else if (json.code === 401 && json.msg.includes('密码')) {
      needPassword.value = true
      errorMsg.value = json.msg || '请输入访问密码'
    } else {
      errorMsg.value = json.msg || '卡密无效或已过期'
    }
  } catch (err) {
    errorMsg.value = '网络连接异常: ' + err.message
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    cardCode.value = ''
    password.value = ''
    needPassword.value = false
    errorMsg.value = ''
  }
})
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(10, 12, 20, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-container {
  width: 440px;
  max-width: 90vw;
  background: #141824;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(129, 140, 248, 0.15);
  display: flex;
  flex-direction: column;
  color: #f1f5f9;
  overflow: hidden;
}

.modal-header {
  padding: 16px 20px;
  background: #1a2030;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-title h3 {
  margin: 0;
  font-size: 1.1rem;
  background: linear-gradient(135deg, #818cf8, #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.2rem;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
}

.subtitle {
  font-size: 0.85rem;
  color: #94a3b8;
  line-height: 1.4;
  margin-top: 0;
  margin-bottom: 18px;
}

.form-group label {
  display: block;
  font-size: 0.86rem;
  color: #cbd5e1;
  margin-bottom: 8px;
}

.card-input {
  width: 100%;
  padding: 12px 14px;
  background: #0f172a;
  border: 1px solid #38bdf8;
  border-radius: 8px;
  color: #38bdf8;
  font-size: 1.15rem;
  font-family: monospace;
  font-weight: bold;
  letter-spacing: 2px;
  outline: none;
  box-sizing: border-box;
}

.mt-3 { margin-top: 14px; }

.error-banner {
  padding: 10px;
  background: rgba(244, 63, 94, 0.15);
  border: 1px solid rgba(244, 63, 94, 0.4);
  border-radius: 8px;
  color: #f43f5e;
  font-size: 0.85rem;
}

.action-bar {
  margin-top: 22px;
}

.btn-connect {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
  font-size: 0.96rem;
  cursor: pointer;
}

.btn-connect:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
