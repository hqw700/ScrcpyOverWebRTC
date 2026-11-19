import { ref, onUnmounted } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { debugInfo, debugLog, debugWarn } from '@/utils/debug'
import { WebCodecsRenderer } from '@/utils/webcodecsRenderer'
import i18n from '@/locales'

const t = (key, params) => {
  if (i18n && i18n.global && typeof i18n.global.t === 'function') {
    return i18n.global.t(key, params || {})
  }
  return key
}

const projectionKeys = new Map()

function getProjectionResumeKey(deviceId) {
  const storageKey = `cloudphone_projection_resume:${deviceId}`
  let key = projectionKeys.get(deviceId)
  try { key ||= sessionStorage.getItem(storageKey) } catch {}
  if (!key && globalThis.crypto?.getRandomValues) {
    key = Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('')
  }
  if (!key) return ''
  projectionKeys.set(deviceId, key)
  try { sessionStorage.setItem(storageKey, key) } catch {}
  return key
}

export function useWebRTC(deviceId, options = {}) {
  const deviceStore = options.deviceStore ?? useDeviceStore()
  const status = ref('disconnected')
  const error = ref(null)
  const audioMuted = ref(false)
  const cameraSupport = ref(true)
  const agentVersion = ref('unknown')
  const isWebCodecsActive = ref(false)

  // 只读分享模式：屏蔽一切输入注入（触控/滚动/键盘/文本/剪贴板）。
  // 注：输入走 P2P datachannel，服务端无法过滤，只能客户端源头拦截。
  const viewOnly = options.view_only === true

  let webrtcObj = null
  let ws = null
  let wsHeartbeatTimer = null
  let pc = null
  let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }]
  let inputChannel = null
  let clipboardChannel = null
  let videoElementGetter = null  // 获取 video 元素的函数
  let canvasElementGetter = null // 获取 canvas 元素的函数 (WebCodecs 极速锁相渲染)
  let webcodecsRenderer = null
  let videoStream = null
  let audioStream = null
  let audioElement = null
  let audioContext = null
  let audioSourceNode = null
  let audioGainNode = null
  let audioUnlockHandler = null
  let touchSeq = 0
  const DEVICE_W = ref(1080)
  const DEVICE_H = ref(1920)
  let controlEventCallback = null

  let cameraChannel = null

  const localCandidates = []
  const remoteCandidates = []
  let cameraStream = null
  let cameraIntervalId = null

  let aiCommandChannel = null
  const aiCommandPromises = new Map()

  const layoutDisplayRevision = ref(0)
  let layoutFrameSize = ''
  let layoutVideoElement = null

  function updateLayoutFrameSize(width, height) {
    if (!width || !height) return
    const size = width + 'x' + height
    if (size !== layoutFrameSize) {
      layoutFrameSize = size
      layoutDisplayRevision.value++
    }
  }

  function onLayoutVideoResize(event) {
    updateLayoutFrameSize(event.currentTarget.videoWidth, event.currentTarget.videoHeight)
  }

  let uiLayoutChannel = null
  const pendingLayoutSnapshots = new Map()
  let activeLayoutReceiver = null

  function getOption(key, def) {
    try {
      const devStored = localStorage.getItem(`cloudphone_settings_${deviceId}`)
      if (devStored) {
        const val = JSON.parse(devStored)[key]
        if (val !== undefined) return val
      }
      const globalStored = localStorage.getItem('cloudphone_settings')
      if (globalStored) {
        const val = JSON.parse(globalStored)[key]
        if (val !== undefined) return val
      }
    } catch (e) {}
    return def
  }

  let isDisposed = false
  let projectionOnDemand = false
  let projectionResumeKey = ''
  let projectionAuthorized = false

  function connect(shareTokenParam = null, sharePwdParam = '') {
    isDisposed = false
    status.value = 'connecting'
    error.value = null

    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      setTimeout(() => {
        status.value = 'connected'
      }, 300)
      return
    }

    const endpoint = new URL(options.serverURL || location.origin)
    const wsProtocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:'
    const token = options.getToken ? options.getToken() : (localStorage.getItem('auth_token') || '')
    let wsUrl = `${wsProtocol}//${endpoint.host}/connect_client?token=${encodeURIComponent(token)}`
    if (shareTokenParam) {
      wsUrl = `${wsProtocol}//${endpoint.host}/connect_client?share_token=${encodeURIComponent(shareTokenParam)}`
      if (sharePwdParam) {
        wsUrl += `&share_pwd=${encodeURIComponent(sharePwdParam)}`
      }
    }
    
    debugLog('[Signaling] Connecting to:', wsUrl)
    const connection = new WebSocket(options.signalingURL || wsUrl)
    ws = connection

    connection.onopen = () => {
      if (ws !== connection) return
      debugLog('[Signaling] WebSocket connected')
      status.value = 'signaling'
      ws.send(JSON.stringify({
        message_type: 'connect',
        device_id: deviceId
      }))
      // 启动 WebRTC 信令长连接应用层心跳（每 20 秒发送一次 ping 保活）
      if (wsHeartbeatTimer) clearInterval(wsHeartbeatTimer)
      wsHeartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: 'ping' }))
          } catch (e) {
            console.warn('[WebRTC Signaling] Failed to send ws ping:', e)
          }
        }
      }, 20000)
    }

    connection.onmessage = (evt) => {
      if (ws !== connection) return
      if (typeof evt.data !== 'string') return
      try {
        const msg = JSON.parse(evt.data)
        if (msg.type === 'pong' || msg.message_type === 'pong') return
        debugLog('[Signaling] Received:', msg.message_type || msg.type, msg)
        handleMessage(msg)
      } catch (e) {
        console.error('[Signaling] Failed to parse message:', e, evt.data)
      }
    }

    connection.onerror = (e) => {
      if (ws !== connection) return
      if (!error.value) {
        error.value = t('share.signalingError')
      }
      status.value = 'error'
      console.error('[Signaling] WebSocket error:', e)
    }

    connection.onclose = () => {
      if (ws !== connection) return
      if (wsHeartbeatTimer) {
        clearInterval(wsHeartbeatTimer)
        wsHeartbeatTimer = null
      }
      debugLog('[Signaling] WebSocket closed')
      if (status.value !== 'disconnected' && status.value !== 'error') {
        status.value = 'disconnected'
      }
    }
  }

  function handleMessage(msg) {
    const type = msg.message_type || msg.type
    switch (type) {
      case 'config':
        status.value = 'waiting_offer'
        if (msg.ice_servers && msg.ice_servers.length > 0) {
          iceServers = msg.ice_servers
          debugLog('[WebRTC] ICE Servers updated from config:', iceServers)
        }
        // 发送 request-offer 请求，附加 IP 协议偏好设置以通知 Agent 动态调整网络栈
        const offerPayload = { 
          type: 'request-offer',
          ip_preference: getOption('ipPreference', 'auto')
        }
        if (Object.keys(options).length > 0) {
          const { serverURL, signalingURL, getToken, deviceStore, ...scrcpyOptions } = options
          offerPayload.scrcpy_options = scrcpyOptions
        }
        projectionResumeKey ||= getProjectionResumeKey(deviceId)
        if (projectionResumeKey) offerPayload.projection_resume_key = projectionResumeKey
        sendForward(offerPayload)
        break
      case 'device_info':
        handleDeviceInfo(msg.device_info)
        break
      case 'device_msg':
        handleDeviceMessage(msg.payload)
        break
      case 'screenshot_response':
        handleScreenshot(msg.data)
        break
      case 'error':
        if (msg.code === 'SHARE_IN_USE' || (msg.error && (msg.error.includes('当前分享已被其他访客占用') || msg.error.toLowerCase().includes('already in use')))) {
          error.value = t('share.shareInUse')
        } else {
          error.value = msg.error || 'Server error'
        }
        status.value = 'error'
        break
    }
  }

  function handleDeviceInfo(info) {
    if (info) {
      projectionOnDemand = info.projection_on_demand === true
      if (info.app_version) {
        agentVersion.value = info.app_version
      }
      if (info.displays && info.displays.length > 0) {
        const display = info.displays[0]
        DEVICE_W.value = display.x_res || 1080
        DEVICE_H.value = display.y_res || 1920
        debugLog(`[WebRTC] Device dimensions updated: ${DEVICE_W.value}x${DEVICE_H.value}`)
      }
    }
  }
