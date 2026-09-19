import { defineStore } from 'pinia'
import { ref, computed, shallowRef, markRaw, watch } from 'vue'
import { debugLog } from '@/utils/debug'
import { useTagStore } from './tags'
import { useAuthStore } from './auth'

export const useDeviceStore = defineStore('devices', () => {
  const devices = ref([])
  const loading = ref(false)
  const error = ref(null)

  const isLicenseExpired = ref(false)
  const licenseErrorMsg = ref('')
  const globalMachineID = ref('')
  const licenseMaxDevices = ref(50)
  const licenseExpiresAt = ref('')
  const licenseDaysRemaining = ref(0)
  const licenseStatus = ref('valid')
  const licenseActivated = ref(false)          // 是否有验签通过的有效授权
  const licenseCustomer = ref('')              // 已激活时的客户名
  const licenseCurrentDevices = ref(0)         // 当前在线设备数（服务端口径）
  const licensePromo = ref(false)              // 未激活且处于限时特惠期
  const licensePostPromoMaxDevices = ref(10)   // 特惠结束后的免费额度
  // /api/license_status 对普通用户只返回最小信息（如 {licensed}），
  // 详细字段（到期时间、设备上限等）是否存在以此标记，UI 据此隐藏对应行
  const licenseDetailsLoaded = ref(false)

  const onlineDevices = computed(() => 
    [...devices.value]
      .filter(d => d.status === 'online')
      .sort((a, b) => a.id.localeCompare(b.id)) // 稳定升序排序
  )

  const offlineDevices = ref([])

  // --- 顶栏共享与视图控制状态 ---
  const searchQuery = ref('')
  const cardSize = ref(Number(localStorage.getItem('cloudphone_card_size') || 200))
  const viewMode = ref(localStorage.getItem('cloudphone_view_mode') || 'grid') // 'grid' | 'table'
  const showLicenseModal = ref(false)
  const showGlobalSettingsModal = ref(false)
  const showTagManagerModal = ref(false)

  function setCardSize(size) {
    cardSize.value = Number(size)
    localStorage.setItem('cloudphone_card_size', String(size))
  }

  function setViewMode(mode) {
    viewMode.value = mode
    localStorage.setItem('cloudphone_view_mode', mode)
  }

  function toggleViewMode() {
    setViewMode(viewMode.value === 'grid' ? 'table' : 'grid')
  }

  // --- 授权用量与徽标计算属性 ---
  const licenseUsedCount = computed(() => licenseCurrentDevices.value || onlineDevices.value.length)
  const licenseUsagePercent = computed(() => {
    if (!licenseMaxDevices.value || licenseMaxDevices.value <= 0) return 0
    return Math.round((licenseUsedCount.value / licenseMaxDevices.value) * 100)
  })

  const licenseBadgeText = computed(() => {
    const used = licenseUsedCount.value
    const max = licenseMaxDevices.value
    if (licenseActivated.value) {
      // 普通用户拿不到详细字段（额度/剩余天数），只显示已授权状态，避免展示默认值误导
      if (!licenseDetailsLoaded.value) return '已授权'
      return `授权 ${used}/${max} 台 · 剩余 ${licenseDaysRemaining.value} 天`
    }
    if (!licenseDetailsLoaded.value) return '未授权'
    if (licensePromo.value) {
      return `限时特惠 ${used}/${max} 台`
    }
    return `免费版 ${used}/${max} 台`
  })

  const licenseBadgeTitle = computed(() => {
    if (!licenseDetailsLoaded.value) {
      return '点击查看授权管理'
    }
    if (licenseActivated.value) {
      return `授权到期时间: ${licenseExpiresAt.value || '-'}，点击查看授权管理`
    }
    if (licensePromo.value) {
      return `特惠至 ${licenseExpiresAt.value}，到期后恢复 ${licensePostPromoMaxDevices.value} 台`
    }
    return '免费版授权，点击查看授权管理'
  })

  const licenseBadgeClass = computed(() => {
    if (licenseStatus.value === 'expired' || isLicenseExpired.value) return 'badge-danger'
    // 无详细字段时不做用量/临期阈值着色（此时相关值为默认值，不可靠）
    if (!licenseDetailsLoaded.value) return ''
    if (licenseUsagePercent.value >= 100) return 'badge-danger'
    if (licenseUsagePercent.value >= 80) return 'badge-warn'
    if (licenseActivated.value && licenseDaysRemaining.value <= 30) return 'badge-warn'
    return ''
  })


  // 辅助函数：根据当前活跃的设备列表更新在线和离线列表
  // 入参 deviceList 项可携带服务端状态：{ id, info, online, firstSeen, lastSeen }
  // online 缺省（旧服务端）按在线处理，保持向后兼容
  function processDeviceList(deviceList) {
    const activeDevices = deviceList.filter(d => d.online !== false)
    const serverOffline = deviceList.filter(d => d.online === false)
    const activeIds = activeDevices.map(d => d.id)

    // 1. 找出刚刚掉线（原本在线但在新活跃列表中找不到）的设备
    devices.value.forEach(d => {
      if (!activeIds.includes(d.id)) {
        const serverRec = serverOffline.find(sd => sd.id === d.id)
        const offlineDev = {
          ...d,
          info: serverRec?.info || d.info,
          status: 'offline',
          firstSeen: serverRec?.firstSeen || d.firstSeen,
          lastSeen: serverRec?.lastSeen || d.lastSeen,
          // 注意：服务端显式返回 lease: null（已收回）时必须清空，?? 会把 null 也当作"缺省"回退旧值
          lease: serverRec ? (serverRec.lease ?? null) : (d.lease ?? null),
          myLeaseRemainingSeconds: serverRec ? serverRec.myLeaseRemainingSeconds : d.myLeaseRemainingSeconds,
          lastOffline: new Date().toISOString()
        }
        const idx = offlineDevices.value.findIndex(od => od.id === d.id)
        if (idx === -1) {
          offlineDevices.value.push(offlineDev)
        } else {
          // 保留或更新最新的属性
          offlineDevices.value[idx] = { ...offlineDevices.value[idx], ...offlineDev }
        }
      }
    })

    // 1b. 服务端记录中的离线设备（本页面会话内可能从未在线过）：直接并入离线列表
    serverOffline.forEach(sd => {
      if (devices.value.some(d => d.id === sd.id)) return // 已在步骤 1 中处理
      const idx = offlineDevices.value.findIndex(od => od.id === sd.id)
      if (idx > -1) {
        const old = offlineDevices.value[idx]
        offlineDevices.value[idx] = {
          ...old,
          info: sd.info || old.info,
          firstSeen: sd.firstSeen || old.firstSeen,
          lastSeen: sd.lastSeen || old.lastSeen,
          // sd 来自服务端列表，lease 显式为 null 时也要生效（清除旧租约）
          lease: sd.lease ?? null,
          myLeaseRemainingSeconds: sd.myLeaseRemainingSeconds
        }
      } else {
        offlineDevices.value.push({
          id: sd.id,
          info: sd.info || null,
          status: 'offline',
          snapshot: null,
          firstSeen: sd.firstSeen || null,
          lastSeen: sd.lastSeen || null,
          lease: sd.lease || null,
          myLeaseRemainingSeconds: sd.myLeaseRemainingSeconds,
          lastOffline: null
        })
      }
    })

    // 2. 过滤在线列表，只保留当前活跃的设备，并更新 info
    const newOnlineList = devices.value.filter(d => activeIds.includes(d.id)).map(d => {
      const activeDev = activeDevices.find(ad => ad.id === d.id)
      return {
        ...d,
        info: activeDev?.info || d.info,
        firstSeen: activeDev?.firstSeen || d.firstSeen,
        clientCount: activeDev?.clientCount ?? d.clientCount ?? 0,
        clients: activeDev?.clients ?? d.clients ?? [],
        // activeDev 一定存在（按 activeIds 过滤）；lease 显式 null 也要生效
        lease: activeDev ? (activeDev.lease ?? null) : (d.lease ?? null),
        myLeaseRemainingSeconds: activeDev ? activeDev.myLeaseRemainingSeconds : d.myLeaseRemainingSeconds
      }
    })

    // 3. 处理重新上线或新上线的设备
    activeDevices.forEach(devData => {
      const id = devData.id
      const existingOnline = newOnlineList.find(d => d.id === id)
      if (!existingOnline) {
        const existingOfflineIdx = offlineDevices.value.findIndex(d => d.id === id)
        if (existingOfflineIdx > -1) {
          // 从离线列表移除并移回在线列表
          const resurrected = offlineDevices.value.splice(existingOfflineIdx, 1)[0]
          newOnlineList.push({
            ...resurrected,
            info: devData.info,
            status: 'online',
            firstSeen: devData.firstSeen || resurrected.firstSeen,
            lastSeen: new Date().toISOString(),
            clientCount: devData.clientCount ?? resurrected.clientCount ?? 0,
            clients: devData.clients ?? resurrected.clients ?? [],
            lease: devData.lease ?? null, // devData 来自服务端，显式 null 即无租约
            myLeaseRemainingSeconds: devData.myLeaseRemainingSeconds
          })
        } else {
          // 全新上线的设备
          newOnlineList.push({
            id,
            info: devData.info,
            status: 'online',
            snapshot: null,
            firstSeen: devData.firstSeen || null,
            lastSeen: new Date().toISOString(),
            clientCount: devData.clientCount ?? 0,
            clients: devData.clients ?? [],
            lease: devData.lease ?? null,
            myLeaseRemainingSeconds: devData.myLeaseRemainingSeconds
          })
        }
      }
    })

    newOnlineList.sort((a, b) => a.id.localeCompare(b.id))
    devices.value = newOnlineList
  }

  async function fetchDevices() {
    loading.value = true
    error.value = null
    
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      try {
        const { MOCK_DEVICES, startMockStatsGenerator } = await import('@/mock/demoEngine')
        const activeList = MOCK_DEVICES.filter(d => d.status === 'online')
        devices.value = activeList.map(d => ({
          ...d,
          info: d.info,
          status: d.status
        }))
        const offlineList = MOCK_DEVICES.filter(d => d.status === 'offline')
        offlineDevices.value = offlineList

        if (!window.__mock_stats_started) {
          window.__mock_stats_started = true
          startMockStatsGenerator((updatedList) => {
            updatedList.forEach(item => {
              const target = devices.value.find(d => d.id === item.id)
              if (target) {
                target.stats = { ...item.stats }
              }
            })
          })
        }
      } catch (e) {
        console.error('Demo devices load error:', e)
      } finally {
        loading.value = false
      }
      return
    }

    try {
      const res = await fetch('/devices', {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '') }
      })
      const data = await res.json()
      
      if (Array.isArray(data)) {
        const deviceList = data.map(item => {
          if (typeof item === 'string') {
            return { id: item, info: null }
          }
          return {
            id: item.device_id,
            info: item.device_info,
            online: item.online !== false,
            firstSeen: item.first_seen || null,
            lastSeen: item.last_seen || null,
            clientCount: item.client_count || 0,
            clients: item.clients || [],
            lease: item.lease || null, // admin 视角：当前活跃租约 {username, expires_at, remaining_seconds, ...}
            myLeaseRemainingSeconds: item.my_lease_remaining_seconds // 普通用户视角：我的租约剩余秒数（无租约则缺省）
          }
        })
        processDeviceList(deviceList)
      } else {
        processDeviceList([])
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
      // 检查是否在离线列表中
      const idx = offlineDevices.value.findIndex(d => d.id === device.id)
      if (idx > -1) {
        offlineDevices.value.splice(idx, 1)
      }
      devices.value.push({ ...device, status: 'online', lastSeen: new Date().toISOString() })
      devices.value.sort((a, b) => a.id.localeCompare(b.id))
    }
  }

  function removeDevice(deviceId) {
    const index = devices.value.findIndex(d => d.id === deviceId)
    if (index > -1) {
      devices.value.splice(index, 1)
    }
    const idx = offlineDevices.value.findIndex(d => d.id === deviceId)
    if (idx > -1) {
      offlineDevices.value.splice(idx, 1)
    }
  }

  function updateFromList(idList) {
    if (!Array.isArray(idList)) return
    const deviceList = idList.map(item => {
      if (typeof item === 'string') {
        return { id: item, info: null }
      }
      return {
        id: item.device_id,
        info: item.device_info || null,
        online: item.online !== false,
        firstSeen: item.first_seen || null,
        lastSeen: item.last_seen || null,
        clientCount: item.client_count || 0,
        clients: item.clients || [],
        lease: item.lease || null, // admin 视角：当前活跃租约
        myLeaseRemainingSeconds: item.my_lease_remaining_seconds // 普通用户视角：我的租约剩余秒数
      }
    })
    processDeviceList(deviceList)
    debugLog('[Store] Device list updated via broadcast:', idList)
  }

  function updateSnapshot(deviceId, base64Data) {
    const index = devices.value.findIndex(d => d.id === deviceId)
    if (index > -1) {
      // 深度更新属性
      devices.value[index].snapshot = `data:image/png;base64,${base64Data}`
      // 触发响应式 (虽然 Vue3 应该能检测到，但重新赋值数组引用更保险)
      devices.value = [...devices.value]
      debugLog(`[Store] Snapshot updated for ${deviceId}, length: ${base64Data.length}`)
    }
  }

  const activeDeviceIds = ref([])
  const focusedDeviceId = ref(null)
  const masterDeviceId = ref(null)
  const multiLayoutMode = ref('grid') // 'grid' | 'tabs' | 'master-slave' | 'floating'
  const audioFocusMode = ref('exclusive') // 'exclusive' (独占音频) | 'mix' (混音)
  const globalBroadcastInput = ref(false) // 键盘与输入法是否全局广播
  const maximizedDeviceId = ref(null) // 单机放大聚焦 ID

  const activeWebRTCMap = shallowRef(new Map())

  function registerWebRTC(deviceId, webrtcInstance) {
    if (!deviceId || !webrtcInstance) return
    const newMap = new Map(activeWebRTCMap.value)
    newMap.set(deviceId, markRaw(webrtcInstance))
    activeWebRTCMap.value = newMap
  }

  function unregisterWebRTC(deviceId) {
    if (!deviceId) return
    if (activeWebRTCMap.value.has(deviceId)) {
      const newMap = new Map(activeWebRTCMap.value)
      newMap.delete(deviceId)
      activeWebRTCMap.value = newMap
    }
  }

  function getWebRTC(deviceId) {
    if (!deviceId) return null
    return activeWebRTCMap.value.get(deviceId) || null
  }

  // 兼容单机 activeDeviceId
  const activeDeviceId = computed({
    get: () => focusedDeviceId.value || activeDeviceIds.value[0] || null,
    set: (val) => {
      if (!val) {
        closeAllDevices()
      } else {
        openDevice(val)
      }
    }
  })

  // 兼容单机 activeWebRTC：动态返回当前焦点或首台设备实例
  const activeWebRTC = computed(() => {
    if (focusedDeviceId.value && activeWebRTCMap.value.has(focusedDeviceId.value)) {
      return activeWebRTCMap.value.get(focusedDeviceId.value)
    }
    const firstId = activeDeviceIds.value[0]
    if (firstId && activeWebRTCMap.value.has(firstId)) {
      return activeWebRTCMap.value.get(firstId)
    }
    return null
  })

  const activeDevice = computed(() => 
    devices.value.find(d => d.id === activeDeviceId.value)
  )

  function openDevice(id) {
    if (!id) return
    if (!activeDeviceIds.value.includes(id)) {
      activeDeviceIds.value.push(id)
    }
    focusedDeviceId.value = id
    if (!masterDeviceId.value) {
      masterDeviceId.value = id
    }
    activeTopLayer.value = 'connection'
  }

  function closeDevice(id) {
    const index = activeDeviceIds.value.indexOf(id)
    if (index > -1) {
      activeDeviceIds.value.splice(index, 1)
    }
    unregisterWebRTC(id)
    if (focusedDeviceId.value === id) {
      focusedDeviceId.value = activeDeviceIds.value[activeDeviceIds.value.length - 1] || null
    }
    if (masterDeviceId.value === id) {
      masterDeviceId.value = activeDeviceIds.value[0] || null
    }
    if (maximizedDeviceId.value === id) {
      maximizedDeviceId.value = null
    }
    deviceConnectionModes.value[id] = 'display'
    if (activeDeviceIds.value.length === 0) {
      closeAllDevices()
    }
  }

  // 独立设备当前会话连接模式（'display' | 'camera'），默认均为屏幕连接 'display'
  const deviceConnectionModes = ref({})

  function setDeviceMode(deviceId, mode = 'display') {
    if (!deviceId) return
    deviceConnectionModes.value[deviceId] = mode
  }

  function getDeviceMode(deviceId) {
    if (!deviceId) return 'display'
    return deviceConnectionModes.value[deviceId] || 'display'
  }

  function openDeviceAsCamera(id) {
    if (!id) return
    setDeviceMode(id, 'camera')
    openDevice(id)
  }

  function openDeviceAsWebSocket(id) {
    if (!id) return
    setDeviceMode(id, 'websocket')
    openDevice(id)
  }

  function closeAllDevices() {
    activeDeviceIds.value = []
    focusedDeviceId.value = null
    masterDeviceId.value = null
    maximizedDeviceId.value = null
    activeWebRTCMap.value = new Map()
    deviceConnectionModes.value = {}
  }

  function focusDevice(id) {
    if (activeDeviceIds.value.includes(id)) {
      focusedDeviceId.value = id
      activeTopLayer.value = 'connection'
    }
  }

  function setMasterDevice(id) {
    if (activeDeviceIds.value.includes(id)) {
      masterDeviceId.value = id
    }
  }

  function setMultiLayoutMode(mode) {
    multiLayoutMode.value = mode
  }

  function toggleMaximizeDevice(id) {
    if (maximizedDeviceId.value === id) {
      maximizedDeviceId.value = null
    } else {
      maximizedDeviceId.value = id
    }
  }

  function setActiveDevice(id) {
    if (id) {
      openDevice(id)
    } else {
      closeAllDevices()
    }
  }

  function setActiveWebRTC(webrtcInstance) {
    if (activeDeviceId.value && webrtcInstance) {
      registerWebRTC(activeDeviceId.value, webrtcInstance)
    } else if (!webrtcInstance && activeDeviceId.value) {
      unregisterWebRTC(activeDeviceId.value)
    }
  }

  function clearActiveDevice() {
    closeAllDevices()
  }

  const deviceHistory = ref({})

  function updateMetrics(deviceId, metrics) {
    const index = devices.value.findIndex(d => d.id === deviceId)
    if (index > -1) {
      devices.value[index].metrics = metrics
      devices.value = [...devices.value]
    }

    if (!deviceHistory.value[deviceId]) {
      deviceHistory.value[deviceId] = {
        cpu: [],
        memory: [],
        disk: [],
        temp: [],
        downSpeed: [],
        upSpeed: [],
        timestamps: []
      }
    }

    const history = deviceHistory.value[deviceId]
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')
    const timeStr = `${hh}:${mm}:${ss}`

    history.cpu.push(metrics.cpu || 0)
    history.memory.push(metrics.memory_percent || 0)
    history.disk.push(metrics.disk_percent || 0)
    history.temp.push(metrics.temperature || 0)
    history.downSpeed.push(metrics.download_speed || 0)
    history.upSpeed.push(metrics.upload_speed || 0)
    history.timestamps.push(timeStr)

    if (history.cpu.length > 360) {
      history.cpu.shift()
      history.memory.shift()
      history.disk.shift()
      history.temp.shift()
      history.downSpeed.shift()
      history.upSpeed.shift()
      history.timestamps.shift()
    }

    // 显式触发响应式引用变更以更新大盘折线图
    deviceHistory.value = { ...deviceHistory.value }
  }

  const previewCallbacks = new Map() // deviceId -> Map<subscriberId, callback>

  function registerPreviewCallback(deviceId, subscriberOrCb, maybeCallback) {
    let subscriberId = 'default'
    let cb = maybeCallback
    if (typeof subscriberOrCb === 'function') {
      cb = subscriberOrCb
      subscriberId = 'default'
    } else {
      subscriberId = String(subscriberOrCb || 'default')
    }
    if (!cb) return
    if (!previewCallbacks.has(deviceId)) {
      previewCallbacks.set(deviceId, new Map())
    }
    previewCallbacks.get(deviceId).set(subscriberId, cb)
  }

  function unregisterPreviewCallback(deviceId, subscriberId = 'default') {
    const subMap = previewCallbacks.get(deviceId)
    if (subMap) {
      subMap.delete(subscriberId)
      if (subMap.size === 0) {
        previewCallbacks.delete(deviceId)
      }
    }
  }

  function hasPreviewSubscribers(deviceId) {
    const subMap = previewCallbacks.get(deviceId)
    return Boolean(subMap && subMap.size > 0)
  }

  function sendPreviewControl(action, deviceId, fps, maxSize, bitrate, stayAwake) {
    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
      const payload = {
        message_type: action,
        type: action,
        device_id: deviceId
      }
      if (fps !== undefined && fps > 0) payload.fps = fps
      if (maxSize !== undefined && maxSize > 0) payload.max_size = maxSize
      if (bitrate !== undefined && bitrate > 0) {
        payload.bitrate = bitrate >= 10000 ? Math.round(bitrate) : Math.round(bitrate * 1000000)
      }
      if (stayAwake !== undefined) payload.stay_awake = stayAwake
      globalWs.send(JSON.stringify(payload))
    }
  }

  // group_control_event 发送失败告警节流（WS 未就绪时避免高频 touch move 刷爆控制台）
  let lastGroupControlWarnTs = 0

  function sendGroupControlEvent(targetDeviceIds, event) {
    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify({
        message_type: 'group_control_event',
        target_device_ids: targetDeviceIds,
        event: event
      }))
    } else {
      // 诊断：预览直控/群控事件未下发时给出明确线索（2s 节流）
      const now = Date.now()
      if (now - lastGroupControlWarnTs > 2000) {
        lastGroupControlWarnTs = now
        console.warn(`[Store] group_control_event 未下发: globalWs ${globalWs ? 'readyState=' + globalWs.readyState : '为 null'}`, targetDeviceIds, event && event.type)
      }
    }
  }

  function sendInjectData(channel, payload, targetDeviceIds) {
    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
      const msg = {
        message_type: 'inject_data',
        channel: channel,
        payload: payload
      }
      if (Array.isArray(targetDeviceIds) && targetDeviceIds.length > 0) {
        msg.target_device_ids = targetDeviceIds
      }
      globalWs.send(JSON.stringify(msg))
    }
  }

  function handlePreviewBinary(buffer) {
    if (buffer.byteLength < 49) return
    const view = new DataView(buffer)
    
    // Check Magic: PREV
    if (view.getUint8(0) !== 0x50 || view.getUint8(1) !== 0x52 ||
        view.getUint8(2) !== 0x45 || view.getUint8(3) !== 0x56) return

    // Extract DeviceID (32 bytes)
    const idBytes = new Uint8Array(buffer, 4, 32)
    let deviceId = new TextDecoder().decode(idBytes)
    const nullIdx = deviceId.indexOf('\0')
    if (nullIdx !== -1) {
      deviceId = deviceId.substring(0, nullIdx)
    }

    const subMap = previewCallbacks.get(deviceId)
    if (!subMap || subMap.size === 0) return

    const isKey = view.getUint8(36) === 0x01
    // BigEndian read uint64 ptsUs
    const ptsUs = Number(view.getBigUint64(37, false))
    const payloadLen = view.getUint32(45, false)
    const nalu = new Uint8Array(buffer, 49, payloadLen)

    subMap.forEach(cb => {
      try {
        cb(nalu, isKey, ptsUs)
      } catch (err) {
        console.error(`[Preview] Callback error for ${deviceId}:`, err)
      }
    })
  }

  let globalWs = null
  let globalWsHeartbeatTimer = null
  let licensePollTimer = null

  // 缩略图 HTTP 兜底轮询：全局 WS 断开（自签名证书等 WSS 不稳定环境）时也能刷新缩略图。
  // 与 WS 推送互补，/snapshots/ 服务端有 hasDeviceAccess 校验，普通用户只能拉到自己设备的图。
  let snapshotPollTimer = null
  function refreshSnapshotsViaHTTP() {
    const token = localStorage.getItem('auth_token') || ''
    const now = Date.now()
    let changed = false
    devices.value.forEach((d, i) => {
      if (d.status === 'online') {
        devices.value[i].snapshot = `/snapshots/${encodeURIComponent(d.id)}.jpg?t=${now}&token=${encodeURIComponent(token)}`
        changed = true
      }
    })
    if (changed) devices.value = [...devices.value]
  }

  function initSignaling() {
    if (globalWs && (globalWs.readyState === WebSocket.OPEN || globalWs.readyState === WebSocket.CONNECTING)) return
    if (globalWs) {
      try { globalWs.close() } catch(e) {}
      globalWs = null
    }

    const authStore = useAuthStore()
    if (!authStore.isLoggedIn) return

    fetchLicenseStatus()
    // 授权状态 60s 兜底轮询（WS 推送之外的保险；用单例定时器避免重连时叠加）
    if (!licensePollTimer) {
      licensePollTimer = setInterval(fetchLicenseStatus, 60000)
    }
    // 缩略图 15s 兜底轮询（立即先刷一次，WS 不可用时也能看到缩略图）
    if (!snapshotPollTimer) {
      snapshotPollTimer = setInterval(refreshSnapshotsViaHTTP, 15000)
    }
    refreshSnapshotsViaHTTP()

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const token = localStorage.getItem('auth_token') || ''
    const url = `${protocol}//${location.host}/connect_client?token=${encodeURIComponent(token)}`
    
    debugLog('[Store] Connecting to global signaling:', url)
    globalWs = new WebSocket(url)
    globalWs.binaryType = 'arraybuffer'

    globalWs.onopen = () => {
      debugLog('[Store] Global signaling connected')
      // 启动应用层心跳保活定时器（每 20 秒向服务端发送一次 ping，避免 NAT/反代超时断连）
      if (globalWsHeartbeatTimer) clearInterval(globalWsHeartbeatTimer)
      globalWsHeartbeatTimer = setInterval(() => {
        if (globalWs && globalWs.readyState === WebSocket.OPEN) {
          try {
            globalWs.send(JSON.stringify({ type: 'ping' }))
          } catch (e) {
            console.warn('[Store] Failed to send ws ping:', e)
          }
        }
      }, 20000)
    }

    globalWs.onmessage = (evt) => {
      if (evt.data instanceof ArrayBuffer) {
        handlePreviewBinary(evt.data)
        return
      }
      try {
        const msg = JSON.parse(evt.data)
        if (msg.type === 'pong' || msg.message_type === 'pong') {
          return
        }
        if (msg.message_type === 'snapshot_update') {
          updateSnapshot(msg.device_id, msg.data)
        } else if (msg.message_type === 'snapshot_updated') {
          // HTTP 模式下的更新通知
          handleSnapshotUpdated(msg.device_id, msg.url)
        } else if (msg.message_type === 'global_settings_updated') {
          localStorage.setItem('cloudphone_settings', JSON.stringify(msg.settings))
          window.dispatchEvent(new CustomEvent('cloudphone-settings-updated', { detail: { deviceId: '' } }))
        } else if (msg.message_type === 'device_list_update') {
          updateFromList(msg.devices)
        } else if (msg.message_type === 'tags_update') {
          const tagsStore = useTagStore()
          tagsStore.updateTagsFromRemote(msg.tags, msg.deviceTags)
        } else if (msg.type === 'device_metrics') {
          updateMetrics(msg.device_id, msg.metrics)
        } else if (msg.message_type === 'task_status_updated') {
          const task = msg.task
          if (currentTask.value && currentTask.value.task_id === task.task_id) {
            currentTask.value = task
            const allDone = Object.values(task.devices).every(sub => ['success', 'failed'].includes(sub.status))
            if (allDone) {
              stopTrackingTask()
            }
          }
        } else if (msg.message_type === 'license_update') {
          // 服务端广播的授权状态变更（设备超限被拒、特惠到期降额等）
          applyLicenseState(msg)
        } else if (msg.error === 'license_expired') {
          isLicenseExpired.value = true
          licenseErrorMsg.value = msg.reason || '当前版本已不受支持，请升级'
          globalMachineID.value = msg.machine_id || ''
        }
      } catch (e) {
        console.error('[Store] Message error:', e)
      }
    }

    globalWs.onerror = (err) => {
      console.warn('[Store] Global signaling error:', err)
    }

    globalWs.onclose = () => {
      if (globalWsHeartbeatTimer) {
        clearInterval(globalWsHeartbeatTimer)
        globalWsHeartbeatTimer = null
      }
      globalWs = null
      // 仅在仍然处于登录状态时安排重连
      const aStore = useAuthStore()
      if (aStore.isLoggedIn) {
        setTimeout(initSignaling, 3000) // 自动重连
      }
    }
  }

  // 将授权状态（/api/license_status 响应或 license_update 推送）统一填充到 store。
  // 普通用户的响应只含最小信息（如 {licensed}），缺失字段一律保留现有值，不用默认值覆盖。
  function applyLicenseState(data) {
    if (data.license_expired !== undefined) isLicenseExpired.value = !!data.license_expired
    if (data.error_msg !== undefined) licenseErrorMsg.value = data.error_msg || ''
    if (data.machine_id !== undefined) globalMachineID.value = data.machine_id || ''
    if (data.max_devices !== undefined) licenseMaxDevices.value = data.max_devices
    if (data.expires_at !== undefined) licenseExpiresAt.value = data.expires_at || ''
    if (data.days_remaining !== undefined) licenseDaysRemaining.value = data.days_remaining
    if (data.status !== undefined) licenseStatus.value = data.status
    if (data.activated !== undefined) licenseActivated.value = !!data.activated
    if (data.customer !== undefined) licenseCustomer.value = data.customer || ''
    if (data.current_devices !== undefined) licenseCurrentDevices.value = data.current_devices
    if (data.promo !== undefined) licensePromo.value = !!data.promo
    if (data.post_promo_max_devices !== undefined) licensePostPromoMaxDevices.value = data.post_promo_max_devices
    // 最小响应的 licensed 字段映射为 activated 语义
    if (data.activated === undefined && data.licensed !== undefined) {
      licenseActivated.value = !!data.licensed
    }
    // 响应中带有任一详细字段即视为完整粒度
    licenseDetailsLoaded.value = data.max_devices !== undefined || data.expires_at !== undefined || data.status !== undefined
  }

  async function fetchLicenseStatus() {
    try {
      const res = await fetch('/api/license_status', {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '') }
      })
      if (res.ok) {
        const data = await res.json()
        applyLicenseState(data)
      }
    } catch (e) {
      console.error('Failed to fetch license status:', e)
    }
  }

  async function activateLicense(licenseKey) {
    try {
      const res = await fetch('/api/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '')
        },
        body: JSON.stringify({ license: licenseKey })
      })
      const data = await res.json()
      if (res.ok && data.status === 'success') {
        isLicenseExpired.value = false
        licenseErrorMsg.value = ''
        // 成功后自动重新拉取设备列表和初始化信令
        await fetchDevices()
        if (!globalWs || globalWs.readyState !== WebSocket.OPEN) {
          initSignaling()
        }
        return { success: true }
      } else {
        return { success: false, error: data.error || '激活失败，请检查激活码是否有效' }
      }
    } catch (e) {
      return { success: false, error: e.message || '网络请求错误' }
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

  // 删除离线设备档案（仅 admin；服务端拒绝删除在线设备）
  async function deleteOfflineDevice(deviceId) {
    const token = localStorage.getItem('auth_token') || ''
    const res = await fetch(`/api/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    })
    if (!res.ok) {
      const text = (await res.text()).trim()
      throw new Error(text || `删除失败 (${res.status})`)
    }
    removeDevice(deviceId)
  }

  function handleSnapshotUpdated(deviceId, url) {
    const index = devices.value.findIndex(d => d.id === deviceId)
    if (index > -1) {
      const token = localStorage.getItem('auth_token') || ''
      // 增加时间戳防止浏览器缓存不刷新，并附加 token 进行鉴权
      devices.value[index].snapshot = url + '?t=' + Date.now() + '&token=' + encodeURIComponent(token)
      devices.value = [...devices.value]
      debugLog(`[Store] Snapshot URL updated for ${deviceId}`)
    }
  }

  // 全局高频预览模式状态
  const globalPreviewMode = ref(false)

  // 高频预览机器范围选择模式: 'visible' (屏幕可视区域设备) | 'all' (全部在线设备) | 'selected' (仅勾选设备/从机) | 'tag' (匹配标签设备)
  const previewScopeMode = ref(localStorage.getItem('cloudphone_preview_scope') || 'visible')

  // 高频预览所选标签列表 (多选 tagId 数组)
  const previewSelectedTagIds = ref((() => {
    try {
      const raw = localStorage.getItem('cloudphone_preview_tags')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })())

  function setPreviewScopeMode(mode) {
    if (['visible', 'all', 'selected', 'tag'].includes(mode)) {
      previewScopeMode.value = mode
      localStorage.setItem('cloudphone_preview_scope', mode)
    }
  }

  function togglePreviewTag(tagId) {
    const idx = previewSelectedTagIds.value.indexOf(tagId)
    if (idx >= 0) {
      previewSelectedTagIds.value.splice(idx, 1)
    } else {
      previewSelectedTagIds.value.push(tagId)
    }
    localStorage.setItem('cloudphone_preview_tags', JSON.stringify(previewSelectedTagIds.value))
  }

  function clearPreviewTags() {
    previewSelectedTagIds.value = []
    localStorage.setItem('cloudphone_preview_tags', JSON.stringify([]))
  }

  function setPreviewTags(tagIds) {
    previewSelectedTagIds.value = Array.isArray(tagIds) ? [...tagIds] : []
    localStorage.setItem('cloudphone_preview_tags', JSON.stringify(previewSelectedTagIds.value))
  }

  // 全局预览直控模式状态（必须依赖高频预览）
  const globalInteractiveMode = ref(false)

  // 预览直控和高频预览强关联：高频预览关闭时，直控自动重置关闭
  watch(globalPreviewMode, (enabled) => {
    if (!enabled) {
      globalInteractiveMode.value = false
    }
  })

  // 全局下半屏控制台状态
  const showGlobalConsole = ref(false)
  const consoleDeviceId = ref('')
  const consoleInitialTab = ref('shell')
  // 终端与连接界面动态层叠置顶状态：'connection' (连接面板置顶) | 'console' (终端控制台置顶)
  const activeTopLayer = ref('connection')

  function setActiveTopLayer(layer) {
    if (layer === 'console' || layer === 'connection') {
      activeTopLayer.value = layer
    }
  }

  // 初始高度按当前视口钳制：避免大屏保存的高度在小屏上超出视口，
  // 导致顶部拉伸手柄跑到屏幕外而无法缩小
  const globalConsoleHeight = ref(clampConsoleHeight(parseInt(localStorage.getItem('cloudphone_console_height') || '380', 10)))

  // 离线设备筛选视图（侧边栏"离线设备"栏）：开启后设备列表只展示离线设备
  const showOfflineOnly = ref(false)

  // 最近新增筛选视图（30 分钟内首次注册的设备）
  const showRecentOnly = ref(false)
  const RECENT_WINDOW_MS = 30 * 60 * 1000
  // 30 秒跳动的时钟，让"30 分钟内"窗口随时间滚动（computed 依赖它重算）
  const nowTick = ref(Date.now())
  setInterval(() => { nowTick.value = Date.now() }, 30000)

  function isRecentDevice(d) {
    if (!d.firstSeen) return false
    const t = new Date(d.firstSeen).getTime()
    if (isNaN(t)) return false
    return (nowTick.value - t) < RECENT_WINDOW_MS
  }

  // 最近新增设备（在线 + 离线并集），供侧边栏计数与列表页筛选
  const recentDevices = computed(() =>
    [...devices.value, ...offlineDevices.value].filter(isRecentDevice)
  )

  function ensureConsoleDeviceId(fallback = '') {
    if (consoleDeviceId.value) return consoleDeviceId.value
    if (activeDeviceId.value) {
      consoleDeviceId.value = activeDeviceId.value
    } else if (onlineDevices.value.length > 0) {
      consoleDeviceId.value = onlineDevices.value[0].id
    } else if (devices.value.length > 0) {
      consoleDeviceId.value = devices.value[0].id
    } else if (fallback) {
      consoleDeviceId.value = fallback
    } else {
      consoleDeviceId.value = 'default'
    }
    return consoleDeviceId.value
  }

  // 监听设备列表加载，自动将默认占位符替换为真实设备
  watch(() => devices.value, (newDevs) => {
    if ((!consoleDeviceId.value || consoleDeviceId.value === 'default') && newDevs && newDevs.length > 0) {
      const online = newDevs.find(d => d.status === 'online')
      consoleDeviceId.value = online ? online.id : newDevs[0].id
    }
  }, { immediate: true })

  function openGlobalConsole(deviceId, initialTab = 'shell') {
    if (deviceId) {
      consoleDeviceId.value = deviceId
    } else {
      ensureConsoleDeviceId()
    }
    if (initialTab) {
      consoleInitialTab.value = initialTab
    }
    showGlobalConsole.value = true
    activeTopLayer.value = 'console'
  }

  function toggleGlobalConsole() {
    if (showGlobalConsole.value) {
      // 若控制台已开但当前处于底层（被连接界面遮挡），点击时先提升至最前
      if (activeTopLayer.value === 'connection') {
        activeTopLayer.value = 'console'
      } else {
        showGlobalConsole.value = false
        activeTopLayer.value = 'connection'
      }
    } else {
      ensureConsoleDeviceId()
      showGlobalConsole.value = true
      activeTopLayer.value = 'console'
    }
  }

  function closeGlobalConsole() {
    showGlobalConsole.value = false
    activeTopLayer.value = 'connection'
  }

  function destroyGlobalConsole() {
    showGlobalConsole.value = false
    consoleDeviceId.value = null
    activeTopLayer.value = 'connection'
  }

  // 钳制终端高度：上限跟随当前视口（至少留出顶部 100px 保证拉伸手柄可达）
  function clampConsoleHeight(height) {
    const maxHeight = typeof window !== 'undefined' ? Math.max(300, window.innerHeight - 100) : 1200
    return Math.max(200, Math.min(maxHeight, height))
  }

  function setConsoleHeight(height) {
    const validHeight = clampConsoleHeight(height)
    globalConsoleHeight.value = validHeight
    try {
      localStorage.setItem('cloudphone_console_height', String(validHeight))
    } catch(e) {}
  }

  // 窗口尺寸变化（如大屏切小屏）时重新钳制，防止终端比屏幕还大。
  // 不写回 localStorage：保留用户在大屏上的偏好高度，回到大屏仍然生效。
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      const clamped = clampConsoleHeight(globalConsoleHeight.value)
      if (clamped !== globalConsoleHeight.value) {
        globalConsoleHeight.value = clamped
      }
    })
  }

  const currentTask = ref(null)
  let trackingTimer = null

  function startTrackingTask(taskId) {
    stopTrackingTask()
    pollTaskDetails(taskId)
    trackingTimer = setInterval(() => pollTaskDetails(taskId), 2000)
  }

  function stopTrackingTask() {
    if (trackingTimer) {
      clearInterval(trackingTimer)
      trackingTimer = null
    }
  }

  async function pollTaskDetails(taskId) {
    const token = localStorage.getItem('auth_token') || ''
    try {
      const res = await fetch(`/api/tasks/details?task_id=${encodeURIComponent(taskId)}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (res.ok) {
        const data = await res.json()
        currentTask.value = data
        
        const allDone = Object.values(data.devices).every(sub => ['success', 'failed'].includes(sub.status))
        if (allDone) {
          stopTrackingTask()
        }
      }
    } catch (e) {
      console.warn('Failed to poll task details:', e)
    }
  }

  return {
    currentTask,
    startTrackingTask,
    stopTrackingTask,
    devices,
    offlineDevices,
    loading,
    error,
    activeDeviceId,
    activeDeviceIds,
    focusedDeviceId,
    masterDeviceId,
    multiLayoutMode,
    audioFocusMode,
    globalBroadcastInput,
    maximizedDeviceId,
    openDevice,
    closeDevice,
    closeAllDevices,
    focusDevice,
    setMasterDevice,
    setMultiLayoutMode,
    toggleMaximizeDevice,
    activeWebRTC,
    activeWebRTCMap,
    registerWebRTC,
    unregisterWebRTC,
    getWebRTC,
    activeDevice,
    onlineDevices,
    deviceHistory,
    showGlobalConsole,
    consoleDeviceId,
    globalConsoleHeight,
    showOfflineOnly,
    showRecentOnly,
    recentDevices,
    fetchDevices,
    addDevice,
    removeDevice,
    updateFromList,
    updateSnapshot,
    updateMetrics,
    initSignaling, // 导出
    quitAgent,
    deleteOfflineDevice,
    setActiveDevice,
    openDeviceAsCamera,
    openDeviceAsWebSocket,
    setDeviceMode,
    getDeviceMode,
    setActiveWebRTC,
    clearActiveDevice,
    openGlobalConsole,
    consoleInitialTab,
    toggleGlobalConsole,
    closeGlobalConsole,
    destroyGlobalConsole,
    activeTopLayer,
    setActiveTopLayer,
    setConsoleHeight,
    isLicenseExpired,
    licenseErrorMsg,
    globalMachineID,
    licenseMaxDevices,
    licenseExpiresAt,
    licenseDaysRemaining,
    licenseStatus,
    licenseActivated,
    licenseCustomer,
    licenseCurrentDevices,
    licensePromo,
    licensePostPromoMaxDevices,
    licenseDetailsLoaded,
    applyLicenseState,
    fetchLicenseStatus,
    activateLicense,
    registerPreviewCallback,
    unregisterPreviewCallback,
    hasPreviewSubscribers,
    sendPreviewControl,
    sendGroupControlEvent,
    sendInjectData,
    globalPreviewMode,
    previewScopeMode,
    setPreviewScopeMode,
    previewSelectedTagIds,
    togglePreviewTag,
    clearPreviewTags,
    setPreviewTags,
    globalInteractiveMode,
    searchQuery,
    cardSize,
    viewMode,
    showLicenseModal,
    showGlobalSettingsModal,
    showTagManagerModal,
    setCardSize,
    setViewMode,
    toggleViewMode,
    licenseUsedCount,
    licenseUsagePercent,
    licenseBadgeText,
    licenseBadgeTitle,
    licenseBadgeClass
  }
})
