import { ref, onUnmounted } from 'vue'
import { useDeviceStore } from '@/stores/devices'

export function useWebRTC(deviceId) {
  const status = ref('disconnected')
  const error = ref(null)

  let ws = null
  let pc = null
  let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }]
  let inputChannel = null
  let adbChannel = null
  let videoElementGetter = null  // 获取 video 元素的函数
  const DEVICE_W = ref(1080)
  const DEVICE_H = ref(1920)

  function connect() {
    status.value = 'connecting'
    error.value = null

    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    // 如果在开发模式（端口 3000），使用当前 host，依靠 Vite 代理
    const wsUrl = `${wsProtocol}//${location.host}/connect_client`
    
    console.log('[Signaling] Connecting to:', wsUrl)
    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('[Signaling] WebSocket connected')
      status.value = 'signaling'
      ws.send(JSON.stringify({
        message_type: 'connect',
        device_id: deviceId
      }))
    }

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        console.log('[Signaling] Received:', msg.message_type || msg.type, msg)
        handleMessage(msg)
      } catch (e) {
        console.error('[Signaling] Failed to parse message:', e, evt.data)
      }
    }

    ws.onerror = (e) => {
      error.value = 'WebSocket error'
      status.value = 'error'
      console.error('WebSocket error:', e)
    }

    ws.onclose = () => {
      console.log('[Signaling] WebSocket closed')
      if (status.value !== 'disconnected') {
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
          console.log('[WebRTC] ICE Servers updated from config:', iceServers)
        }
        // 发送 request-offer 请求
        sendForward({ type: 'request-offer' })
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
        error.value = msg.error || 'Server error'
        status.value = 'error'
        break
    }
  }

  function handleDeviceInfo(info) {
    if (info && info.displays && info.displays.length > 0) {
      const display = info.displays[0]
      DEVICE_W.value = display.x_res || 1080
      DEVICE_H.value = display.y_res || 1920
      console.log(`[WebRTC] Device dimensions updated: ${DEVICE_W.value}x${DEVICE_H.value}`)
    }
  }