function handleDeviceMessage(payload) {
  if (!payload || !payload.type) return

  switch (payload.type) {
    case 'projection_status': {
      const state = payload.state
      if (state === 'waiting') {
        status.value = 'waiting_projection'
        break
      }
      const errors = {
        rejected: 'deviceClient.projectionRejected',
        expired: 'deviceClient.projectionExpired',
        busy: 'deviceClient.projectionBusy',
        unattended_denied: 'deviceClient.projectionUnattendedDenied',
        ended: 'deviceClient.projectionEnded',
        failed: 'deviceClient.projectionFailed'
      }
      if (Object.prototype.hasOwnProperty.call(errors, state)) {
        if (state !== 'failed') projectionAuthorized = false
        disconnect()
        error.value = t(errors[state])
        status.value = 'error'
      }
      break
    }

    case 'offer':
      projectionAuthorized = projectionOnDemand
      debugLog('[WebRTC] Received offer, length:', payload.sdp.length)
      cameraSupport.value = payload.camera_support !== false
      if (!cameraSupport.value) {
        debugWarn('[WebRTC] Device does not support camera injection (Camera HAL not found)')
      }
      createPeerConnection()
      const filteredOfferSdp = filterSDPCandidates(payload.sdp)
      pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: filteredOfferSdp
      }))
        .then(() => pc.createAnswer())
        .then(answer => {
          let sdp = answer.sdp;
          // 检测浏览器是否拒绝了视频媒体行 (m=video 0)
          if (/m=video 0/i.test(sdp)) {
            debugWarn('[WebRTC] 浏览器拒收了视频媒体流 (m=video 0)，可能因当前环境不支持该编解码器规格。建议改用 WebSocket 投屏。')
            error.value = '浏览器拒收了视频流，建议改用 WebSocket 投屏模式'
          } else if (!projectionOnDemand) {
            // 录屏发送端使用信令下发的码率，避免应答中的固定起始码率提示干扰。
            // 仅对有效视频行 (端口 > 0) 注入带宽 AS 20000 (20Mbps)
            sdp = sdp.replace(/m=video ([1-9]\d* .*)\r\n/g, 'm=video $1\r\nb=AS:20000\r\n');
            // 针对任意协商选中的 H.264 profile (102, 104, 106, 108, 110, 112, 96 等) 注入 google 码率参数 (bps)
            sdp = sdp.replace(/a=fmtp:(\d+) (.*)\r\n/g, 'a=fmtp:$1 $2;x-google-start-bitrate=20000000;x-google-max-bitrate=20000000\r\n');
          }

          const newAnswer = new RTCSessionDescription({
            type: 'answer',
            sdp: sdp
          });
          debugLog('[WebRTC] Answer SDP processed')
          return pc.setLocalDescription(newAnswer);
        })
        .then(() => {
          // 不再死等 ICE 收集完毕，直接发送 Answer 开启 Trickle ICE。
          // 浏览器收集到的后续 ICE 候选者会自动通过 pc.onicecandidate 发送给对端。
          sendAnswer()
          status.value = 'connecting_webrtc'
        })
        .catch(e => {
          error.value = 'SDP error: ' + e.message
          console.error('SDP error:', e)
        })
      break

    case 'ice-candidate':
      if (pc && payload.candidate) {
        const candStr = payload.candidate.candidate
        remoteCandidates.push(candStr)
        if (shouldKeepCandidate(candStr)) {
          debugLog('[WebRTC] Received remote ICE candidate (accepted):', candStr)
          pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
            .catch(e => console.warn('ICE error:', e))
        } else {
          debugLog('[WebRTC] Received remote ICE candidate (filtered out):', candStr)
        }
      }
      break

    case 'command_result':
      handleCommandResult(payload)
      break

    case 'scrcpy_error':
      console.error('[WebRTC] scrcpy-server error:', payload.message)
      // 如果是相机ID不存在引发的异常，自动清除该设备的异常相机本地缓存偏好，防止死锁
      if (payload.message && payload.message.includes('Camera with id')) {
        try {
          localStorage.removeItem(`cloudphone_camera_pref_${deviceId}`)
        } catch (e) {}
      }
      error.value = payload.message || 'scrcpy-server 启动失败'
      status.value = 'error'
      if (pc) {
        pc.close()
        pc = null
      }
      break
    }
  }

  function sendInjectData(channel, payload, targetDeviceIds = null) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const msg = {
        message_type: 'inject_data',
        device_id: deviceId,
        channel: channel,
        payload: payload
      }
      if (Array.isArray(targetDeviceIds) && targetDeviceIds.length > 0) {
        msg.target_device_ids = targetDeviceIds
      }
      ws.send(JSON.stringify(msg))
    }
  }

  const commandPromises = new Map()

  function sendCommand(command) {
    if (projectionOnDemand) {
      const navigation = { 'input keyevent 3': 3, 'input keyevent 4': 4, 'input keyevent 187': 187 }
      if (Object.prototype.hasOwnProperty.call(navigation, command)) {
        sendInjectKeycode(0, navigation[command])
        sendInjectKeycode(1, navigation[command])
        return null
      }
    }
    const requestId = Math.random().toString(36).substring(7)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        message_type: 'command',
        device_id: deviceId,
        request_id: requestId,
        command: command
      }))
      return requestId
    }
    return null
  }

  function executeCommand(command, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const requestId = sendCommand(command)
      const timer = setTimeout(() => {
        if (commandPromises.has(requestId)) {
          commandPromises.delete(requestId)
          reject(new Error(`命令执行超时 (${timeoutMs}ms)`))
        }
      }, timeoutMs)
      commandPromises.set(requestId, { resolve, reject, timer })
    })
  }

  function createAiCommandChannel() {
    if (!pc || pc.readyState === 'closed') {
      debugWarn('[AI-Command] Cannot create command channel, WebRTC not ready')
      return
    }
    if (aiCommandChannel && (aiCommandChannel.readyState === 'open' || aiCommandChannel.readyState === 'connecting')) {
      return
    }

    debugLog('[AI-Command] Creating P2P command DataChannel...')
    aiCommandChannel = pc.createDataChannel('ai-command-channel', { ordered: true })
    aiCommandChannel.binaryType = 'arraybuffer'

    aiCommandChannel.onopen = () => {
      debugLog('[AI-Command] P2P command DataChannel OPEN')
    }

    aiCommandChannel.onclose = () => {
      debugLog('[AI-Command] P2P command DataChannel CLOSED')
    }

    aiCommandChannel.onerror = (e) => {
      console.warn('[AI-Command] P2P command DataChannel error:', e)
    }

    aiCommandChannel.onmessage = (evt) => {
      try {
        let dataStr = evt.data
        if (evt.data instanceof ArrayBuffer) {
          dataStr = new TextDecoder().decode(evt.data)
        }
        const res = JSON.parse(dataStr)
        const reqId = res.request_id
        if (reqId && aiCommandPromises.has(reqId)) {
          const { resolve, timer } = aiCommandPromises.get(reqId)
          clearTimeout(timer)
          aiCommandPromises.delete(reqId)
          resolve(res)
        }
      } catch (e) {
        console.error('[AI-Command] Failed to parse P2P cmd result:', e)
      }
    }
  }

  function executeCommandP2P(command, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      if (!aiCommandChannel || aiCommandChannel.readyState !== 'open') {
        debugWarn('[AI-Command] P2P command channel not open, falling back to signaling channel')
        createAiCommandChannel()
        resolve(executeCommand(command, timeoutMs))
        return
      }

      const requestId = Math.random().toString(36).substring(7)
      const timer = setTimeout(() => {
        if (aiCommandPromises.has(requestId)) {
          aiCommandPromises.delete(requestId)
          reject(new Error(`P2P 命令执行超时 (${timeoutMs}ms)`))
        }
      }, timeoutMs)

      aiCommandPromises.set(requestId, { resolve, reject, timer })
      try {
        aiCommandChannel.send(JSON.stringify({
          request_id: requestId,
          command: command
        }))
      } catch (e) {
        clearTimeout(timer)
        aiCommandPromises.delete(requestId)
        console.warn('[AI-Command] Failed to send via P2P channel, falling back', e)
        resolve(executeCommand(command, timeoutMs))
      }
    })
  }

  function createUiLayoutChannel() {
    if (!pc) return null
    if (uiLayoutChannel && ['open', 'connecting'].includes(uiLayoutChannel.readyState)) {
      return uiLayoutChannel
    }

    const channel = pc.createDataChannel('ui-layout-channel', { ordered: true })
    uiLayoutChannel = channel
    channel.binaryType = 'arraybuffer'

    channel.onclose = () => {
      if (uiLayoutChannel !== channel) return
      activeLayoutReceiver = null
      for (const item of pendingLayoutSnapshots.values()) {
        item.reject(new Error('layout_channel_closed'))
      }
    }

    channel.onmessage = ({ data }) => {
      if (uiLayoutChannel !== channel) return
      try {
        if (data instanceof ArrayBuffer) {
          const receiver = activeLayoutReceiver
          if (!receiver || !data.byteLength || data.byteLength > 16384 ||
              receiver.chunks.length >= receiver.expectedChunks ||
              receiver.receivedBytes + data.byteLength > receiver.expectedBytes) {
            throw new Error('invalid_dump')
          }
          receiver.chunks.push(new Uint8Array(data))
          receiver.receivedBytes += data.byteLength
          return
        }

        const msg = JSON.parse(data)
        const item = pendingLayoutSnapshots.get(msg.requestId)
        if (!item) throw new Error('invalid_dump')
        if (msg.type === 'layout.error') {
          item.reject(Object.assign(new Error(msg.code), { code: msg.code }))
          return
        }
        if (msg.type === 'layout.begin') {
          if (activeLayoutReceiver || msg.encoding !== 'json-utf8' ||
              !Number.isInteger(msg.bytes) || msg.bytes < 1 || msg.bytes > 1048576 ||
              msg.chunks !== Math.ceil(msg.bytes / 16384) || typeof msg.snapshotId !== 'string') {
            throw new Error('invalid_dump')
          }
          activeLayoutReceiver = {
            requestId: msg.requestId,
            snapshotId: msg.snapshotId,
            expectedBytes: msg.bytes,
            expectedChunks: msg.chunks,
            receivedBytes: 0,
            chunks: []
          }
          return
        }
        const receiver = activeLayoutReceiver
        if (msg.type !== 'layout.end' || !receiver || receiver.requestId !== msg.requestId ||
            receiver.snapshotId !== msg.snapshotId || receiver.receivedBytes !== receiver.expectedBytes ||
            receiver.chunks.length !== receiver.expectedChunks) {
          throw new Error('invalid_dump')
        }
        const combined = new Uint8Array(receiver.expectedBytes)
        let offset = 0
        for (const chunk of receiver.chunks) {
          combined.set(chunk, offset)
          offset += chunk.byteLength
        }
        const snapshot = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(combined))
        const { width, height, rotation } = snapshot.display ?? {}
        if (snapshot.v !== 1 || snapshot.snapshotId !== msg.snapshotId ||
            !Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1 ||
            ![0, 90, 180, 270].includes(rotation) || !Array.isArray(snapshot.nodes) || snapshot.nodes.length > 4000 ||
            snapshot.nodes.some(node => !Array.isArray(node?.bounds) || node.bounds.length !== 4 ||
              !node.bounds.every(Number.isSafeInteger))) {
          throw new Error('invalid_dump')
        }
        item.resolve(snapshot)
      } catch {
        for (const item of pendingLayoutSnapshots.values()) {
          item.reject(new Error('invalid_dump'))
        }
        channel.close()
      }
    }
    return channel
  }

  function requestLayoutSnapshot(timeoutMs = 15000, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted || pendingLayoutSnapshots.size) {
        reject(new Error(signal?.aborted ? 'layout_cancelled' : 'layout_busy'))
        return
      }
      const channel = createUiLayoutChannel()
      if (!channel) {
        reject(new Error('peer_connection_not_ready'))
        return
      }
      const reqId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
      const finish = (callback, value) => {
        clearTimeout(timer)
        channel.removeEventListener('open', sendRequest)
        signal?.removeEventListener('abort', abort)
        pendingLayoutSnapshots.delete(reqId)
        activeLayoutReceiver = null
        callback(value)
      }
      const fail = error => finish(reject, error)
      const abort = () => {
        fail(new Error('layout_cancelled'))
        channel.close()
      }
      const sendRequest = () => {
        try {
          channel.send(JSON.stringify({ type: 'layout.request', v: 1, requestId: reqId }))
        } catch (error) {
          fail(error)
          channel.close()
        }
      }
      const timer = setTimeout(() => {
        fail(new Error('capture_timeout'))
        channel.close()
      }, timeoutMs)
      pendingLayoutSnapshots.set(reqId, { resolve: snapshot => finish(resolve, snapshot), reject: fail })
      signal?.addEventListener('abort', abort, { once: true })
      if (channel.readyState === 'open') {
        sendRequest()
      } else {
        channel.addEventListener('open', sendRequest, { once: true })
      }
    })
  }

  let commandCallback = null
  function onCommandResult(callback) {
    commandCallback = callback
  }

  function handleCommandResult(result) {
    const reqId = result.request_id
    if (reqId && commandPromises.has(reqId)) {
      const { resolve, timer } = commandPromises.get(reqId)
      clearTimeout(timer)
      commandPromises.delete(reqId)
      resolve(result)
    }
    if (commandCallback) {
      commandCallback(result)
    }
  }

  function filterSDPCandidates(sdp) {
    if (!sdp) return sdp
    const lines = sdp.split('\r\n')
    const filteredLines = lines.filter(line => {
      if (line.startsWith('a=candidate:')) {
        return shouldKeepCandidate(line)
      }
      return true
    })
    return filteredLines.join('\r\n')
  }

  function sendAnswer() {
    if (!pc || !pc.localDescription) return
    debugLog('[WebRTC] Sending answer')
    const filteredSdp = filterSDPCandidates(pc.localDescription.sdp)
    sendForward({
      type: 'answer',
      sdp: filteredSdp
    })
  }

  function getAudioGain() {
    const value = Number(options.audio_gain ?? options.audioGain ?? 1)
    if (!Number.isFinite(value)) return 1
    return Math.max(0, Math.min(5, value))
  }

  function getAudioLowLatency() {
    return Boolean(options.audio_low_latency ?? options.audioLowLatency)
  }

  function clearAudioUnlockHandler() {
    if (audioUnlockHandler) {
      window.removeEventListener('pointerdown', audioUnlockHandler, { capture: true })
      window.removeEventListener('keydown', audioUnlockHandler, { capture: true })
      window.removeEventListener('touchstart', audioUnlockHandler, { capture: true })
      window.removeEventListener('click', audioUnlockHandler, { capture: true })
      audioUnlockHandler = null
    }
  }

  function cleanupAudioPlayback() {
    clearAudioUnlockHandler()
    if (audioSourceNode) {
      audioSourceNode.disconnect()
      audioSourceNode = null
    }
    if (audioGainNode) {
      audioGainNode.disconnect()
      audioGainNode = null
    }
    if (audioContext) {
      audioContext.close().catch(() => {})
      audioContext = null
    }
    if (audioElement) {
      audioElement.pause()
      audioElement.srcObject = null
      audioElement.remove()
      audioElement = null
    }
    audioStream = null
  }

  function playAudioElement(gain) {
    if (!audioStream) return

    clearAudioUnlockHandler()

    if (audioElement) {
      audioElement.pause()
      audioElement.srcObject = null
      audioElement.remove()
      audioElement = null
    }

    audioElement = new Audio()
    audioElement.autoplay = true
    audioElement.playsInline = true
    audioElement.muted = audioMuted.value
    audioElement.volume = Math.min(1, gain)
    audioElement.srcObject = audioStream
    audioElement.style.display = 'none'
    document.body.appendChild(audioElement)

    const play = () => {
      if (!audioElement) return
      audioElement.play()
        .then(() => {
          debugLog('[WebRTC] Audio element playing, volume:', audioElement.volume)
          clearAudioUnlockHandler()
        })
        .catch(err => {
          debugWarn('[WebRTC] audio play() blocked, waiting for user gesture:', err)
          if (!audioUnlockHandler) {
            audioUnlockHandler = () => play()
            window.addEventListener('pointerdown', audioUnlockHandler, { once: true, capture: true })
            window.addEventListener('keydown', audioUnlockHandler, { once: true, capture: true })
            window.addEventListener('touchstart', audioUnlockHandler, { once: true, capture: true })
            window.addEventListener('click', audioUnlockHandler, { once: true, capture: true })
          }
        })
    }

    audioElement.addEventListener('canplay', play, { once: true })
    audioElement.addEventListener('playing', () => {
      debugLog('[WebRTC] audio element state=playing')
    })
    audioElement.addEventListener('error', () => {
      console.warn('[WebRTC] audio element error:', audioElement?.error)
    })
    play()
  }

  function playAudioTrack(track) {
    if (options.audio === false) return

    cleanupAudioPlayback()
    audioStream = new MediaStream([track])
    const gain = getAudioGain()

    if (getAudioLowLatency()) {
      debugWarn('[WebRTC] Low latency audio experiment is disabled for now; using audio element playback')
    }
    playAudioElement(gain)

    if (track.addEventListener) {
      track.addEventListener('ended', cleanupAudioPlayback, { once: true })
    }
  }

  function shouldKeepCandidate(candidateStr) {
    if (!candidateStr) return false

    // 1. 直连与中转过滤
    const isRelay = candidateStr.indexOf('typ relay') !== -1
    const pathPref = getOption('connectionPath', 'auto')
    if (pathPref === 'relay' && !isRelay) {
      return false // 仅中转模式，丢弃非中转 Candidate
    }
    if (pathPref === 'direct' && isRelay) {
      return false // 仅直连模式，丢弃中转 Candidate
    }

    // 2. 鲁棒的 IPv4 与 IPv6 过滤（不依赖固定的 parts[4] 索引偏移）
    let isIPv6 = false
    let isIPv4 = false
    const parts = candidateStr.trim().split(/\s+/)
    for (const part of parts) {
      if (part.startsWith('candidate:') || part.startsWith('a=candidate:')) {
        continue
      }
      if (part.split(':').length >= 3) {
        isIPv6 = true
        break
      }
      if (part.split('.').length === 4) {
        isIPv4 = true
        break
      }
    }

    const ipPref = getOption('ipPreference', 'auto')
    if (ipPref === 'ipv4' && isIPv6) {
      return false // 强制 IPv4，丢弃 IPv6 Candidate
    }
    if (ipPref === 'ipv6' && isIPv4) {
      return false // 强制 IPv6，丢弃 IPv4 Candidate
    }
    return true
  }

  function createPeerConnection() {
    if (pc) return

    localCandidates.length = 0
    remoteCandidates.length = 0

    const iceTransportPolicy = getOption('connectionPath', 'auto') === 'relay' ? 'relay' : 'all'
    const renderEnginePref = getOption('renderEngine', 'video')
    const enableInsertable = (renderEnginePref === 'webcodecs' && WebCodecsRenderer.isSupported())
    debugLog('[WebRTC] Creating RTCPeerConnection with servers:', iceServers, 'policy:', iceTransportPolicy, 'insertableStreams:', enableInsertable)
    pc = new RTCPeerConnection({
      iceServers: iceServers,
      iceTransportPolicy: iceTransportPolicy,
      encodedInsertableStreams: enableInsertable
    })

    // 创建 File 通道 (主动创建)
    fileChannel = pc.createDataChannel('file-channel', { ordered: true })
    fileChannel.binaryType = 'arraybuffer'
    setupFileChannel(fileChannel)

    videoStream = new MediaStream()

    pc.ontrack = (evt) => {
      debugLog('[WebRTC] ontrack event:', evt.track.kind, evt.streams)
      if (evt.track.kind === 'audio') {
        // ⚡ 当开启 encodedInsertableStreams 时（例如 WebCodecs 模式），
        // 浏览器将音频接收端也置于 Insertable Streams 拦截管线中。
        // 若不读取并通过 pipeTo 直通 writable，编码的 Opus 数据包将积压在队列中，
        // 导致浏览器原生音频解码器接收不到任何数据，画面动作流畅但毫无声音。
        if (enableInsertable && evt.receiver && evt.receiver.createEncodedStreams) {
          try {
            const { readable, writable } = evt.receiver.createEncodedStreams()
            readable.pipeTo(writable).catch(e => console.warn('[WebRTC] Audio insertable streams pipeTo error:', e))
          } catch (e) {
            console.warn('[WebRTC] Audio createEncodedStreams error:', e)
          }
        }

        if (options.audio === false) return
        playAudioTrack(evt.track)
        return
      }

      // 纯数据通道连接（如文件管理器专用连接）：不挂接视频，避免无谓的视频解码开销
      if (options.video === false) {
        debugLog('[WebRTC] video track ignored (options.video === false)')
        return
      }

      const canvas = canvasElementGetter ? canvasElementGetter() : null

      // ⚡ 仅当用户选择 webcodecs 模式时，尝试 WebCodecs + WebGL/Canvas 极速锁相渲染管线
      if (renderEnginePref === 'webcodecs' && canvas && WebCodecsRenderer.isSupported() && evt.receiver && evt.receiver.createEncodedStreams) {
        debugLog('[WebRTC] ⚡ Activating WebCodecs Phase-Locked Hardware Renderer')
        if (webcodecsRenderer) {
          webcodecsRenderer.stop()
        }
        webcodecsRenderer = new WebCodecsRenderer(canvas, {
          onFrameSizeChange: (w, h) => {
            updateLayoutFrameSize(w, h)
            if (!DEVICE_W.value || !DEVICE_H.value) {
              DEVICE_W.value = w
              DEVICE_H.value = h
            }
            if (frameSizeCallback) {
              frameSizeCallback(w, h)
            }
          }
        })
        const started = webcodecsRenderer.start(evt.receiver)
        if (started) {
          isWebCodecsActive.value = true
          return
        }
      }

      // 回退至 HTML5 <video> 传统渲染模式
      isWebCodecsActive.value = false
      if (projectionOnDemand && evt.receiver && 'jitterBufferTarget' in evt.receiver) {
        try {
          // 远程操作优先显示新画面，实际缓冲仍由浏览器按网络状况调整。
          evt.receiver.jitterBufferTarget = 0
        } catch (e) {
          debugLog('[WebRTC] Could not set projection jitter buffer target:', e)
        }
      }
      if (enableInsertable && evt.receiver && evt.receiver.createEncodedStreams) {
        try {
          const { readable, writable } = evt.receiver.createEncodedStreams()
          readable.pipeTo(writable).catch(e => console.warn('[WebRTC] pipeTo error:', e))
        } catch (e) {
          console.warn('[WebRTC] createEncodedStreams pipeTo fallback error:', e)
        }
      }

      const video = videoElementGetter ? videoElementGetter() : null
      if (video) {
        if (!videoStream) videoStream = new MediaStream()
        const exists = videoStream.getTracks().some(track => track.id === evt.track.id)
        if (!exists) {
          videoStream.addTrack(evt.track)
        }
        video.muted = true
        video.playsInline = true
        layoutVideoElement?.removeEventListener('resize', onLayoutVideoResize)
        layoutVideoElement = video
        video.addEventListener('resize', onLayoutVideoResize)
        video.srcObject = videoStream
        debugLog('[WebRTC] Set srcObject to video element')
        // 强制播放
        video.play().catch(e => console.warn('[WebRTC] play() failed:', e))
      } else {
        console.error('[WebRTC] videoElement is null!')
      }
    }

    pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        const candStr = evt.candidate.candidate
        localCandidates.push(candStr)
        if (shouldKeepCandidate(candStr)) {
          debugLog('[WebRTC] Sending local ICE candidate (accepted):', candStr)
          sendForward({
            type: 'ice-candidate',
            candidate: {
              candidate: evt.candidate.candidate,
              sdpMid: evt.candidate.sdpMid,
              sdpMLineIndex: evt.candidate.sdpMLineIndex
            }
          })
        } else {
          debugLog('[WebRTC] Sending local ICE candidate (filtered out):', candStr)
        }
      }
    }

    function diagnoseConnectionFailure() {
      let advice = 'WebRTC 握手建连失败。建议检查：1. 确认设备端与本端网络是否在同一局域网；2. 若处于公网/跨网访问，请确认系统是否配置并开启了有效的 TURN 中转服务器。'
      
      const hasOnlyDockerOrLoopback = remoteCandidates.length > 0 && remoteCandidates.every(cand => {
        const parts = cand.split(' ')
        if (parts.length >= 5) {
          const ip = parts[4]
          return ip === '127.0.0.1' || ip.startsWith('172.17.') || ip.startsWith('172.18.') || ip.startsWith('172.16.') || ip.startsWith('172.19.') || ip.startsWith('172.20.') || ip.startsWith('172.30.')
        }
        return false
      })

      const clientHasPhysicalLanIp = localCandidates.some(cand => {
        const parts = cand.split(' ')
        if (parts.length >= 5) {
          const ip = parts[4]
          return ip.startsWith('192.168.') || ip.startsWith('10.')
        }
        return false
      })

      if (hasOnlyDockerOrLoopback && clientHasPhysicalLanIp) {
        advice = '网络物理隔离。检测到被控端云手机仅上报了 Docker 内部私有 IP (如 172.17.x.x)，您的电脑（在局域网内物理网段）无法直接路由到容器内网。请联系管理员确保启动 Agent 时配置了宿主机物理 IP 映射（如启动参数 -external-addr 或环境变量 CP_AGENT_EXTERNAL_ADDR）。'
        return advice
      }

      const hasClashTun = localCandidates.some(cand => {
        const parts = cand.split(' ')
        if (parts.length >= 5) {
          const ip = parts[4]
          return ip.startsWith('198.18.')
        }
        return false
      })

      if (hasClashTun) {
        advice = '网络连接受阻。检测到您的电脑启用了网络代理软件的 Tun 虚拟网卡模式（常见 IP 198.18.x.x）。该模式会拦截或篡改 WebRTC UDP 握手数据包。建议您暂时关闭代理软件的 Tun 模式后重新连接。'
        return advice
      }

      return advice
    }

    pc.oniceconnectionstatechange = () => {
      debugLog('[WebRTC] ICE Connection State:', pc.iceConnectionState)
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        status.value = 'connected'
      } else if (pc.iceConnectionState === 'failed') {
        error.value = '连接失败: ' + diagnoseConnectionFailure()
        status.value = 'error'
      }
    }

    pc.onconnectionstatechange = () => {
      debugLog('[WebRTC] Connection State:', pc.connectionState)
      if (pc.connectionState === 'connected') {
        status.value = 'connected'
      } else if (pc.connectionState === 'failed') {
        error.value = '连接失败: ' + diagnoseConnectionFailure()
        status.value = 'error'
      } else if (pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
        status.value = 'disconnected'
      }
    }

    pc.ondatachannel = (evt) => {
      debugLog('[WebRTC] Received DataChannel:', evt.channel.label)
      if (evt.channel.label === 'input-channel') {
        inputChannel = evt.channel
        inputChannel.onopen = () => {
          debugLog('[DataChannel] input-channel OPEN')
        }
        inputChannel.onclose = () => {
          debugLog('[DataChannel] input-channel CLOSED')
        }
        inputChannel.onerror = (e) => console.error('[DataChannel] Error:', e)
      } else if (evt.channel.label === 'clipboard-channel') {
        clipboardChannel = evt.channel
        clipboardChannel.onopen = () => {
          debugLog('[DataChannel] clipboard-channel OPEN')
        }
        clipboardChannel.onmessage = (evt) => {
          try {
            let dataStr = evt.data
            if (evt.data instanceof ArrayBuffer) {
              dataStr = new TextDecoder().decode(evt.data)
            }
            const msg = JSON.parse(dataStr)
            if (msg.type === 'clipboard' && clipboardCallback) {
              clipboardCallback({
                text: msg.text,
                source: msg.source || 'device',
                originClientId: msg.origin_client_id ?? null
              })
            }
          } catch (e) {
            console.error('[DataChannel] Failed to parse clipboard msg:', e)
          }
        }
        clipboardChannel.onclose = () => {
          debugLog('[DataChannel] clipboard-channel CLOSED')
        }
      } else if (evt.channel.label === 'camera-channel') {
        cameraChannel = evt.channel
        cameraChannel.onopen = () => {
          debugLog('[DataChannel] camera-channel OPEN')
        }
        cameraChannel.onmessage = (evt) => {
          try {
            let dataStr = evt.data
            if (evt.data instanceof ArrayBuffer) {
              dataStr = new TextDecoder().decode(evt.data)
            }
            const msg = JSON.parse(dataStr)
            if (msg.action === 'start') {
              debugLog('[Camera] Received start command from Agent')
              startCameraStreaming()
            } else if (msg.action === 'stop') {
              debugLog('[Camera] Received stop command from Agent')
              stopCameraStreaming()
            }
          } catch (e) {
            // 忽略非控制消息解析错误
          }
        }
        cameraChannel.onclose = () => {
          debugLog('[DataChannel] camera-channel CLOSED')
          stopCameraStreaming()
        }
        cameraChannel.onerror = (e) => console.error('[DataChannel] camera-channel Error:', e)
      }
    }
  }

  // --- 统计监控逻辑 ---
  let prevStats = { timestamp: 0, bytesReceived: 0, framesDecoded: 0, framesReceived: 0, framesPresented: 0 }
  let previousJitterBuffer = null
  let pauseCount = 0
  let wasPaused = false

  async function getVideoStats() {
    if (!pc) return null
    try {
      const stats = await pc.getStats()
      let currentRtt = 0
      let activePair = null
      
      // First pass to find RTT and active candidate pair
      for (const report of stats.values()) {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          activePair = report
          currentRtt = (report.currentRoundTripTime || 0) * 1000
          break
        }
      }

      if (!activePair) {
        for (const report of stats.values()) {
          if (report.type === 'candidate-pair' && (report.nominated || report.selected)) {
            activePair = report
            if (report.currentRoundTripTime !== undefined) {
              currentRtt = report.currentRoundTripTime * 1000
            }
            break
          }
        }
      }

      let connectionType = 'UDP p2p'
      if (activePair) {
        const localCand = stats.get(activePair.localCandidateId)
        if (localCand) {
          const proto = (localCand.protocol || 'udp').toUpperCase()
          const candType = localCand.candidateType // 'host', 'srflx', 'prflx', 'relay'
          if (candType === 'relay') {
            connectionType = `${proto} relay`
          } else {
            connectionType = `${proto} p2p`
          }
        }
      }

      const activeEl = (isWebCodecsActive.value && canvasElementGetter)
        ? canvasElementGetter()
        : (videoElementGetter ? videoElementGetter() : null)

      // 注册标准 requestVideoFrameCallback 捕获渲染呈现帧率 (PRES)
      if (activeEl && activeEl.requestVideoFrameCallback && !activeEl.__rvfcHooked) {
        activeEl.__rvfcHooked = true
        activeEl.__presCount = 0
        function _rvLoop(now, metadata) {
          if (metadata && typeof metadata.presentedFrames === 'number') {
            activeEl.__presCount = metadata.presentedFrames
          } else {
            activeEl.__presCount = (activeEl.__presCount || 0) + 1
          }
          if (activeEl && activeEl.requestVideoFrameCallback) {
            activeEl.requestVideoFrameCallback(_rvLoop)
          }
        }
        activeEl.requestVideoFrameCallback(_rvLoop)
      }

      for (const report of stats.values()) {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          const now = report.timestamp
          const dt = prevStats.timestamp ? (now - prevStats.timestamp) / 1000 : 0

          let fps = 0
          let framesDecodedVal = report.framesDecoded || 0
          let decodeTimeNum = 0
          let jbDelayNum = 0
          let jbTargetMs = null
          let jbMinimumMs = null

          if (isWebCodecsActive.value && webcodecsRenderer) {
            fps = webcodecsRenderer.currentFps.toFixed(0)
            framesDecodedVal = webcodecsRenderer.totalFramesDecoded
            decodeTimeNum = 0.5 // WebCodecs GPU 硬件解码耗时 < 0.5ms
            jbDelayNum = 0     // 极速锁相直通模式绕过了 JitterBuffer
          } else {
            const newFrames = framesDecodedVal - (prevStats.framesDecoded || 0)
            fps = dt > 0 ? (newFrames / dt).toFixed(0) : 0
            const count = report.jitterBufferEmittedCount || 0
            const previous = previousJitterBuffer?.id === report.id &&
              count >= previousJitterBuffer.count ? previousJitterBuffer : null
            const emitted = count - (previous?.count ?? 0)
            if (emitted > 0) {
              const average = (total, baseline) => Number.isFinite(total)
                ? Math.max(0, total - (baseline ?? 0)) * 1000 / emitted
                : null
              jbDelayNum = average(report.jitterBufferDelay, previous?.delay) ?? 0
              jbTargetMs = average(report.jitterBufferTargetDelay, previous?.target)
              jbMinimumMs = average(report.jitterBufferMinimumDelay, previous?.minimum)
            } else if (previous) {
              // 静止画面没有新帧时，保留最近一次有画面的采样。
              jbDelayNum = previous.delayMs
              jbTargetMs = previous.targetMs
              jbMinimumMs = previous.minimumMs
            }
            previousJitterBuffer = {
              id: report.id, count,
              delay: report.jitterBufferDelay,
              target: report.jitterBufferTargetDelay,
              minimum: report.jitterBufferMinimumDelay,
              delayMs: jbDelayNum, targetMs: jbTargetMs, minimumMs: jbMinimumMs
            }
            decodeTimeNum = (report.totalDecodeTime / (framesDecodedVal || 1) * 1000) || 0

            // 静音抑制 decode-pause 刷屏，仅记录状态与 pauseCount，避免静止画面持续污染控制台
            if (dt > 0 && newFrames === 0 && !wasPaused && status.value === 'connected') {
              pauseCount++
              wasPaused = true
            } else if (newFrames > 0) {
              wasPaused = false
            }
          }

          const rxT = report.framesReceived || 0
          const presT = activeEl ? (activeEl.__presCount || framesDecodedVal) : framesDecodedVal

          const dRx = rxT - (prevStats.framesReceived || 0)
          const dPres = presT - (prevStats.framesPresented || 0)
          const rxFps = dt > 0 ? Math.round(dRx / dt) : 0
          const presFps = dt > 0 ? Math.round(dPres / dt) : 0
          const srcFps = report.framesPerSecond !== undefined ? Math.round(report.framesPerSecond) : rxFps
          const fLbl = `SRC ${srcFps} | RX ${rxFps} | DEC ${fps} | PRES ${presFps}`

          const bitrate = dt > 0 ? ((report.bytesReceived - prevStats.bytesReceived) * 8 / dt / 1000).toFixed(0) : 0
          const jbDelay = jbDelayNum.toFixed(0)
          
          // Estimate E2E latency: RTT (network) + JB (buffer) + Decode (client) + 10ms (server processing)
          const e2eDelay = (currentRtt + jbDelayNum + decodeTimeNum + 10).toFixed(0)

          const pliCount = report.pliCount || 0
          const lostCount = report.packetsLost || 0

          // 挂载全局诊断快照，方便 DevTools 控制台直接审查
          window.__streamStats = {
            timestamp: Date.now(),
            mode: 'webrtc',
            srcFps,
            rxFps,
            decodeFps: Number(fps),
            presentFps: presFps,
            fpsLabel: fLbl,
            bitrateKbps: Number(bitrate),
            avgJitterBufferMs: Number(jbDelay),
            jitterBufferTargetMs: jbTargetMs,
            jitterBufferMinimumMs: jbMinimumMs,
            avgDecodeMs: Math.round(decodeTimeNum * 10) / 10,
            rttMs: Number(currentRtt.toFixed(0)),
            packetLossTotal: lostCount,
            framesReceived: rxT,
            framesDecoded: framesDecodedVal,
            framesPresented: presT
          }

          prevStats = {
            timestamp: now,
            bytesReceived: report.bytesReceived,
            framesDecoded: framesDecodedVal,
            framesReceived: rxT,
            framesPresented: presT
          }

          return { 
            fps, 
            fpsLabel: fLbl,
            srcFps, 
            rxFps, 
            decodeFps: Number(fps), 
            presentFps: presFps, 
            bitrate, 
            jbDelay, 
            e2eDelay, 
            rtt: currentRtt.toFixed(0), 
            pliCount, 
            pauseCount, 
            lostCount, 
            connectionType 
          }
        }
      }
    } catch (e) {
      // ignore
    }
    return null
  }

  function resetStats() {
    prevStats = { timestamp: 0, bytesReceived: 0, framesDecoded: 0, framesReceived: 0, framesPresented: 0 }
    previousJitterBuffer = null
    pauseCount = 0
    wasPaused = false
  }

  function setAudioMuted(muted) {
    audioMuted.value = Boolean(muted)
    if (audioElement) {
      audioElement.muted = audioMuted.value
    }
  }

  function toggleAudioMuted() {
    setAudioMuted(!audioMuted.value)
    return audioMuted.value
  }

  function sendForward(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        message_type: 'forward',
        device_id: deviceId,
        payload
      }))
    }
  }

  function sendTouch(action, clientX, clientY, id = 0, rotatedCoord = null) {
    if (viewOnly) return
    if (!inputChannel || inputChannel.readyState !== 'open') return
    const activeEl = (isWebCodecsActive.value && canvasElementGetter) ? canvasElementGetter() : (videoElementGetter ? videoElementGetter() : null)
    if (!activeEl) return
    const videoW = activeEl.videoWidth || activeEl.width || DEVICE_W.value
    const videoH = activeEl.videoHeight || activeEl.height || DEVICE_H.value
    if (!videoW || !videoH) return
    const seq = ++touchSeq
    const clientTsMs = Date.now()

    const isDefaultLandscape = DEVICE_W.value > DEVICE_H.value
    const isVideoLandscape = videoW > videoH
    const isRotated = isVideoLandscape !== isDefaultLandscape
    const targetW = isRotated ? DEVICE_H.value : DEVICE_W.value
    const targetH = isRotated ? DEVICE_W.value : DEVICE_H.value

    let finalX, finalY

    // 如果提供了预计算的旋转坐标，直接使用
    if (rotatedCoord && rotatedCoord.isRotated) {
      // rotatedCoord.x/y 是相对于原始视频尺寸的坐标，按比例映射回逻辑尺寸
      const x = Math.round(rotatedCoord.x / videoW * targetW)
      const y = Math.round(rotatedCoord.y / videoH * targetH)
      finalX = Math.max(0, Math.min(targetW, x))
      finalY = Math.max(0, Math.min(targetH, y))
    } else {
      // 正常计算
      const rect = activeEl.getBoundingClientRect()
      const clientW = rect.width
      const clientH = rect.height

      // 计算 object-fit: contain 下视频实际显示的尺寸和偏移
      const videoRatio = videoW / videoH
      const clientRatio = clientW / clientH

      let actualW, actualH, offsetX, offsetY
      if (clientRatio > videoRatio) {
        // 左右有黑边 (Pillarbox)
        actualH = clientH
        actualW = clientH * videoRatio
        offsetX = (clientW - actualW) / 2
        offsetY = 0
      } else {
        // 上下有黑边 (Letterbox)
        actualW = clientW
        actualH = clientW / videoRatio
        offsetX = 0
        offsetY = (clientH - actualH) / 2
      }

      // 计算相对于实际视频内容的坐标
      const relativeX = clientX - rect.left - offsetX
      const relativeY = clientY - rect.top - offsetY

      // 映射到设备逻辑分辨率
      const x = Math.round(relativeX / actualW * targetW)
      const y = Math.round(relativeY / actualH * targetH)

      // 越界检查
      finalX = Math.max(0, Math.min(targetW, x))
      finalY = Math.max(0, Math.min(targetH, y))
    }

    const msg = JSON.stringify({
      type: 'touch',
      id,
      seq,
      client_ts_ms: clientTsMs,
      action,
      x: finalX,
      y: finalY,
      w: targetW,
      h: targetH
    })

    const bufferedBefore = inputChannel.bufferedAmount
    inputChannel.send(msg)
    if (controlEventCallback) {
      controlEventCallback({
        type: 'touch',
        id,
        seq,
        client_ts_ms: clientTsMs,
        action,
        x: finalX,
        y: finalY,
        w: targetW,
        h: targetH
      })
    }
    const bufferedAfter = inputChannel.bufferedAmount
    if (action !== 2 || seq % 30 === 0 || bufferedAfter > 65536) {
      debugInfo('[TouchTrace] dc-send', {
        seq,
        action,
        id,
        x: finalX,
        y: finalY,
        w: targetW,
        h: targetH,
        clientTsMs,
        bufferedBefore,
        bufferedAfter
      })
    }
  }

  function sendTouchDirect(action, x, y, w, h, id = 0) {
    if (viewOnly) return
    if (!inputChannel || inputChannel.readyState !== 'open') return
    const targetW = w || DEVICE_W.value || 1080
    const targetH = h || DEVICE_H.value || 1920
    const seq = ++touchSeq
    const clientTsMs = Date.now()

    const finalX = Math.max(0, Math.min(targetW - 1, Math.round(x)))
    const finalY = Math.max(0, Math.min(targetH - 1, Math.round(y)))

    const msg = JSON.stringify({
      type: 'touch',
      id,
      seq,
      client_ts_ms: clientTsMs,
      action,
      x: finalX,
      y: finalY,
      w: targetW,
      h: targetH
    })

    try {
      inputChannel.send(msg)
      return true
    } catch {
      return false
    }
  }

  function sendScrollDirect(x, y, scrollH, scrollV, w, h) {
    if (viewOnly) return
    if (!inputChannel || inputChannel.readyState !== 'open') return
    const targetW = w || DEVICE_W.value || 1080
    const targetH = h || DEVICE_H.value || 1920
    const seq = ++touchSeq
    const clientTsMs = Date.now()

    const finalX = Math.max(0, Math.min(targetW - 1, Math.round(x)))
    const finalY = Math.max(0, Math.min(targetH - 1, Math.round(y)))

    const msg = JSON.stringify({
      type: 'inject_scroll',
      seq,
      client_ts_ms: clientTsMs,
      x: finalX,
      y: finalY,
      w: targetW,
      h: targetH,
      scroll_h: scrollH,
      scroll_v: scrollV
    })

    try {
      inputChannel.send(msg)
      return true
    } catch {
      return false
    }
  }

  function sendScroll(clientX, clientY, scrollH, scrollV, rotatedCoord = null) {
    if (viewOnly) return
    debugLog('[sendScroll] called', 'inputChannel:', inputChannel?.readyState, 'scrollH:', scrollH, 'scrollV:', scrollV)
    if (!inputChannel || inputChannel.readyState !== 'open') {
      debugWarn('[sendScroll] blocked: channel not open, state:', inputChannel?.readyState)
      return false
    }
    const activeEl = (isWebCodecsActive.value && canvasElementGetter) ? canvasElementGetter() : (videoElementGetter ? videoElementGetter() : null)
    if (!activeEl) {
      debugWarn('[sendScroll] blocked: no active media element')
      return false
    }
    const videoW = activeEl.videoWidth || activeEl.width || DEVICE_W.value
    const videoH = activeEl.videoHeight || activeEl.height || DEVICE_H.value
    if (!videoW || !videoH) {
      debugWarn('[sendScroll] blocked: no valid dimensions', videoW, videoH)
      return false
    }

    const seq = ++touchSeq
    const clientTsMs = Date.now()

    const isDefaultLandscape = DEVICE_W.value > DEVICE_H.value
    const isVideoLandscape = videoW > videoH
    const isRotated = isVideoLandscape !== isDefaultLandscape
    const targetW = isRotated ? DEVICE_H.value : DEVICE_W.value
    const targetH = isRotated ? DEVICE_W.value : DEVICE_H.value

    let finalX, finalY

    if (rotatedCoord && rotatedCoord.isRotated) {
      const x = Math.round(rotatedCoord.x / videoW * targetW)
      const y = Math.round(rotatedCoord.y / videoH * targetH)
      finalX = Math.max(0, Math.min(targetW, x))
      finalY = Math.max(0, Math.min(targetH, y))
    } else {
      const rect = activeEl.getBoundingClientRect()
      const clientW = rect.width
      const clientH = rect.height

      const videoRatio = videoW / videoH
      const clientRatio = clientW / clientH

      let actualW, actualH, offsetX, offsetY
      if (clientRatio > videoRatio) {
        actualH = clientH
        actualW = clientH * videoRatio
        offsetX = (clientW - actualW) / 2
        offsetY = 0
      } else {
        actualW = clientW
        actualH = clientW / videoRatio
        offsetX = 0
        offsetY = (clientH - actualH) / 2
      }

      const relativeX = clientX - rect.left - offsetX
      const relativeY = clientY - rect.top - offsetY

      const x = Math.round(relativeX / actualW * targetW)
      const y = Math.round(relativeY / actualH * targetH)

      finalX = Math.max(0, Math.min(targetW, x))
      finalY = Math.max(0, Math.min(targetH, y))
    }

    const msg = JSON.stringify({
      type: 'inject_scroll',
      seq,
      client_ts_ms: clientTsMs,
      x: finalX,
      y: finalY,
      w: targetW,
      h: targetH,
      scroll_h: scrollH,
      scroll_v: scrollV
    })

    debugInfo('[ScrollTrace] dc-send', {
      seq,
      x: finalX,
      y: finalY,
      w: targetW,
      h: targetH,
      scrollH,
      scrollV
    })
    inputChannel.send(msg)
    if (controlEventCallback) {
      controlEventCallback({
        type: 'inject_scroll',
        seq,
        client_ts_ms: clientTsMs,
        x: finalX,
        y: finalY,
        w: targetW,
        h: targetH,
        scroll_h: scrollH,
        scroll_v: scrollV
      })
    }
    return true
  }

  function requestScreenshot() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        message_type: 'screenshot_request',
        device_id: deviceId
      }))
    }
  }

  let clipboardCallback = null
  let unwatchWsClipboard = null

  function onClipboard(callback) {
    clipboardCallback = callback
    if (!unwatchWsClipboard && deviceStore && typeof deviceStore.onDeviceClipboard === 'function') {
      unwatchWsClipboard = deviceStore.onDeviceClipboard((devId, evt) => {
        if (devId === deviceId && clipboardCallback) {
          clipboardCallback({
            text: evt.text || '',
            source: evt.source || 'device',
            originClientId: evt.origin_client_id ?? null
          })
        }
      })
    }
  }

  function setClipboard(text, options = false) {
    if (viewOnly) return false
    const normalized = typeof options === 'boolean' ? { paste: options } : (options || {})
    if (clipboardChannel && clipboardChannel.readyState === 'open') {
      clipboardChannel.send(JSON.stringify({
        type: 'set_clipboard',
        text,
        paste: Boolean(normalized.paste),
        source: normalized.source || 'local',
        suppress_broadcast: Boolean(normalized.suppressBroadcast)
      }))
      return true
    }
    // 降级兜底：若直连通道尚未就绪（握手建连期），通过 WS 信令下发，确保用户操作绝不丢失
    try {
      deviceStore.sendGroupControlEvent([deviceId], {
        type: 'set_clipboard',
        text,
        paste: Boolean(normalized.paste),
        source: normalized.source || 'local',
        suppress_broadcast: Boolean(normalized.suppressBroadcast)
      })
      return true
    } catch (e) {
      console.warn('[useWebRTC] setClipboard fallback via WS failed:', e)
      return false
    }
  }

  function getClipboard() {
    if (viewOnly) return false
    if (clipboardChannel && clipboardChannel.readyState === 'open') {
      clipboardChannel.send(JSON.stringify({
        type: 'get_clipboard'
      }))
      return true
    }
    // 降级兜底：若直连通道尚未就绪，通过 WS 信令下发
    try {
      deviceStore.sendGroupControlEvent([deviceId], {
        type: 'get_clipboard'
      })
      return true
    } catch (e) {
      console.warn('[useWebRTC] getClipboard fallback via WS failed:', e)
      return false
    }
  }

  let screenshotCallback = null

  function onScreenshot(callback) {
    screenshotCallback = callback
  }

  function handleScreenshot(data) {
    if (screenshotCallback) {
      screenshotCallback(data)
    }
  }

  function createAdbSessionChannel() {
    if (!pc || pc.readyState === 'closed') {
      throw new Error('WebRTC connection not ready')
    }
    debugLog('[ADB] Creating a new session DataChannel...')
    const channel = pc.createDataChannel('adb-channel', { ordered: true })
    channel.binaryType = 'arraybuffer'

    let channelLastOpenTime = 0
    let stabilizeTimer = null
    let sendQueue = []

    const flushQueue = () => {
      if (sendQueue.length > 0 && channel.readyState === 'open') {
        debugLog(`[ADB] Flushing ${sendQueue.length} queued send packets`)
        sendQueue.forEach(buf => {
          try {
            channel.send(buf)
          } catch (e) {
            console.error('[ADB] Failed to send buffered data:', e)
          }
        })
        sendQueue = []
      }
    }

    channel.onopen = () => {
      debugLog('[ADB] Session DataChannel OPEN')
      channelLastOpenTime = Date.now()
      if (!stabilizeTimer) {
        stabilizeTimer = setTimeout(() => {
          flushQueue()
          stabilizeTimer = null
        }, 150)
      }
    }

    channel.onclose = () => {
      debugLog('[ADB] Session DataChannel CLOSED')
      if (stabilizeTimer) {
        clearTimeout(stabilizeTimer)
        stabilizeTimer = null
      }
    }

    channel.onerror = (e) => {
      console.error('[ADB] Session DataChannel Error:', e)
      if (stabilizeTimer) {
        clearTimeout(stabilizeTimer)
        stabilizeTimer = null
      }
    }

    const sendData = (data) => {
      let buffer = null
      if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
        buffer = data
      } else if (data && data.buffer instanceof ArrayBuffer) {
        buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      } else {
        return
      }

      const now = Date.now()
      const isStabilized = (now - channelLastOpenTime) > 150

      if (channel.readyState === 'open' && isStabilized) {
        try {
          channel.send(buffer)
        } catch (e) {
          console.error('[ADB] Send data failed, buffering instead:', e)
          sendQueue.push(buffer)
        }
      } else {
        sendQueue.push(buffer)
        if (channel.readyState === 'open' && !stabilizeTimer) {
          stabilizeTimer = setTimeout(() => {
            flushQueue()
            stabilizeTimer = null
          }, 150)
        }
      }
    }

    return {
      channel,
      sendData,
      close: () => {
        debugLog('[ADB] Closing session DataChannel')
        try {
          channel.close()
        } catch (e) {}
        if (stabilizeTimer) {
          clearTimeout(stabilizeTimer)
          stabilizeTimer = null
        }
        sendQueue = []
      }
    }
  }

  let fileChannel = null
  const fileChannelReady = ref(false)
  let fileChannelCallback = null

  function onFileChannelMessage(callback) {
    fileChannelCallback = callback
  }

  function setupFileChannel(channel) {
    channel.onopen = () => {
      debugLog('[FileChannel] DataChannel OPEN')
      fileChannelReady.value = true
    }
    channel.onmessage = (evt) => {
      if (fileChannelCallback) {
        fileChannelCallback(evt.data)
      }
    }
    channel.onclose = () => {
      debugLog('[FileChannel] DataChannel CLOSED')
      fileChannelReady.value = false
    }
    channel.onerror = (e) => {
      console.error('[FileChannel] DataChannel Error:', e)
      fileChannelReady.value = false
    }
  }

  function sendFileChannelCmd(cmd) {
    if (!fileChannel || fileChannel.readyState !== 'open') {
      console.warn('[DataChannel] sendFileChannelCmd failed: fileChannel is not open')
      return false
    }
    fileChannel.send(JSON.stringify(cmd))
    return true
  }

  function sendFileChannelChunk(arrayBuffer) {
    if (!fileChannel || fileChannel.readyState !== 'open') {
      console.warn('[DataChannel] sendFileChannelChunk failed: fileChannel is not open')
      return false
    }
    if (fileChannel.bufferedAmount > 512 * 1024) {
      return false // 发送缓冲大于 512KB 触发流控挂起
    }
    try {
      fileChannel.send(arrayBuffer)
      return true
    } catch (e) {
      console.error('[DataChannel] Error in sendFileChannelChunk:', e)
      return false
    }
  }

  function getFileChannelBufferedAmount() {
    return fileChannel ? fileChannel.bufferedAmount : 0
  }

  async function startCameraStreaming() {
    debugLog('[Camera] startCameraStreaming() called, camera option:', options.camera)
    if (!options.camera || !cameraSupport.value) {
      if (!cameraSupport.value) {
        debugWarn('[Camera] Intercepted camera streaming: device does not support camera')
      }
      return
    }
    stopCameraStreaming()

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errMsg = '由于浏览器安全限制，摄像头注入功能仅支持在安全上下文 (HTTPS 或 localhost) 下使用。请使用 HTTPS 部署，或在本地开发环境下测试。'
      console.error('[WebRTC] ' + errMsg)
      alert(errMsg)
      return
    }

    debugLog('[WebRTC] Requesting local camera stream...')
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 640, 
          height: 480, 
          frameRate: 30,
          facingMode: { ideal: "environment" }
        }
      })
      debugLog('[WebRTC] Local camera stream acquired')
    } catch (err) {
      console.error('[WebRTC] Failed to acquire camera:', err)
      alert('获取摄像头权限失败: ' + err.message)
      return
    }

    const video = document.createElement('video')
    video.autoplay = true
    video.playsInline = true
    video.muted = true
    video.srcObject = cameraStream
    
    try {
      await video.play()
    } catch (e) {
      console.warn('[WebRTC] Offscreen camera video play() failed:', e)
    }

    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')

    cameraIntervalId = setInterval(() => {
      if (!cameraChannel || cameraChannel.readyState !== 'open') {
        stopCameraStreaming()
        return
      }

      ctx.drawImage(video, 0, 0, 640, 480)
      canvas.toBlob((blob) => {
        if (!blob || !cameraChannel || cameraChannel.readyState !== 'open') return
        const reader = new FileReader()
        reader.onload = () => {
          if (cameraChannel && cameraChannel.readyState === 'open') {
            cameraChannel.send(reader.result)
          }
        }
        reader.readAsArrayBuffer(blob)
      }, 'image/jpeg', 0.6)
    }, 1000 / 30)
  }

  function stopCameraStreaming() {
    if (cameraIntervalId) {
      clearInterval(cameraIntervalId)
      cameraIntervalId = null
    }
    if (cameraStream) {
      try {
        cameraStream.getTracks().forEach(track => track.stop())
      } catch (e) {}
      cameraStream = null
    }
    debugLog('[WebRTC] Camera streaming stopped and tracks released')
  }

  function hasProjectionSession() {
    return projectionOnDemand && (projectionAuthorized || status.value === 'waiting_projection')
  }

  function canResumeProjection() {
    return projectionOnDemand && projectionAuthorized && Boolean(projectionResumeKey)
  }

  function endProjection() {
    if (!projectionOnDemand) return
    sendForward({ type: 'projection-end', projection_resume_key: projectionResumeKey })
    projectionAuthorized = false
    projectionKeys.delete(deviceId)
    try { sessionStorage.removeItem(`cloudphone_projection_resume:${deviceId}`) } catch {}
    projectionResumeKey = ''
  }

  function disconnect() {
    if (isDisposed) return
    isDisposed = true
    layoutVideoElement?.removeEventListener('resize', onLayoutVideoResize)
    layoutVideoElement = null
    stopCameraStreaming()
    if (webcodecsRenderer) {
      webcodecsRenderer.stop()
      webcodecsRenderer = null
      isWebCodecsActive.value = false
    }
    if (pc) {
      pc.close()
      pc = null
    }
    const video = videoElementGetter ? videoElementGetter() : null
    if (video) {
      video.srcObject = null
    }
    videoStream = null
    cleanupAudioPlayback()
    if (wsHeartbeatTimer) {
      clearInterval(wsHeartbeatTimer)
      wsHeartbeatTimer = null
    }
    if (ws) {
      ws.close()
      ws = null
    }
    if (fileChannel) {
      try { fileChannel.close() } catch(e) {}
      fileChannel = null
    }
    fileChannelReady.value = false
    if (aiCommandChannel) {
      try { aiCommandChannel.close() } catch(e) {}
      aiCommandChannel = null
    }
    if (uiLayoutChannel) {
      try { uiLayoutChannel.close() } catch(e) {}
      uiLayoutChannel = null
    }
    activeLayoutReceiver = null
    for (const [, item] of pendingLayoutSnapshots.entries()) {
      clearTimeout(item.timer)
      item.reject(new Error('disconnected'))
    }
    pendingLayoutSnapshots.clear()
    if (unwatchWsClipboard) {
      unwatchWsClipboard()
      unwatchWsClipboard = null
    }
    aiCommandPromises.clear()
    status.value = 'disconnected'

    if (webrtcObj) {
      webrtcObj._adbInstance = null
      webrtcObj._adbTransport = null
      webrtcObj._adbRawConnection = null
      webrtcObj._adbActiveSocketsCount = 0
    }
  }

  onUnmounted(() => {
    disconnect()
  })

  // 设置获取视频元素的函数 (由组件调用)
  function setVideoGetter(getter) {
    videoElementGetter = getter
  }

  // 设置获取 Canvas 元素的函数 (WebCodecs 极速锁相模式)
  function setCanvasGetter(getter) {
    canvasElementGetter = getter
  }

  function sendInjectText(text) {
    if (viewOnly) return
    if (!inputChannel || inputChannel.readyState !== 'open') {
      console.warn('[DataChannel] sendInjectText failed: inputChannel is not open')
      return false
    }
    console.log('[DataChannel] Sending inject_text:', text)
    const eventObj = {
      type: 'inject_text',
      text
    }
    const msg = JSON.stringify(eventObj)
    inputChannel.send(msg)
    if (controlEventCallback) {
      controlEventCallback(eventObj)
    }
    return true
  }

  function sendInjectKeycode(action, keycode, repeat = 0, meta = 0) {
    if (viewOnly) return
    if (!inputChannel || inputChannel.readyState !== 'open') {
      console.warn('[DataChannel] sendInjectKeycode failed: inputChannel is not open')
      return false
    }
    console.log('[DataChannel] Sending inject_keycode:', { action, keycode, repeat, meta })
    const eventObj = {
      type: 'inject_keycode',
      action,
      keycode,
      repeat,
      meta
    }
    const msg = JSON.stringify(eventObj)
    inputChannel.send(msg)
    if (controlEventCallback) {
      controlEventCallback(eventObj)
    }
    return true
  }

  let frameSizeCallback = null
  function onFrameSize(cb) {
    frameSizeCallback = cb
  }

  function onControlEvent(cb) {
    controlEventCallback = cb
  }

  webrtcObj = {
    status,
    onControlEvent,
    onFrameSize,
    error,
    audioMuted,
    cameraSupport,
    agentVersion,
    isWebCodecsActive,
    setVideoGetter,
    setCanvasGetter,
    connect,
    disconnect,
    hasProjectionSession,
    canResumeProjection,
    endProjection,
    sendTouch,
    sendTouchDirect,
    sendScroll,
    sendScrollDirect,
    requestScreenshot,
    onScreenshot,
    sendCommand,
    executeCommand,
    executeCommandP2P,
    createAiCommandChannel,
    createUiLayoutChannel,
    requestLayoutSnapshot,
    layoutDisplayRevision,
    onCommandResult,
    sendInjectData,
    createAdbSessionChannel,
    getVideoStats,
    resetStats,
    setAudioMuted,
    toggleAudioMuted,
    onClipboard,
    setClipboard,
    getClipboard,
    sendInjectText,
    sendInjectKeycode,
    fileChannelReady,
    onFileChannelMessage,
    sendFileChannelCmd,
    sendFileChannelChunk,
    getFileChannelBufferedAmount
  }

  return webrtcObj
}
