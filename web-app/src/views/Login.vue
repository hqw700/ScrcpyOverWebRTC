<template>
  <div class="login-container">
    <div class="background-decor animate-bg"></div>
    <div class="background-decor-2 animate-bg-2"></div>
    
    <div class="glass-card">
      <div class="brand">
        <div class="brand-logo">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM11 16H13V18H11V16ZM11 6H13V14H11V6Z" fill="url(#brandGrad)"/>
            <defs>
              <linearGradient id="brandGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#00f2fe" />
                <stop offset="100%" stop-color="#4facfe" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1>云手机管理系统</h1>
        <p class="subtitle">CloudPhone Management Platform</p>
      </div>

      <!-- 切换 Tab -->
      <div class="tab-header">
        <button 
          :class="['tab-btn', { active: activeTab === 'login' }]" 
          @click="switchTab('login')"
        >
          安全登录
        </button>
        <button 
          :class="['tab-btn', { active: activeTab === 'register' }]" 
          @click="switchTab('register')"
        >
          快捷注册
        </button>
        <button 
          class="tab-btn card-tab-btn"
          @click="showCardModal = true"
        >
          🔑 卡密直连
        </button>
      </div>

      <div class="form-container">
        <!-- 错误提示 -->
        <transition name="fade">
          <div v-if="errorMsg" class="alert-box error">
            <span class="icon">⚠️</span>
            <span class="msg">{{ errorMsg }}</span>
          </div>
        </transition>
        
        <!-- 成功提示 -->
        <transition name="fade">
          <div v-if="successMsg" class="alert-box success">
            <span class="icon">✨</span>
            <span class="msg">{{ successMsg }}</span>
          </div>
        </transition>

        <form @submit.prevent="handleSubmit">
          <div class="input-group">
            <input 
              type="text" 
              v-model="form.username" 
              required 
              placeholder=" " 
              id="username-input"
            />
            <label for="username-input">用户名 / Username</label>
            <span class="input-line"></span>
          </div>

          <div class="input-group">
            <input 
              type="password" 
              v-model="form.password" 
              required 
              placeholder=" " 
              id="password-input"
            />
            <label for="password-input">密码 / Password</label>
            <span class="input-line"></span>
          </div>

          <div v-if="activeTab === 'register'" class="input-group">
            <input 
              type="password" 
              v-model="form.confirmPassword" 
              required 
              placeholder=" " 
              id="confirm-input"
            />
            <label for="confirm-input">确认密码 / Confirm Password</label>
            <span class="input-line"></span>
          </div>

          <button type="submit" class="submit-btn" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            <span v-else>{{ activeTab === 'login' ? '登 录' : '注 册' }}</span>
          </button>
        </form>
      </div>
    </div>
    <!-- 卡密直连弹窗 -->
    <CardConnectModal :visible="showCardModal" @close="showCardModal = false" />
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
import CardConnectModal from '@/components/CardConnectModal.vue'

const authStore = useAuthStore()
const showCardModal = ref(false)

const activeTab = ref('login')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const form = reactive({
  username: '',
  password: '',
  confirmPassword: ''
})

function switchTab(tab) {
  activeTab.value = tab
  errorMsg.value = ''
  successMsg.value = ''
  form.password = ''
  form.confirmPassword = ''
}

async function handleSubmit() {
  errorMsg.value = ''
  successMsg.value = ''

  const username = form.username.trim()
  const password = form.password

  if (!username) {
    errorMsg.value = '用户名不能为空'
    return
  }
  if (password.length < 6) {
    errorMsg.value = '密码长度不能少于 6 位'
    return
  }

  loading.value = true

  try {
    if (activeTab.value === 'login') {
      await authStore.login(username, password)
      router.push('/')
    } else {
      if (password !== form.confirmPassword) {
        errorMsg.value = '两次输入的密码不一致'
        loading.value = false
        return
      }
      await authStore.register(username, password)
      successMsg.value = '注册成功！请切换到登录页进行登录'
      form.password = ''
      form.confirmPassword = ''
      // 延迟 1.5 秒自动切回登录 Tab
      setTimeout(() => {
        switchTab('login')
      }, 1500)
    }
  } catch (err) {
    errorMsg.value = err.message || '操作失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #0f172a;
  overflow: hidden;
  font-family: 'Outfit', 'Inter', -apple-system, sans-serif;
}

/* 背景炫光装饰 */
.background-decor {
  position: absolute;
  top: -10%;
  left: -10%;
  width: 50vw;
  height: 50vw;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 242, 254, 0.15) 0%, rgba(79, 172, 254, 0) 70%);
  filter: blur(80px);
  pointer-events: none;
}