function handleDeviceMessage(payload) {
  if (!payload || !payload.type) return

  switch (payload.type) {
    case 'offer':
      console.log('[WebRTC] Received offer, length:', payload.sdp.length)
      createPeerConnection()
      pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: payload.sdp
      }))
        .then(() => pc.createAnswer())
        .then(answer => {
          // 重新启用 SDP Munging：这次使用正确的单位 (bps)
          let sdp = answer.sdp;
          // 1. 设置带宽 AS (kbps) 为 20000 = 20Mbps
          sdp = sdp.replace(/m=video (.*)\r\n/g, `m=video $1\r\nb=AS:20000\r\n`);
          // 2. 针对常见 H.264 profile 设置 google 特有参数 (bps) 20000000 = 20Mbps
          sdp = sdp.replace(/a=fmtp:(102|96) (.*)\r\n/g, `a=fmtp:$1 $2;x-google-start-bitrate=20000000;x-google-max-bitrate=20000000\r\n`);

          const newAnswer = new RTCSessionDescription({
            type: 'answer',
            sdp: sdp
          });
          console.log('[WebRTC] Answer SDP munged to 20Mbps (bps)');
          return pc.setLocalDescription(newAnswer);
        })
        .then(() => {
          // 等待 ICE 收集完成
          if (pc.iceGatheringState === 'complete') {
            sendAnswer()
          } else {
              const checkIce = () => {
                if (pc.iceGatheringState === 'complete') {
                  pc.removeEventListener('icegatheringstatechange', checkIce)
                  sendAnswer()
                }
              }
              pc.addEventListener('icegatheringstatechange', checkIce)
              // 设置超时，防止等待过久
              setTimeout(() => {
                pc.removeEventListener('icegatheringstatechange', checkIce)
                if (status.value === 'connecting_webrtc') {
                  sendAnswer()
                }
              }, 2000)
            }
            status.value = 'connecting_webrtc'
          })
          .catch(e => {
            error.value = 'SDP error: ' + e.message
            console.error('SDP error:', e)
          })
        break

      case 'ice-candidate':
        if (pc && payload.candidate) {
          console.log('[WebRTC] Received remote ICE candidate')
          pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
            .catch(e => console.warn('ICE error:', e))
        }
        break

      case 'command_result':
        handleCommandResult(payload)
        break
    }
  }

  function sendCommand(command) {
    const requestId = Math.random().toString(36).substring(7)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        message_type: 'command',
        device_id: deviceId,
        request_id: requestId,
        command: command
      }))
    }
    return requestId
  }

  let commandCallback = null
  function onCommandResult(callback) {
    commandCallback = callback
  }

  function handleCommandResult(result) {
    if (commandCallback) {
      commandCallback(result)
    }
  }

  function sendAnswer() {
    if (!pc || !pc.localDescription) return
    console.log('[WebRTC] Sending answer')
    sendForward({
      type: 'answer',
      sdp: pc.localDescription.sdp
    })
  }

  function createPeerConnection() {
    if (pc) return

    console.log('[WebRTC] Creating RTCPeerConnection with servers:', iceServers)
    pc = new RTCPeerConnection({
      iceServers: iceServers
    })

    // 创建 ADB 通道 (主动创建)
    adbChannel = pc.createDataChannel('adb-channel', { ordered: true })
    adbChannel.binaryType = 'arraybuffer' // 必须设置为 arraybuffer 以支持二进制流
    setupAdbChannel(adbChannel)

    pc.ontrack = (evt) => {
      console.log('[WebRTC] ontrack event:', evt.track.kind, evt.streams)
      const video = videoElementGetter ? videoElementGetter() : null
      if (video) {
        if (evt.streams && evt.streams[0]) {
          video.srcObject = evt.streams[0]
        } else {
          const stream = new MediaStream()
          stream.addTrack(evt.track)
          video.srcObject = stream
        }
        console.log('[WebRTC] Set srcObject to video element')
        // 强制播放
        video.play().catch(e => console.warn('[WebRTC] play() failed:', e))
      } else {
        console.error('[WebRTC] videoElement is null!')
      }
    }

    pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        sendForward({
          type: 'ice-candidate',
          candidate: {
            candidate: evt.candidate.candidate,
            sdpMid: evt.candidate.sdpMid,
            sdpMLineIndex: evt.candidate.sdpMLineIndex
          }
        })
      }
    }

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE Connection State:', pc.iceConnectionState)
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        status.value = 'connected'
      } else if (pc.iceConnectionState === 'failed') {
        error.value = 'ICE connection failed'
        status.value = 'error'
      }
    }

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection State:', pc.connectionState)
      if (pc.connectionState === 'connected') {
        status.value = 'connected'
      } else if (pc.connectionState === 'failed') {
        error.value = 'WebRTC connection failed'
        status.value = 'error'
      } else if (pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
        status.value = 'disconnected'
      }
    }

    pc.ondatachannel = (evt) => {
      console.log('[WebRTC] Received DataChannel:', evt.channel.label)
      if (evt.channel.label === 'input-channel') {
        inputChannel = evt.channel
        inputChannel.onopen = () => {
          console.log('[DataChannel] input-channel OPEN')
        }
        inputChannel.onclose = () => {
          console.log('[DataChannel] input-channel CLOSED')
        }
        inputChannel.onerror = (e) => console.error('[DataChannel] Error:', e)
      }
    }
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
    if (!inputChannel || inputChannel.readyState !== 'open') return
    const video = videoElementGetter ? videoElementGetter() : null
    if (!video || !video.videoWidth || !video.videoHeight) return

    const videoW = video.videoWidth
    const videoH = video.videoHeight
    const isVideoLandscape = videoW > videoH
    const targetW = isVideoLandscape ? DEVICE_H.value : DEVICE_W.value
    const targetH = isVideoLandscape ? DEVICE_W.value : DEVICE_H.value

    let finalX, finalY

    // 如果提供了预计算的旋转坐标，直接使用
    if (rotatedCoord && rotatedCoord.isRotated) {
      // rotatedCoord.x/y 是相对于原始视频尺寸的坐标
      // 映射到设备分辨率
      const x = Math.round(rotatedCoord.x / videoW * targetW)
      const y = Math.round(rotatedCoord.y / videoH * targetH)
      finalX = Math.max(0, Math.min(targetW, x))
      finalY = Math.max(0, Math.min(targetH, y))
    } else {
      // 正常计算
      const rect = video.getBoundingClientRect()
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

      // 映射到设备分辨率
      const x = Math.round(relativeX / actualW * targetW)
      const y = Math.round(relativeY / actualH * targetH)

      // 越界检查
      finalX = Math.max(0, Math.min(targetW, x))
      finalY = Math.max(0, Math.min(targetH, y))
    }

    const msg = JSON.stringify({
      type: 'touch',
      id,
      action,
      x: finalX,
      y: finalY,
      w: targetW,
      h: targetH
    })

    inputChannel.send(msg)
  }

  function requestScreenshot() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        message_type: 'screenshot_request',
        device_id: deviceId
      }))
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

  function setupAdbChannel(channel) {
    channel.onopen = () => {
      console.log('[ADB] DataChannel OPEN')
    }
    channel.onmessage = (evt) => {
      // console.log('[ADB] DataChannel Message Received:', evt.data.byteLength, 'bytes')
      if (adbDataCallback) {
        adbDataCallback(evt.data)
      } else {
        console.log('[ADB] Buffering data packet:', evt.data.byteLength, 'bytes')
        adbDataBuffer.push(evt.data)
      }
    }
    channel.onclose = () => {
      console.log('[ADB] DataChannel CLOSED')
    }
    channel.onerror = (e) => console.error('[ADB] DataChannel Error:', e)
  }

  let adbDataCallback = null
  let adbDataBuffer = [] // 数据缓冲区

  function onAdbData(callback) {
    adbDataCallback = callback
    if (!callback) {
      adbDataBuffer = [] // 如果清空回调，也清空缓冲区
      return
    }
    // 立即处理缓冲中的数据
    if (adbDataBuffer.length > 0) {
      console.log(`[ADB] Flushing ${adbDataBuffer.length} buffered packets`)
      adbDataBuffer.forEach(data => callback(data))
      adbDataBuffer = []
    }
  }

  function sendAdbData(data) {
    if (adbChannel && adbChannel.readyState === 'open') {
      // 严格检查并确保发送二进制数据
      if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
        adbChannel.send(data)
      } else if (data && data.buffer instanceof ArrayBuffer) {
        // 自动提取底层 ArrayBuffer
        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
        adbChannel.send(buffer)
      } else {
        console.error('[ADB] Fatal: sendAdbData received non-binary object, blocking send:', data)
      }
    }
  }

  function disconnect() {
    if (pc) {
      pc.close()
      pc = null
    }
    if (ws) {
      ws.close()
      ws = null
    }
    status.value = 'disconnected'
  }

  onUnmounted(() => {
    disconnect()
  })

  // 设置获取视频元素的函数 (由组件调用)
  function setVideoGetter(getter) {
    videoElementGetter = getter
  }

  return {
    status,
    error,
    setVideoGetter,
    connect,
    disconnect,
    sendTouch,
    requestScreenshot,
    onScreenshot,
    sendCommand,
    onCommandResult,
    onAdbData,
    sendAdbData
  }
}
