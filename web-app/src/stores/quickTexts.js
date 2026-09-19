import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useDeviceStore } from '@/stores/devices'

const STORAGE_KEY = 'cloudphone_quick_texts_v1'

export const DEFAULT_QUICK_TEXTS = [
  {
    id: 'qt_welcome',
    title: '测试欢迎语',
    content: '欢迎体验云手机低延迟 WebRTC 投屏控制系统！🎉',
    autoEnter: true,
    createdAt: Date.now()
  },
  {
    id: 'qt_account',
    title: '测试账号',
    content: 'test_user_001@cloudphone.com',
    autoEnter: false,
    createdAt: Date.now()
  },
  {
    id: 'qt_password',
    title: '默认密码',
    content: 'Admin123456!',
    autoEnter: true,
    createdAt: Date.now()
  }
]

function generateId() {
  return `qt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export const useQuickTextStore = defineStore('quickTexts', () => {
  const quickTexts = ref([])
  const loading = ref(false)
  const isLoaded = ref(false)

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          quickTexts.value = parsed
          return true
        }
      }
    } catch (e) {
      console.warn('[QuickTexts] Failed to load from localStorage:', e)
    }
    return false
  }

  // 立即同步载入数据或赋予默认文本，杜绝首屏空列表
  if (!loadLocal() || quickTexts.value.length === 0) {
    quickTexts.value = [...DEFAULT_QUICK_TEXTS]
    persistLocal()
  }

  function persistLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quickTexts.value))
    } catch (e) {
      console.warn('[QuickTexts] Failed to persist to localStorage:', e)
    }
  }

  async function fetchQuickTexts() {
    if (loading.value) return
    loading.value = true
    try {
      const token = localStorage.getItem('auth_token') || ''
      const res = await fetch('/api/quick_texts', {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          quickTexts.value = data.map(item => ({
            id: item.id || generateId(),
            title: item.title || '未命名短语',
            content: item.content || '',
            autoEnter: !!item.auto_enter,
            createdAt: item.created_at || Date.now()
          }))
          persistLocal()
          isLoaded.value = true
          return
        }
      }
    } catch (e) {
      console.warn('[QuickTexts] Failed to fetch from server, fallback to local:', e)
    } finally {
      loading.value = false
    }

    // 服务端失败或未配置时回退本地，本地若为空则必须使用 DEFAULT_QUICK_TEXTS 保底
    if (!loadLocal() || quickTexts.value.length === 0) {
      quickTexts.value = [...DEFAULT_QUICK_TEXTS]
      persistLocal()
    }
    isLoaded.value = true
  }

  async function syncToServer() {
    persistLocal()
    try {
      const token = localStorage.getItem('auth_token') || ''
      const payload = quickTexts.value.map(item => ({
        id: item.id,
        title: item.title,
        content: item.content,
        auto_enter: !!item.autoEnter,
        created_at: item.createdAt || Date.now()
      }))
      const res = await fetch('/api/quick_texts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        console.warn('[QuickTexts] Sync to server returned non-ok:', res.status)
      }
    } catch (e) {
      console.warn('[QuickTexts] Failed to sync to server:', e)
    }
  }

  function addQuickText({ title, content, autoEnter = false }) {
    const item = {
      id: generateId(),
      title: title.trim() || '快捷短语',
      content: content || '',
      autoEnter: !!autoEnter,
      createdAt: Date.now()
    }
    quickTexts.value.unshift(item)
    syncToServer()
    return item
  }

  function updateQuickText(id, updates) {
    const index = quickTexts.value.findIndex(item => item.id === id)
    if (index === -1) return false
    quickTexts.value[index] = {
      ...quickTexts.value[index],
      title: updates.title !== undefined ? updates.title.trim() : quickTexts.value[index].title,
      content: updates.content !== undefined ? updates.content : quickTexts.value[index].content,
      autoEnter: updates.autoEnter !== undefined ? !!updates.autoEnter : quickTexts.value[index].autoEnter
    }
    syncToServer()
    return true
  }

  function removeQuickText(id) {
    const prevLen = quickTexts.value.length
    quickTexts.value = quickTexts.value.filter(item => item.id !== id)
    if (quickTexts.value.length !== prevLen) {
      syncToServer()
      return true
    }
    return false
  }

  function reorderQuickTexts(items) {
    if (Array.isArray(items)) {
      quickTexts.value = [...items]
      syncToServer()
    }
  }

  /**
   * 向单台设备注入文本
   * @param {string} deviceId 
   * @param {string} text 
   * @param {boolean} autoEnter 是否追加 Enter 键
   */
  function injectToDevice(deviceId, text, autoEnter = false) {
    if (!deviceId || !text) return false
    const deviceStore = useDeviceStore()
    
    // 优先通过 WebRTC inputChannel 快速注入（若直连处于连接状态）
    const webrtc = deviceStore.getWebRTC ? deviceStore.getWebRTC(deviceId) : null
    let injected = false
    if (webrtc && typeof webrtc.sendInjectText === 'function') {
      injected = webrtc.sendInjectText(text)
    }

    // 若无 WebRTC 或通道未就绪，使用信令 group_control_event 兜底（支持 WebSocket 投屏与后台大盘）
    if (!injected) {
      deviceStore.sendGroupControlEvent([deviceId], {
        type: 'inject_text',
        text
      })
      injected = true
    }

    // 若需要自动回车
    if (autoEnter) {
      setTimeout(() => {
        // Android keycode 66: KEYCODE_ENTER
        if (webrtc && typeof webrtc.sendInjectKeycode === 'function') {
          webrtc.sendInjectKeycode(0, 66)
          setTimeout(() => webrtc.sendInjectKeycode(1, 66), 30)
        } else {
          deviceStore.sendGroupControlEvent([deviceId], {
            type: 'inject_keycode',
            action: 0,
            keycode: 66
          })
          setTimeout(() => {
            deviceStore.sendGroupControlEvent([deviceId], {
              type: 'inject_keycode',
              action: 1,
              keycode: 66
            })
          }, 30)
        }
      }, 80)
    }

    return true
  }

  /**
   * 批量向多台设备广播下发文本
   * @param {string[]} targetDeviceIds 
   * @param {string} text 
   * @param {object} options { autoEnter }
   */
  function batchInject(targetDeviceIds, text, options = {}) {
    if (!Array.isArray(targetDeviceIds) || targetDeviceIds.length === 0 || !text) {
      return false
    }
    const deviceStore = useDeviceStore()
    const autoEnter = !!options.autoEnter

    // 广播 inject_text 事件给所有目标设备
    deviceStore.sendGroupControlEvent(targetDeviceIds, {
      type: 'inject_text',
      text
    })

    // 若需要追加回车
    if (autoEnter) {
      setTimeout(() => {
        deviceStore.sendGroupControlEvent(targetDeviceIds, {
          type: 'inject_keycode',
          action: 0,
          keycode: 66
        })
        setTimeout(() => {
          deviceStore.sendGroupControlEvent(targetDeviceIds, {
            type: 'inject_keycode',
            action: 1,
            keycode: 66
          })
        }, 40)
      }, 100)
    }

    return true
  }

  return {
    quickTexts,
    loading,
    isLoaded,
    fetchQuickTexts,
    addQuickText,
    updateQuickText,
    removeQuickText,
    reorderQuickTexts,
    injectToDevice,
    batchInject
  }
})