.background-decor-2 {
  position: absolute;
  bottom: -10%;
  right: -10%;
  width: 50vw;
  height: 50vw;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, rgba(236, 72, 153, 0) 70%);
  filter: blur(80px);
  pointer-events: none;
}

.animate-bg {
  animation: floatBG 20s infinite alternate ease-in-out;
}

.animate-bg-2 {
  animation: floatBG-2 25s infinite alternate ease-in-out;
}

@keyframes floatBG {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(10vw, 5vh) scale(1.1); }
}

@keyframes floatBG-2 {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(-8vw, -8vh) scale(1.15); }
}

/* 磨砂玻璃卡片 */
.glass-card {
  position: relative;
  width: 420px;
  padding: 40px;
  background: rgba(30, 41, 59, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  z-index: 10;
  box-sizing: border-box;
}

@media (max-width: 480px) {
  .glass-card {
    width: 90%;
    padding: 30px 20px;
  }
}

/* 品牌头部 */
.brand {
  text-align: center;
  margin-bottom: 30px;
}

.brand-logo {
  width: 60px;
  height: 60px;
  margin: 0 auto 15px;
  filter: drop-shadow(0 4px 10px rgba(0, 242, 254, 0.3));
}

.brand-logo svg {
  width: 100%;
  height: 100%;
}

.brand h1 {
  font-size: 24px;
  font-weight: 700;
  color: #f8fafc;
  margin: 0 0 6px;
  letter-spacing: 1px;
}

.brand .subtitle {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

/* Tab 切换 */
.tab-header {
  display: flex;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 30px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.tab-btn {
  flex: 1;
  border: none;
  background: transparent;
  color: #94a3b8;
  padding: 10px 0;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-btn.active {
  background: rgba(255, 255, 255, 0.08);
  color: #38bdf8;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* 输入框 */
.input-group {
  position: relative;
  margin-bottom: 24px;
}

.input-group input {
  width: 100%;
  padding: 12px 0;
  font-size: 15px;
  color: #f1f5f9;
  border: none;
  border-bottom: 1px solid #475569;
  background: transparent;
  outline: none;
  transition: border-color 0.3s;
  box-sizing: border-box;
}

.input-group label {
  position: absolute;
  top: 12px;
  left: 0;
  font-size: 14px;
  color: #64748b;
  pointer-events: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.input-group input:focus ~ label,
.input-group input:not(:placeholder-shown) ~ label {
  top: -12px;
  font-size: 11px;
  color: #38bdf8;
}

.input-line {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, #00f2fe, #4facfe);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.input-group input:focus ~ .input-line {
  width: 100%;
  left: 0;
}

/* 按钮 */
.submit-btn {
  position: relative;
  width: 100%;
  padding: 14px;
  margin-top: 10px;
  background: linear-gradient(90deg, #38bdf8, #0ea5e9);
  color: #ffffff;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(14, 165, 233, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  justify-content: center;
  align-items: center;
}

.submit-btn:hover {
  filter: brightness(1.1);
  box-shadow: 0 6px 20px rgba(14, 165, 233, 0.45);
  transform: translateY(-1px);
}

.submit-btn:active {
  transform: translateY(1px);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Loading 旋转 */
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s infinite linear;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 提示框 */
.alert-box {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.4;
  margin-bottom: 20px;
  animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.alert-box.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

.alert-box.success {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: #a7f3d0;
}

.alert-box .icon {
  margin-right: 8px;
  font-size: 14px;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
