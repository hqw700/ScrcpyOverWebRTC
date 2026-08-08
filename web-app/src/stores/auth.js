import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true'
  const token = ref(localStorage.getItem('auth_token') || (isDemo ? 'demo-token-xyz' : ''))
  const username = ref(localStorage.getItem('auth_user') || (isDemo ? 'demo_admin' : ''))
  const role = ref(localStorage.getItem('auth_role') || (isDemo ? 'admin' : ''))
  const assignedDevices = ref(JSON.parse(localStorage.getItem('auth_devices') || (isDemo ? '["*"]' : '[]')))
  const noAuthMode = ref(isDemo)
  // 当前用户的设置管控策略（/api/me 下发，null = 未加载）：
  // { forbid_bitrate, forbid_fps, forbid_resolution, forbid_audio, settings, expires_at }
  const userPolicy = ref(null)

  const isLoggedIn = computed(() => noAuthMode.value || !!token.value)
  const isAdmin = computed(() => noAuthMode.value || role.value === 'admin')

  async function login(user, pass) {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: user, password: pass })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(errText || '登录失败')
      }

      const data = await response.json()
      token.value = data.token
      username.value = data.username
      role.value = data.role || 'user'
      assignedDevices.value = data.assigned_devices || []

      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('auth_user', data.username)
      localStorage.setItem('auth_role', data.role || 'user')
      localStorage.setItem('auth_devices', JSON.stringify(data.assigned_devices || []))
      await fetchMe()
      return true
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  async function register(user, pass) {
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: user, password: pass })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(errText || '注册失败')
      }
      return true
    } catch (error) {
      console.error('Register error:', error)
      throw error
    }
  }

  async function logout() {
    try {
      if (token.value) {
        await fetch('/api/logout', {
          method: 'POST'
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      token.value = ''
      username.value = ''
      role.value = ''
      assignedDevices.value = []
      noAuthMode.value = false
      userPolicy.value = null
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      localStorage.removeItem('auth_role')
      localStorage.removeItem('auth_devices')
      window.location.href = '/login'
    }
  }

  async function checkNoAuthStatus() {
    try {
      const res = await fetch('/api/auth-status')
      if (res.ok) {
        const data = await res.json()
        if (data.noAuth) {
          noAuthMode.value = true
          username.value = 'admin'
          role.value = 'admin'
          assignedDevices.value = ['*']
        }
      }
    } catch (e) {
      // 请求失败说明需要正常认证，忽略
    }
  }

  async function fetchMe() {
    if (noAuthMode.value || !token.value) return
    try {
      const res = await fetch('/api/me', {
        headers: {
          'Authorization': `Bearer ${token.value}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        username.value = data.username
        role.value = data.role || 'user'
        assignedDevices.value = data.assigned_devices || []
        
        localStorage.setItem('auth_user', data.username)
        localStorage.setItem('auth_role', data.role || 'user')
        localStorage.setItem('auth_devices', JSON.stringify(data.assigned_devices || []))

        // 如果服务器端返回了用户的 AI 配置，同步保存到 localStorage
        if (data.ai_config) {
          localStorage.setItem('ai_api_url', data.ai_config.ai_api_url || '')
          localStorage.setItem('ai_api_key', data.ai_config.ai_api_key || '')
          localStorage.setItem('ai_model', data.ai_config.ai_model || '')
          localStorage.setItem('ai_provider', data.ai_config.ai_provider || '')
        }

        // 缓存用户的设置管控策略（画质/音频锁定 + 管理员配置值 + 账号有效期）
        userPolicy.value = {
          forbid_bitrate: !!data.forbid_bitrate,
          forbid_fps: !!data.forbid_fps,
          forbid_resolution: !!data.forbid_resolution,
          forbid_audio: !!data.forbid_audio,
          settings: data.settings || null,
          expires_at: data.expires_at || null
        }
      }
    } catch (e) {
      console.error('Fetch me error:', e)
    }
  }

  async function saveAIConfig(config) {
    if (noAuthMode.value || !token.value) return false
    try {
      const res = await fetch('/api/user/ai-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.value}`
        },
        body: JSON.stringify(config)
      })
      return res.ok
    } catch (e) {
      console.error('Save AI config error:', e)
      return false
    }
  }

  return {
    token,
    username,
    role,
    assignedDevices,
    noAuthMode,
    userPolicy,
    isLoggedIn,
    isAdmin,
    login,
    register,
    logout,
    checkNoAuthStatus,
    fetchMe,
    saveAIConfig
  }
})
