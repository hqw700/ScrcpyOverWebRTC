import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useDeviceStore = defineStore('devices', () => {
  const devices = ref([])
  const loading = ref(false)
  const error = ref(null)

  const onlineDevices = computed(() => 
    [...devices.value]
      .filter(d => d.status === 'online')
      .sort((a, b) => a.id.localeCompare(b.id)) // 稳定升序排序
  )

  async function fetchDevices() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/devices')
      const data = await res.json()
      
      if (Array.isArray(data)) {
        // 转换并排序
        const newList = data.map(id => ({
          id: typeof id === 'string' ? id : id.device_id,
          status: 'online'
        })).sort((a, b) => a.id.localeCompare(b.id))
        
        // 只有当 ID 列表发生变化时才更新（防止 UI 频繁重绘）
        const oldIds = devices.value.map(d => d.id).join(',')
        const newIds = newList.map(d => d.id).join(',')
        
        if (oldIds !== newIds) {
          devices.value = newList
        }
      } else {
        devices.value = []
      }
    } catch (e) {
      error.value = e.message
      console.error('Failed to fetch devices:', e)
    } finally {
      loading.value = false
    }
  }

  function addDevice(device) {
    const existing = devices.value.find(d => d.id === device.id)
    if (!existing) {
      devices.value.push({ ...device, status: 'online' })
      devices.value.sort((a, b) => a.id.localeCompare(b.id))
    }
  }

  function removeDevice(deviceId) {
    const index = devices.value.findIndex(d => d.id === deviceId)
    if (index > -1) {
      devices.value.splice(index, 1)
    }
  }

  function updateFromList(idList) {
    if (!Array.isArray(idList)) return
    
    // 排序并转换
    const newList = idList.map(id => {
      // 尝试保留旧的快照数据
      const old = devices.value.find(d => d.id === (typeof id === 'string' ? id : id.device_id))
      return {
        id: typeof id === 'string' ? id : id.device_id,
        status: 'online',
        snapshot: old ? old.snapshot : null
      }
    }).sort((a, b) => a.id.localeCompare(b.id))
    
    // 对比是否有变化
    const oldIds = devices.value.map(d => d.id).join(',')
    const newIds = newList.map(d => d.id).join(',')
    
    if (oldIds !== newIds) {
      devices.value = newList
      console.log('[Store] Device list updated via broadcast:', idList)
    }
  }

  function updateSnapshot(deviceId, base64Data) {
    const index = devices.value.findIndex(d => d.id === deviceId)
    if (index > -1) {
      // 深度更新属性
      devices.value[index].snapshot = `data:image/png;base64,${base64Data}`
      // 触发响应式 (虽然 Vue3 应该能检测到，但重新赋值数组引用更保险)
      devices.value = [...devices.value]
      console.log(`[Store] Snapshot updated for ${deviceId}, length: ${base64Data.length}`)
    }
  }

  const activeDeviceId = ref(null)

  const activeDevice = computed(() => 
    devices.value.find(d => d.id === activeDeviceId.value)
  )

  function setActiveDevice(id) {
    activeDeviceId.value = id
  }

  function clearActiveDevice() {
    activeDeviceId.value = null
  }

  let globalWs = null

  function initSignaling() {
    if (globalWs) return

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${location.host}/connect_client`
    
    console.log('[Store] Connecting to global signaling:', url)
    globalWs = new WebSocket(url)

    globalWs.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg.message_type === 'snapshot_update') {
          updateSnapshot(msg.device_id, msg.data)
        } else if (msg.message_type === 'snapshot_updated') {
          // HTTP 模式下的更新通知
          handleSnapshotUpdated(msg.device_id, msg.url)
        } else if (msg.message_type === 'device_list_update') {
          updateFromList(msg.devices)
        }
      } catch (e) {
        console.error('[Store] Message error:', e)
      }
    }

    globalWs.onclose = () => {
      globalWs = null
      setTimeout(initSignaling, 3000) // 自动重连
    }
  }

  function quitAgent(deviceId) {
    if (!globalWs || globalWs.readyState !== WebSocket.OPEN) {
      console.warn('[Store] Signaling not connected, cannot quit agent')
      return
    }
    globalWs.send(JSON.stringify({
      message_type: 'quit_agent',
      device_id: deviceId
    }))
  }

  function handleSnapshotUpdated(deviceId, url) {
    const index = devices.value.findIndex(d => d.id === deviceId)
    if (index > -1) {
      // 增加时间戳防止浏览器缓存不刷新
      devices.value[index].snapshot = url + '?t=' + Date.now()
      devices.value = [...devices.value]
      console.log(`[Store] Snapshot URL updated for ${deviceId}`)
    }
  }

  return {
    devices,
    loading,
    error,
    activeDeviceId,
    activeDevice,
    onlineDevices,
    fetchDevices,
    addDevice,
    removeDevice,
    updateFromList,
    updateSnapshot,
    initSignaling, // 导出
    quitAgent,
    setActiveDevice,
    clearActiveDevice
  }
})
